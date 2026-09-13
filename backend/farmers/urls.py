# Phase 3: Farmer API routes using DRF router.
from rest_framework.routers import DefaultRouter
from .views import FarmerViewSet

router = DefaultRouter()
router.register(r'farmers', FarmerViewSet, basename='farmer')

urlpatterns = router.urls
