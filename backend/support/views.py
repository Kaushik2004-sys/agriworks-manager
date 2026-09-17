# Problem report API: users submit; admin (is_superuser) manages.
# AgriWorks has only two levels: normal user and admin (is_superuser).
# A user with is_staff=true but is_superuser=false is a NORMAL user here.
# - POST: any authenticated user (forced to status Pending, own account).
# - GET: admin sees all reports; normal users see only their own.
# - PATCH/PUT/DELETE: admin only.
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
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


_SCREENSHOT_CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
}


def _screenshot_missing():
    from rest_framework import status
    from rest_framework.response import Response

    return Response({'error': 'Screenshot not found.'},
                    status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def problem_screenshot_view(request, filename):
    """Serve one problem screenshot to its owner or a superuser only.

    P3: screenshots must not be reachable through a guessable anonymous
    URL. Any failure (bad name, missing file, wrong owner) returns the
    same 404 so file existence is never leaked. Served inline as a
    verified image with nosniff (uploads are magic-byte gated).
    """
    import os

    from django.http import FileResponse

    from .models import ProblemReport

    name = (filename or '').replace('\\', '/')
    if not name or '/' in name or name.startswith('.'):
        return _screenshot_missing()
    if os.path.splitext(name)[1].lower() not in _SCREENSHOT_CONTENT_TYPES:
        return _screenshot_missing()
    try:
        report = ProblemReport.objects.select_related('user').get(
            screenshot='problem_screenshots/' + name)
    except ProblemReport.DoesNotExist:
        return _screenshot_missing()
    user = request.user
    if not (user.is_superuser or report.user_id == user.id):
        return _screenshot_missing()
    field_file = report.screenshot
    if not field_file or not os.path.exists(field_file.path):
        return _screenshot_missing()
    response = FileResponse(
        open(field_file.path, 'rb'),
        content_type=_SCREENSHOT_CONTENT_TYPES[
            os.path.splitext(name)[1].lower()],
    )
    response['X-Content-Type-Options'] = 'nosniff'
    response['Content-Disposition'] = 'inline'
    return response
