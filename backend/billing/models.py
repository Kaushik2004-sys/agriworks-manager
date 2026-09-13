# Phase 5: Billing model.
# Chain: Farmer -> Work -> Bill -> Payment (Phase 6).
# One bill per work record (OneToOne) keeps totals simple for B.Sc. project.
from django.conf import settings
from django.db import models
from django.db.models import Sum


class Bill(models.Model):
    STATUS_CHOICES = [
        ('Unpaid', 'Unpaid'),
        ('Partial', 'Partial'),
        ('Paid', 'Paid'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bills',
    )
    farmer = models.ForeignKey(
        'farmers.Farmer',
        on_delete=models.CASCADE,
        related_name='bills',
    )
    work = models.OneToOneField(
        'works.Work',
        on_delete=models.CASCADE,
        related_name='bill',
        help_text='Work record this bill is generated from.',
    )
    bill_date = models.DateField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Unpaid')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-bill_date', '-id']

    def __str__(self):
        return f'Bill #{self.id} - {self.farmer.name} - Rs {self.total_amount}'

    def get_paid_amount(self):
        """Total received via payments. Returns 0 until Phase 6 payments exist."""
        try:
            result = self.payments.aggregate(total=Sum('amount'))['total']
            return result or 0
        except Exception:
            return 0

    def get_pending_amount(self):
        return self.total_amount - self.get_paid_amount()
