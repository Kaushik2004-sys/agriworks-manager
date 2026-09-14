"""
Django settings for AgriWorks Manager - Phase 1 Project Setup.

Simple settings kept understandable for B.Sc. IT student.
- Frontend: React.js (http://localhost:5173)
- Backend: Django + DRF (http://127.0.0.1:8000)
- Database: SQLite (db.sqlite3) — MySQL is not required.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory: C:\AgriWorks\backend
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: secret key and debug come from .env, never hardcode in production
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-only-change-me')
DEBUG = os.getenv('DJANGO_DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')
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


# Database: SQLite is the project database (db.sqlite3).
# The mysql block below is kept only as an unused fallback and is not used.
DB_ENGINE = os.getenv('DB_ENGINE', 'sqlite')

if DB_ENGINE == 'mysql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.getenv('DB_NAME', 'agriworks_db'),
            'USER': os.getenv('DB_USER', 'root'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('DB_PORT', '3306'),
            'OPTIONS': {'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"},
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            # Render persistent disk sets SQLITE_PATH=/var/data/db.sqlite3.
            # Local default unchanged: backend/db.sqlite3.
            'NAME': os.getenv('SQLITE_PATH') or BASE_DIR / 'db.sqlite3',
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
CSRF_TRUSTED_ORIGINS = [
    o for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o
]

# Django REST Framework default settings (simple for student project)
# Phase 2: Token Authentication for login/logout.
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
}

# CORS: allow React frontend to call Django API
CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173'
).split(',')

# Auth update: frontend URL used to build password-reset links.
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# Email: console backend in DEBUG so password reset works without SMTP.
# For production set EMAIL_BACKEND=smtp plus the SMTP settings below.
if DEBUG and not os.getenv('EMAIL_BACKEND'):
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = os.getenv(
        'EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', '')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL',
                               'noreply@agriworks.local')

# Password reset links expire after this many seconds (default 24 hours).
# The token also becomes invalid as soon as the password is changed.
PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', '86400'))
