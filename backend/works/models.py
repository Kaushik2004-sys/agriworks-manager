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
        ('Other', 'Other'),
        ('Land Leveling', 'Land Leveling'),
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
    # Irrigation time-based billing: only used when work_type == 'Irrigation'.
    # Nullable so all existing records stay untouched (NULL = not applicable).
    irrigation_hours = models.PositiveIntegerField(null=True, blank=True)
    irrigation_minutes = models.PositiveIntegerField(null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                      help_text='Rate per hour in Rs for irrigation.')
    # Land Leveling: rate per acre in Rs. Nullable so all other work types stay untouched.
    rate_per_acre = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                        help_text='Rate per acre in Rs for land leveling.')
    work_date = models.DateField()
    # Location of the work. Nullable so pre-existing records stay valid;
    # required for new/updated records via serializer validation.
    field_location = models.CharField(max_length=200, null=True, blank=False,
                                      help_text='Where the work was performed.')
    # Optional free-text note. Nullable + blankable per existing convention.
    remark = models.TextField(null=True, blank=True,
                              help_text='Additional information about the work.')
    # Work Description, only used when work_type == 'Other'.
    # Nullable so all existing records stay untouched.
    work_description = models.TextField(null=True, blank=True,
                                        help_text='Description of the work for Other work type.')
    # Nullable so Irrigation (time-based) can leave Acre empty; other types still require it via validation.
    area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                               help_text='Area of work in acres.')
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text='Amount charged in Rs.')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-work_date', '-id']

    def __str__(self):
        return f'{self.work_type} for {self.farmer.name} on {self.work_date}'
