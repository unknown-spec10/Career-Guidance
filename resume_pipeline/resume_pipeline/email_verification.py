"""
Email verification utilities
"""
import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
import logging
from .config import settings

logger = logging.getLogger(__name__)


def generate_verification_token() -> str:
    """Generate a secure random verification token"""
    return secrets.token_urlsafe(32)


def generate_verification_code(length: int = 6, digits_only: bool = True) -> str:
    """Generate a short verification code (default 6 digits)."""
    if digits_only:
        # Ensure first digit isn't zero for UX
        first = secrets.choice("123456789")
        rest = ''.join(secrets.choice("0123456789") for _ in range(max(0, length - 1)))
        return first + rest
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # exclude ambiguous chars
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def send_verification_email(to_email: str, verification_token: str, user_name: str) -> bool:
    """Send verification email via Gmail SMTP"""
    try:
        # Get Gmail credentials from settings
        gmail_user = settings.GMAIL_USER
        gmail_password = settings.GMAIL_APP_PASSWORD
        
        if not gmail_user or not gmail_password:
            logger.error("Gmail credentials not configured in environment")
            return False
        
        # Create verification link
        frontend_url = settings.FRONTEND_URL or "http://localhost:5173"
        verification_link = f"{frontend_url}/verify-email?token={verification_token}"
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Verify Your Career Guidance Account'
        msg['From'] = f"Career Guidance <{gmail_user}>"
        msg['To'] = to_email
        
        # HTML email body
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6366f1;">Welcome to Career Guidance Platform!</h2>
                    <p>Hello {user_name},</p>
                    <p>Thank you for registering with Career Guidance. Please verify your email address to complete your registration.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_link}" 
                           style="background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify Email Address
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        Or copy and paste this link in your browser:<br>
                        <a href="{verification_link}" style="color: #6366f1;">{verification_link}</a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 24 hours.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        If you didn't create an account, please ignore this email.
                    </p>
                </div>
            </body>
        </html>
        """
        
        # Plain text fallback
        text = f"""
        Welcome to Career Guidance Platform!
        
        Hello {user_name},
        
        Thank you for registering with Career Guidance. Please verify your email address by clicking the link below:
        
        {verification_link}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, please ignore this email.
        """
        
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        
        logger.info(f"Verification email sent to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        return False


def send_verification_code_email(to_email: str, code: str, user_name: str) -> bool:
    """Send a verification CODE email via Gmail SMTP."""
    try:
        gmail_user = settings.GMAIL_USER
        gmail_password = settings.GMAIL_APP_PASSWORD

        if not gmail_user or not gmail_password:
            logger.error("Gmail credentials not configured in environment")
            return False

        ttl_min = settings.VERIFICATION_CODE_TTL_MINUTES or 30

        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Your Career Guidance Verification Code'
        msg['From'] = f"Career Guidance <{gmail_user}>"
        msg['To'] = to_email

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6366f1;">Verify your email</h2>
                    <p>Hello {user_name},</p>
                    <p>Use the verification code below to complete your registration:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="display: inline-block; padding: 14px 24px; font-size: 24px; letter-spacing: 6px; font-weight: 700; background: #f3f4f6; border-radius: 8px; border: 1px solid #e5e7eb;">
                            {code}
                        </div>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code expires in {ttl_min} minutes.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
                </div>
            </body>
        </html>
        """

        text = f"""
        Your verification code is: {code}

        This code expires in {ttl_min} minutes.
        """

        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)

        logger.info(f"Verification code email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification code to {to_email}: {e}")
        return False


def send_password_reset_code_email(to_email: str, code: str, user_name: str) -> bool:
    """Send a password reset CODE email via Gmail SMTP."""
    try:
        gmail_user = settings.GMAIL_USER
        gmail_password = settings.GMAIL_APP_PASSWORD

        if not gmail_user or not gmail_password:
            logger.error("Gmail credentials not configured in environment")
            return False

        ttl_min = settings.VERIFICATION_CODE_TTL_MINUTES or 30

        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Your Career Guidance Password Reset Code'
        msg['From'] = f"Career Guidance <{gmail_user}>"
        msg['To'] = to_email

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6366f1;">Password Reset Request</h2>
                    <p>Hello {user_name},</p>
                    <p>You requested a password reset for your Career Guidance account. Use the code below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="display: inline-block; padding: 14px 24px; font-size: 24px; letter-spacing: 6px; font-weight: 700; background: #fef3c7; border-radius: 8px; border: 1px solid #fbbf24;">
                            {code}
                        </div>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code expires in {ttl_min} minutes.</p>
                    <p style="color: #dc2626; font-size: 14px; font-weight: 600;">⚠️ If you didn't request this password reset, please ignore this email and ensure your account is secure.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">For security reasons, never share this code with anyone.</p>
                </div>
            </body>
        </html>
        """

        text = f"""
        Password Reset Request

        Hello {user_name},

        You requested a password reset for your Career Guidance account.
        
        Your reset code is: {code}

        This code expires in {ttl_min} minutes.

        If you didn't request this password reset, please ignore this email and ensure your account is secure.
        """

        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_user, gmail_password)
            server.send_message(msg)

        logger.info(f"Password reset code email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset code to {to_email}: {e}")
        return False


def is_token_expired(created_at: datetime, expiry_hours: int = 24) -> bool:
    """Check if verification token has expired"""
    expiry_time = created_at + timedelta(hours=expiry_hours)
    return datetime.utcnow() > expiry_time


def is_code_expired(created_at: datetime, ttl_minutes: int = 30) -> bool:
    """Check if verification code has expired"""
    expiry_time = created_at + timedelta(minutes=ttl_minutes)
    return datetime.utcnow() > expiry_time
