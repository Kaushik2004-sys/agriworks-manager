# Problem report API routes using DRF router.
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ProblemReportViewSet, problem_screenshot_view

router = DefaultRouter()
router.register(r'problem-reports', ProblemReportViewSet, basename='problem-report')

urlpatterns = [
    # P3: authenticated screenshot download (owner or superuser only).
    path('problem-screenshots/<path:filename>', problem_screenshot_view,
         name='api-problem-screenshot'),
] + router.urls
