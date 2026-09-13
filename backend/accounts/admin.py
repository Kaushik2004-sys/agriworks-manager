from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'full_name', 'company_name', 'mobile')
    search_fields = ('full_name', 'company_name', 'mobile',
                     'user__username', 'user__email')
