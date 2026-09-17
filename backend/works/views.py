# Phase 4: Work CRUD API (requires login).
# Filters: ?search=work_type/farmer name, ?farmer=<id>, ?work_type=<type>
# Phase 5: ?unbilled=true returns only works without a bill.
from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Work
from .serializers import WorkSerializer


class WorkViewSet(viewsets.ModelViewSet):
    serializer_class = WorkSerializer
    permission_classes = [IsAuthenticated]
    # Saved work records are locked (source of truth for billing):
    # no PUT/PATCH routes exist, so updates are rejected with 405
    # even for direct API calls. Corrections use new records.
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        # P9: a malformed farmer id must fail loudly instead of silently
        # returning every record. Empty stays "no filter" as before.
        farmer_id = (request.query_params.get('farmer') or '').strip()
        if farmer_id and not farmer_id.isdigit():
            return Response({'error': 'Invalid farmer filter.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # P5: prefetch the reverse one-to-one bill so the serializer's
        # is_billed/bill_id flags cost no extra query per row.
        qs = Work.objects.select_related('farmer').prefetch_related(
            'bill').filter(user=self.request.user)
        farmer_id = (self.request.query_params.get('farmer') or '').strip()
        if farmer_id.isdigit():
            qs = qs.filter(farmer_id=int(farmer_id))
        work_type = (self.request.query_params.get('work_type') or '').strip()
        if work_type:
            qs = qs.filter(work_type=work_type)
        # Phase 5: only works that have no bill yet (for bill generation dropdown)
        unbilled = (self.request.query_params.get('unbilled') or '').strip().lower()
        if unbilled in ('true', '1'):
            qs = qs.filter(bill__isnull=True)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(work_type__icontains=search)
                | Q(farmer__name__icontains=search)
                | Q(farmer__village__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        # P2: the UniqueConstraint above decides any concurrent duplicate
        # race - convert it to the same friendly 400 as the app-level
        # check instead of letting an IntegrityError become HTTP 500.
        from django.db import IntegrityError, transaction
        from rest_framework import serializers as _serializers
        try:
            with transaction.atomic():
                serializer.save(user=self.request.user)
        except IntegrityError:
            raise _serializers.ValidationError({
                'work_date': 'A work entry for this work type already exists on this date.'})

    def perform_destroy(self, instance):
        # Delete guard (no model/schema change): a work with a generated
        # bill is the source of truth for that bill and its payments, so
        # deleting it would cascade-delete finalized records. Reject with
        # 400 and keep work, bill and payments untouched.
        if hasattr(instance, 'bill'):
            raise serializers.ValidationError(
                'Cannot delete this work because a bill has already '
                'been generated for it.')
        instance.delete()
