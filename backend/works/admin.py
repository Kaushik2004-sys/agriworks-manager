from django.contrib import admin
from .models import Work


@admin.register(Work)
class WorkAdmin(admin.ModelAdmin):
    list_display = ('id', 'farmer', 'work_type', 'work_date', 'area', 'amount', 'user')
    list_filter = ('work_type', 'work_date')
    search_fields = ('farmer__name', 'work_type')
