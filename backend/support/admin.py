# Problem reports in Django admin (staff only, like the rest of admin).
from django.contrib import admin
from .models import ProblemReport


@admin.register(ProblemReport)
class ProblemReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'email', 'problem_type', 'status', 'created_at')
    list_filter = ('status', 'problem_type')
    search_fields = ('name', 'email', 'description')
    readonly_fields = ('created_at', 'updated_at')
