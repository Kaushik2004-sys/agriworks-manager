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
        # Simple Indian mobile rule: 10 digits, numeric only
        if not re.fullmatch(r'\d{10}', value):
            raise serializers.ValidationError('Mobile number must be 10 digits.')
        return value

    def validate_village(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Village is required.')
        return value
