# Phase 1 API routes + Phase 2 auth routes + Phase 8 dashboard + Phase 9 reports.
from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='api-health'),
    path('login/', views.login_view, name='api-login'),
    path('auth/google/', views.google_auth_view, name='api-google-auth'),
    path('logout/', views.logout_view, name='api-logout'),
    path('me/', views.me_view, name='api-me'),
    path('dashboard/', views.dashboard_view, name='api-dashboard'),
    path('reports/', views.reports_view, name='api-reports'),
    path('admin/overview/', views.admin_overview_view, name='api-admin-overview'),
    path('admin/login-history/', views.admin_login_history_view, name='api-admin-login-history'),
]
