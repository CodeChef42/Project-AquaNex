import os
import sys
import platform

# Path to Backend/ root (3 dirs up from celery.py)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'apps.backend.settings')

# Celery app
from celery import Celery
app = Celery('backend')

# Load Django Celery config
app.config_from_object('django.conf:settings', namespace='CELERY')

# On macOS with Python 3.13, prefork workers can crash (SIGSEGV) in dev.
# Use a safer default pool locally; can be overridden via CELERY_WORKER_POOL.
worker_pool = os.getenv("CELERY_WORKER_POOL")
if not worker_pool and platform.system() == "Darwin" and sys.version_info >= (3, 13):
    worker_pool = "solo"
if worker_pool:
    app.conf.worker_pool = worker_pool
    if worker_pool == "solo":
        app.conf.worker_concurrency = 1

# Auto-discover tasks
app.autodiscover_tasks()

