from django.contrib import admin
from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('id', 'expense_type', 'amount', 'date', 'user')
    list_filter = ('expense_type', 'date')
    search_fields = ('description',)
