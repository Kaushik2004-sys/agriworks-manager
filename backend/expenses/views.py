# Phase 7: Expense CRUD API (requires login).
# Filters: ?search=type/description, ?expense_type=Diesel/Maintenance/...
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    # Saved expense records are locked: no PUT/PATCH routes exist, so updates
    # are rejected with 405 even for direct API calls. Corrections use a new
    # expense record. Deleting is unchanged.
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Expense.objects.filter(user=self.request.user)
        expense_type = (self.request.query_params.get('expense_type') or '').strip()
        if expense_type:
            qs = qs.filter(expense_type=expense_type)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(expense_type__icontains=search)
                | Q(description__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
