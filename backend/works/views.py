# Phase 4: Work CRUD API (requires login).
# Filters: ?search=work_type/farmer name, ?farmer=<id>, ?work_type=<type>
# Phase 5: ?unbilled=true returns only works without a bill.
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Work
from .serializers import WorkSerializer


class WorkViewSet(viewsets.ModelViewSet):
    serializer_class = WorkSerializer
    permission_classes = [IsAuthenticated]
    # Saved work records are locked (source of truth for billing):
    # no PUT/PATCH routes exist, so updates are rejected with 405
    # even for direct API calls. Corrections use new records.
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Work.objects.select_related('farmer').filter(user=self.request.user)
        farmer_id = (self.request.query_params.get('farmer') or '').strip()
        if farmer_id.isdigit():
            qs = qs.filter(farmer_id=int(farmer_id))
        work_type = (self.request.query_params.get('work_type') or '').strip()
        if work_type:
            qs = qs.filter(work_type=work_type)
        # Phase 5: only works that have no bill yet (for bill generation dropdown)
        unbilled = (self.request.query_params.get('unbilled') or '').strip().lower()
        if unbilled in ('true', '1'):
            qs = qs.filter(bill__isnull=True)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(work_type__icontains=search)
                | Q(farmer__name__icontains=search)
                | Q(farmer__village__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
