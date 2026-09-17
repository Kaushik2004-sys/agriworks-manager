# Phase 7: Expense serializer with validation.
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = [
            'id', 'expense_type', 'amount', 'date', 'description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_amount(self, value):
        # Expenses accept only positive whole rupees, starting from Rs 1.
        # Decimals, zero and negatives are rejected even on direct API calls.
        # Values like '2000.00' pass because they are whole.
        try:
            dec = Decimal(value)
        except Exception:
            raise serializers.ValidationError(
                'Amount must be a whole number of at least Rs 1.')
        if not dec.is_finite() or dec < 1 or dec != dec.to_integral_value():
            raise serializers.ValidationError(
                'Amount must be a whole number of at least Rs 1.')
        return value

    def validate_date(self, value):
        # P8: compare against the Asia/Kolkata local date (see works).
        if value > timezone.localdate():
            raise serializers.ValidationError('Date cannot be in the future.')
        return value
