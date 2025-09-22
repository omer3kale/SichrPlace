import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
};

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

if (!emailConfig.auth.user || !emailConfig.auth.pass) {
  console.error('Missing email configuration variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const {
      template_type,
      recipient_email,
      recipient_name,
      template_data = {},
      send_immediately = true,
      priority = 'normal'
    } = JSON.parse(event.body);

    if (!template_type || !recipient_email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Template type and recipient email are required'
        })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient_email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid email format'
        })
      };
    }

    // Get email template
    const template = await getEmailTemplate(template_type, template_data);
    if (!template) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: `Email template not found: ${template_type}`
        })
      };
    }

    // Create email record
    const emailRecord = {
      template_type: template_type,
      recipient_email: recipient_email,
      recipient_name: recipient_name || '',
      subject: template.subject,
      html_content: template.html,
      text_content: template.text,
      template_data: template_data,
      status: send_immediately ? 'sending' : 'queued',
      priority: priority,
      scheduled_at: send_immediately ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save email to database
    const { data: savedEmail, error: saveError } = await supabase
      .from('email_logs')
      .insert([emailRecord])
      .select('id')
      .single();

    if (saveError) {
      console.error('Failed to save email record:', saveError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Failed to save email record',
          error: saveError.message
        })
      };
    }

    const emailId = savedEmail.id;

    // Send email immediately if requested
    if (send_immediately) {
      try {
        const emailResult = await sendEmail({
          to: recipient_email,
          subject: template.subject,
          html: template.html,
          text: template.text
        });

        // Update email status
        await supabase
          .from('email_logs')
          .update({
            status: emailResult.success ? 'sent' : 'failed',
            sent_at: emailResult.success ? new Date().toISOString() : null,
            error_message: emailResult.error || null,
            message_id: emailResult.messageId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);

        return {
          statusCode: emailResult.success ? 200 : 500,
          headers,
          body: JSON.stringify({
            success: emailResult.success,
            message: emailResult.success ? 'Email sent successfully' : 'Email sending failed',
            data: {
              email_id: emailId,
              template_type: template_type,
              recipient: recipient_email,
              status: emailResult.success ? 'sent' : 'failed',
              message_id: emailResult.messageId,
              error: emailResult.error
            }
          })
        };

      } catch (sendError) {
        // Update email status to failed
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: sendError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailId);

        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email sending failed',
            data: {
              email_id: emailId,
              error: sendError.message
            }
          })
        };
      }
    } else {
      // Email queued for later sending
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Email queued successfully',
          data: {
            email_id: emailId,
            template_type: template_type,
            recipient: recipient_email,
            status: 'queued'
          }
        })
      };
    }

  } catch (error) {
    console.error('Email service error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email service failed',
        error: error.message
      })
    };
  }
};

// Get email template by type
async function getEmailTemplate(templateType, templateData) {
  const templates = {
    welcome: {
      subject: 'Welcome to SichrPlace - Your Housing Journey Starts Here!',
      html: generateWelcomeEmailHTML(templateData),
      text: generateWelcomeEmailText(templateData)
    },
    booking_confirmation: {
      subject: 'Booking Confirmed - Your SichrPlace Reservation',
      html: generateBookingConfirmationHTML(templateData),
      text: generateBookingConfirmationText(templateData)
    },
    booking_reminder: {
      subject: 'Upcoming Check-in Reminder - SichrPlace',
      html: generateBookingReminderHTML(templateData),
      text: generateBookingReminderText(templateData)
    },
    booking_cancelled: {
      subject: 'Booking Cancelled - SichrPlace',
      html: generateBookingCancelledHTML(templateData),
      text: generateBookingCancelledText(templateData)
    },
    password_reset: {
      subject: 'Password Reset Request - SichrPlace',
      html: generatePasswordResetHTML(templateData),
      text: generatePasswordResetText(templateData)
    },
    email_verification: {
      subject: 'Verify Your Email Address - SichrPlace',
      html: generateEmailVerificationHTML(templateData),
      text: generateEmailVerificationText(templateData)
    },
    landlord_inquiry: {
      subject: 'New Inquiry for Your Property - SichrPlace',
      html: generateLandlordInquiryHTML(templateData),
      text: generateLandlordInquiryText(templateData)
    },
    gdpr_data_export: {
      subject: 'Your Data Export Request - SichrPlace',
      html: generateGDPRDataExportHTML(templateData),
      text: generateGDPRDataExportText(templateData)
    },
    gdpr_deletion_confirmation: {
      subject: 'Account Deletion Confirmation - SichrPlace',
      html: generateGDPRDeletionHTML(templateData),
      text: generateGDPRDeletionText(templateData)
    },
    newsletter: {
      subject: templateData.subject || 'SichrPlace Newsletter',
      html: generateNewsletterHTML(templateData),
      text: generateNewsletterText(templateData)
    }
  };

  return templates[templateType] || null;
}

// Send email using nodemailer
async function sendEmail({ to, subject, html, text }) {
  try {
    const transporter = nodemailer.createTransporter(emailConfig);

    const mailOptions = {
      from: `"SichrPlace" <${emailConfig.auth.user}>`,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };

  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Email template generators
function generateWelcomeEmailHTML(data) {
  const { user_name = 'User', verification_link = '' } = data;
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome to SichrPlace</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 Welcome to SichrPlace!</h1>
            </div>
            <div class="content">
                <h2>Hello ${user_name}!</h2>
                <p>Thank you for joining SichrPlace, your trusted platform for finding the perfect accommodation.</p>
                <p>We're excited to have you on board! Here's what you can do with your new account:</p>
                <ul>
                    <li>🔍 Search thousands of apartments and rooms</li>
                    <li>💬 Connect directly with landlords</li>
                    <li>📅 Book viewings and accommodations</li>
                    <li>⭐ Read and write reviews</li>
                    <li>🛡️ Enjoy secure, verified listings</li>
                </ul>
                ${verification_link ? `<p>Please verify your email address to get started:</p><a href="${verification_link}" class="button">Verify Email Address</a>` : ''}
                <p>If you have any questions, our support team is here to help!</p>
                <p>Happy house hunting!</p>
                <p>Best regards,<br>The SichrPlace Team</p>
            </div>
            <div class="footer">
                <p>© 2025 SichrPlace. All rights reserved.</p>
                <p>This email was sent to you because you created an account on SichrPlace.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function generateWelcomeEmailText(data) {
  const { user_name = 'User', verification_link = '' } = data;
  return `
Welcome to SichrPlace!

Hello ${user_name}!

Thank you for joining SichrPlace, your trusted platform for finding the perfect accommodation.

We're excited to have you on board! Here's what you can do with your new account:
- Search thousands of apartments and rooms
- Connect directly with landlords  
- Book viewings and accommodations
- Read and write reviews
- Enjoy secure, verified listings

${verification_link ? `Please verify your email address: ${verification_link}` : ''}

If you have any questions, our support team is here to help!

Happy house hunting!

Best regards,
The SichrPlace Team

© 2025 SichrPlace. All rights reserved.
  `;
}

function generateBookingConfirmationHTML(data) {
  const { 
    user_name = 'User', 
    apartment_title = 'Apartment',
    check_in_date = '',
    check_out_date = '',
    total_amount = 0,
    booking_id = '',
    landlord_contact = ''
  } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Confirmed</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .booking-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Booking Confirmed!</h1>
            </div>
            <div class="content">
                <h2>Great news, ${user_name}!</h2>
                <p>Your booking has been confirmed. Here are the details:</p>
                
                <div class="booking-details">
                    <h3>Booking Details</h3>
                    <p><strong>Property:</strong> ${apartment_title}</p>
                    <p><strong>Check-in:</strong> ${check_in_date}</p>
                    <p><strong>Check-out:</strong> ${check_out_date}</p>
                    <p><strong>Total Amount:</strong> €${total_amount}</p>
                    <p><strong>Booking ID:</strong> ${booking_id}</p>
                    ${landlord_contact ? `<p><strong>Landlord Contact:</strong> ${landlord_contact}</p>` : ''}
                </div>
                
                <p>Please save this confirmation for your records. You'll receive a reminder email closer to your check-in date.</p>
                <p>If you need to make any changes or have questions, please contact us immediately.</p>
                
                <p>We hope you have a wonderful stay!</p>
                <p>Best regards,<br>The SichrPlace Team</p>
            </div>
            <div class="footer">
                <p>© 2025 SichrPlace. All rights reserved.</p>
                <p>Booking confirmation for ${user_name}</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function generateBookingConfirmationText(data) {
  const { 
    user_name = 'User', 
    apartment_title = 'Apartment',
    check_in_date = '',
    check_out_date = '',
    total_amount = 0,
    booking_id = '',
    landlord_contact = ''
  } = data;
  
  return `
Booking Confirmed!

Great news, ${user_name}!

Your booking has been confirmed. Here are the details:

Booking Details:
- Property: ${apartment_title}
- Check-in: ${check_in_date}
- Check-out: ${check_out_date}
- Total Amount: €${total_amount}
- Booking ID: ${booking_id}
${landlord_contact ? `- Landlord Contact: ${landlord_contact}` : ''}

Please save this confirmation for your records. You'll receive a reminder email closer to your check-in date.

If you need to make any changes or have questions, please contact us immediately.

We hope you have a wonderful stay!

Best regards,
The SichrPlace Team

© 2025 SichrPlace. All rights reserved.
  `;
}

function generateBookingReminderHTML(data) {
  const { user_name = 'User', apartment_title = 'Apartment', check_in_date = '', landlord_contact = '' } = data;
  return `<html><body><h2>Check-in Reminder</h2><p>Hi ${user_name}, your check-in for ${apartment_title} is tomorrow (${check_in_date}). Contact: ${landlord_contact}</p></body></html>`;
}

function generateBookingReminderText(data) {
  const { user_name = 'User', apartment_title = 'Apartment', check_in_date = '', landlord_contact = '' } = data;
  return `Check-in Reminder\n\nHi ${user_name}, your check-in for ${apartment_title} is tomorrow (${check_in_date}). Contact: ${landlord_contact}`;
}

function generateBookingCancelledHTML(data) {
  const { user_name = 'User', apartment_title = 'Apartment', booking_id = '' } = data;
  return `<html><body><h2>Booking Cancelled</h2><p>Hi ${user_name}, your booking for ${apartment_title} (ID: ${booking_id}) has been cancelled.</p></body></html>`;
}

function generateBookingCancelledText(data) {
  const { user_name = 'User', apartment_title = 'Apartment', booking_id = '' } = data;
  return `Booking Cancelled\n\nHi ${user_name}, your booking for ${apartment_title} (ID: ${booking_id}) has been cancelled.`;
}

function generatePasswordResetHTML(data) {
  const { user_name = 'User', reset_link = '' } = data;
  return `<html><body><h2>Password Reset</h2><p>Hi ${user_name}, click here to reset your password: <a href="${reset_link}">Reset Password</a></p></body></html>`;
}

function generatePasswordResetText(data) {
  const { user_name = 'User', reset_link = '' } = data;
  return `Password Reset\n\nHi ${user_name}, click here to reset your password: ${reset_link}`;
}

function generateEmailVerificationHTML(data) {
  const { user_name = 'User', verification_link = '' } = data;
  return `<html><body><h2>Email Verification</h2><p>Hi ${user_name}, please verify your email: <a href="${verification_link}">Verify Email</a></p></body></html>`;
}

function generateEmailVerificationText(data) {
  const { user_name = 'User', verification_link = '' } = data;
  return `Email Verification\n\nHi ${user_name}, please verify your email: ${verification_link}`;
}

function generateLandlordInquiryHTML(data) {
  const { landlord_name = 'Landlord', apartment_title = 'Property', inquirer_name = 'User', message = '' } = data;
  return `<html><body><h2>New Property Inquiry</h2><p>Hi ${landlord_name}, ${inquirer_name} is interested in ${apartment_title}. Message: ${message}</p></body></html>`;
}

function generateLandlordInquiryText(data) {
  const { landlord_name = 'Landlord', apartment_title = 'Property', inquirer_name = 'User', message = '' } = data;
  return `New Property Inquiry\n\nHi ${landlord_name}, ${inquirer_name} is interested in ${apartment_title}. Message: ${message}`;
}

function generateGDPRDataExportHTML(data) {
  const { user_name = 'User', download_link = '' } = data;
  return `<html><body><h2>Your Data Export</h2><p>Hi ${user_name}, your data export is ready: <a href="${download_link}">Download Data</a></p></body></html>`;
}

function generateGDPRDataExportText(data) {
  const { user_name = 'User', download_link = '' } = data;
  return `Your Data Export\n\nHi ${user_name}, your data export is ready: ${download_link}`;
}

function generateGDPRDeletionHTML(data) {
  const { user_name = 'User' } = data;
  return `<html><body><h2>Account Deleted</h2><p>Hi ${user_name}, your account and all associated data have been permanently deleted as requested.</p></body></html>`;
}

function generateGDPRDeletionText(data) {
  const { user_name = 'User' } = data;
  return `Account Deleted\n\nHi ${user_name}, your account and all associated data have been permanently deleted as requested.`;
}

function generateNewsletterHTML(data) {
  const { content = 'Newsletter content', unsubscribe_link = '' } = data;
  return `<html><body><div>${content}</div><p><a href="${unsubscribe_link}">Unsubscribe</a></p></body></html>`;
}

function generateNewsletterText(data) {
  const { content = 'Newsletter content', unsubscribe_link = '' } = data;
  return `${content}\n\nUnsubscribe: ${unsubscribe_link}`;
}