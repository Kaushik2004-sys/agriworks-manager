from django.contrib import admin
from .models import Farmer


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'mobile', 'village', 'user')
    search_fields = ('name', 'mobile', 'village')
