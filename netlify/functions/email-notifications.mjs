import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

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

  try {
    const { action } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: [
            'send_notification', 
            'create_notification', 
            'mark_read', 
            'mark_all_read',
            'get_notifications',
            'delete_notification',
            'send_system_alert',
            'send_promotional',
            'unsubscribe'
          ]
        })
      };
    }

    switch (action) {
      case 'send_notification':
        return await sendNotification(event.body, headers);
      
      case 'create_notification':
        return await createNotification(event.body, headers);
      
      case 'mark_read':
        return await markNotificationRead(event.body, headers);
      
      case 'mark_all_read':
        return await markAllNotificationsRead(event.body, headers);
      
      case 'get_notifications':
        return await getNotifications(event.queryStringParameters, headers);
      
      case 'delete_notification':
        return await deleteNotification(event.body, headers);
      
      case 'send_system_alert':
        return await sendSystemAlert(event.body, headers);
      
      case 'send_promotional':
        return await sendPromotionalEmail(event.body, headers);
      
      case 'unsubscribe':
        return await unsubscribeUser(event.body, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified'
          })
        };
    }

  } catch (error) {
    console.error('Notification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Notification operation failed',
        error: error.message
      })
    };
  }
};

// Send notification (email + in-app)
async function sendNotification(requestBody, headers) {
  try {
    const {
      user_id,
      notification_type,
      title,
      message,
      action_url,
      email_required = true,
      priority = 'normal',
      category = 'general'
    } = JSON.parse(requestBody);

    if (!user_id || !notification_type || !title || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: user_id, notification_type, title, message'
        })
      };
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, username, notification_settings')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User not found'
        })
      };
    }

    // Check user notification preferences
    const notificationSettings = user.notification_settings || {};
    const emailEnabled = notificationSettings.email !== false;
    const categoryEnabled = notificationSettings[category] !== false;

    if (!categoryEnabled) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Notification skipped - user preferences',
          notification_sent: false
        })
      };
    }

    // Create in-app notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: user_id,
        type: notification_type,
        title: title,
        message: message,
        action_url: action_url,
        priority: priority,
        category: category,
        is_read: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (notificationError) {
      throw notificationError;
    }

    // Send email notification if required and enabled
    let emailSent = false;
    if (email_required && emailEnabled && user.email) {
      try {
        const emailTemplate = generateNotificationEmail(
          user.username,
          title,
          message,
          action_url,
          notification_type
        );

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'SichrPlace <noreply@sichrplace.com>',
          to: user.email,
          subject: `SichrPlace: ${title}`,
          html: emailTemplate.html,
          text: emailTemplate.text
        });

        emailSent = true;

        // Log email delivery
        await supabase.from('email_logs').insert([{
          user_id: user_id,
          email_type: 'notification',
          subject: title,
          status: 'sent',
          sent_at: new Date().toISOString(),
          notification_id: notification.id
        }]);

      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Continue without failing the entire request
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        data: {
          notification_id: notification.id,
          in_app_sent: true,
          email_sent: emailSent,
          priority: priority,
          category: category
        }
      })
    };

  } catch (error) {
    console.error('Send notification error:', error);
    throw error;
  }
}

// Create notification without sending email
async function createNotification(requestBody, headers) {
  try {
    const {
      user_id,
      notification_type,
      title,
      message,
      action_url,
      priority = 'normal',
      category = 'general'
    } = JSON.parse(requestBody);

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: user_id,
        type: notification_type,
        title: title,
        message: message,
        action_url: action_url,
        priority: priority,
        category: category,
        is_read: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification created successfully',
        data: notification
      })
    };

  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
}

// Mark notification as read
async function markNotificationRead(requestBody, headers) {
  try {
    const { notification_id, user_id } = JSON.parse(requestBody);

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .match({ id: notification_id, user_id: user_id })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification marked as read',
        data: data
      })
    };

  } catch (error) {
    console.error('Mark notification read error:', error);
    throw error;
  }
}

// Mark all notifications as read for user
async function markAllNotificationsRead(requestBody, headers) {
  try {
    const { user_id } = JSON.parse(requestBody);

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('is_read', false)
      .select('id');

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'All notifications marked as read',
        data: {
          updated_count: data?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    throw error;
  }
}

// Get user notifications
async function getNotifications(queryParams, headers) {
  try {
    const {
      user_id,
      limit = '20',
      offset = '0',
      unread_only = 'false',
      category,
      priority
    } = queryParams || {};

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw error;
    }

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('is_read', false);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          notifications: notifications || [],
          unread_count: unreadCount || 0,
          total_fetched: notifications?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get notifications error:', error);
    throw error;
  }
}

// Delete notification
async function deleteNotification(requestBody, headers) {
  try {
    const { notification_id, user_id } = JSON.parse(requestBody);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .match({ id: notification_id, user_id: user_id });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification deleted successfully'
      })
    };

  } catch (error) {
    console.error('Delete notification error:', error);
    throw error;
  }
}

// Send system alert to multiple users
async function sendSystemAlert(requestBody, headers) {
  try {
    const {
      user_ids = [],
      title,
      message,
      priority = 'high',
      send_email = true,
      alert_type = 'system'
    } = JSON.parse(requestBody);

    if (!title || !message || user_ids.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Title, message, and user_ids are required'
        })
      };
    }

    const notifications = user_ids.map(user_id => ({
      user_id: user_id,
      type: alert_type,
      title: title,
      message: message,
      priority: priority,
      category: 'system',
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { data: createdNotifications, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) {
      throw error;
    }

    // Send emails if required
    if (send_email) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, username, notification_settings')
        .in('id', user_ids);

      if (!userError && users) {
        const emailPromises = users
          .filter(user => user.email && (user.notification_settings?.email !== false))
          .map(async (user) => {
            try {
              const emailTemplate = generateSystemAlertEmail(
                user.username,
                title,
                message,
                alert_type
              );

              await transporter.sendMail({
                from: process.env.SMTP_FROM || 'SichrPlace <alerts@sichrplace.com>',
                to: user.email,
                subject: `🚨 SichrPlace Alert: ${title}`,
                html: emailTemplate.html,
                text: emailTemplate.text,
                priority: priority === 'critical' ? 'high' : 'normal'
              });

              return { user_id: user.id, email_sent: true };
            } catch (emailError) {
              console.error(`Email failed for user ${user.id}:`, emailError);
              return { user_id: user.id, email_sent: false };
            }
          });

        await Promise.all(emailPromises);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'System alert sent successfully',
        data: {
          notifications_created: createdNotifications.length,
          alert_type: alert_type,
          priority: priority
        }
      })
    };

  } catch (error) {
    console.error('Send system alert error:', error);
    throw error;
  }
}

// Send promotional email
async function sendPromotionalEmail(requestBody, headers) {
  try {
    const {
      user_ids = [],
      subject,
      content,
      template_type = 'promotional',
      campaign_id
    } = JSON.parse(requestBody);

    if (!subject || !content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Subject and content are required'
        })
      };
    }

    // Get users who haven't unsubscribed from promotional emails
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, username, notification_settings')
      .in('id', user_ids)
      .neq('email', null);

    if (userError) {
      throw userError;
    }

    const eligibleUsers = users.filter(user => 
      user.notification_settings?.promotional !== false &&
      user.notification_settings?.email !== false
    );

    if (eligibleUsers.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No eligible users for promotional email',
          eligible_count: 0
        })
      };
    }

    const emailResults = await Promise.all(
      eligibleUsers.map(async (user) => {
        try {
          const emailTemplate = generatePromotionalEmail(
            user.username,
            subject,
            content,
            user.id
          );

          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'SichrPlace <marketing@sichrplace.com>',
            to: user.email,
            subject: subject,
            html: emailTemplate.html,
            text: emailTemplate.text
          });

          // Log promotional email
          await supabase.from('email_logs').insert([{
            user_id: user.id,
            email_type: 'promotional',
            subject: subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            campaign_id: campaign_id
          }]);

          return { user_id: user.id, status: 'sent' };
        } catch (error) {
          console.error(`Promotional email failed for user ${user.id}:`, error);
          return { user_id: user.id, status: 'failed', error: error.message };
        }
      })
    );

    const successCount = emailResults.filter(r => r.status === 'sent').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Promotional email campaign completed',
        data: {
          total_eligible: eligibleUsers.length,
          emails_sent: successCount,
          campaign_id: campaign_id,
          results: emailResults
        }
      })
    };

  } catch (error) {
    console.error('Send promotional email error:', error);
    throw error;
  }
}

// Unsubscribe user from emails
async function unsubscribeUser(requestBody, headers) {
  try {
    const { user_id, email_type = 'all' } = JSON.parse(requestBody);

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    // Get current settings
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notification_settings')
      .eq('id', user_id)
      .single();

    if (userError) {
      throw userError;
    }

    const currentSettings = user.notification_settings || {};

    // Update notification settings
    let updatedSettings;
    if (email_type === 'all') {
      updatedSettings = { ...currentSettings, email: false };
    } else {
      updatedSettings = { ...currentSettings, [email_type]: false };
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ notification_settings: updatedSettings })
      .eq('id', user_id);

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully unsubscribed from emails',
        data: {
          unsubscribed_from: email_type,
          updated_settings: updatedSettings
        }
      })
    };

  } catch (error) {
    console.error('Unsubscribe error:', error);
    throw error;
  }
}

// Email template generators
function generateNotificationEmail(username, title, message, actionUrl, type) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SichrPlace Notification</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .notification { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .notification-title { font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
            .notification-message { color: #475569; line-height: 1.6; }
            .action-button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SichrPlace</div>
            </div>
            
            <p>Hi ${username},</p>
            
            <div class="notification">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            
            ${actionUrl ? `<a href="${actionUrl}" class="action-button">View Details</a>` : ''}
            
            <div class="footer">
                <p>You received this notification because you have an account with SichrPlace.</p>
                <p><a href="${process.env.FRONTEND_URL}/unsubscribe">Unsubscribe from notifications</a></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    SichrPlace Notification
    
    Hi ${username},
    
    ${title}
    ${message}
    
    ${actionUrl ? `View details: ${actionUrl}` : ''}
    
    You received this notification because you have an account with SichrPlace.
    To unsubscribe: ${process.env.FRONTEND_URL}/unsubscribe
  `;

  return { html, text };
}

function generateSystemAlertEmail(username, title, message, alertType) {
  const urgencyColor = alertType === 'critical' ? '#dc2626' : '#f59e0b';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SichrPlace System Alert</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .alert-header { background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
            .alert-title { font-size: 20px; font-weight: bold; margin: 0; }
            .alert-message { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid ${urgencyColor}; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="alert-header">
                <div class="alert-title">🚨 System Alert</div>
            </div>
            
            <p>Hi ${username},</p>
            
            <h2>${title}</h2>
            
            <div class="alert-message">
                ${message}
            </div>
            
            <p>Please take appropriate action if required.</p>
            
            <div class="footer">
                <p>This is an automated system alert from SichrPlace.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    SichrPlace System Alert
    
    Hi ${username},
    
    🚨 SYSTEM ALERT: ${title}
    
    ${message}
    
    Please take appropriate action if required.
    
    This is an automated system alert from SichrPlace.
  `;

  return { html, text };
}

function generatePromotionalEmail(username, subject, content, userId) {
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?user_id=${userId}&type=promotional`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
            .content { line-height: 1.6; color: #374151; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SichrPlace</div>
            </div>
            
            <p>Hi ${username},</p>
            
            <div class="content">
                ${content}
            </div>
            
            <div class="footer">
                <p>You received this promotional email because you subscribed to SichrPlace updates.</p>
                <p><a href="${unsubscribeUrl}">Unsubscribe from promotional emails</a></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
    ${subject}
    
    Hi ${username},
    
    ${content.replace(/<[^>]*>/g, '')}
    
    You received this promotional email because you subscribed to SichrPlace updates.
    To unsubscribe: ${unsubscribeUrl}
  `;

  return { html, text };
}