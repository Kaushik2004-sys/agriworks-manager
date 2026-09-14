# Problem report API: users submit; admin (is_superuser) manages.
# AgriWorks has only two levels: normal user and admin (is_superuser).
# A user with is_staff=true but is_superuser=false is a NORMAL user here.
# - POST: any authenticated user (forced to status Pending, own account).
# - GET: admin sees all reports; normal users see only their own.
# - PATCH/PUT/DELETE: admin only.
from rest_framework import viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated
from .models import ProblemReport
from .serializers import ProblemReportSerializer


class IsSuperUser(BasePermission):
    """AgriWorks admin = Django is_superuser (not is_staff)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.is_superuser)


class ProblemReportViewSet(viewsets.ModelViewSet):
    serializer_class = ProblemReportSerializer
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = ProblemReport.objects.select_related('user').all()
        if self.request.user.is_superuser:
            return qs
        return qs.filter(user=self.request.user)

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsSuperUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='Pending')
