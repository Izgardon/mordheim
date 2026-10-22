"""Email through Resend: the password reset link and the feedback report.

Each is queued to send after the request's transaction commits, off the request thread (`apps.core.dispatch`), and
skipped with a log line while email isn't configured (`email_configured`, the one check).
"""

import logging

import requests
from django.conf import settings
from django.utils import timezone

from apps.core.dispatch import dispatch_after_commit

from .names import display_name

logger = logging.getLogger(__name__)

RESEND_EMAILS_URL = "https://api.resend.com/emails"
SUBJECT_MESSAGE_LENGTH = 60
RESET_EMAIL_UNAVAILABLE = "Password reset by email isn't switched on yet. Ask the app's admin to reset your password."


def email_configured() -> bool:
    """Whether email can be sent at all: Resend's API key is set (it's blank in production until email is turned on,
    and the test runner blanks it)."""
    return bool(getattr(settings, "RESEND_API_KEY", ""))


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


def _queue_email(to_email: str, subject: str, text: str, description: str) -> None:
    """Send a plain-text email from DEFAULT_FROM_EMAIL once the transaction commits (email must be configured)."""
    payload = {"from": settings.DEFAULT_FROM_EMAIL, "to": [to_email], "subject": subject, "text": text}
    dispatch_after_commit(_post_to_resend, settings.RESEND_API_KEY, payload, description)


def password_reset_email_available() -> bool:
    """Whether reset emails can be sent. When they can't, a reset request answers 503 for every address, logged at
    ERROR without the address (BUG-56, BUG-155)."""
    if email_configured():
        return True
    logger.error("A password reset was requested, but RESEND_API_KEY isn't set: answered 503 email_unavailable")
    return False


def send_password_reset_email(to_email, reset_url):
    """Queue a password reset email. Returns False when email isn't configured."""
    if not email_configured():
        logger.error("RESEND_API_KEY not set; skipping a password reset email")  # no address in the log (BUG-155)
        return False

    subject = getattr(settings, "PASSWORD_RESET_EMAIL_SUBJECT", "Reset your password")
    text_body = (
        "Use the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        "If you did not request a password reset, you can ignore this email."
    )
    _queue_email(to_email, subject, text_body, "password reset")
    return True


def feedback_subject(user, report_type, message):
    """`[Mordheim] Bug from Pia: <the message's first 60 characters, on one line>` (AUTH-UX-04)."""
    opening = " ".join(message.split())[:SUBJECT_MESSAGE_LENGTH]
    return f"[Mordheim] {report_type} from {display_name(user)}: {opening}"


def feedback_text(*, user, report_type, message, campaign_id=None, campaign_name="", warband_id=None, warband_name=""):
    """The report's body: who sent it and when, the campaign and warband it was sent from (each when given), then the
    message."""
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
    return "\n".join(lines)


def send_feedback_report_email(*, user, report_type, message, **context):
    """Queue a feedback report email to FEEDBACK_REPORT_TO_EMAIL; `context` is the campaign and warband it was sent
    from. Returns False when email isn't configured."""
    to_email = getattr(settings, "FEEDBACK_REPORT_TO_EMAIL", "")
    if not email_configured():
        logger.warning("RESEND_API_KEY not set; skipping feedback report email for user %s", user.pk)
        return False
    if not to_email:
        logger.warning("FEEDBACK_REPORT_TO_EMAIL not set; skipping feedback report email for user %s", user.pk)
        return False

    text = feedback_text(user=user, report_type=report_type, message=message, **context)
    _queue_email(to_email, feedback_subject(user, report_type, message), text, "feedback report")
    return True
