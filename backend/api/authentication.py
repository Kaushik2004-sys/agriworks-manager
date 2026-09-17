# 24-hour absolute server-side expiry for the existing DRF auth token.
# Smallest possible authentication-layer change: normal DRF token
# authentication runs first, then Token.created (already stored on the
# existing authtoken_token table) is compared against the timezone-aware
# current time. No model/schema change, no migration, no new table/field.
# Rotation, logout, password-change and password-reset flows are untouched:
# they create/delete tokens, and every one of those paths naturally yields
# a fresh Token.created timestamp.
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


def token_expiry_timedelta():
    hours = getattr(settings, 'TOKEN_EXPIRY_HOURS', 24)
    return timedelta(hours=hours)


class ExpiringTokenAuthentication(TokenAuthentication):
    """DRF token auth + absolute lifetime (default 24 hours).

    Age < lifetime  -> valid (user, token) as before.
    Age >= lifetime -> AuthenticationFailed (HTTP 401), handled by the
    existing frontend 401/session flow. Expired tokens are rejected, never
    refreshed: the user logs in again and rotation issues a fresh token.
    """

    keyword = 'Token'

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if timezone.now() - token.created >= token_expiry_timedelta():
            raise AuthenticationFailed('Token has expired. Please log in again.')
        return user, token
