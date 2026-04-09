
# Django settings for backend project.
import os
from pathlib import Path
from datetime import timedelta
import ssl
import certifi
from dotenv import load_dotenv
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

# Define BASE_DIR FIRST so we know where we are
BASE_DIR = Path(__file__).resolve().parent.parent

# Build the exact path to your custom file
env_path = BASE_DIR / '.worker.env'

# Load it!
load_dotenv(dotenv_path=env_path)

# SSL Fixes
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

AUTH_USER_MODEL = 'core.User'

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-szb&(+oo!s+v^7#_3ghv4!u#$1wl04rde#y3id--ht)8jqm)h$'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "project-aquanex-xtn5.onrender.com",   # your Render URL
    ".onrender.com", 
    "aquanex.app",
    "www.aquanex.app",
    "144.24.249.18"
]


# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://www.aquanex.app",
    "https://aquanex.app",
    "https://aquanex-deployment-2-mbilal-1120s-projects.vercel.app",
    "https://project-aquanex-xtn5.onrender.com",
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.onrender\.com$",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-workspace-id",
]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'apps.core',
]

EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'ik11001.mixhost.jp')        # ← was smtp.gmail.com
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '465'))                   # ← was 587
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', 'info@aquanex.app') # ← was ''
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = str(os.environ.get('EMAIL_USE_TLS', 'false')).strip().lower() in {'1', 'true', 'yes', 'on'}  # ← was 'true'
EMAIL_USE_SSL = str(os.environ.get('EMAIL_USE_SSL', 'true')).strip().lower() in {'1', 'true', 'yes', 'on'}   # ← was 'false'
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '20'))
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'info@aquanex.app')  # ← was dynamic
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://www.aquanex.app')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

if not GOOGLE_CLIENT_ID:
    raise ImproperlyConfigured("CRITICAL: GOOGLE_CLIENT_ID is missing from the environment!")

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'apps.backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'


import logging
import psycopg2

# DATABASE CONFIGURATION

logger = logging.getLogger(__name__)

DB_PASSWORD = os.environ.get('DB_PASSWORD')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

if DB_PASSWORD:
    try:
        conn = psycopg2.connect(
            dbname='postgres',
            user='postgres.xxiojmtocfiawqzcxffi',
            password=DB_PASSWORD,
            host='aws-1-ap-northeast-1.pooler.supabase.com',
            port='6543',
            sslmode='require',
            connect_timeout=5,
        )
        conn.close()
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': 'postgres',
                'USER': 'postgres.xxiojmtocfiawqzcxffi',
                'PASSWORD': DB_PASSWORD,
                'HOST': 'aws-1-ap-northeast-1.pooler.supabase.com',
                'PORT': '6543',
                'OPTIONS': {
                    'sslmode': 'require',
                    'connect_timeout': 5,
                },
                'CONN_MAX_AGE': 60,
                'CONN_HEALTH_CHECKS': True,
            }
        }
        print(" Connected to Supabase PostgreSQL")
    except Exception as e:
        print(f" Supabase connection failed: {e}")
        print(" Falling back to SQLite")
else:
    print(" DB_PASSWORD is None — check your .env file")




# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTHENTICATION_BACKENDS = [
    'apps.core.backends.CustomUserBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dubai'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Optional shared storage backend (recommended in cloud so web and celery share files)
if os.environ.get('DJANGO_DEFAULT_FILE_STORAGE'):
    DEFAULT_FILE_STORAGE = os.environ['DJANGO_DEFAULT_FILE_STORAGE']

# Cloudflare R2 / S3-compatible storage settings (used when DEFAULT_FILE_STORAGE points to S3Boto3Storage)
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'auto')
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL')
AWS_S3_SIGNATURE_VERSION = os.environ.get('AWS_S3_SIGNATURE_VERSION', 's3v4')
AWS_S3_ADDRESSING_STYLE = os.environ.get('AWS_S3_ADDRESSING_STYLE', 'path')
AWS_QUERYSTRING_AUTH = os.environ.get('AWS_QUERYSTRING_AUTH', 'false').lower() == 'true'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
    'NON_FIELD_ERRORS_KEY': 'error',
    'DEFAULT_SCHEMA_CLASS': 'rest_framework.schemas.coreapi.AutoSchema',
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'USER_ID_FIELD': 'user_id',
    'USER_ID_CLAIM': 'user_id'
}

# Celery
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_CONNECTION_MAX_RETRIES = None # Retry forever
CELERY_WORKER_CANCEL_LONG_RUNNING_TASKS_ON_CONNECTION_LOSS = False
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'visibility_timeout': 3600,
    'socket_timeout': 60,
    'socket_connect_timeout': 60,
    'socket_keepalive': True,
    'retry_on_timeout': True,
    'health_check_interval': 30,
}

# ML service integration (deploy ML API as a separate always-on service)
ML_SERVICE_URL = os.environ.get('ML_SERVICE_URL', 'http://localhost:8001')
ML_SERVICE_TIMEOUT_SEC = float(os.environ.get('ML_SERVICE_TIMEOUT_SEC', '5'))
ML_USE_CELERY = os.environ.get('ML_USE_CELERY', 'false')
