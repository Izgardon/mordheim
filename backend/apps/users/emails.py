import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email, reset_url):
    api_key = getattr(settings, "SENDGRID_API_KEY", "")
    if not api_key:
        logger.warning(
            "SENDGRID_API_KEY not set; skipping password reset email to %s", to_email
        )
        return False

    subject = getattr(settings, "PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")
    from_email = settings.DEFAULT_FROM_EMAIL
    text_body = (
        "Use the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text_body}],
    }

    try:
        response = requests.post(
            "https://api.sendgrid.com/v3/mail/send",
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
            "SendGrid error %s while sending reset email: %s",
            response.status_code,
            response.text,
        )
        return False

    return True
