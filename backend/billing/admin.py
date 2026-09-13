from django.contrib import admin
from .models import Bill


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ('id', 'farmer', 'work', 'bill_date', 'total_amount', 'status', 'user')
    list_filter = ('status', 'bill_date')
    search_fields = ('farmer__name',)
