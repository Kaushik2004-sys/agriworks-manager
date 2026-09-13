# Phase 7: Expense model.
# Each expense belongs to a user (User -> Expense).
from django.conf import settings
from django.db import models


class Expense(models.Model):
    EXPENSE_TYPES = [
        ('Diesel', 'Diesel'),
        ('Maintenance', 'Vehicle maintenance'),
        ('Driver Wages', 'Driver wages'),
        ('Other', 'Other operational expenses'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='expenses',
    )
    expense_type = models.CharField(max_length=20, choices=EXPENSE_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.expense_type} Rs {self.amount} on {self.date}'
