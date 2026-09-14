# Problem report API routes using DRF router.
from rest_framework.routers import DefaultRouter
from .views import ProblemReportViewSet

router = DefaultRouter()
router.register(r'problem-reports', ProblemReportViewSet, basename='problem-report')

urlpatterns = router.urls
