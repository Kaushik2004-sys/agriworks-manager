# Phase 3: Farmer CRUD API (requires login).
# Search: GET /api/farmers/?search=name/mobile/village
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Farmer
from .serializers import FarmerSerializer


class FarmerViewSet(viewsets.ModelViewSet):
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Each user sees only their own farmers (User -> Farmer)
        qs = Farmer.objects.filter(user=self.request.user)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(mobile__icontains=search)
                | Q(village__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
