# Phase 5: Bill CRUD API (requires login).
# Generated bills are finalized records: no PUT/PATCH routes exist, so any
# update attempt is rejected with 405 even for direct API calls.
# Filters: ?search=farmer name/mobile/village, ?status=Unpaid/Partial/Paid, ?farmer=<id>
from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Bill
from .serializers import BillSerializer


class BillViewSet(viewsets.ModelViewSet):
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        # P9: same malformed-id rule as works (see WorkViewSet.list).
        farmer_id = (request.query_params.get('farmer') or '').strip()
        if farmer_id and not farmer_id.isdigit():
            return Response({'error': 'Invalid farmer filter.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # P5: annotate paid sums once for the whole page instead of one
        # aggregate query per bill in the serializer (N+1).
        from django.db.models import Sum
        qs = Bill.objects.select_related('farmer', 'work').filter(
            user=self.request.user).annotate(paid_sum=Sum('payments__amount'))
        farmer_id = (self.request.query_params.get('farmer') or '').strip()
        if farmer_id.isdigit():
            qs = qs.filter(farmer_id=int(farmer_id))
        status = (self.request.query_params.get('status') or '').strip()
        if status in ('Unpaid', 'Partial', 'Paid'):
            qs = qs.filter(status=status)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(farmer__name__icontains=search)
                | Q(farmer__mobile__icontains=search)
                | Q(farmer__village__icontains=search)
                | Q(work__work_type__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        # P2: lock the work row so concurrent bill creations serialize -
        # the second waiter re-checks under the lock and gets the same
        # friendly 400 instead of racing the OneToOne constraint to a 500.
        # No model/schema change (the OneToOne constraint already exists).
        from django.db import transaction
        from rest_framework import serializers as _serializers

        from works.models import Work
        work = serializer.validated_data.get('work')
        farmer = serializer.validated_data.get('farmer')
        try:
            with transaction.atomic():
                locked_work = Work.objects.select_for_update().get(
                    id=work.id, user=self.request.user)
                if hasattr(locked_work, 'bill'):
                    raise _serializers.ValidationError({
                        'work': 'Bill already exists for this work record.'})
                if work and not farmer:
                    serializer.save(
                        user=self.request.user, farmer=locked_work.farmer)
                else:
                    serializer.save(user=self.request.user)
        except Work.DoesNotExist:
            raise _serializers.ValidationError(
                {'work': 'Invalid work selected.'})

    def perform_destroy(self, instance):
        # Delete guard (no model/schema change): a bill with received
        # payments is the audit trail for that money. Reject with 400
        # and keep the bill and its payments untouched.
        if instance.payments.exists():
            raise serializers.ValidationError(
                'Cannot delete this bill because payment records exist.')
        instance.delete()
