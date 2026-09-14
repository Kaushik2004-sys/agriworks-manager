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
            'field_location', 'remark', 'work_description',
            'irrigation_hours', 'irrigation_minutes', 'hourly_rate', 'rate_per_acre',
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
        if value is None:
            return value
        if Decimal(value) <= 0:
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
        # Field / Location is required for new/updated records (pre-existing
        # rows with NULL keep working because updates always send the field).
        loc = attrs.get('field_location')
        if self.instance is not None and 'field_location' not in attrs:
            loc = getattr(self.instance, 'field_location', None)
        if loc is None or not str(loc).strip():
            raise serializers.ValidationError(
                {'field_location': 'Field / Location is required.'})
        attrs['field_location'] = str(loc).strip()
        # Remark is optional; normalize empty/whitespace to None.
        if attrs.get('remark') is None or not str(attrs.get('remark')).strip():
            attrs['remark'] = None
        # Irrigation time-based billing: validate + recompute amount server-side
        # so the stored/billed total is always (hours + minutes/60) x rate.
        work_type = attrs.get('work_type') or getattr(self.instance, 'work_type', None)
        if work_type == 'Irrigation':
            # Acre is optional for Irrigation (time-based); normalize empty to None.
            if attrs.get('area') in (None, ''):
                attrs['area'] = None
            hours = attrs.get('irrigation_hours')
            minutes = attrs.get('irrigation_minutes')
            rate = attrs.get('hourly_rate')
            errors = {}
            if hours is None:
                errors['irrigation_hours'] = 'Hours must be 0 or more.'
            elif isinstance(hours, bool) or not isinstance(hours, int) or hours < 0:
                errors['irrigation_hours'] = 'Hours must be 0 or more.'
            if minutes is None:
                errors['irrigation_minutes'] = 'Minutes must be between 0 and 59.'
            elif isinstance(minutes, bool) or not isinstance(minutes, int) or minutes < 0 or minutes > 59:
                errors['irrigation_minutes'] = 'Minutes must be between 0 and 59.'
            if rate is None:
                errors['hourly_rate'] = 'Rate per Hour must be 0 or more.'
            elif Decimal(rate) < 0:
                errors['hourly_rate'] = 'Rate per Hour must be 0 or more.'
            if errors:
                raise serializers.ValidationError(errors)
            from decimal import ROUND_HALF_UP
            total = (Decimal(hours) + Decimal(minutes) / Decimal(60)) * Decimal(rate)
            attrs['amount'] = total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            attrs['rate_per_acre'] = None
            attrs['work_description'] = None
        elif work_type == 'Land Leveling':
            # Land Leveling: Total = Area x Rate per Acre, computed server-side.
            area = attrs.get('area')
            rate = attrs.get('rate_per_acre')
            errors = {}
            if area in (None, ''):
                errors['area'] = 'Area must be greater than 0.'
            elif Decimal(area) <= 0:
                errors['area'] = 'Area must be greater than 0.'
            if rate in (None, ''):
                errors['rate_per_acre'] = 'Rate per Acre must be 0 or more.'
            elif Decimal(rate) < 0:
                errors['rate_per_acre'] = 'Rate per Acre must be 0 or more.'
            if errors:
                raise serializers.ValidationError(errors)
            from decimal import ROUND_HALF_UP
            attrs['amount'] = (Decimal(area) * Decimal(rate)).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP)
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
            attrs['work_description'] = None
        elif work_type in ('Ploughing', 'Rotavator', 'Cultivation', 'Harvesting'):
            # Area-based types: Total = Area x Rate per Acre, computed server-side.
            area = attrs.get('area')
            rate = attrs.get('rate_per_acre')
            errors = {}
            if area in (None, ''):
                errors['area'] = 'Area must be greater than 0.'
            elif Decimal(area) <= 0:
                errors['area'] = 'Area must be greater than 0.'
            if rate in (None, ''):
                errors['rate_per_acre'] = 'Rate per Acre must be 0 or more.'
            elif Decimal(rate) < 0:
                errors['rate_per_acre'] = 'Rate per Acre must be 0 or more.'
            if errors:
                raise serializers.ValidationError(errors)
            from decimal import ROUND_HALF_UP
            attrs['amount'] = (Decimal(area) * Decimal(rate)).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP)
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
            attrs['work_description'] = None
        else:
            # 'Other': manual Total Amount (required, unchanged); Work Description required.
            # Acre is OPTIONAL for Other: blank accepted, entered values must be > 0.
            if attrs.get('area') in (None, ''):
                attrs['area'] = None
            desc = attrs.get('work_description')
            if desc is None or not str(desc).strip():
                raise serializers.ValidationError(
                    {'work_description': 'Work Description is required.'})
            attrs['work_description'] = str(desc).strip()
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
            attrs['rate_per_acre'] = None
        return attrs
