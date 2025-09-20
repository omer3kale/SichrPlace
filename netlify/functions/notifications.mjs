import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Notification types enum
const NOTIFICATION_TYPES = {
  VIEWING_REQUEST: 'viewing_request',
  VIEWING_APPROVED: 'viewing_approved',
  VIEWING_REJECTED: 'viewing_rejected',
  NEW_MESSAGE: 'new_message',
  FAVORITE_APARTMENT_UPDATED: 'favorite_apartment_updated',
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_MODERATED: 'review_moderated',
  SAVED_SEARCH_ALERT: 'saved_search_alert',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

// Helper function to authenticate token
const authenticateToken = async (headers) => {
  const authHeader = headers.authorization;
  if (!authHeader) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new Error('Malformed token');
  }

  const decoded = jwt.verify(token, jwtSecret);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    throw new Error(`User not found: ${error?.message}`);
  }

  return user;
};

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const user = await authenticateToken(event.headers);
        return await getNotifications(user, event.queryStringParameters, headers);
      case 'POST':
        return await createNotification(event.body, headers);
      case 'PUT':
        const userForUpdate = await authenticateToken(event.headers);
        return await updateNotification(userForUpdate, event.path, event.body, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Notifications function error:', error);
    return {
      statusCode: error.message.includes('token') || error.message.includes('User not found') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error.message.includes('token') || error.message.includes('User not found') 
          ? 'Authentication failed' 
          : 'Internal server error',
        details: error.message 
      })
    };
  }
};

// GET notifications
const getNotifications = async (user, queryParams, headers) => {
  try {
    const { 
      unreadOnly = 'false', 
      limit = '20', 
      offset = '0',
      type 
    } = queryParams || {};

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data || [],
        unreadCount: unreadCount || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      })
    };
  } catch (error) {
    throw error;
  }
};

// POST create notification (internal use)
const createNotification = async (body, headers) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      data = {},
      actionUrl,
      priority = 'normal'
    } = JSON.parse(body || '{}');

    if (!userId || !type || !title || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'userId, type, title, and message are required'
        })
      };
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        message,
        data,
        action_url: actionUrl,
        priority,
        is_read: false
      }])
      .select();

    if (error) throw new Error(`Failed to create notification: ${error.message}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification created successfully',
        data: notification[0]
      })
    };
  } catch (error) {
    throw error;
  }
};

// PUT update notification (mark as read)
const updateNotification = async (user, path, body, headers) => {
  try {
    // Extract notification ID from path
    const pathParts = path.split('/');
    const notificationId = pathParts[pathParts.indexOf('notifications') + 1];
    
    if (!notificationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Notification ID is required' })
      };
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date() 
      })
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .select();

    if (error) throw new Error(`Failed to update notification: ${error.message}`);

    if (!data || data.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Notification not found'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Notification marked as read',
        data: data[0]
      })
    };
  } catch (error) {
    throw error;
  }
};

// Helper functions for creating specific notification types
export const createViewingRequestNotification = async (landlordId, apartmentTitle, tenantName) => {
  return await supabase
    .from('notifications')
    .insert([{
      user_id: landlordId,
      type: NOTIFICATION_TYPES.VIEWING_REQUEST,
      title: 'New Viewing Request',
      message: `${tenantName} has requested to view your apartment "${apartmentTitle}"`,
      priority: 'high'
    }]);
};

export const createViewingApprovalNotification = async (tenantId, apartmentTitle, viewingDate) => {
  return await supabase
    .from('notifications')
    .insert([{
      user_id: tenantId,
      type: NOTIFICATION_TYPES.VIEWING_APPROVED,
      title: 'Viewing Request Approved',
      message: `Your viewing request for "${apartmentTitle}" has been approved for ${viewingDate}`,
      priority: 'high'
    }]);
};

export const createFavoriteApartmentUpdateNotification = async (userId, apartmentTitle, updateType) => {
  return await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      type: NOTIFICATION_TYPES.FAVORITE_APARTMENT_UPDATED,
      title: 'Favorite Apartment Updated',
      message: `Your favorite apartment "${apartmentTitle}" has been updated: ${updateType}`,
      priority: 'normal'
    }]);
};

export const createSavedSearchAlertNotification = async (userId, searchCriteria, newApartmentCount) => {
  return await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      type: NOTIFICATION_TYPES.SAVED_SEARCH_ALERT,
      title: 'New Properties Match Your Search',
      message: `${newApartmentCount} new properties match your saved search criteria`,
      priority: 'normal',
      data: { searchCriteria }
    }]);
};