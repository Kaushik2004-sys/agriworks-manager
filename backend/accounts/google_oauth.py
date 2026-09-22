# Phase 1 Google Login: server-side Google ID-token verification.
#
# This module verifies Google Identity Services ID tokens and NOTHING
# else. It never creates users, never links accounts, never issues DRF
# tokens or sessions, and never touches admin flags - Phase 2+ consumes
# the verified identity returned here. Only the cryptographically
# verified ID token is authoritative: frontend-provided email, name, or
# profile objects are never trusted.
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class GoogleTokenVerificationError(Exception):
    """Raised when a Google ID token cannot be verified."""


GOOGLE_ISSUERS = ('accounts.google.com', 'https://accounts.google.com')


def verify_google_id_token(id_token_str):
    """Verify a Google ID token server-side and return verified claims.

    Returns a dict with `sub`, `email`, `name` and `email_verified`.
    Raises `ImproperlyConfigured` when GOOGLE_CLIENT_ID is unset and
    `GoogleTokenVerificationError` for every verification failure
    (bad signature, expiry, wrong audience, bad issuer, unverified
    email, missing claims). Internal error details are never exposed.
    """
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    client_id = (getattr(settings, 'GOOGLE_CLIENT_ID', '') or '').strip()
    if not client_id:
        raise ImproperlyConfigured(
            'GOOGLE_CLIENT_ID is not configured; '
            'Google authentication is unavailable.')
    if not id_token_str or not isinstance(id_token_str, str):
        raise GoogleTokenVerificationError('Google credential is required.')
    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), client_id)
    except ValueError as exc:
        # Bad signature, expiry, wrong audience and malformed tokens all
        # surface here; keep the client message generic (no internals).
        raise GoogleTokenVerificationError(
            f'Google token verification failed: {exc}')
    except Exception as exc:
        # Transport/network errors: same generic shape, internals hidden.
        raise GoogleTokenVerificationError(
            'Google token verification failed: '
            f'{type(exc).__name__}')
    if claims.get('iss') not in GOOGLE_ISSUERS:
        raise GoogleTokenVerificationError(
            'Google token has an invalid issuer.')
    if not claims.get('sub'):
        raise GoogleTokenVerificationError(
            'Google token is missing the subject identifier.')
    if not claims.get('email'):
        raise GoogleTokenVerificationError(
            'Google token is missing the email address.')
    if claims.get('email_verified') is not True:
        raise GoogleTokenVerificationError(
            'Google email address is not verified.')
    return {
        'sub': claims['sub'],
        'email': claims['email'],
        'name': claims.get('name', ''),
        'email_verified': True,
    }
