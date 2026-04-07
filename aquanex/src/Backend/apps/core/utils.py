from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_workspace_invite(email, workspace_name, inviter_name, invite_link):
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
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f"Invitation email sent to {email} for workspace {workspace_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to send invitation email to {email}: {e}")
        return False
