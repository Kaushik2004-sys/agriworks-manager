# Phase 6: Payment CRUD API (requires login).
# Filters: ?bill=<id>, ?search=farmer name/bill id.
from decimal import Decimal
from django.db.models import Q, Sum
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Payment
from .serializers import PaymentSerializer, bill_pending


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
    # Saved payment records are locked: no PUT/PATCH routes exist, so updates
    # are rejected with 405 even for direct API calls. Corrections use a new
    # payment record. Deleting still refreshes the bill status below.
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        # P9: malformed bill id fails loudly instead of listing everything.
        bill_id = (request.query_params.get('bill') or '').strip()
        if bill_id and not bill_id.isdigit():
            return Response({'error': 'Invalid bill filter.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

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
        # P1: lock the bill row so concurrent payments serialize. The
        # serializer already checked the remaining amount, but that read
        # can go stale between validation and save - re-check under the
        # lock and reject overpayment with the same 400 shape. No model
        # or schema change; status update stays in the same transaction.
        from decimal import Decimal as _Decimal

        from django.db import transaction
        from rest_framework import serializers as _serializers

        from billing.models import Bill
        bill = serializer.validated_data.get('bill')
        try:
            with transaction.atomic():
                locked_bill = Bill.objects.select_for_update().get(
                    id=bill.id, user=self.request.user)
                pending = bill_pending(
                    locked_bill,
                    exclude_payment_id=None)
                amount = serializer.validated_data.get('amount')
                if amount is not None and _Decimal(amount) > pending:
                    raise _serializers.ValidationError({
                        'amount': f'Payment Rs {amount} exceeds remaining '
                                  f'Rs {pending}.'
                    })
                payment = serializer.save(user=self.request.user)
                update_bill_status(locked_bill)
        except Bill.DoesNotExist:
            raise _serializers.ValidationError(
                {'bill': 'Invalid bill selected.'})
        return payment

    def perform_destroy(self, instance):
        # Same bill-row locking as creation so a concurrent create cannot
        # interleave between the delete and the status refresh.
        from django.db import transaction

        from billing.models import Bill
        with transaction.atomic():
            locked_bill = Bill.objects.select_for_update().get(
                id=instance.bill_id, user=self.request.user)
            instance.delete()
            update_bill_status(locked_bill)
