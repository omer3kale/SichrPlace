import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

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
            'get_user_profile', 
            'update_user_profile', 
            'get_user_stats',
            'get_user_activity',
            'update_preferences',
            'update_password',
            'update_avatar',
            'delete_account'
          ]
        })
      };
    }

    // Get authentication for most operations
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
      
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid authentication token'
          })
        };
      }
    }

    switch (action) {
      case 'get_user_profile':
        return await getUserProfile(user?.id || event.queryStringParameters?.user_id, headers);
      
      case 'update_user_profile':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await updateUserProfile(user.id, event.body, headers);
      
      case 'get_user_stats':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await getUserStats(user.id, headers);
      
      case 'get_user_activity':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await getUserActivity(user.id, event.queryStringParameters, headers);
      
      case 'update_preferences':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await updatePreferences(user.id, event.body, headers);
      
      case 'update_password':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await updatePassword(user.id, event.body, headers);
      
      case 'update_avatar':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await updateAvatar(user.id, event.body, headers);
      
      case 'delete_account':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await deleteAccount(user.id, event.body, headers);
      
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
    console.error('User management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'User management operation failed',
        error: error.message
      })
    };
  }
};

// Get user profile with detailed information
async function getUserProfile(userId, headers) {
  try {
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    // Get user data with related information
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        full_name,
        phone,
        user_type,
        verified,
        profile_image,
        bio,
        location,
        notification_settings,
        privacy_settings,
        created_at,
        updated_at,
        last_login_at
      `)
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // Get user statistics
    const [
      apartmentsCount,
      bookingsCount,
      reviewsCount,
      favoritesCount,
      messagesCount
    ] = await Promise.all([
      supabase.from('apartments').select('id', { count: 'exact' }).eq('landlord_id', userId),
      supabase.from('bookings').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('apartment_reviews').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('user_favorites').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('messages').select('id', { count: 'exact' }).eq('sender_id', userId)
    ]);

    const userProfile = {
      ...user,
      statistics: {
        apartments_count: apartmentsCount.count || 0,
        bookings_count: bookingsCount.count || 0,
        reviews_count: reviewsCount.count || 0,
        favorites_count: favoritesCount.count || 0,
        messages_count: messagesCount.count || 0
      },
      account_status: {
        verified: user.verified,
        profile_complete: !!(user.full_name && user.phone && user.bio),
        last_activity: user.last_login_at
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: userProfile
      })
    };

  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
}

// Update user profile information
async function updateUserProfile(userId, requestBody, headers) {
  try {
    const {
      full_name,
      phone,
      bio,
      location,
      user_type,
      profile_image
    } = JSON.parse(requestBody);

    // Validate input
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (user_type !== undefined && ['tenant', 'landlord'].includes(user_type)) {
      updateData.user_type = user_type;
    }
    if (profile_image !== undefined) updateData.profile_image = profile_image;
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
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
        message: 'Profile updated successfully',
        data: updatedUser
      })
    };

  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
}

// Get user statistics and analytics
async function getUserStats(userId, headers) {
  try {
    // Get various user statistics
    const [
      apartmentStats,
      bookingStats,
      reviewStats,
      messageStats,
      activityStats
    ] = await Promise.all([
      // Apartment statistics
      supabase
        .from('apartments')
        .select('id, status, created_at, views_count')
        .eq('landlord_id', userId),

      // Booking statistics
      supabase
        .from('bookings')
        .select('id, status, total_amount, created_at')
        .eq('user_id', userId),

      // Review statistics
      supabase
        .from('apartment_reviews')
        .select('id, rating, created_at')
        .eq('user_id', userId),

      // Message statistics
      supabase
        .from('messages')
        .select('id, created_at')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),

      // Activity statistics
      supabase
        .from('user_activity')
        .select('id, action, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    const stats = {
      apartments: {
        total: apartmentStats.data?.length || 0,
        active: apartmentStats.data?.filter(a => a.status === 'active').length || 0,
        total_views: apartmentStats.data?.reduce((sum, a) => sum + (a.views_count || 0), 0) || 0
      },
      bookings: {
        total: bookingStats.data?.length || 0,
        confirmed: bookingStats.data?.filter(b => b.status === 'confirmed').length || 0,
        total_spent: bookingStats.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0
      },
      reviews: {
        total: reviewStats.data?.length || 0,
        average_rating: reviewStats.data?.length > 0 
          ? reviewStats.data.reduce((sum, r) => sum + r.rating, 0) / reviewStats.data.length 
          : 0
      },
      messages: {
        total: messageStats.data?.length || 0,
        last_30_days: messageStats.data?.filter(m => 
          new Date(m.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length || 0
      },
      activity: {
        total_actions: activityStats.data?.length || 0,
        last_activity: activityStats.data?.[0]?.created_at || null,
        most_common_action: getMostCommonAction(activityStats.data || [])
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
    console.error('Get user stats error:', error);
    throw error;
  }
}

// Get user activity history
async function getUserActivity(userId, queryParams, headers) {
  try {
    const { limit = '50', offset = '0', action_type } = queryParams || {};

    let query = supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (action_type) {
      query = query.eq('action', action_type);
    }

    const { data: activities, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          activities: activities || [],
          total_fetched: activities?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get user activity error:', error);
    throw error;
  }
}

// Update user preferences
async function updatePreferences(userId, requestBody, headers) {
  try {
    const {
      notification_settings,
      privacy_settings,
      language_preference,
      timezone
    } = JSON.parse(requestBody);

    const updateData = {};
    if (notification_settings) updateData.notification_settings = notification_settings;
    if (privacy_settings) updateData.privacy_settings = privacy_settings;
    if (language_preference) updateData.language_preference = language_preference;
    if (timezone) updateData.timezone = timezone;
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('notification_settings, privacy_settings, language_preference, timezone')
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Preferences updated successfully',
        data: updatedUser
      })
    };

  } catch (error) {
    console.error('Update preferences error:', error);
    throw error;
  }
}

// Update user password
async function updatePassword(userId, requestBody, headers) {
  try {
    const { current_password, new_password } = JSON.parse(requestBody);

    if (!current_password || !new_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Current password and new password are required'
        })
      };
    }

    if (new_password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'New password must be at least 8 characters long'
        })
      };
    }

    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    // Verify current password (in production, use proper password hashing)
    // This is a simplified example
    if (user.password !== current_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Current password is incorrect'
        })
      };
    }

    // Update password (in production, hash the password)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: new_password, // In production: await bcrypt.hash(new_password, 10)
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password updated successfully'
      })
    };

  } catch (error) {
    console.error('Update password error:', error);
    throw error;
  }
}

// Update user avatar
async function updateAvatar(userId, requestBody, headers) {
  try {
    const { profile_image, avatar_data } = JSON.parse(requestBody);

    if (!profile_image && !avatar_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Profile image URL or avatar data is required'
        })
      };
    }

    const updateData = {
      profile_image: profile_image || avatar_data,
      updated_at: new Date().toISOString()
    };

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('profile_image')
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Avatar updated successfully',
        data: {
          profile_image: updatedUser.profile_image
        }
      })
    };

  } catch (error) {
    console.error('Update avatar error:', error);
    throw error;
  }
}

// Delete user account
async function deleteAccount(userId, requestBody, headers) {
  try {
    const { confirmation, reason } = JSON.parse(requestBody);

    if (confirmation !== 'DELETE MY ACCOUNT') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Account deletion requires confirmation text: "DELETE MY ACCOUNT"'
        })
      };
    }

    // Check for active bookings or obligations
    const { data: activeBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'active']);

    if (bookingError) {
      throw bookingError;
    }

    if (activeBookings && activeBookings.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cannot delete account with active bookings',
          active_bookings: activeBookings.length
        })
      };
    }

    // Anonymize user data instead of hard delete
    const anonymizedData = {
      username: `deleted_user_${Date.now()}`,
      email: `deleted_${Date.now()}@anonymized.local`,
      full_name: '[DELETED USER]',
      phone: null,
      profile_image: null,
      bio: null,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deletion_reason: reason || 'User requested deletion',
      updated_at: new Date().toISOString()
    };

    const { error: deleteError } = await supabase
      .from('users')
      .update(anonymizedData)
      .eq('id', userId);

    if (deleteError) {
      throw deleteError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
        data: {
          deletion_date: new Date().toISOString(),
          method: 'anonymization'
        }
      })
    };

  } catch (error) {
    console.error('Delete account error:', error);
    throw error;
  }
}

// Helper function to get most common action
function getMostCommonAction(activities) {
  if (!activities || activities.length === 0) return null;
  
  const actionCounts = activities.reduce((acc, activity) => {
    acc[activity.action] = (acc[activity.action] || 0) + 1;
    return acc;
  }, {});
  
  return Object.keys(actionCounts).reduce((a, b) => 
    actionCounts[a] > actionCounts[b] ? a : b
  );
}