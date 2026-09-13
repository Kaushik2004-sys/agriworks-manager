# Auth update: account routes (register + password reset + profile).
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='api-register'),
    path('password-reset/request/', views.password_reset_request_view,
         name='api-password-reset-request'),
    path('password-reset/confirm/', views.password_reset_confirm_view,
         name='api-password-reset-confirm'),
    path('profile/', views.profile_view, name='api-profile'),
    path('change-password/', views.change_password_view,
         name='api-change-password'),
]
