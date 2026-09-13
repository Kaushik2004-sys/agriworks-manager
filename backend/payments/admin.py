from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'bill', 'payment_date', 'method', 'amount', 'user')
    list_filter = ('method', 'payment_date')
