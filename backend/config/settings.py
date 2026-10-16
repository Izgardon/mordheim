import os
from datetime import timedelta
from pathlib import Path
from typing import Any

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str) -> int | None:
    raw_value = os.environ.get(name)
    if raw_value is None or not raw_value.strip():
        return None
    return int(raw_value)


BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = _env_bool("DJANGO_DEBUG", False)

# SECRET_KEY also signs JWTs and password-reset tokens, so production must never
# fall back to a known value. Local dev (DEBUG on) gets a fixed throwaway key.
_DEV_SECRET_KEY = "dev-only-insecure-secret-key-do-not-use-in-production"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY in {"dev-secret-key", _DEV_SECRET_KEY}:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a unique value when DJANGO_DEBUG is off.")
    SECRET_KEY = _DEV_SECRET_KEY

allowed_hosts = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,backend")
ALLOWED_HOSTS = [host for host in allowed_hosts.split(",") if host]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "apps.core.apps.CoreConfig",
    "apps.campaigns.apps.CampaignsConfig",
    "apps.restrictions.apps.RestrictionsConfig",
    "apps.items.apps.ItemsConfig",
    "apps.races.apps.RacesConfig",
    "apps.skills.apps.SkillsConfig",
    "apps.spells.apps.SpellsConfig",
    "apps.special.apps.SpecialConfig",
    "apps.logs.apps.LogsConfig",
    "apps.users.apps.UsersConfig",
    "apps.warbands.apps.WarbandsConfig",
    "apps.trades.apps.TradesConfig",
    "apps.realtime.apps.RealtimeConfig",
    "apps.battles.apps.BattlesConfig",
    "apps.bestiary.apps.BestiaryConfig",
    "apps.notifications.apps.NotificationsConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Keep connections open between requests: production reaches Neon (London) from
# Render (Frankfurt), and a fresh TLS + auth handshake costs several round trips.
# Health checks drop connections that died while idle (e.g. Neon autosuspend).
DB_CONN_MAX_AGE = int(os.environ.get("DB_CONN_MAX_AGE", "600"))

# Database configuration for Neon
if os.environ.get("DATABASE_URL"):
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ.get("DATABASE_URL"),
            conn_max_age=DB_CONN_MAX_AGE,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "mordheim"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.environ.get("POSTGRES_HOST", "db"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": DB_CONN_MAX_AGE,
            "CONN_HEALTH_CHECKS": True,
        }
    }

# Neon's "-pooler" endpoint is PgBouncer in transaction mode: a session-level
# server-side cursor (.iterator()) or prepared statement can land on a different
# server connection mid-use, so both are disabled there.
_default_db = DATABASES["default"]
if "-pooler" in str(_default_db.get("HOST", "")):
    _default_db["DISABLE_SERVER_SIDE_CURSORS"] = True
    _default_db["OPTIONS"] = {**(_default_db.get("OPTIONS") or {}), "prepare_threshold": None}

REST_FRAMEWORK: dict[str, Any] = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_THROTTLE_RATES": {
        "auth_login_minute": "5/min",
        "auth_login_hour": "30/hour",
        "auth_register_hour": "3/hour",
        "auth_register_day": "10/day",
        "auth_password_reset_hour": "3/hour",
        "auth_password_reset_day": "10/day",
        "auth_password_reset_confirm_hour": "10/hour",
        "auth_refresh_minute": "30/min",
        "feedback_report_user": "3/min",
        "feedback_report_ip": "10/min",
        "campaign_chat_user": "12/min",
        "campaign_chat_ip": "60/min",
        "campaign_ping_user": "30/min",
        "campaign_ping_ip": "120/min",
        "battle_write_user": "60/min",
        "battle_write_ip": "240/min",
        "trade_write_user": "20/min",
        "trade_write_ip": "60/min",
    },
}

rate_limit_num_proxies = _env_int("RATE_LIMIT_NUM_PROXIES")
if rate_limit_num_proxies is not None:
    REST_FRAMEWORK["NUM_PROXIES"] = rate_limit_num_proxies

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", True)

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "rate-limit",
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOWED_ORIGINS = [origin for origin in cors_origins.split(",") if origin]

# Render terminates TLS at its proxy and forwards the original scheme.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", str(60 * 60 * 24 * 30)))
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Not applicable behind Render: onrender.com is a shared domain (no HSTS
# subdomains/preload) and Render's proxy already redirects HTTP to HTTPS.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W008", "security.W021"]

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@example.com")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
PASSWORD_RESET_EMAIL_SUBJECT = os.environ.get("PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")
FEEDBACK_REPORT_TO_EMAIL = os.environ.get("FEEDBACK_REPORT_TO_EMAIL", "")
PASSWORD_RESET_TIMEOUT = int(os.environ.get("PASSWORD_RESET_TIMEOUT", "3600"))

PUSHER_APP_ID = os.environ.get("PUSHER_APP_ID", "")
PUSHER_KEY = os.environ.get("PUSHER_KEY", "")
PUSHER_SECRET = os.environ.get("PUSHER_SECRET", "")
PUSHER_CLUSTER = os.environ.get("PUSHER_CLUSTER", "")
PUSHER_TIMEOUT_SECONDS = int(os.environ.get("PUSHER_TIMEOUT_SECONDS", "3"))
# Set only for a self-hosted Pusher-compatible server (local dev uses soketi via docker-compose).
PUSHER_HOST = os.environ.get("PUSHER_HOST", "")
PUSHER_PORT = int(os.environ.get("PUSHER_PORT", "443"))
PUSHER_USE_TLS = _env_bool("PUSHER_USE_TLS", True)

# Pusher/Resend calls run on a background thread after commit (apps.core.dispatch).
# The test runner turns this on so dispatched calls run inline and deterministically.
EXTERNAL_DISPATCH_SYNC = False

MIGRATION_MODULES = {
    "realtime": None,
}

# Blanks Resend/Pusher credentials and blocks outbound network calls during tests.
TEST_RUNNER = "config.test_runner.NoNetworkTestRunner"
