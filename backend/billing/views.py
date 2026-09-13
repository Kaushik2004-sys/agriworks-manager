# Phase 5: Bill CRUD API (requires login).
# Filters: ?search=farmer name/mobile/village, ?status=Unpaid/Partial/Paid, ?farmer=<id>
from decimal import Decimal
from django.db.models import Q, Sum
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Bill
from .serializers import BillSerializer


def refresh_bill_status(bill):
    """Recalculate Paid/Partial/Unpaid after total_amount is edited.
    (Payment create/update/delete already recalculates on its own side.)"""
    bill.refresh_from_db()
    paid = bill.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    if paid <= 0:
        bill.status = 'Unpaid'
    elif paid >= bill.total_amount:
        bill.status = 'Paid'
    else:
        bill.status = 'Partial'
    bill.save(update_fields=['status', 'updated_at'])


class BillViewSet(viewsets.ModelViewSet):
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

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

    def perform_update(self, serializer):
        bill = serializer.save()
        # Editing total_amount must refresh status (e.g. raising the total
        # on a Paid bill must not leave it showing Paid).
        refresh_bill_status(bill)
