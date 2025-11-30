# Gmail Email Verification Setup Guide

This application uses Gmail SMTP to send email verification links to new users during registration.

## Setup Steps

### 1. Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Follow the prompts to enable 2FA if not already enabled

### 2. Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
2. Select **App**: Choose "Mail" or "Other (Custom name)"
3. Select **Device**: Choose your device or enter a custom name (e.g., "Career Guidance App")
4. Click **Generate**
5. Copy the 16-character password (remove spaces)

### 3. Configure Environment Variables

Open the `.env` file in the project root and update:

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
FRONTEND_URL=http://localhost:5173
```

**Important Notes:**
- Use your full Gmail address for `GMAIL_USER`
- Use the 16-character App Password (not your regular Gmail password)
- For production, update `FRONTEND_URL` to your production domain

### 4. Restart the Backend Server

After updating `.env`, restart the FastAPI server:

```powershell
# Stop the current server (Ctrl+C)
# Then restart it
cd "D:\Career Guidence\resume_pipeline"
python -m uvicorn resume_pipeline.app:app --reload
```

## How It Works

### Registration Flow

1. **User Registration**: User fills out the registration form
2. **Token Generation**: Backend generates a secure random token (32 bytes)
3. **Email Sent**: Verification email sent to user's email address
4. **User Clicks Link**: Email contains link like `http://localhost:5173/verify-email?token=abc123...`
5. **Verification**: Backend validates token and marks user as verified
6. **Complete**: User can now login with full access

### Email Content

The verification email includes:
- Professional HTML template
- Verification link (valid for 24 hours)
- Instructions to ignore if not requested
- Branding with your application name

### Token Expiry

- Verification tokens are valid for **24 hours**
- After expiry, users can request a new verification email
- Old tokens are automatically invalidated when new ones are generated

## Testing

### Test the Email System

1. Start the backend server
2. Open frontend at `http://localhost:5173`
3. Click **Register** and create a new account
4. Check your email inbox (and spam folder)
5. Click the verification link
6. Confirm you're redirected to login page

### Troubleshooting

**Email not received?**
- Check spam/junk folder
- Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are correct in `.env`
- Check backend logs for SMTP errors
- Ensure 2FA is enabled on your Google account
- Make sure you're using an App Password, not your regular password

**"SMTPAuthenticationError"**
- App Password might be incorrect
- 2FA might not be enabled
- Try generating a new App Password

**"Connection refused"**
- Check your internet connection
- Gmail SMTP might be blocked by firewall
- Try using a different network

**Token expired**
- Tokens are valid for 24 hours only
- Use the "Resend verification" link to get a new token

## Security Notes

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use App Passwords** - Never use your actual Gmail password
3. **Rotate App Passwords** - Generate new ones periodically
4. **Production**: Use environment variables or secrets manager for production deployment
5. **Rate Limiting**: Consider adding rate limiting to prevent spam

## Production Considerations

For production deployment:

1. **Use a dedicated email service**:
   - SendGrid
   - AWS SES
   - Mailgun
   - Postmark

2. **Update FRONTEND_URL**:
   ```env
   FRONTEND_URL=https://your-production-domain.com
   ```

3. **Set up DKIM/SPF** for better deliverability

4. **Monitor email delivery** and bounces

5. **Implement rate limiting** to prevent abuse

## Additional Features

The system includes:

- ✅ Email verification on registration
- ✅ Token expiry (24 hours)
- ✅ Resend verification email
- ✅ Professional HTML email template
- ✅ Non-blocking email sending (registration succeeds even if email fails)
- ✅ Frontend verification pages with proper UX

## Support

If you encounter issues:

1. Check backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a different email address
4. Ensure Gmail SMTP is not blocked by your network

For Gmail-specific issues, refer to:
- https://support.google.com/accounts/answer/185833 (App Passwords)
- https://support.google.com/mail/answer/7126229 (SMTP settings)
