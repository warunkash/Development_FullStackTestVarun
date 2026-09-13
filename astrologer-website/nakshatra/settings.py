"""Django settings for the Nakshatra online astrology consultancy site."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=()):
    value = os.environ.get(name)
    if not value:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


# SECURITY: set NAKSHATRA_SECRET_KEY in every non-local environment.
SECRET_KEY = os.environ.get(
    "NAKSHATRA_SECRET_KEY", "django-insecure-local-development-key-do-not-deploy"
)

DEBUG = env_bool("NAKSHATRA_DEBUG", True)

ALLOWED_HOSTS = env_list("NAKSHATRA_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])

CSRF_TRUSTED_ORIGINS = env_list("NAKSHATRA_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "astrology.apps.AstrologyConfig",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "nakshatra.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "astrology.context_processors.site_settings",
            ],
        },
    },
]

WSGI_APPLICATION = "nakshatra.wsgi.application"
ASGI_APPLICATION = "nakshatra.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("NAKSHATRA_DB_PATH", BASE_DIR / "db.sqlite3"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = os.environ.get("NAKSHATRA_TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "my_bookings"
LOGOUT_REDIRECT_URL = "home"

MESSAGE_STORAGE = "django.contrib.messages.storage.session.SessionStorage"

# Consultation enquiries are e-mailed to the desk; console backend keeps local runs quiet.
EMAIL_BACKEND = os.environ.get(
    "NAKSHATRA_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.environ.get("NAKSHATRA_FROM_EMAIL", "desk@nakshatra.example")
CONSULTATION_DESK_EMAIL = os.environ.get(
    "NAKSHATRA_DESK_EMAIL", "desk@nakshatra.example"
)

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("NAKSHATRA_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
