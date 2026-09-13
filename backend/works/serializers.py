# Phase 4: Work serializer with validation.
from datetime import date
from decimal import Decimal
from rest_framework import serializers
from farmers.models import Farmer
from .models import Work


class WorkSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_village = serializers.CharField(source='farmer.village', read_only=True)
    is_billed = serializers.SerializerMethodField()
    bill_id = serializers.SerializerMethodField()

    class Meta:
        model = Work
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_village',
            'work_type', 'work_date', 'area', 'amount',
            'is_billed', 'bill_id',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_billed(self, obj):
        # True if a Bill exists for this work (Phase 5)
        try:
            return hasattr(obj, 'bill') and obj.bill is not None
        except Exception:
            return False

    def get_bill_id(self, obj):
        try:
            return obj.bill.id if hasattr(obj, 'bill') and obj.bill else None
        except Exception:
            return None

    def validate_farmer(self, value):
        # Ensure farmer belongs to the logged-in user
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Selected farmer does not belong to you.')
        return value

    def validate_work_date(self, value):
        if value > date.today():
            raise serializers.ValidationError('Work date cannot be in the future.')
        return value

    def validate_area(self, value):
        if value is None or Decimal(value) <= 0:
            raise serializers.ValidationError('Area must be greater than 0.')
        return value

    def validate_amount(self, value):
        if value is None or Decimal(value) < 0:
            raise serializers.ValidationError('Amount cannot be negative.')
        return value

    def validate(self, attrs):
        # On update, farmer may not be in attrs; check existing instance too
        farmer = attrs.get('farmer') or getattr(self.instance, 'farmer', None)
        request = self.context.get('request')
        if farmer and request and farmer.user_id != request.user.id:
            raise serializers.ValidationError({'farmer': 'Selected farmer does not belong to you.'})
        # Ensure farmer id exists for this user (extra safety for wrong id)
        if farmer and not Farmer.objects.filter(id=farmer.id, user=request.user).exists():
            raise serializers.ValidationError({'farmer': 'Invalid farmer selected.'})
        return attrs
