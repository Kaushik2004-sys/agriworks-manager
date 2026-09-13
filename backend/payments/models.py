# Phase 6: Payment model.
# Chain: Bill -> Payment. Each payment reduces the bill pending amount.
from django.conf import settings
from django.db import models


class Payment(models.Model):
    METHOD_CHOICES = [
        ('Cash', 'Cash'),
        ('UPI', 'UPI'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Cheque', 'Cheque'),
        ('Other', 'Other'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    bill = models.ForeignKey(
        'billing.Bill',
        on_delete=models.CASCADE,
        related_name='payments',
        help_text='Bill this payment is received against.',
    )
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='Cash')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date', '-id']

    def __str__(self):
        return f'Rs {self.amount} for Bill #{self.bill_id} ({self.method})'
