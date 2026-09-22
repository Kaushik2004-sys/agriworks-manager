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


class GoogleAccount(models.Model):
    """Links a verified Google identity to one AgriWorks user (Phase 1).

    The stable identity key is Google's `sub` claim - never the email
    address (emails can change and are not unique in this project).
    One Google identity maps to exactly one user (`sub` unique); one
    user holds at most one Google link (`user` OneToOne). Phase 1 only
    stores verified links: it never creates users, never touches
    `is_staff`/`is_superuser`, and never issues sessions or tokens.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='google_account',
        help_text='AgriWorks account this Google identity is linked to.',
    )
    sub = models.CharField(
        max_length=255,
        unique=True,
        help_text='Google stable subject identifier (ID token `sub` claim).',
    )
    email = models.EmailField(
        help_text='Verified Google email at link time; informational only, '
                  'never the identity key.',
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Google {self.sub} -> {self.user.username}'


class LoginHistory(models.Model):
    """Immutable audit record of every successful login (one row per login).

    Created server-side right after authentication succeeds; never
    updated or deleted by logout. Failed attempts are deliberately not
    recorded (existing tested behavior - avoids throttle noise and any
    secret-adjacent data). Deleting a user keeps their rows with an
    emptied user reference instead of silently destroying the audit
    trail. Never stores passwords, hashes, or tokens of any kind.
    """
    STATUS_CHOICES = [
        ('Successful', 'Successful'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_history',
        help_text='Account used at login; emptied if the account is deleted.',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Successful')
    # Client IP taken ONLY from REMOTE_ADDR (set by the server/WSGI layer).
    # Forwarded headers are never trusted - the project has no proxy setup.
    ip_address = models.GenericIPAddressField(
        null=True, blank=True,
        help_text='Client IP at login; empty when unavailable.',
    )
    # Bounded request header for diagnostics; never credentials or tokens.
    user_agent = models.CharField(
        max_length=255, blank=True, default='',
        help_text='User-Agent header at login (first 255 chars).',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # No updated_at: an audit event is immutable and is never updated.

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        name = self.user.username if self.user_id else '(deleted user)'
        return f'{name} logged in at {self.created_at} ({self.status})'
