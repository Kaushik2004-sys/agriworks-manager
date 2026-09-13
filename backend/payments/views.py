# Phase 6: Payment CRUD API (requires login).
# Filters: ?bill=<id>, ?search=farmer name/bill id.
from decimal import Decimal
from django.db.models import Q, Sum
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Payment
from .serializers import PaymentSerializer


def update_bill_status(bill):
    """Recalculate Paid/Partial/Unpaid from total vs sum(payments)."""
    paid = bill.payments.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    if paid <= 0:
        bill.status = 'Unpaid'
    elif paid >= bill.total_amount:
        bill.status = 'Paid'
    else:
        bill.status = 'Partial'
    bill.save(update_fields=['status', 'updated_at'])


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Payment.objects.select_related('bill', 'bill__farmer').filter(user=self.request.user)
        bill_id = (self.request.query_params.get('bill') or '').strip()
        if bill_id.isdigit():
            qs = qs.filter(bill_id=int(bill_id))
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(bill__farmer__name__icontains=search)
                | Q(method__icontains=search)
            )
            if search.isdigit():
                qs = qs | Payment.objects.filter(user=self.request.user, bill_id=int(search))
        return qs

    def perform_create(self, serializer):
        payment = serializer.save(user=self.request.user)
        update_bill_status(payment.bill)

    def perform_update(self, serializer):
        old_bill = serializer.instance.bill
        payment = serializer.save()
        # Bill can be reassigned on update: refresh the old bill too,
        # otherwise it keeps a stale Paid/Partial status.
        if old_bill.id != payment.bill.id:
            old_bill.refresh_from_db()
            update_bill_status(old_bill)
        update_bill_status(payment.bill)

    def perform_destroy(self, instance):
        bill = instance.bill
        instance.delete()
        update_bill_status(bill)
