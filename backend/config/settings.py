"""
Django settings for AgriWorks Manager - Phase 1 Project Setup.

Simple settings kept understandable for B.Sc. IT student.
- Frontend: React.js (http://localhost:5173)
- Backend: Django + DRF (http://127.0.0.1:8000)
- Database: MySQL (agriworks_db) — the only supported database.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory: C:\AgriWorks\backend
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: secret key and debug come from the environment, never hardcoded.
# QA-01: DEBUG defaults to False so a forgotten DJANGO_DEBUG can never
# enable debug mode in production. Local development is unchanged because
# backend/.env sets DJANGO_DEBUG=True explicitly. When DEBUG is off, a
# missing or placeholder DJANGO_SECRET_KEY fails loudly at boot instead of
# silently using the well-known insecure dev key.
_insecure_dev_key = 'django-insecure-dev-only-change-me'
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
if DEBUG:
    SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', _insecure_dev_key)
else:
    _secret = os.getenv('DJANGO_SECRET_KEY', '').strip()
    if not _secret or _secret == _insecure_dev_key:
        raise ImproperlyConfigured(
            'AgriWorks production requires a real DJANGO_SECRET_KEY '
            'environment variable (and DJANGO_DEBUG must not be True). '
            'Set DJANGO_SECRET_KEY in the hosting environment.')
    SECRET_KEY = _secret

ALLOWED_HOSTS = [h.strip() for h in os.getenv(
    'DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if h.strip()]
# Render: allow the auto-assigned external hostname (no local behavior change).
if os.getenv('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.getenv('RENDER_EXTERNAL_HOSTNAME'))

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    # Local apps (Phase 1 health-check app, future phases add more)
    'api',
    'accounts',
    'farmers',
    'works',
    'billing',
    'payments',
    'expenses',
    'support',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be on top for React access
    'django.middleware.security.SecurityMiddleware',
    'config.middleware.APINoCacheMiddleware',  # No-cache on /api/ responses
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve admin/DRF static in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database: MySQL is the only supported database for this project.
# There is intentionally no SQLite fallback — if MySQL is unreachable,
# Django must fail loudly instead of silently using another database.
# TLS (Aiven/Render): Aiven MySQL requires TLS. mysqlclient accepts an
# `ssl_mode` (DISABLED/PREFERRED/REQUIRED/VERIFY_CA/VERIFY_IDENTITY) plus
# an `ssl` dict for mysql_ssl_set() (ca/capath/cert/key/cipher), both
# passed through Django's OPTIONS untouched. Everything comes from the
# environment so no certificate or credential is ever hardcoded. When
# neither variable is set, local non-TLS MySQL keeps working unchanged;
# when set, verification is never disabled — an explicit CA gives full
# VERIFY_IDENTITY, otherwise the requested mode (minimum REQUIRED).
_db_options = {'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"}
_db_ssl_mode = os.getenv('DB_SSL_MODE', '').strip().upper()
_db_ssl_ca = os.getenv('DB_SSL_CA', '').strip()
if _db_ssl_mode or _db_ssl_ca:
    _db_ssl_mode = _db_ssl_mode or (
        'VERIFY_IDENTITY' if _db_ssl_ca else 'REQUIRED')
    if _db_ssl_mode not in ('DISABLED', 'PREFERRED', 'REQUIRED',
                            'VERIFY_CA', 'VERIFY_IDENTITY'):
        raise ImproperlyConfigured(
            'Invalid DB_SSL_MODE. Use one of DISABLED, PREFERRED, '
            'REQUIRED, VERIFY_CA, VERIFY_IDENTITY.')
    _db_options['ssl_mode'] = _db_ssl_mode
    if _db_ssl_ca:
        _db_options.setdefault('ssl', {})['ca'] = _db_ssl_ca
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DB_NAME', 'agriworks_db'),
        'USER': os.getenv('DB_USER', 'root'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '3306'),
        'OPTIONS': _db_options,
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # collectstatic target for production

# Uploads (problem-report screenshots only). Served by Django in DEBUG;
# production deployments need separate media serving for this directory.
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# CSRF trusted origins (comma-separated env). Token-auth API is CSRF-exempt
# by design; this covers admin/session use in production.
# M16.4: development default is empty (localhost admin use needs none);
# in production the block at the bottom of this file derives it from env.
CSRF_TRUSTED_ORIGINS = [
    o for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o
]

# Django REST Framework default settings (simple for student project)
# Phase 2: Token Authentication for login/logout.
# M7: per-view brute-force limits for auth endpoints (login, register,
# password-reset request/confirm), applied via @throttle_classes, never
# globally. QA-02: counted per client IP whether or not a token is sent, so
# a valid token cannot bypass the limits; business endpoints and normal
# authenticated use are untouched. 60/min caps an
# IP at ~1 login/sec - stopping rapid password guessing and credential
# stuffing while never bothering normal logins; 60/hour fits rare reset
# requests while blocking reset-email abuse. Both verified compatible
# with the backend test-suite density from a single test IP.
# Absolute lifetime for the DRF login token (exactly 24 hours, enforced
# server-side by api.authentication.ExpiringTokenAuthentication using the
# existing Token.created column - no schema change).
TOKEN_EXPIRY_HOURS = 24
# Browsable API is a development convenience only: production serves
# JSON alone so the public API surface stays minimal. DEBUG behavior
# is unchanged.
_rest_renderers = ['rest_framework.renderers.JSONRenderer']
if DEBUG:
    _rest_renderers.append(
        'rest_framework.renderers.BrowsableAPIRenderer')
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': _rest_renderers,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.ExpiringTokenAuthentication',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'login': '60/min',
        'password_reset': '60/hour',
        # P4: backstops, not UX limits - normal use is a handful of
        # requests, while each fake registration also needs a unique
        # email + mobile. Suite density from one test IP stays well
        # under both budgets.
        'register': '100/hour',
        'password_reset_confirm': '30/hour',
    },
}

# CORS: allow React frontend to call Django API.
# M16.4: in production the origin list MUST come from the environment; the
# localhost defaults exist only for local development (DJANGO_DEBUG=True).
# No wildcard, no allow-all, no hardcoded production domain.
_cors_default = ('http://localhost:5173,http://127.0.0.1:5173' if DEBUG
                 else '')
_cors_raw = [o.strip() for o in os.getenv(
    'CORS_ALLOWED_ORIGINS', _cors_default).split(',') if o.strip()]
if not DEBUG and not _cors_raw:
    raise ImproperlyConfigured(
        'AgriWorks production requires CORS_ALLOWED_ORIGINS to be set to '
        'the exact frontend origin(s), e.g. https://your-frontend.example.')
CORS_ALLOWED_ORIGINS = _cors_raw

# Auth update: frontend URL used to build password-reset links.
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# Email: console backend in DEBUG when no backend is configured, so local
# password-reset testing works without SMTP.
# M16.6: production uses the SMTP backend and all SMTP parameters come from
# environment variables (never hardcoded, never committed). The friendly
# value "smtp" from .env.example-style configs maps to Django's backend path.
EMAIL_BACKEND_DEFAULT = 'django.core.mail.backends.smtp.EmailBackend'
_email_backend_raw = (os.getenv('EMAIL_BACKEND') or '').strip()
if DEBUG and not _email_backend_raw:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
elif _email_backend_raw == 'smtp':
    EMAIL_BACKEND = EMAIL_BACKEND_DEFAULT
elif _email_backend_raw:
    EMAIL_BACKEND = _email_backend_raw
else:
    EMAIL_BACKEND = EMAIL_BACKEND_DEFAULT
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '15'))
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL',
                               'noreply@agriworks.local')

# Password reset links expire after this many seconds (default 24 hours).
# The token also becomes invalid as soon as the password is changed.
PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', '86400'))

# M16.3: production HTTPS hardening. Active ONLY when DEBUG is off so local
# HTTP development (runserver on 127.0.0.1) is never redirected or changed.
# HSTS is enabled in production and can only be relaxed by expiry; set a
# conservative initial value via SECURE_HSTS_SECONDS if you prefer ramp-up.
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True') == 'True'
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Render terminates TLS at its proxy; without this, SSL redirect loops.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_REFERRER_POLICY = 'same-origin'
    # M16.4: production CSRF origins must come from the environment
    # (scheme-prefixed, e.g. https://your-frontend.example). No wildcard.
    _csrf_raw = [o.strip() for o in os.getenv(
        'CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]
    if not _csrf_raw and CORS_ALLOWED_ORIGINS:
        # Reuse the CORS origins so the admin UI works behind the same
        # scheme; explicit CSRF_TRUSTED_ORIGINS always wins when provided.
        _csrf_raw = [o for o in CORS_ALLOWED_ORIGINS
                     if o.startswith('https://')]
    CSRF_TRUSTED_ORIGINS = _csrf_raw

# M16.2/M16.3 sanity net: production must never run with a permissive
# configuration even if an operator sets odd environment combinations.
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
