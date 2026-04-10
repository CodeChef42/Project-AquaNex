# apps/core/utils.py

from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


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
            exc_info=True   # prints full traceback in Render logs
        )
        return False