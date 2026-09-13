# Phase 7: Expense serializer with validation.
from datetime import date
from decimal import Decimal
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
        if value is None or Decimal(value) <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value

    def validate_date(self, value):
        if value > date.today():
            raise serializers.ValidationError('Date cannot be in the future.')
        return value
