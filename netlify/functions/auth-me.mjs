import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
  console.error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to extract user from JWT token
const getUserFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    return jwt.verify(token, jwtSecret);
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if user is authenticated
    const user = getUserFromToken(event.headers.authorization);
    
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Get fresh user data from database
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        user_type,
        full_name,
        phone,
        verified,
        created_at,
        profile_image
      `)
      .eq('id', user.userId)
      .single();

    if (userError || !currentUser) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Get user profile based on type
    let profile = null;
    if (currentUser.user_type === 'landlord') {
      const { data: landlordProfile } = await supabase
        .from('landlord_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      profile = landlordProfile;
    } else if (currentUser.user_type === 'applicant') {
      const { data: applicantProfile } = await supabase
        .from('applicant_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      profile = applicantProfile;
    }

    // Get user statistics
    const [apartmentsResult, viewingRequestsResult, favoritesResult] = await Promise.all([
      // Count apartments if landlord
      currentUser.user_type === 'landlord' 
        ? supabase.from('apartments').select('id', { count: 'exact' }).eq('landlord_id', currentUser.id)
        : { count: 0 },
      
      // Count viewing requests
      supabase.from('viewing_requests').select('id', { count: 'exact' }).eq('user_id', currentUser.id),
      
      // Count favorites
      supabase.from('favorites').select('id', { count: 'exact' }).eq('user_id', currentUser.id)
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          userType: currentUser.user_type,
          fullName: currentUser.full_name,
          phone: currentUser.phone,
          verified: currentUser.verified,
          profileImage: currentUser.profile_image,
          createdAt: currentUser.created_at,
          profile,
          stats: {
            apartments: apartmentsResult.count || 0,
            viewingRequests: viewingRequestsResult.count || 0,
            favorites: favoritesResult.count || 0
          }
        }
      })
    };

  } catch (error) {
    console.error('Get user profile error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};