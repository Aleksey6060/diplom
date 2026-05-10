#!/usr/bin/env sh
set -e

echo "Starting entrypoint script..."

: "${DB_HOST:=postgres-db}"
: "${DB_PORT:=5432}"

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
while ! nc -z ${DB_HOST} ${DB_PORT}; do
  echo "Waiting for postgres..."
  sleep 1
done

echo "Database available, running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ -n "${DJANGO_SUPERUSER_USERNAME}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD}" ] && [ -n "${DJANGO_SUPERUSER_EMAIL}" ]; then
  echo "Creating superuser (if not exists)..."
  python manage.py createsuperuser --noinput --username "${DJANGO_SUPERUSER_USERNAME}" --email "${DJANGO_SUPERUSER_EMAIL}" || true
fi

echo "Starting daphne (ASGI)..."
exec daphne -b 0.0.0.0 -p 8000 osnova.asgi:application