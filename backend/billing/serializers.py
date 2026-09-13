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
        if value is None or Decimal(value) < 0:
            raise serializers.ValidationError('Total amount cannot be negative.')
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

        # Default total to work amount if not given
        if work and attrs.get('total_amount') is None:
            attrs['total_amount'] = work.amount
        return attrs
