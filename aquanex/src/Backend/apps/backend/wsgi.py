"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# ─── Self-ping: keeps Render free-tier alive ──────────────────────────────────
# RENDER env var is automatically present on all Render services.
# Locally this block is completely skipped — no side effects.
if os.environ.get("RENDER"):
    try:
        from core.backendping import BackendPinger
        BackendPinger.start()
    except Exception as exc:
        import logging
        logging.getLogger("aquanex.wsgi").warning(
            "[BackendPing] Could not start pinger: %s", exc
        )
# ─────────────────────────────────────────────────────────────────────────────

application = get_wsgi_application()