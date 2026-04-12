# apps/core/utils.py

import os
import re
import logging
import requests as req_lib  # aliased to avoid clash with Django's HttpRequest

from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Email Utilities
# ─────────────────────────────────────────────────────────────────────────────

def send_workspace_invite(email: str, workspace_name: str, inviter_name: str, invite_link: str) -> bool:
    """
    Sends an invitation email to a user to join a workspace.
    invite_link is the tokenised URL where the recipient sets their name + password.
    """
    subject = f"You're invited to join {workspace_name} on AquaNex"

    message = (
        f"Hello,\n\n"
        f"{inviter_name} has invited you to join the workspace \"{workspace_name}\" on AquaNex.\n\n"
        f"Click the link below to accept your invitation and create your account:\n\n"
        f"{invite_link}\n\n"
        f"This link expires in 72 hours. If you did not expect this email, you can safely ignore it.\n\n"
        f"Best regards,\n"
        f"The AquaNex Team"
    )

    # ── Debug: log SMTP config so Render logs show exactly what Django is using ──
    logger.info(
        f"[SMTP] Attempting to send invite to {email} | "
        f"HOST={settings.EMAIL_HOST} "
        f"PORT={settings.EMAIL_PORT} "
        f"USER={settings.EMAIL_HOST_USER} "
        f"SSL={settings.EMAIL_USE_SSL} "
        f"TLS={settings.EMAIL_USE_TLS} "
        f"FROM={settings.DEFAULT_FROM_EMAIL}"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f"[SMTP] ✅ Invite email successfully sent to {email} for workspace '{workspace_name}'")
        return True

    except Exception as e:
        logger.error(
            f"[SMTP] ❌ Failed to send invite to {email} | "
            f"{type(e).__name__}: {e}",
            exc_info=True,
        )
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Component ID Resolution (IoT → Physical Pipe Mapping)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_pipe_id_from_thingsboard(
    device_id: str | None,
    *,
    fallback_device_ids: dict | None = None,
    workspace_id: str | None = None,
    gateway_id: str | None = None,
) -> str | None:
    """
    Resolves a physical pipe_id (comp_id) for a given sensor device_id.

    Resolution order:
      1. Local DB  — FieldDevice.metadata['comp_id'] or ['pipe_id']  (zero-latency, preferred)
      2. ThingsBoard REST API — SERVER_SCOPE attribute 'pipe_id' or 'comp_id'
      3. Repeats steps 1 & 2 for each entry in fallback_device_ids if primary fails

    Returns the pipe_id string, or None if unresolvable.
    """
    # Build candidate list: primary device_id first, then slot fallbacks
    candidates = []
    if device_id:
        candidates.append(device_id)
    if fallback_device_ids:
        for slot_did in fallback_device_ids.values():
            if slot_did and slot_did not in candidates:
                candidates.append(slot_did)

    if not candidates:
        logger.warning("fetch_pipe_id_from_thingsboard: no device_id candidates provided.")
        return None

    for did in candidates:
        comp_id = (
            _resolve_comp_id_from_db(did, workspace_id=workspace_id, gateway_id=gateway_id)
            or _resolve_comp_id_from_thingsboard(did)
        )
        if comp_id:
            logger.info(
                "fetch_pipe_id_from_thingsboard: resolved comp_id=%s for device=%s",
                comp_id, did,
            )
            return comp_id

    logger.error(
        "fetch_pipe_id_from_thingsboard: FAILED to resolve comp_id for all candidates: %s",
        candidates,
    )
    return None


def _resolve_comp_id_from_db(
    device_id: str,
    *,
    workspace_id: str | None = None,
    gateway_id: str | None = None,
) -> str | None:
    """
    Fast path: look up comp_id in FieldDevice.metadata.
    Avoids any external API call. Lazy import prevents circular imports.
    """
    from apps.core.models import FieldDevice  # lazy to avoid circular import

    try:
        qs = FieldDevice.objects.filter(device_id=device_id)
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)
        if gateway_id:
            qs = qs.filter(gateway_id=gateway_id)

        device = qs.first()
        if not device:
            return None

        meta = device.metadata or {}
        # Accept both 'comp_id' and 'pipe_id' as valid keys
        comp_id = meta.get("comp_id") or meta.get("pipe_id")
        if comp_id:
            return str(comp_id)

        logger.debug(
            "_resolve_comp_id_from_db: FieldDevice found for %s but no comp_id/pipe_id in metadata=%s",
            device_id, meta,
        )
        return None

    except Exception as exc:
        logger.warning("_resolve_comp_id_from_db error for device=%s: %s", device_id, exc)
        return None


def _resolve_comp_id_from_thingsboard(device_id: str) -> str | None:
    """
    Fallback path: call ThingsBoard REST API to fetch SERVER_SCOPE attributes
    and extract 'pipe_id' or 'comp_id'.

    Required env vars:
      THINGSBOARD_URL   — e.g. https://your-tb-instance.com
      THINGSBOARD_TOKEN — a valid JWT (tenant admin or system user)
    """
    tb_url = (
        os.getenv("THINGSBOARD_URL")
        or os.getenv("TB_URL")
        or os.getenv("THINGSBOARD_BASE_URL")
        or os.getenv("TB_BASE_URL")
        or ""
    ).rstrip("/")
    tb_token = os.getenv("THINGSBOARD_TOKEN") or os.getenv("TB_TOKEN") or ""

    if not tb_url:
        logger.debug(
            "_resolve_comp_id_from_thingsboard: TB base URL not configured, skipping."
        )
        return None

    try:
        # If token is not provided explicitly, try tenant login credentials.
        if not tb_token:
            tb_username = (
                os.getenv("THINGSBOARD_TENANT_USERNAME")
                or os.getenv("TB_TENANT_USERNAME")
                or os.getenv("TB_TENANT_EMAIL")
                or ""
            )
            tb_password = (
                os.getenv("THINGSBOARD_TENANT_PASSWORD")
                or os.getenv("TB_TENANT_PASSWORD")
                or ""
            )
            if tb_username and tb_password:
                login_resp = req_lib.post(
                    f"{tb_url}/api/auth/login",
                    json={"username": tb_username, "password": tb_password},
                    timeout=4.0,
                )
                if login_resp.status_code == 200:
                    tb_token = str(login_resp.json().get("token") or "").strip()

        if not tb_token:
            logger.debug(
                "_resolve_comp_id_from_thingsboard: no token available (set THINGSBOARD_TOKEN/TB_TOKEN or TB tenant creds)."
            )
            return None

        headers = {
            "Authorization": f"Bearer {tb_token}",
            "X-Authorization": f"Bearer {tb_token}",
            "Content-Type":  "application/json",
        }

        # device_id from telemetry is often TB device NAME, not entity UUID.
        is_uuid = bool(re.fullmatch(r"[0-9a-fA-F-]{32,36}", str(device_id or "").strip()))
        tb_entity_id = str(device_id or "").strip() if is_uuid else ""
        if not tb_entity_id:
            lookup_resp = req_lib.get(
                f"{tb_url}/api/tenant/devices",
                params={"deviceName": device_id},
                headers=headers,
                timeout=4.0,
            )
            if lookup_resp.status_code == 200:
                body = lookup_resp.json() if isinstance(lookup_resp.json(), dict) else {}
                tb_entity_id = str(((body.get("id") or {}).get("id")) or "").strip()
            else:
                logger.warning(
                    "_resolve_comp_id_from_thingsboard: device lookup failed HTTP %s for deviceName=%s",
                    lookup_resp.status_code,
                    device_id,
                )

        if not tb_entity_id:
            return None

        attr_resp = req_lib.get(
            f"{tb_url}/api/plugins/telemetry/DEVICE/{tb_entity_id}/values/attributes/SERVER_SCOPE",
            headers=headers,
            timeout=4.0,
        )
        if attr_resp.status_code != 200:
            logger.warning(
                "_resolve_comp_id_from_thingsboard: attributes fetch failed HTTP %s for device=%s (entity_id=%s)",
                attr_resp.status_code,
                device_id,
                tb_entity_id,
            )
            return None

        raw_items = attr_resp.json()
        items = raw_items if isinstance(raw_items, list) else []
        attrs = {}
        for item in items:
            if isinstance(item, dict) and "key" in item:
                attrs[item.get("key")] = item.get("value")
        comp_id = attrs.get("pipe_id") or attrs.get("comp_id")
        if comp_id:
            return str(comp_id)
        logger.warning(
            "_resolve_comp_id_from_thingsboard: device=%s found but no pipe_id/comp_id in SERVER_SCOPE attrs. Keys present: %s",
            device_id,
            list(attrs.keys()),
        )

    except Exception as exc:
        logger.warning(
            "_resolve_comp_id_from_thingsboard error for device=%s: %s",
            device_id, exc,
        )

    return None
