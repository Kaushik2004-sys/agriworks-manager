# Phase 4: Work serializer with validation.
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from rest_framework import serializers
from farmers.models import Farmer
from .models import Work

RATE_PER_ACRE_ERROR = 'Rate per Acre must be a whole number of at least Rs 1.'
RATE_PER_HOUR_ERROR = 'Rate per Hour must be a whole number of at least Rs 1.'


def validate_whole_rate_per_acre(value):
    """Rate per Acre accepts whole rupees only, minimum Rs 1.

    Rejects 0, negatives, and decimals (e.g. 1000.50) even on direct
    API calls. Values like '5000.00' pass because they are whole.
    """
    try:
        dec = Decimal(value)
    except Exception:
        raise serializers.ValidationError(RATE_PER_ACRE_ERROR)
    if not dec.is_finite() or dec < 1 or dec != dec.to_integral_value():
        raise serializers.ValidationError(RATE_PER_ACRE_ERROR)
    return value


def validate_whole_rate_per_hour(value):
    """Rate per Hour accepts whole rupees only, minimum Rs 1.

    Rejects 0, negatives, decimals (e.g. 500.50) and invalid text
    even on direct API calls. Values like '1000.00' pass as whole.
    """
    try:
        dec = Decimal(value)
    except Exception:
        raise serializers.ValidationError(RATE_PER_HOUR_ERROR)
    if not dec.is_finite() or dec < 1 or dec != dec.to_integral_value():
        raise serializers.ValidationError(RATE_PER_HOUR_ERROR)
    return value


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
        # P8: project TIME_ZONE is Asia/Kolkata - compare against the local
        # date so "today" stays valid around midnight server time.
        if value > timezone.localdate():
            raise serializers.ValidationError('Work date cannot be in the future.')
        return value

    def validate_area(self, value):
        # Area accepts decimal acres (e.g. 0.5, 1.25); rejects 0,
        # negatives, empty and invalid text. None stays None so
        # Irrigation/Other can leave it empty (stored as NULL).
        if value is None:
            return value
        try:
            dec = Decimal(value)
        except Exception:
            raise serializers.ValidationError('Area must be greater than 0.')
        if not dec.is_finite() or dec <= 0:
            raise serializers.ValidationError('Area must be greater than 0.')
        return value

    def validate_rate_per_acre(self, value):
        # Whole-rupee rates only (minimum Rs 1). None stays None so
        # Irrigation/Other can leave it empty (stored as NULL).
        if value is None:
            return value
        return validate_whole_rate_per_acre(value)

    def validate_hourly_rate(self, value):
        # Whole-rupee rates only (minimum Rs 1). None stays None so
        # non-Irrigation types can leave it empty (stored as NULL).
        if value is None:
            return value
        return validate_whole_rate_per_hour(value)

    def validate_amount(self, value):
        # Every work record must carry a positive amount: all server-side
        # totals (area x rate, irrigation duration x rate, manual Other
        # total) are positive, and billing requires totals above zero.
        # Defensive coercion: malformed input is a 400, never a 500
        # (DRF DecimalField normally rejects it first).
        try:
            dec = Decimal(value)
        except Exception:
            raise serializers.ValidationError('Amount cannot be negative.')
        if value is None or dec <= 0:
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
                errors['hourly_rate'] = RATE_PER_HOUR_ERROR
            else:
                try:
                    validate_whole_rate_per_hour(rate)
                except serializers.ValidationError as exc:
                    errors['hourly_rate'] = exc.detail[0] if hasattr(exc.detail, '__getitem__') else exc.detail
            if errors:
                raise serializers.ValidationError(errors)
            # Zero duration would compute a Rs 0 total, which can never be
            # billed - reject it. Hour/minute range checks above are
            # unchanged, so 0h 30m and 1h 0m stay allowed.
            if hours == 0 and minutes == 0:
                raise serializers.ValidationError({
                    'irrigation_minutes':
                        'Irrigation duration must be greater than zero.'})
            total = (Decimal(hours) + Decimal(minutes) / Decimal(60)) * Decimal(rate)
            attrs['amount'] = total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            attrs['rate_per_acre'] = None
            attrs['work_description'] = None
        elif work_type == 'Land Leveling':
            # Land Leveling: Total = Area x Rate per Acre, computed server-side.
            # Area accepts decimals (> 0); rate accepts whole rupees (>= Rs 1).
            area = attrs.get('area')
            rate = attrs.get('rate_per_acre')
            errors = {}
            if area in (None, ''):
                errors['area'] = 'Area must be greater than 0.'
            else:
                try:
                    if not Decimal(area).is_finite() or Decimal(area) <= 0:
                        errors['area'] = 'Area must be greater than 0.'
                except Exception:
                    errors['area'] = 'Area must be greater than 0.'
            if rate in (None, ''):
                errors['rate_per_acre'] = RATE_PER_ACRE_ERROR
            else:
                try:
                    validate_whole_rate_per_acre(rate)
                except serializers.ValidationError as exc:
                    errors['rate_per_acre'] = exc.detail[0] if hasattr(exc.detail, '__getitem__') else exc.detail
            if errors:
                raise serializers.ValidationError(errors)
            attrs['amount'] = (Decimal(area) * Decimal(rate)).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP)
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
            attrs['work_description'] = None
        elif work_type in ('Ploughing', 'Rotavator', 'Cultivation', 'Harvesting'):
            # Area-based types: Total = Area x Rate per Acre, computed server-side.
            # Area accepts decimals (> 0); rate accepts whole rupees (>= Rs 1).
            area = attrs.get('area')
            rate = attrs.get('rate_per_acre')
            errors = {}
            if area in (None, ''):
                errors['area'] = 'Area must be greater than 0.'
            else:
                try:
                    if not Decimal(area).is_finite() or Decimal(area) <= 0:
                        errors['area'] = 'Area must be greater than 0.'
                except Exception:
                    errors['area'] = 'Area must be greater than 0.'
            if rate in (None, ''):
                errors['rate_per_acre'] = RATE_PER_ACRE_ERROR
            else:
                try:
                    validate_whole_rate_per_acre(rate)
                except serializers.ValidationError as exc:
                    errors['rate_per_acre'] = exc.detail[0] if hasattr(exc.detail, '__getitem__') else exc.detail
            if errors:
                raise serializers.ValidationError(errors)
            attrs['amount'] = (Decimal(area) * Decimal(rate)).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP)
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
            attrs['work_description'] = None
        else:
            # 'Other': manual Total Amount as whole rupees; Work Description required.
            # Acre is OPTIONAL for Other: blank accepted, entered values must be > 0.
            # Rate per Acre is OPTIONAL for Other: blank accepted (stored as NULL),
            # entered values must be whole rupees (>= Rs 1), same rule as other types.
            if attrs.get('area') in (None, ''):
                attrs['area'] = None
            rate = attrs.get('rate_per_acre')
            if rate in (None, ''):
                attrs['rate_per_acre'] = None
            else:
                try:
                    validate_whole_rate_per_acre(rate)
                except serializers.ValidationError as exc:
                    raise serializers.ValidationError({
                        'rate_per_acre': exc.detail[0] if hasattr(exc.detail, '__getitem__') else exc.detail})
            desc = attrs.get('work_description')
            if desc is None or not str(desc).strip():
                raise serializers.ValidationError(
                    {'work_description': 'Work Description is required.'})
            attrs['work_description'] = str(desc).strip()
            # Total Amount for Other is entered manually but billed in whole
            # rupees, so decimals are rejected (e.g. 1500.50) and the stored
            # value is normalized to whole rupees.
            amt = attrs.get('amount')
            if amt in (None, ''):
                raise serializers.ValidationError({
                    'amount': 'Total Amount must be a whole number of at least Rs 1.'})
            try:
                dec_amt = Decimal(amt)
            except Exception:
                raise serializers.ValidationError({
                    'amount': 'Total Amount must be a whole number of at least Rs 1.'})
            if not dec_amt.is_finite() or dec_amt < 1 or dec_amt != dec_amt.to_integral_value():
                raise serializers.ValidationError({
                    'amount': 'Total Amount must be a whole number of at least Rs 1.'})
            attrs['amount'] = dec_amt.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
            attrs['irrigation_hours'] = None
            attrs['irrigation_minutes'] = None
            attrs['hourly_rate'] = None
        # Duplicate prevention (create only): the same user cannot save the
        # same work type twice for the same farmer on the same work date.
        # Same type/date for a different farmer stays allowed. Runs after
        # all existing validations so their errors stay unchanged. Updates
        # stay locked (405), so no exclude-self handling is needed.
        # Application-level check only — no schema change.
        # Compares real date values.
        if self.instance is None and request is not None:
            dup_type = attrs.get('work_type')
            dup_date = attrs.get('work_date')
            if (dup_type and dup_date and farmer and Work.objects.filter(
                    user=request.user, farmer=farmer, work_type=dup_type,
                    work_date=dup_date).exists()):
                raise serializers.ValidationError({
                    'work_date': 'A work entry for this work type already exists on this date.'})
        return attrs
