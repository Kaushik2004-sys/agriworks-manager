from django.contrib import admin
from .models import LoginHistory, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'full_name', 'company_name', 'mobile')
    search_fields = ('full_name', 'company_name', 'mobile',
                     'user__username', 'user__email')


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'ip_address', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('user', 'status', 'ip_address', 'user_agent',
                       'created_at')
