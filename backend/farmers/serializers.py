# Phase 3: Farmer serializer with validation.
import re
from rest_framework import serializers
from .models import Farmer


class FarmerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farmer
        fields = ['id', 'name', 'mobile', 'village', 'address', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Farmer name is required.')
        return value

    def validate_mobile(self, value):
        value = (value or '').strip()
        # Same Indian mobile rule as Registration: the UI shows a fixed,
        # non-editable +91 prefix, so only the 10-digit number starting
        # with 6/7/8/9 is submitted and stored (no +91 in the database).
        # No model/schema change: Farmer.mobile still holds 10 digits.
        if not re.fullmatch(r'[6-9]\d{9}', value):
            raise serializers.ValidationError('Mobile number must be 10 digits.')
        return value

    def validate_village(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Village is required.')
        return value
