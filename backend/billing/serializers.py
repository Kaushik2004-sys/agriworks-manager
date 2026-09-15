# Phase 5: Bill serializer with validation + computed amounts.
from datetime import date
from decimal import Decimal
from rest_framework import serializers
from works.models import Work
from .models import Bill


class BillSerializer(serializers.ModelSerializer):
    # Readable details for frontend display
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_mobile = serializers.CharField(source='farmer.mobile', read_only=True)
    farmer_village = serializers.CharField(source='farmer.village', read_only=True)
    work_type = serializers.CharField(source='work.work_type', read_only=True)
    work_date = serializers.DateField(source='work.work_date', read_only=True)
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_mobile', 'farmer_village',
            'work', 'work_type', 'work_date',
            'bill_date', 'total_amount', 'paid_amount', 'pending_amount',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']
        extra_kwargs = {
            # Farmer auto-filled from work in perform_create, so not required on input.
            'farmer': {'required': False},
            # Bill date defaults to the work date if not given.
            'bill_date': {'required': False},
            # Total defaults to work.amount if not given.
            'total_amount': {'required': False},
        }

    def get_paid_amount(self, obj):
        return str(obj.get_paid_amount())

    def get_pending_amount(self, obj):
        return str(obj.get_pending_amount())

    def validate_work(self, value):
        request = self.context.get('request')
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError('Selected work does not belong to you.')
        # One bill per work: block duplicates (allow same work on update)
        qs = Bill.objects.filter(work=value)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError('Bill already exists for this work record.')
        return value

    def validate_bill_date(self, value):
        if value > date.today():
            raise serializers.ValidationError('Bill date cannot be in the future.')
        return value

    def validate_total_amount(self, value):
        if value is None or Decimal(value) <= 0:
            raise serializers.ValidationError('Total amount must be greater than 0.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        work = attrs.get('work') or getattr(self.instance, 'work', None)
        farmer = attrs.get('farmer') or getattr(self.instance, 'farmer', None)

        if work and request:
            # Work must exist for this user
            if not Work.objects.filter(id=work.id, user=request.user).exists():
                raise serializers.ValidationError({'work': 'Invalid work selected.'})
            # Farmer must match work's farmer (keeps Farmer->Work->Bill chain correct)
            if farmer and farmer.id != work.farmer_id:
                raise serializers.ValidationError(
                    {'farmer': 'Farmer must match the work record farmer.'}
                )
            if farmer and farmer.user_id != request.user.id:
                raise serializers.ValidationError({'farmer': 'Selected farmer does not belong to you.'})

        # Bill date follows the work date (source of truth) on create and update.
        # A sent date that differs is rejected, so API tampering cannot create
        # a bill inconsistent with its work record. Omitting the date on create
        # still defaults to the work date (normal UI flow). The work record
        # itself is never modified here.
        if work is not None:
            if attrs.get('bill_date') is not None:
                if attrs['bill_date'] != work.work_date:
                    raise serializers.ValidationError(
                        {'bill_date': 'Bill date must match the work date.'})
            elif self.instance is None:
                attrs['bill_date'] = work.work_date
        # Create: the billed amount is locked to the work amount at generation.
        # The work amount is the source of truth; an explicitly sent amount
        # that differs from it is rejected, so API tampering cannot create
        # a bill inconsistent with its work record. Omitting the amount
        # still defaults to the work amount (normal UI flow).
        if self.instance is None and work is not None:
            if attrs.get('total_amount') is not None:
                if Decimal(attrs['total_amount']) != Decimal(work.amount):
                    raise serializers.ValidationError(
                        {'total_amount': 'Billed amount must match the work amount.'})
            else:
                attrs['total_amount'] = work.amount
        # Total must be positive however it was provided (explicit or defaulted).
        if attrs.get('total_amount') is not None and Decimal(attrs['total_amount']) <= 0:
            raise serializers.ValidationError(
                {'total_amount': 'Total amount must be greater than 0.'})
        # Lock: once a bill is generated its total is frozen. Any API attempt
        # to change total_amount on update is rejected, so frontend hiding
        # alone is never the only protection. Same-value resubmits (normal
        # full-object PUTs) remain allowed.
        if self.instance is not None and attrs.get('total_amount') is not None:
            if Decimal(attrs['total_amount']) != self.instance.total_amount:
                raise serializers.ValidationError(
                    {'total_amount': 'Generated bill amount cannot be changed.'})
        # Never allow lowering the total below what is already paid
        # (prevents negative pending amounts and wrong Paid status).
        if self.instance is not None and attrs.get('total_amount') is not None:
            paid = self.instance.get_paid_amount()
            if Decimal(attrs['total_amount']) < Decimal(paid):
                raise serializers.ValidationError(
                    {'total_amount': 'Total amount cannot be less than the paid amount.'})
        return attrs
