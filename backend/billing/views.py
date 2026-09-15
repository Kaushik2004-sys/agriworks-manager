# Phase 5: Bill CRUD API (requires login).
# Generated bills are finalized records: no PUT/PATCH routes exist, so any
# update attempt is rejected with 405 even for direct API calls.
# Filters: ?search=farmer name/mobile/village, ?status=Unpaid/Partial/Paid, ?farmer=<id>
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Bill
from .serializers import BillSerializer


class BillViewSet(viewsets.ModelViewSet):
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Bill.objects.select_related('farmer', 'work').filter(user=self.request.user)
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
        # Auto-fill farmer from work if frontend did not send it
        work = serializer.validated_data.get('work')
        farmer = serializer.validated_data.get('farmer')
        if work and not farmer:
            serializer.save(user=self.request.user, farmer=work.farmer)
        else:
            serializer.save(user=self.request.user)
