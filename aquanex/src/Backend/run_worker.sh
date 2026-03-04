#!/bin/zsh
set -e
cd /Volumes/PortableSSD/Project-AquaNex/aquanex/src/Backend
source venv/bin/activate

if [ ! -f .worker.env ]; then
  echo "Missing .worker.env in Backend directory."
  exit 1
fi

set -a
source .worker.env
set +a

required_vars=(
  CELERY_BROKER_URL
  CELERY_RESULT_BACKEND
  DJANGO_SETTINGS_MODULE
  PYTHONPATH
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_STORAGE_BUCKET_NAME
  AWS_S3_ENDPOINT_URL
)

for var_name in "${required_vars[@]}"; do
  if [ -z "${(P)var_name}" ]; then
    echo "Missing required env var: ${var_name}"
    exit 1
  fi
done

echo "Starting Celery worker with app=apps.backend, pool=solo"
exec celery -A apps.backend worker -l info -P solo
