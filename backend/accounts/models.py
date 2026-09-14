# Auth update: user profile stores Full Name, Company/Business Name (optional), Mobile.
# Linked OneToOne to the existing User table - no existing users are touched.
from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    full_name = models.CharField(max_length=150)
    # OPTIONAL: blank=True so accounts work with or without a company name.
    company_name = models.CharField(max_length=150, blank=True, default='')
    mobile = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.full_name} ({self.user.username})'


class LoginHistory(models.Model):
    """Permanent record of every successful login (one row per login).

    Created server-side right after authentication succeeds; never
    updated or deleted by logout. Deleting a user cascades their rows.
    """
    STATUS_CHOICES = [
        ('Successful', 'Successful'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='login_history',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Successful')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.user.username} logged in at {self.created_at} ({self.status})'
