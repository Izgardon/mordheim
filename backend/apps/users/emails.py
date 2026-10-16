import logging

import requests
from django.conf import settings
from django.utils import timezone

from apps.core.dispatch import dispatch_after_commit

logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"


def _post_to_resend(api_key: str, payload: dict, description: str) -> None:
    """Send one email through Resend. Runs off the request thread; failures are logged."""
    try:
        response = requests.post(
            RESEND_EMAILS_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=(3, 10),
        )
    except requests.RequestException:
        logger.exception("Failed to send %s email", description)
        return

    if response.status_code >= 400:
        logger.error("Resend error %s while sending %s email: %s", response.status_code, description, response.text)


def send_password_reset_email(to_email, reset_url):
    """Queue a password reset email. Returns False when email isn't configured."""
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping password reset email to %s", to_email)
        return False

    subject = getattr(settings, "PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")
    text_body = (
        "Use the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    payload = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    dispatch_after_commit(_post_to_resend, api_key, payload, "password reset")
    return True


def send_feedback_report_email(
    *,
    user,
    report_type,
    message,
    campaign_id=None,
    campaign_name="",
    warband_id=None,
    warband_name="",
):
    """Queue a feedback report email. Returns False when email isn't configured."""
    api_key = getattr(settings, "RESEND_API_KEY", "")
    to_email = getattr(settings, "FEEDBACK_REPORT_TO_EMAIL", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping feedback report email for user %s", user.pk)
        return False
    if not to_email:
        logger.warning("FEEDBACK_REPORT_TO_EMAIL not set; skipping feedback report email for user %s", user.pk)
        return False

    user_name = (getattr(user, "first_name", "") or "").strip() or "(blank)"

    lines = [
        "A new feedback report was submitted.",
        "",
        f"Type: {report_type}",
        f"Timestamp: {timezone.now().isoformat()}",
        f"User id: {user.pk}",
        f"User name: {user_name}",
        f"User email: {getattr(user, 'email', '')}",
    ]

    if campaign_id is not None or campaign_name:
        lines.append(f"Campaign id: {campaign_id if campaign_id is not None else ''}")
        lines.append(f"Campaign name: {campaign_name}")

    if warband_id is not None or warband_name:
        lines.append(f"Warband id: {warband_id if warband_id is not None else ''}")
        lines.append(f"Warband name: {warband_name}")

    lines.extend(["", "Message:", message])

    payload = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to_email],
        "subject": report_type,
        "text": "\n".join(lines),
    }
    dispatch_after_commit(_post_to_resend, api_key, payload, "feedback report")
    return True
