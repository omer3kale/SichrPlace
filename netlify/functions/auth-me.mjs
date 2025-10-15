import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Supabase configuration with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions
const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, body) => ({
  statusCode,
  headers: buildHeaders(),
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const httpError = (status, message, details = null) => {
  const error = { error: { message, status } };
  if (details && process.env.NODE_ENV !== 'production') {
    error.error.details = details;
  }
  return { status, ...error };
};

const extractBearerToken = (headers) => {
  const authHeader = headers.authorization || headers.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

// Supabase error checking
const isMissingTableError = (error) => {
  return error?.code === 'PGRST116' || error?.message?.includes('relation') && error?.message?.includes('does not exist');
};

// Safe query operations with missing table resilience
const safeSelect = async (table, query = {}) => {
  try {
    let queryBuilder = supabase.from(table).select(query.select || '*');
    
    if (query.eq) {
      Object.entries(query.eq).forEach(([key, value]) => {
        queryBuilder = queryBuilder.eq(key, value);
      });
    }
    
    if (query.single) {
      queryBuilder = queryBuilder.single();
    }
    
    const { data, error } = await queryBuilder;
    return { data, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { data: query.single ? null : [], error: null };
    }
    return { data: null, error };
  }
};

const safeCount = async (table, conditions = {}) => {
  try {
    let queryBuilder = supabase.from(table).select('*', { count: 'exact', head: true });
    
    Object.entries(conditions).forEach(([key, value]) => {
      if (key === 'or') {
        queryBuilder = queryBuilder.or(value);
      } else {
        queryBuilder = queryBuilder.eq(key, value);
      }
    });
    
    const { count, error } = await queryBuilder;
    return { count: count || 0, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { count: 0, error: null };
    }
    return { count: 0, error };
  }
};

// Authentication with comprehensive validation
const getAuthContext = async (eventHeaders) => {
  const token = extractBearerToken(eventHeaders || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required.');
  }

  try {
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
    const decoded = jwt.verify(token, jwtSecret);
    
    if (!decoded.userId) {
      throw httpError(401, 'Invalid token payload.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (profileError || !profile) {
      throw httpError(401, 'User profile not found.');
    }

    if (
      profile.is_blocked ||
      ['suspended', 'deleted'].includes(profile.account_status) ||
      profile.status === 'suspended'
    ) {
      throw httpError(403, 'Account suspended or blocked');
    }

    return { token, authUser: decoded, profile };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw httpError(401, 'Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw httpError(401, 'Invalid token');
    }
    if (error.status) throw error;
    throw httpError(401, 'Authentication failed');
  }
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  if (event.httpMethod !== 'GET') {
    return respond(405, {
      error: { message: 'Method not allowed' }
    });
  }

  try {
    // Authenticate user
    const authContext = await getAuthContext(event.headers || {});
    const currentUser = authContext.profile;

    // Get additional profile data based on user type
    let extendedProfile = null;
    
    if (currentUser.user_type === 'landlord' || currentUser.role === 'landlord') {
      const { data: landlordProfile } = await safeSelect('landlord_profiles', {
        eq: { user_id: currentUser.id },
        single: true
      });
      extendedProfile = landlordProfile;
    } else if (currentUser.user_type === 'applicant' || currentUser.role === 'applicant') {
      const { data: applicantProfile } = await safeSelect('applicant_profiles', {
        eq: { user_id: currentUser.id },
        single: true
      });
      extendedProfile = applicantProfile;
    }

    // Get user statistics with safe count operations
    const statsPromises = [
      // Count apartments if landlord
      (currentUser.role === 'landlord' || currentUser.user_type === 'landlord')
        ? safeCount('apartments', { landlord_id: currentUser.id })
        : Promise.resolve({ count: 0, error: null }),
      
      // Count viewing requests (both as requester and landlord)
      safeCount('viewing_requests', { 
        or: `requester_id.eq.${currentUser.id},landlord_id.eq.${currentUser.id}` 
      }),
      
      // Count favorites
      safeCount('user_favorites', { user_id: currentUser.id }),
      
      // Count reviews (both written and received)
      safeCount('reviews', { user_id: currentUser.id }),
      
      // Count messages/conversations
      safeCount('messages', { 
        or: `sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}` 
      })
    ];

    const [apartmentsResult, viewingRequestsResult, favoritesResult, reviewsResult, messagesResult] = await Promise.all(statsPromises);

    // Build comprehensive user response
    const userResponse = {
      // Core user data
      id: currentUser.id,
      username: currentUser.username,
      email: currentUser.email,
      role: currentUser.role,
      user_type: currentUser.user_type,
      status: currentUser.status,
      
      // Personal information
      first_name: currentUser.first_name,
      last_name: currentUser.last_name,
      fullName: (currentUser.first_name || '') + (currentUser.last_name ? ' ' + currentUser.last_name : '') || currentUser.username,
      phone: currentUser.phone,
      
      // German user fields
      anrede: currentUser.anrede,
      title: currentUser.title,
      
      // Address information
      postal_code: currentUser.postal_code,
      city: currentUser.city,
      state: currentUser.state,
      
      // Account status
      verified: currentUser.verified || currentUser.email_verified || false,
      email_verified: currentUser.email_verified || false,
      is_blocked: currentUser.is_blocked || false,
      account_status: currentUser.account_status || 'active',
      
      // Profile information
      profile_image: currentUser.profile_image,
      bio: currentUser.bio,
      
      // Timestamps
      created_at: currentUser.created_at,
      updated_at: currentUser.updated_at,
      last_login: currentUser.last_login,
      
      // Extended profile data
      profile: extendedProfile,
      
      // User statistics
      stats: {
        apartments: apartmentsResult.count,
        viewing_requests: viewingRequestsResult.count,
        favorites: favoritesResult.count,
        reviews: reviewsResult.count,
        messages: messagesResult.count,
      },
      
      // Permissions based on role
      permissions: {
        canCreateProperty: ['landlord', 'admin'].includes(currentUser.role),
        canViewAnalytics: ['landlord', 'admin', 'analytics'].includes(currentUser.role),
        canModerateContent: ['admin'].includes(currentUser.role),
        canAccessAdminPanel: ['admin'].includes(currentUser.role),
      }
    };

    return respond(200, {
      success: true,
      user: userResponse,
      message: 'User profile retrieved successfully'
    });

  } catch (error) {
    if (error.status) {
      return respond(error.status, error);
    }
    
    console.error('Get user profile error:', error);
    return respond(500, {
      error: { 
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { details: error.message })
      }
    });
  }
};