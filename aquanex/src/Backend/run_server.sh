#!/bin/zsh
set -e

# ----------------------------
# Load environment variables first
# ----------------------------
if [ ! -f .worker.env ]; then
  echo "Missing .worker.env in Backend directory."
  exit 1
fi

set -a
source .worker.env
set +a

# ----------------------------
# Move to project directory and activate venv
# ----------------------------
cd /Volumes/PortableSSD/Project-AquaNex/aquanex/src/Backend
source venv/bin/activate

# ----------------------------
# Select Redis broker (must match what Celery worker is using)
# ----------------------------
echo ""
echo "This is for running both local redis and the local AquaNex server"
echo ""
echo "Select Redis broker:"
echo "1) Render Redis (production)"
echo "2) Local Redis (development)"
echo ""

read "redis_choice?Enter option (1 or 2): "

if [[ "$redis_choice" == "2" ]]; then
  echo "Using LOCAL Redis"
  export CELERY_BROKER_URL="redis://localhost:6379/0"
  export CELERY_RESULT_BACKEND="redis://localhost:6379/0"
else
  echo "Using RENDER Redis"
fi

echo ""
echo "Broker: $CELERY_BROKER_URL"
echo ""

# ----------------------------
# Check required env vars
# ----------------------------
required_vars=(
  CELERY_BROKER_URL
  CELERY_RESULT_BACKEND
  DJANGO_SETTINGS_MODULE
  PYTHONPATH
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_STORAGE_BUCKET_NAME
  AWS_S3_ENDPOINT_URL
  DJANGO_DEFAULT_FILE_STORAGE
)

for var_name in "${required_vars[@]}"; do
  if [ -z "${(P)var_name}" ]; then
    echo "Missing required env var: ${var_name}"
    exit 1
  fi
done

# ----------------------------
# Start Django dev server
# ----------------------------
echo ""
echo "Starting Django server on 0.0.0.0:3001"
echo ""

exec python manage.py runserver 0.0.0.0:3001