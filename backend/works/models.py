# Phase 4: Agricultural Work model.
# Every work record belongs to a farmer (Farmer -> Work) and a user.
from django.conf import settings
from django.db import models


class Work(models.Model):
    WORK_TYPES = [
        ('Ploughing', 'Ploughing'),
        ('Rotavator', 'Rotavator work'),
        ('Cultivation', 'Cultivation'),
        ('Harvesting', 'Harvesting'),
        ('Irrigation', 'Irrigation'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='works',
    )
    farmer = models.ForeignKey(
        'farmers.Farmer',
        on_delete=models.CASCADE,
        related_name='works',
        help_text='Farmer for whom this work was done.',
    )
    work_type = models.CharField(max_length=20, choices=WORK_TYPES)
    work_date = models.DateField()
    area = models.DecimalField(max_digits=10, decimal_places=2, help_text='Area of work in acres.')
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text='Amount charged in Rs.')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-work_date', '-id']

    def __str__(self):
        return f'{self.work_type} for {self.farmer.name} on {self.work_date}'
