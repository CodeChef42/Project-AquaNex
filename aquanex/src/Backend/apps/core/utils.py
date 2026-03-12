from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_workspace_invite(email, workspace_name, inviter_name):
    """
    Sends an invitation email to a user to join a workspace.
    """
    subject = f"Invitation to join {workspace_name} on AquaNex"
    message = (
        f"Hello,\n\n"
        f"You have been invited by {inviter_name} to join the workspace \"{workspace_name}\" on AquaNex.\n\n"
        f"Please log in or sign up at https://aquanex.app to accept the invitation.\n\n"
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
