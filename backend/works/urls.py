# Phase 4: Work API routes using DRF router.
from rest_framework.routers import DefaultRouter
from .views import WorkViewSet

router = DefaultRouter()
router.register(r'works', WorkViewSet, basename='work')

urlpatterns = router.urls
