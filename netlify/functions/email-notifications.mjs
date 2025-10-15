import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

const getHeader = (headers = {}, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
  const value = getHeader(headers, 'authorization');
  if (!value) return null;
  const parts = value.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    if (typeof body === 'object') {
      return body;
    }
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON');
  }
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clampNumber = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

// Standardized helper functions
const isMissingTableError = (error) => {
  return error && error.code === 'PGRST116';
};

const safeSelect = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Query failed`, error.message);
  }
};

const safeInsert = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Table not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Insert failed`, error.message);
  }
};

const safeUpdate = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Update failed`, error.message);
  }
};

const safeDelete = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Delete failed`, error.message);
  }
};

const getAuthContext = async (event, options = {}) => {
  const token = extractBearerToken(event.headers || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'Invalid or expired token');
  }

  const { data: profile, error: profileError } = await safeSelect(
    supabase
      .from('profiles')
      .select('id, email, role, status, account_status, is_blocked, is_admin, is_staff, notification_preferences')
      .eq('id', data.user.id)
      .single(),
    'profiles',
    'Failed to fetch user profile'
  );

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw httpError(403, 'User profile not found');
  }

  // Check account status
  if (profile.is_blocked) {
    throw httpError(403, 'Account is blocked');
  }

  if (profile.account_status === 'suspended') {
    throw httpError(403, 'Account is suspended');
  }

  // Check role requirements if specified
  if (options.requireAdmin && !profile.is_admin) {
    throw httpError(403, 'Admin access required');
  }

  if (options.requireAnalytics && !(profile.is_admin || profile.is_staff || profile.role === 'analytics')) {
    throw httpError(403, 'Analytics access required');
  }

  return {
    user: data.user,
    profile,
    isAdmin: profile.is_admin,
    isStaff: profile.is_staff
  };
};

const AVAILABLE_ACTIONS = [
  'send_notification', 
  'create_notification', 
  'mark_read', 
  'mark_all_read',
  'get_notifications',
];

export const handler = async (event, _context) => {
  console.log('Email notifications handler called:', {
    method: event.httpMethod,
    path: event.path,
    action: event.queryStringParameters?.action
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const responseHeaders = buildHeaders();
    const action = sanitizeString(event.queryStringParameters?.action, {
      maxLength: 64,
      allowEmpty: false,
    });
    
    if (!action) {
      throw httpError(400, 'Action parameter is required', {
        available_actions: AVAILABLE_ACTIONS
      });
    }
    
    const { profile } = await getAuthContext(event);

    switch (action) {
      case 'send_notification':
        return await sendNotification(profile.id, event.body, responseHeaders);
      
      case 'create_notification':
        return await createNotification(profile.id, event.body, responseHeaders);
      
      case 'mark_read':
        return await markNotificationRead(profile.id, event.body, responseHeaders);
      
      case 'mark_all_read':
        return await markAllNotificationsRead(profile.id, event.body, responseHeaders);
      
      case 'get_notifications':
        return await getNotifications(profile.id, event.queryStringParameters, responseHeaders);
      
      case 'delete_notification':
        return await deleteNotification(profile.id, event.body, responseHeaders);
      
      case 'send_system_alert':
        return await sendSystemAlert(profile.id, event.body, responseHeaders);
      
      case 'send_promotional':
        return await sendPromotionalEmail(profile.id, event.body, responseHeaders);
      
      case 'unsubscribe':
        return await unsubscribeUser(profile.id, event.body, responseHeaders);
      
      default:
        throw httpError(400, 'Invalid action specified', {
          available_actions: AVAILABLE_ACTIONS
        });
    }

  } catch (error) {
    console.error('Email notifications handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Email notification operation failed' : error.message;
    
    const errorResponse = {
      success: false,
      error: message
    };

    if (error.details && status !== 500) {
      errorResponse.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details || error.message;
    }

    return respond(status, errorResponse);
  }
};

// Send notification (email + in-app)
async function sendNotification(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const {
      user_id,
      notification_type,
      title,
      message,
      action_url,
      email_required = true,
      priority = 'normal',
      category = 'general'
    } = parsedBody;

    if (!notification_type || !title || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: notification_type, title, message'
        })
      };
    }

    const targetUserId = user_id || actorUserId;
    if (!isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid user_id is required'
        })
      };
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, username, notification_settings')
      .eq('id', targetUserId)
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
    const notificationResult = await safeInsert(
      supabase
        .from('notifications')
        .insert([{
          user_id: targetUserId,
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
        .single(),
      'notifications',
      'Failed to create notification'
    );

    const notification = notificationResult.data;

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
          user_id: targetUserId,
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
async function createNotification(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const {
      user_id,
      notification_type,
      title,
      message,
      action_url,
      priority = 'normal',
      category = 'general'
    } = parsedBody;

    if (!notification_type || !title || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: notification_type, title, message'
        })
      };
    }

    const targetUserId = user_id || actorUserId;
    if (!isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid user_id is required'
        })
      };
    }

    const notificationResult = await safeInsert(
      supabase
        .from('notifications')
        .insert([{
          user_id: targetUserId,
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
        .single(),
      'notifications',
      'Failed to create notification'
    );

    const notification = notificationResult.data;

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
async function markNotificationRead(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const { notification_id, user_id } = parsedBody;

    const targetUserId = user_id || actorUserId;
    if (!isUuid(notification_id) || !isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid notification_id and user_id are required'
        })
      };
    }

    const updateResult = await safeUpdate(
      supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .match({ id: notification_id, user_id: targetUserId })
        .select()
        .single(),
      'notifications',
      'Failed to mark notification as read'
    );

    const data = updateResult.data;

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
async function markAllNotificationsRead(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const targetUserId = parsedBody.user_id || actorUserId;

    if (!isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid user_id is required'
        })
      };
    }

    const updateResult = await safeUpdate(
      supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', targetUserId)
        .eq('is_read', false)
        .select('id'),
      'notifications',
      'Failed to mark notifications as read'
    );

    const data = updateResult.data;

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
async function getNotifications(actorUserId, queryParams, headers) {
  try {
    const targetUserId = (queryParams?.user_id || actorUserId) ?? null;

    if (!isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid user_id is required'
        })
      };
    }

    const limitValue = clampNumber(queryParams?.limit, {
      min: 1,
      max: 100,
      fallback: 20
    });
    const offsetValue = clampNumber(queryParams?.offset, {
      min: 0,
      max: 1000,
      fallback: 0
    });

    const unreadOnly = String(queryParams?.unread_only ?? 'false').toLowerCase() === 'true';
    const category = sanitizeString(queryParams?.category, { maxLength: 64, allowEmpty: false });
    const priority = sanitizeString(queryParams?.priority, { maxLength: 32, allowEmpty: false });

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(offsetValue, offsetValue + limitValue - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const notificationsResult = await safeSelect(
      query,
      'notifications',
      'Failed to fetch notifications'
    );

    const notifications = notificationsResult.data || [];

    // Get unread count
    const unreadResult = await safeSelect(
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .eq('is_read', false),
      'notifications',
      'Failed to count unread notifications'
    );

    const unreadCount = unreadResult.count ?? 0;

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
async function deleteNotification(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const { notification_id, user_id } = parsedBody;

    const targetUserId = user_id || actorUserId;
    if (!isUuid(notification_id) || !isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid notification_id and user_id are required'
        })
      };
    }

    await safeDelete(
      supabase
        .from('notifications')
        .delete()
        .match({ id: notification_id, user_id: targetUserId }),
      'notifications',
      'Failed to delete notification'
    );

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
async function sendSystemAlert(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const {
      user_ids = [],
      title,
      message,
      priority = 'high',
      send_email = true,
      alert_type = 'system'
    } = parsedBody;

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

    const validUserIds = user_ids
      .filter((value) => typeof value === 'string' && isUuid(value))
      .slice(0, 200);

    if (validUserIds.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'No valid user IDs provided'
        })
      };
    }

    const notifications = validUserIds.map((user_id) => ({
      user_id: user_id,
      type: alert_type,
      title: title,
      message: message,
      priority: priority,
      category: 'system',
      is_read: false,
      initiated_by: actorUserId,
      created_at: new Date().toISOString()
    }));

    const createdResult = await safeInsert(
      supabase
        .from('notifications')
        .insert(notifications)
        .select(),
      'notifications',
      'Failed to create system alerts'
    );

    const createdNotifications = createdResult.data || [];

    // Send emails if required
    if (send_email) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, username, notification_settings')
        .in('id', validUserIds);

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
async function sendPromotionalEmail(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const {
      user_ids = [],
      subject,
      content,
      template_type = 'promotional',
      campaign_id
    } = parsedBody;

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
            user.id,
            template_type
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
            email_type: template_type,
            subject: subject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            campaign_id: campaign_id,
            initiated_by: actorUserId
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
async function unsubscribeUser(actorUserId, requestBody, headers) {
  try {
    const parsedBody = parseRequestBody(requestBody);
    const { user_id, email_type = 'all' } = parsedBody;

    const targetUserId = user_id || actorUserId;

    if (!isUuid(targetUserId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid user_id is required'
        })
      };
    }

    // Get current settings
    const userResult = await safeSelect(
      supabase
        .from('users')
        .select('notification_settings')
        .eq('id', targetUserId)
        .single(),
      'users',
      'Failed to load notification settings'
    );

    const user = userResult.data;

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User not found'
        })
      };
    }

    const currentSettings = user.notification_settings || {};

    // Update notification settings
    let updatedSettings;
    if (email_type === 'all') {
      updatedSettings = { ...currentSettings, email: false };
    } else {
      updatedSettings = { ...currentSettings, [email_type]: false };
    }

    await safeUpdate(
      supabase
        .from('users')
        .update({ notification_settings: updatedSettings })
        .eq('id', targetUserId),
      'users',
      'Failed to update notification settings'
    );

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
  const notificationLabel = type ? `<div class="badge">${type.toUpperCase()}</div>` : '';
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
      .badge { display: inline-block; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: #e0e7ff; color: #1d4ed8; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; }
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
        ${notificationLabel}
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

  ${type ? `Category: ${type}` : ''}
    
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

function generatePromotionalEmail(username, subject, content, userId, templateType = 'promotional') {
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?user_id=${userId}&type=${templateType}`;
  const bannerText = templateType === 'onboarding'
    ? 'Welcome to SichrPlace!'
    : templateType === 'feature'
      ? 'Discover What Is New'
      : 'A Message From SichrPlace';
  
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
        <p>${bannerText}</p>
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
    
    Template: ${templateType}
    You received this promotional email because you subscribed to SichrPlace updates.
    To unsubscribe: ${unsubscribeUrl}
  `;

  return { html, text };
}