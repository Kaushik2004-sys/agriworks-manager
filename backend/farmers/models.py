# Phase 3: Farmer model.
# Each farmer belongs to one user (User -> Farmer).
from django.conf import settings
from django.db import models


class Farmer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='farmers',
        help_text='Owner of this farmer record.',
    )
    name = models.CharField(max_length=100)
    mobile = models.CharField(max_length=10)
    village = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f'{self.name} ({self.village})'
