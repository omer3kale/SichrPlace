import nodemailer from 'nodemailer';

const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS;

if (!emailUser || !emailPassword) {
  throw new Error('Missing email credentials: EMAIL_USER and EMAIL_PASSWORD (or GMAIL_USER/GMAIL_APP_PASSWORD)');
}

const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const emailPort = Number.parseInt(process.env.EMAIL_PORT || '587', 10);
const emailSecure = process.env.EMAIL_SECURE === 'true' || emailPort === 465;

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailSecure,
    auth: {
      user: emailUser,
      pass: emailPassword
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  return cachedTransporter;
};

const buildVerificationTemplate = ({ firstName, verificationUrl }) => {
  const safeName = firstName && typeof firstName === 'string' && firstName.trim().length
    ? firstName.trim()
    : 'there';

  return {
    subject: 'Welcome to SichrPlace – Verify your email',
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your SichrPlace email</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
      .container { max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08); border-radius: 16px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 40px 32px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 32px; }
      .content { padding: 40px 32px; color: #1f2937; }
      .content h2 { font-size: 24px; margin-bottom: 16px; }
      .content p { margin: 12px 0; line-height: 1.6; }
      .btn { display: inline-block; margin-top: 28px; padding: 16px 32px; background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: #fff; text-decoration: none; border-radius: 9999px; font-weight: 600; letter-spacing: 0.02em; }
      .btn:hover { background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); }
      .link { word-break: break-all; color: #2563eb; }
      .footnote { margin-top: 32px; font-size: 13px; color: #64748b; }
      .footer { padding: 24px 32px; background: #f1f5f9; text-align: center; font-size: 13px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🏠 SichrPlace</h1>
        <p>Secure apartment viewings made simple</p>
      </div>
      <div class="content">
        <h2>Welcome, ${safeName}!</h2>
        <p>Thanks for creating a SichrPlace account. To keep your account secure and unlock all features, we need to confirm your email address.</p>
        <p>Please click the button below within the next 24 hours:</p>
        <p style="text-align:center;">
          <a href="${verificationUrl}" class="btn">Verify email address</a>
        </p>
        <p>If the button doesn’t work, copy and paste this link into your browser:</p>
        <p class="link">${verificationUrl}</p>
        <div class="footnote">
          <p>If you didn’t sign up for SichrPlace, you can safely ignore this email.</p>
          <p>This verification link expires in 24 hours to keep your account secure.</p>
        </div>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} SichrPlace. All rights reserved.</p>
        <p>Questions? Contact <a href="mailto:support@sichrplace.com" class="link" style="color:#2563eb;">support@sichrplace.com</a></p>
      </div>
    </div>
  </body>
</html>`,
    text: `Welcome to SichrPlace!\n\nHi ${safeName},\n\nPlease verify your email address within 24 hours to finish setting up your account: ${verificationUrl}\n\nIf you didn't create this account, you can ignore this message.\n\n— The SichrPlace Team`
  };
};

export const sendVerificationEmail = async ({ to, firstName, verificationToken }) => {
  if (!to) {
    throw new Error('Recipient email is required to send verification email');
  }

  if (!verificationToken) {
    throw new Error('Verification token is required to send verification email');
  }

  const verificationUrlBase = process.env.FRONTEND_URL || 'https://www.sichrplace.com';
  const verificationUrl = `${verificationUrlBase.replace(/\/$/, '')}/verify-email.html?token=${encodeURIComponent(verificationToken)}`;
  const template = buildVerificationTemplate({ firstName, verificationUrl });

  const transporter = getTransporter();
  const result = await transporter.sendMail({
    from: {
      name: 'SichrPlace Team',
      address: emailUser
    },
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  return {
    success: true,
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected
  };
};
