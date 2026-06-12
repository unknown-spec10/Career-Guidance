"""SMTP smoke test for password reset emails.

Usage (from repo root):
  "d:/Career Guidence/myenv/Scripts/python.exe" resume_pipeline/tests/test_smtp_password_reset.py
  "d:/Career Guidence/myenv/Scripts/python.exe" resume_pipeline/tests/test_smtp_password_reset.py --to someone@example.com --code 123456
"""

from __future__ import annotations

import argparse
import logging
import smtplib
import sys
from email.mime.text import MIMEText
from pathlib import Path

# Ensure imports work when run as a standalone script from repo root.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from resume_pipeline.config import settings
from resume_pipeline.email_verification import send_password_reset_code_email


def _mask(value: str | None) -> str:
    if not value:
        return "<missing>"
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"


def probe_smtp_login() -> tuple[bool, str]:
    """Try a direct Gmail SMTP login and return details."""
    gmail_user = settings.GMAIL_USER
    gmail_password = settings.GMAIL_APP_PASSWORD

    if not gmail_user or not gmail_password:
        return False, "Missing GMAIL_USER or GMAIL_APP_PASSWORD"

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
            server.login(gmail_user, gmail_password)
        return True, "SMTP login successful"
    except smtplib.SMTPAuthenticationError as exc:
        return False, f"SMTP authentication failed: {exc.smtp_code} {exc.smtp_error!r}"
    except Exception as exc:
        return False, f"SMTP connection/login error: {type(exc).__name__}: {exc}"


def direct_send_test(to_email: str) -> tuple[bool, str]:
    """Send a plain text test email directly via SMTP."""
    gmail_user = settings.GMAIL_USER
    gmail_password = settings.GMAIL_APP_PASSWORD

    if not gmail_user or not gmail_password:
        return False, "Missing GMAIL_USER or GMAIL_APP_PASSWORD"

    msg = MIMEText("This is a direct SMTP connectivity test from Career Guidance backend.")
    msg["Subject"] = "Career Guidance SMTP Direct Test"
    msg["From"] = f"Career Guidance <{gmail_user}>"
    msg["To"] = to_email

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        return True, f"Direct SMTP test email sent to {to_email}"
    except Exception as exc:
        return False, f"Direct SMTP send failed: {type(exc).__name__}: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Gmail SMTP + password reset email send")
    parser.add_argument("--to", dest="to_email", default=None, help="Recipient email")
    parser.add_argument("--code", dest="code", default="123456", help="Reset code to send")
    parser.add_argument("--name", dest="user_name", default="SMTP Test User", help="Name for email template")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    to_email = args.to_email or settings.GMAIL_USER

    print("=== SMTP Configuration Snapshot ===")
    print(f"GMAIL_USER: {_mask(settings.GMAIL_USER)}")
    print(f"GMAIL_APP_PASSWORD: {_mask(settings.GMAIL_APP_PASSWORD)}")
    print(f"Recipient: {to_email or '<missing>'}")

    ok_login, login_msg = probe_smtp_login()
    print(f"SMTP login check: {'PASS' if ok_login else 'FAIL'} - {login_msg}")

    if not to_email:
        print("Cannot continue: recipient email is missing. Pass --to or set GMAIL_USER.")
        return 2

    ok_direct, direct_msg = direct_send_test(to_email)
    print(f"Direct SMTP send: {'PASS' if ok_direct else 'FAIL'} - {direct_msg}")

    ok_reset = send_password_reset_code_email(
        to_email=to_email,
        code=args.code,
        user_name=args.user_name,
    )
    print(
        "Password-reset template send: "
        f"{'PASS' if ok_reset else 'FAIL'}"
    )

    if ok_login and ok_direct and ok_reset:
        print("Result: SMTP and password-reset email flow are working.")
        return 0

    print("Result: One or more checks failed. Review output above for exact reason.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
