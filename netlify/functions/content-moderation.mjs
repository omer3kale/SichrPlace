import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { mapApartmentToFrontend, mapReviewToFrontend, mapArrayToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

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
            'moderate_content',
            'review_reports',
            'manage_users',
            'moderate_apartments',
            'moderate_reviews',
            'ban_user',
            'unban_user',
            'approve_content',
            'reject_content',
            'get_moderation_queue',
            'get_moderation_stats'
          ]
        })
      };
    }

    // Verify admin authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
      
      if (!user || !user.is_admin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Admin access required'
          })
        };
      }
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        })
      };
    }

    switch (action) {
      case 'moderate_content':
        return await moderateContent(event.body, headers);
      
      case 'review_reports':
        return await reviewReports(event.queryStringParameters, headers);
      
      case 'manage_users':
        return await manageUsers(event.body, event.queryStringParameters, headers);
      
      case 'moderate_apartments':
        return await moderateApartments(event.body, event.queryStringParameters, headers);
      
      case 'moderate_reviews':
        return await moderateReviews(event.body, event.queryStringParameters, headers);
      
      case 'ban_user':
        return await banUser(event.body, headers);
      
      case 'unban_user':
        return await unbanUser(event.body, headers);
      
      case 'approve_content':
        return await approveContent(event.body, headers);
      
      case 'reject_content':
        return await rejectContent(event.body, headers);
      
      case 'get_moderation_queue':
        return await getModerationQueue(event.queryStringParameters, headers);
      
      case 'get_moderation_stats':
        return await getModerationStats(headers);
      
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
    console.error('Content moderation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Content moderation operation failed',
        error: error.message
      })
    };
  }
};

// Moderate content (general content review)
async function moderateContent(requestBody, headers) {
  try {
    const {
      content_id,
      content_type,
      action,
      reason,
      severity
    } = JSON.parse(requestBody);

    if (!content_id || !content_type || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Content ID, content type, and action are required'
        })
      };
    }

    // Valid content types and actions
    const validContentTypes = ['apartment', 'review', 'message', 'user_profile'];
    const validActions = ['approve', 'reject', 'flag', 'remove', 'suspend'];

    if (!validContentTypes.includes(content_type) || !validActions.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid content type or action'
        })
      };
    }

    // Create moderation record
    const moderationData = {
      content_id,
      content_type,
      action,
      reason: reason || 'Admin moderation',
      severity: severity || 'medium',
      status: 'completed',
      moderated_by: 'admin',
      moderated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: moderation, error: moderationError } = await supabase
      .from('content_moderation')
      .insert(moderationData)
      .select()
      .single();

    if (moderationError) {
      throw moderationError;
    }

    // Apply action to the actual content
    await applyModerationAction(content_type, content_id, action, reason);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Content ${action}ed successfully`,
        data: moderation
      })
    };

  } catch (error) {
    console.error('Moderate content error:', error);
    throw error;
  }
}

// Review user reports
async function reviewReports(queryParams, headers) {
  try {
    const { 
      status = 'pending', 
      limit = '20', 
      offset = '0',
      report_type 
    } = queryParams || {};

    let query = supabase
      .from('user_reports')
      .select(`
        id,
        reported_user_id,
        reported_by,
        report_type,
        reason,
        description,
        status,
        priority,
        created_at,
        reported_user:users!reported_user_id(username, email, first_name, last_name),
        reporter:users!reported_by(username, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (report_type) {
      query = query.eq('report_type', report_type);
    }

    const { data: reports, error } = await query;

    if (error) {
      throw error;
    }

    // Get report statistics
    const { data: stats, error: statsError } = await supabase
      .from('user_reports')
      .select('status, report_type')
      .order('created_at', { ascending: false });

    if (statsError) {
      throw statsError;
    }

    const reportStats = {
      total: stats.length,
      pending: stats.filter(r => r.status === 'pending').length,
      resolved: stats.filter(r => r.status === 'resolved').length,
      dismissed: stats.filter(r => r.status === 'dismissed').length,
      by_type: stats.reduce((acc, report) => {
        acc[report.report_type] = (acc[report.report_type] || 0) + 1;
        return acc;
      }, {})
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          reports: mapArrayToFrontend(reports || []),
          statistics: reportStats,
          pagination: {
            current_offset: parseInt(offset),
            limit: parseInt(limit),
            total_fetched: reports?.length || 0
          }
        }
      })
    };

  } catch (error) {
    console.error('Review reports error:', error);
    throw error;
  }
}

// Manage users (admin user management)
async function manageUsers(requestBody, queryParams, headers) {
  try {
    const { user_action } = queryParams || {};

    if (user_action === 'list') {
      return await listUsersForModeration(queryParams, headers);
    }

    const {
      user_id,
      action,
      reason,
      duration
    } = JSON.parse(requestBody);

    if (!user_id || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID and action are required'
        })
      };
    }

    const validActions = ['suspend', 'unsuspend', 'verify', 'unverify', 'warn', 'reset_password'];

    if (!validActions.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid action specified'
        })
      };
    }

    // Apply user management action
    const result = await applyUserAction(user_id, action, reason, duration);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `User ${action} applied successfully`,
        data: result
      })
    };

  } catch (error) {
    console.error('Manage users error:', error);
    throw error;
  }
}

// Moderate apartments
async function moderateApartments(requestBody, queryParams, headers) {
  try {
    if (queryParams?.list_action === 'pending') {
      return await getPendingApartments(queryParams, headers);
    }

    const {
      apartment_id,
      action,
      reason,
      feedback
    } = JSON.parse(requestBody);

    if (!apartment_id || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Apartment ID and action are required'
        })
      };
    }

    const validActions = ['approve', 'reject', 'flag', 'feature', 'unfeature'];

    if (!validActions.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid action specified'
        })
      };
    }

    // Update apartment status
    const updateData = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'approve':
        updateData.status = 'active';
        updateData.moderation_status = 'approved';
        break;
      case 'reject':
        updateData.status = 'rejected';
        updateData.moderation_status = 'rejected';
        updateData.rejection_reason = reason;
        break;
      case 'flag':
        updateData.moderation_status = 'flagged';
        updateData.flag_reason = reason;
        break;
      case 'feature':
        updateData.is_featured = true;
        break;
      case 'unfeature':
        updateData.is_featured = false;
        break;
    }

    const { data: apartment, error } = await supabase
      .from('apartments')
      .update(updateData)
      .eq('id', apartment_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log moderation action
    await supabase
      .from('content_moderation')
      .insert({
        content_id: apartment_id,
        content_type: 'apartment',
        action,
        reason: reason || `Apartment ${action}ed by admin`,
        status: 'completed',
        moderated_by: 'admin',
        moderated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Apartment ${action}ed successfully`,
        data: apartment
      })
    };

  } catch (error) {
    console.error('Moderate apartments error:', error);
    throw error;
  }
}

// Moderate reviews
async function moderateReviews(requestBody, queryParams, headers) {
  try {
    if (queryParams?.list_action === 'flagged') {
      return await getFlaggedReviews(queryParams, headers);
    }

    const {
      review_id,
      action,
      reason
    } = JSON.parse(requestBody);

    if (!review_id || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Review ID and action are required'
        })
      };
    }

    const validActions = ['approve', 'remove', 'flag', 'hide'];

    if (!validActions.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid action specified'
        })
      };
    }

    // Update review status
    const updateData = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'approve':
        updateData.moderation_status = 'approved';
        updateData.is_visible = true;
        break;
      case 'remove':
        updateData.moderation_status = 'removed';
        updateData.is_visible = false;
        updateData.removal_reason = reason;
        break;
      case 'flag':
        updateData.moderation_status = 'flagged';
        updateData.flag_reason = reason;
        break;
      case 'hide':
        updateData.is_visible = false;
        updateData.hide_reason = reason;
        break;
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', review_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log moderation action
    await supabase
      .from('content_moderation')
      .insert({
        content_id: review_id,
        content_type: 'review',
        action,
        reason: reason || `Review ${action}ed by admin`,
        status: 'completed',
        moderated_by: 'admin',
        moderated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Review ${action}ed successfully`,
        data: review
      })
    };

  } catch (error) {
    console.error('Moderate reviews error:', error);
    throw error;
  }
}

// Ban user
async function banUser(requestBody, headers) {
  try {
    const {
      user_id,
      reason,
      duration,
      ban_type = 'temporary'
    } = JSON.parse(requestBody);

    if (!user_id || !reason) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID and reason are required'
        })
      };
    }

    const banData = {
      is_banned: true,
      ban_reason: reason,
      ban_type,
      banned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (duration && ban_type === 'temporary') {
      const banEndDate = new Date();
      banEndDate.setDate(banEndDate.getDate() + parseInt(duration));
      banData.ban_expires_at = banEndDate.toISOString();
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(banData)
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the ban action
    await supabase
      .from('admin_actions')
      .insert({
        action_type: 'ban_user',
        target_user_id: user_id,
        reason,
        duration,
        performed_by: 'admin',
        performed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'User banned successfully',
        data: {
          user_id,
          banned_at: banData.banned_at,
          ban_expires_at: banData.ban_expires_at || null,
          ban_type
        }
      })
    };

  } catch (error) {
    console.error('Ban user error:', error);
    throw error;
  }
}

// Unban user
async function unbanUser(requestBody, headers) {
  try {
    const { user_id, reason } = JSON.parse(requestBody);

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

    const { data: user, error } = await supabase
      .from('users')
      .update({
        is_banned: false,
        ban_reason: null,
        ban_type: null,
        banned_at: null,
        ban_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the unban action
    await supabase
      .from('admin_actions')
      .insert({
        action_type: 'unban_user',
        target_user_id: user_id,
        reason: reason || 'Admin unban',
        performed_by: 'admin',
        performed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'User unbanned successfully',
        data: {
          user_id,
          unbanned_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Unban user error:', error);
    throw error;
  }
}

// Approve content
async function approveContent(requestBody, headers) {
  try {
    const { content_id, content_type, feedback } = JSON.parse(requestBody);

    if (!content_id || !content_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Content ID and content type are required'
        })
      };
    }

    await applyModerationAction(content_type, content_id, 'approve', feedback);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Content approved successfully'
      })
    };

  } catch (error) {
    console.error('Approve content error:', error);
    throw error;
  }
}

// Reject content
async function rejectContent(requestBody, headers) {
  try {
    const { content_id, content_type, reason } = JSON.parse(requestBody);

    if (!content_id || !content_type || !reason) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Content ID, content type, and reason are required'
        })
      };
    }

    await applyModerationAction(content_type, content_id, 'reject', reason);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Content rejected successfully'
      })
    };

  } catch (error) {
    console.error('Reject content error:', error);
    throw error;
  }
}

// Get moderation queue
async function getModerationQueue(queryParams, headers) {
  try {
    const { 
      status = 'pending',
      content_type,
      limit = '20',
      offset = '0'
    } = queryParams || {};

    let query = supabase
      .from('content_moderation')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (content_type) {
      query = query.eq('content_type', content_type);
    }

    const { data: queue, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          queue: queue || [],
          total_fetched: queue?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get moderation queue error:', error);
    throw error;
  }
}

// Get moderation statistics
async function getModerationStats(headers) {
  try {
    // Get various moderation statistics
    const [
      totalReports,
      pendingReports,
      moderationActions,
      bannedUsers,
      flaggedContent
    ] = await Promise.all([
      supabase.from('user_reports').select('id', { count: 'exact' }),
      supabase.from('user_reports').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('content_moderation').select('action').order('created_at', { ascending: false }).limit(100),
      supabase.from('users').select('id', { count: 'exact' }).eq('is_banned', true),
      supabase.from('content_moderation').select('id', { count: 'exact' }).eq('action', 'flag')
    ]);

    const actionStats = moderationActions.data?.reduce((acc, action) => {
      acc[action.action] = (acc[action.action] || 0) + 1;
      return acc;
    }, {}) || {};

    const stats = {
      reports: {
        total: totalReports.count || 0,
        pending: pendingReports.count || 0,
        resolved: (totalReports.count || 0) - (pendingReports.count || 0)
      },
      actions: actionStats,
      users: {
        banned: bannedUsers.count || 0
      },
      content: {
        flagged: flaggedContent.count || 0
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: stats
      })
    };

  } catch (error) {
    console.error('Get moderation stats error:', error);
    throw error;
  }
}

// Helper functions

async function applyModerationAction(contentType, contentId, action, reason) {
  const table = getTableForContentType(contentType);
  if (!table) return;

  const updateData = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'approve':
      updateData.moderation_status = 'approved';
      if (contentType === 'apartment') updateData.status = 'active';
      break;
    case 'reject':
      updateData.moderation_status = 'rejected';
      if (contentType === 'apartment') updateData.status = 'rejected';
      updateData.rejection_reason = reason;
      break;
    case 'flag':
      updateData.moderation_status = 'flagged';
      updateData.flag_reason = reason;
      break;
    case 'remove':
      updateData.moderation_status = 'removed';
      updateData.removal_reason = reason;
      break;
  }

  await supabase
    .from(table)
    .update(updateData)
    .eq('id', contentId);
}

function getTableForContentType(contentType) {
  const tableMap = {
    'apartment': 'apartments',
    'review': 'reviews',
    'message': 'messages',
    'user_profile': 'users'
  };
  return tableMap[contentType];
}

async function applyUserAction(userId, action, reason, duration) {
  const updateData = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'suspend':
      updateData.is_suspended = true;
      updateData.suspended_reason = reason;
      updateData.suspended_at = new Date().toISOString();
      if (duration) {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + parseInt(duration));
        updateData.suspended_until = suspendedUntil.toISOString();
      }
      break;
    case 'unsuspend':
      updateData.is_suspended = false;
      updateData.suspended_reason = null;
      updateData.suspended_at = null;
      updateData.suspended_until = null;
      break;
    case 'verify':
      updateData.verified = true;
      updateData.verified_at = new Date().toISOString();
      break;
    case 'unverify':
      updateData.verified = false;
      updateData.verified_at = null;
      break;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  // Log admin action
  await supabase
    .from('admin_actions')
    .insert({
      action_type: action,
      target_user_id: userId,
      reason: reason || `User ${action}ed by admin`,
      duration,
      performed_by: 'admin',
      performed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

  return data;
}

async function listUsersForModeration(queryParams, headers) {
  const { 
    status = 'all',
    limit = '20',
    offset = '0',
    search
  } = queryParams || {};

  let query = supabase
    .from('users')
    .select('id, username, email, first_name, last_name, user_type, verified, is_banned, is_suspended, created_at')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit))
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (status === 'banned') {
    query = query.eq('is_banned', true);
  } else if (status === 'suspended') {
    query = query.eq('is_suspended', true);
  } else if (status === 'verified') {
    query = query.eq('verified', true);
  }

  if (search) {
    query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data: users, error } = await query;

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        users: mapArrayToFrontend(users || []),
        total_fetched: users?.length || 0
      }
    })
  };
}

async function getPendingApartments(queryParams, headers) {
  const { limit = '20', offset = '0' } = queryParams || {};

  const { data: apartments, error } = await supabase
    .from('apartments')
    .select(`
      id, title, description, landlord_id, status, moderation_status, created_at,
      landlord:users!landlord_id(username, email)
    `)
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(parseInt(limit))
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        apartments: apartments || [],
        total_fetched: apartments?.length || 0
      }
    })
  };
}

async function getFlaggedReviews(queryParams, headers) {
  const { limit = '20', offset = '0' } = queryParams || {};

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`
      id, kommentar, rating, user_id, apartment_id, moderation_status, flag_reason, created_at,
      user:users!user_id(username, email),
      apartment:apartments!apartment_id(title)
    `)
    .eq('moderation_status', 'flagged')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit))
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: {
        reviews: reviews || [],
        total_fetched: reviews?.length || 0
      }
    })
  };
}