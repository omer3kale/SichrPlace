// Quick Gmail SMTP verification for SichrPlace
import nodemailer from 'nodemailer';
import { config } from 'dotenv';
config();

(async () => {
  console.log('📧 Verifying Gmail SMTP configuration...');
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('❌ Missing env vars. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`   User: ${user}`);
  console.log(`   App Password: ${pass && pass.length >= 16 ? 'present (hidden)' : 'looks invalid/placeholder'}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified successfully.');
    console.log('   You can now send emails from SichrPlace.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gmail SMTP verification failed:');
    console.error(`   ${err.message}`);
    console.log('\nHow to fix:');
    console.log('1) Enable 2-Step Verification on the Gmail account');
    console.log('2) Generate an App Password at: https://myaccount.google.com/apppasswords');
    console.log('3) Paste the 16-character password (no spaces) into .env as GMAIL_APP_PASSWORD');
    console.log('4) Re-run: node js/backend/verify-gmail-smtp.js');
    process.exit(2);
  }
})();