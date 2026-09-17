# Phase 6: Payment serializer with remaining-amount rule.
# Rule: payment must not exceed remaining bill amount.
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from billing.models import Bill
from .models import Payment


def bill_pending(bill, exclude_payment_id=None):
    qs = bill.payments.all()
    if exclude_payment_id:
        qs = qs.exclude(id=exclude_payment_id)
    paid = qs.aggregate(total=Sum('amount'))['total'] or Decimal('0')
    return bill.total_amount - paid


class PaymentSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='bill.farmer.name', read_only=True)
    bill_total = serializers.DecimalField(source='bill.total_amount', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'bill', 'farmer_name', 'bill_total',
            'payment_date', 'method', 'amount',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_bill(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Selected bill does not belong to you.')
        return value

    def validate_payment_date(self, value):
        # P8: compare against the Asia/Kolkata local date (see works).
        if value > timezone.localdate():
            raise serializers.ValidationError('Payment date cannot be in the future.')
        return value

    def validate_amount(self, value):
        # Payments accept only positive whole rupees, starting from Rs 1.
        # Decimals, zero and negatives are rejected even on direct API calls.
        try:
            dec = Decimal(value)
        except Exception:
            raise serializers.ValidationError(
                'Payment amount must be a whole number of at least Rs 1.')
        if not dec.is_finite() or dec < 1 or dec != dec.to_integral_value():
            raise serializers.ValidationError(
                'Payment amount must be a whole number of at least Rs 1.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        bill = attrs.get('bill') or getattr(self.instance, 'bill', None)
        amount = attrs.get('amount') or getattr(self.instance, 'amount', None)

        if bill and request:
            if not Bill.objects.filter(id=bill.id, user=request.user).exists():
                raise serializers.ValidationError({'bill': 'Invalid bill selected.'})
            # Remaining check (exclude current payment on update)
            exclude_id = self.instance.id if self.instance else None
            # Refresh bill from DB to get latest total
            bill = Bill.objects.get(id=bill.id)
            pending = bill_pending(bill, exclude_payment_id=exclude_id)
            if amount and Decimal(amount) > pending:
                raise serializers.ValidationError({
                    'amount': f'Payment Rs {amount} exceeds remaining Rs {pending}.'
                })
            # Payment date should not be before bill date
            pay_date = attrs.get('payment_date') or getattr(self.instance, 'payment_date', None)
            if pay_date and pay_date < bill.bill_date:
                raise serializers.ValidationError({
                    'payment_date': 'Payment date cannot be before bill date.'
                })
        return attrs
