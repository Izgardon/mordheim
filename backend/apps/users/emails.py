import logging

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email, reset_url):
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping password reset email to %s", to_email)
        return False

    subject = getattr(settings, "PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")
    from_email = settings.DEFAULT_FROM_EMAIL
    text_body = (
        "Use the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
    except requests.RequestException:
        logger.exception("Failed to send password reset email")
        return False

    if response.status_code >= 400:
        logger.error(
            "Resend error %s while sending reset email: %s",
            response.status_code,
            response.text,
        )
        return False

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
    api_key = getattr(settings, "RESEND_API_KEY", "")
    to_email = getattr(settings, "FEEDBACK_REPORT_TO_EMAIL", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping feedback report email for user %s", user.pk)
        return False
    if not to_email:
        logger.warning("FEEDBACK_REPORT_TO_EMAIL not set; skipping feedback report email for user %s", user.pk)
        return False

    from_email = settings.DEFAULT_FROM_EMAIL
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

    lines.extend(
        [
            "",
            "Message:",
            message,
        ]
    )

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": report_type,
        "text": "\n".join(lines),
    }

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
    except requests.RequestException:
        logger.exception("Failed to send feedback report email")
        return False

    if response.status_code >= 400:
        logger.error(
            "Resend error %s while sending feedback report email: %s",
            response.status_code,
            response.text,
        )
        return False

    return True
