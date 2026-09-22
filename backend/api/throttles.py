# M7: rate limits for auth endpoints (no model/schema change).
# QA-02: AnonRateThrottle exempts any request carrying a valid token, so an
# attacker with one account could bypass the limits entirely. These count
# every request by client IP (anonymous or authenticated) under the same
# scope/rate. Applied per-view (never globally), so business endpoints and
# normal authenticated API use are untouched.
from rest_framework.throttling import SimpleRateThrottle


class _IPRateThrottle(SimpleRateThrottle):
    """Throttle by client IP regardless of authentication state."""

    def get_cache_key(self, request, view):
        if not self.get_rate():
            return None
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginRateThrottle(_IPRateThrottle):
    scope = 'login'


class PasswordResetRateThrottle(_IPRateThrottle):
    scope = 'password_reset'


class RegisterRateThrottle(_IPRateThrottle):
    scope = 'register'


class PasswordResetConfirmRateThrottle(_IPRateThrottle):
    scope = 'password_reset_confirm'


class GoogleRateThrottle(_IPRateThrottle):
    scope = 'google'
