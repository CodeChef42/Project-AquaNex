# apps/core/utils.py

import os
import re
import logging
import ssl
import smtplib
from email.utils import formataddr
from email.message import EmailMessage
import requests as req_lib  # aliased to avoid clash with Django's HttpRequest

from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import certifi
except Exception:
    certifi = None


# ─────────────────────────────────────────────────────────────────────────────
# Email Utilities
# ─────────────────────────────────────────────────────────────────────────────

def send_workspace_invite(
    email: str,
    workspace_name: str,
    inviter_name: str,
    invite_link: str,
    *,
    return_meta: bool = False,
):
    """
    Sends an invitation email to a user to join a workspace.
    invite_link is the tokenised URL where the recipient sets their name + password.
    """
    subject = f'AquaNex | You are invited to join the irrigation workspace "{workspace_name}"'
    from_email = formataddr(("AquaNex", getattr(settings, "DEFAULT_FROM_EMAIL", "")))
    brand_banner_url = str(os.getenv("AQUANEX_BRAND_BANNER_URL", "") or "").strip()
    brand_logo_url = str(os.getenv("AQUANEX_BRAND_LOGO_URL", "") or "").strip()

    message = (
        f"Hello,\n\n"
        f"{inviter_name} has invited you to join the irrigation workspace \"{workspace_name}\" on AquaNex.\n\n"
        f"Click the link below to accept your invitation and create your account:\n\n"
        f"{invite_link}\n\n"
        f"This link expires in 72 hours. If you did not expect this email, you can safely ignore it.\n\n"
        f"Best regards,\n"
        f"AquaNex"
    )
    header_banner = (
        f'<img src="{brand_banner_url}" alt="AquaNex Banner" style="width:100%;max-width:640px;height:auto;border-radius:12px;display:block;" />'
        if brand_banner_url
        else (
            '<div style="background:linear-gradient(135deg,#0ea5e9,#1d4ed8);padding:18px 20px;border-radius:12px;color:#ffffff;">'
            '<div style="font-size:24px;font-weight:800;letter-spacing:0.3px;">AquaNex</div>'
            '<div style="font-size:13px;opacity:0.95;margin-top:4px;">INTELLIGENT IRRIGATION SYSTEMS</div>'
            "</div>"
        )
    )
    logo_markup = (
        f'<img src="{brand_logo_url}" alt="AquaNex Logo" width="56" height="56" style="border-radius:10px;display:block;" />'
        if brand_logo_url
        else ""
    )
    html_message = f"""
    <div style="font-family:Arial,sans-serif;background:#f5fbff;padding:16px;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2f2ff;border-radius:14px;padding:16px;">
        {header_banner}
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
          {logo_markup}
          <div>
            <h2 style="margin:0;color:#0f172a;font-size:20px;">You're invited to AquaNex</h2>
            <p style="margin:4px 0 0;color:#475569;font-size:13px;">Intelligent Irrigation Systems</p>
          </div>
        </div>
        <p style="margin:16px 0 8px;color:#0f172a;font-size:14px;">
          <strong>{inviter_name}</strong> has invited you to join the irrigation workspace
          <strong>"{workspace_name}"</strong>.
        </p>
        <p style="margin:0 0 14px;color:#334155;font-size:14px;">
          Click below to accept your invitation and create your account.
        </p>
        <a href="{invite_link}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;">
          Accept Invitation
        </a>
        <p style="margin:14px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          This link expires in 72 hours. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    </div>
    """

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

    meta = {
        "recipient": email,
        "smtp_host": getattr(settings, "EMAIL_HOST", ""),
        "smtp_port": getattr(settings, "EMAIL_PORT", ""),
        "smtp_ssl": bool(getattr(settings, "EMAIL_USE_SSL", False)),
        "smtp_tls": bool(getattr(settings, "EMAIL_USE_TLS", False)),
        "from_email": getattr(settings, "DEFAULT_FROM_EMAIL", ""),
        "primary_attempt_ok": False,
        "verified_retry_used": False,
        "verified_retry_ok": False,
        "insecure_retry_used": False,
        "insecure_retry_ok": False,
        "primary_error": "",
        "verified_retry_error": "",
        "retry_error": "",
        "certifi_available": certifi is not None,
        "allow_insecure_retry": str(os.getenv("EMAIL_ALLOW_INSECURE_SSL_RETRY", "true")).strip().lower() in {"1", "true", "yes", "on"},
    }

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"[SMTP] ✅ Invite email successfully sent to {email} for workspace '{workspace_name}'")
        meta["primary_attempt_ok"] = True
        return (True, meta) if return_meta else True

    except Exception as e:
        meta["primary_error"] = f"{type(e).__name__}: {e}"
        # Retry with verified SSL context first when SSL is enabled.
        if bool(getattr(settings, "EMAIL_USE_SSL", False)):
            try:
                logger.warning("[SMTP] Retrying invite send with verified SSL context.")
                meta["verified_retry_used"] = True
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = from_email
                msg["To"] = email
                msg.set_content(message)
                msg.add_alternative(html_message, subtype="html")

                host = str(getattr(settings, "EMAIL_HOST", "") or "")
                port = int(getattr(settings, "EMAIL_PORT", 465) or 465)
                username = str(getattr(settings, "EMAIL_HOST_USER", "") or "")
                password = str(getattr(settings, "EMAIL_HOST_PASSWORD", "") or "")
                if certifi is not None:
                    context = ssl.create_default_context(cafile=certifi.where())
                else:
                    context = ssl.create_default_context()
                with smtplib.SMTP_SSL(host=host, port=port, context=context, timeout=20) as smtp:
                    if username:
                        smtp.login(username, password)
                    smtp.send_message(msg)
                logger.info(f"[SMTP] ✅ Invite email sent via verified retry to {email}")
                meta["verified_retry_ok"] = True
                return (True, meta) if return_meta else True
            except Exception as verified_retry_err:
                meta["verified_retry_error"] = f"{type(verified_retry_err).__name__}: {verified_retry_err}"
                logger.warning(
                    "[SMTP] verified retry failed for %s: %s",
                    email,
                    verified_retry_err,
                )

        # Local/dev environments may fail CA-chain validation for SMTP SSL.
        # Retry once with unverified SSL context when explicitly enabled.
        allow_insecure_retry = bool(meta["allow_insecure_retry"])
        cert_error_blob = " ".join([meta.get("primary_error", ""), meta.get("verified_retry_error", "")]).upper()
        is_cert_verify_error = "CERTIFICATE_VERIFY_FAILED" in cert_error_blob or "SSLCERTVERIFICATIONERROR" in cert_error_blob
        if allow_insecure_retry and is_cert_verify_error and bool(getattr(settings, "EMAIL_USE_SSL", False)):
            try:
                logger.warning("[SMTP] Retrying invite send with insecure SSL context due to certificate verification failure.")
                meta["insecure_retry_used"] = True
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = from_email
                msg["To"] = email
                msg.set_content(message)
                msg.add_alternative(html_message, subtype="html")

                host = str(getattr(settings, "EMAIL_HOST", "") or "")
                port = int(getattr(settings, "EMAIL_PORT", 465) or 465)
                username = str(getattr(settings, "EMAIL_HOST_USER", "") or "")
                password = str(getattr(settings, "EMAIL_HOST_PASSWORD", "") or "")
                context = ssl._create_unverified_context()
                with smtplib.SMTP_SSL(host=host, port=port, context=context, timeout=20) as smtp:
                    if username:
                        smtp.login(username, password)
                    smtp.send_message(msg)
                logger.info(f"[SMTP] ✅ Invite email sent via insecure SSL retry to {email}")
                meta["insecure_retry_ok"] = True
                return (True, meta) if return_meta else True
            except Exception as retry_err:
                meta["retry_error"] = f"{type(retry_err).__name__}: {retry_err}"
                logger.error(
                    f"[SMTP] ❌ Insecure SSL retry failed for {email} | {type(retry_err).__name__}: {retry_err}",
                    exc_info=True,
                )

        logger.error(
            f"[SMTP] ❌ Failed to send invite to {email} | "
            f"{type(e).__name__}: {e}",
            exc_info=True,
        )
        return (False, meta) if return_meta else False


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
