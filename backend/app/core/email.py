"""
Email sending utilities and verification links.
"""

import logging

logger = logging.getLogger("histofacts.email")


async def send_email(to_email: str, subject: str, body: str) -> None:
    """Send an email. In development / testing, logs the email details."""
    logger.info("========== EMAIL DISPATCH ==========")
    logger.info("To: %s", to_email)
    logger.info("Subject: %s", subject)
    logger.info("Body:\n%s", body)
    logger.info("====================================")


def verification_link(token: str) -> str:
    """Return confirmation link for email change."""
    return f"http://localhost:5173/settings?confirm_email_token={token}"
