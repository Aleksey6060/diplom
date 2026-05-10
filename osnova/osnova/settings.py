import os
import environ
from pathlib import Path

from django.core.files.storage import FileSystemStorage

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False)
)

environ.Env.read_env(os.path.join(BASE_DIR.parent / '.env'))

SECRET_KEY = env('SECRET_KEY')

DEBUG = env('DEBUG')

def _split_env_list(value):
    return [s.strip() for s in str(value or '').split(',') if s.strip()]


ALLOWED_HOSTS = _split_env_list(env('ALLOWED_HOSTS', default='localhost,127.0.0.1'))

CSRF_TRUSTED_ORIGINS = _split_env_list(env(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173'
))

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG

INSTALLED_APPS = [
    'daphne',

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'users',
    'courses.apps.CoursesConfig',
    'universities',
    'chats.apps.ChatsConfig',
    'groups',
    'tickets',

    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'channels',
]

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'universities.middleware.UniversityMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'osnova.urls'

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

WSGI_APPLICATION = 'osnova.wsgi.application'
ASGI_APPLICATION = 'osnova.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.environ.get('DB_HOST'),
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASS'),
        'PORT': 5432,
    }
}

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

LANGUAGE_CODE = 'ru'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

PROTECTED_ROOT = BASE_DIR / 'protected_files'
protected_storage = FileSystemStorage(location=PROTECTED_ROOT) # для файлов студентов, хранящих важную инфу

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# __________EMAIL_____________

EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = env('EMAIL_HOST', default='')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@osnova.app')
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:5173')
PASSWORD_RESET_TIMEOUT = 86400  # 24 hours

# __________CONSTS_____________

MAX_STUDENTS_PER_TIME = 500

SIZE_UNITS = {
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
}

FILE_SIZE_LIMIT = 100
FILE_SIZE_LIMIT_UNIT = 'MB'

MAX_STUDENTS_IN_GROUP = 50

AES_KEY = bytes.fromhex('c2d218d3440123388771ff9e52b007c49d1098212e51bc01f7ec7394c38b4185') # для шифрования файлов
# _________END_CONSTS__________

CORS_EXPOSE_HEADERS = ['X-File-Id', 'X-File-Type', 'X-User-Id']
