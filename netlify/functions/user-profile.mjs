import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Authorization header required'
        }),
      };
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
        }),
      };
    }

    if (event.httpMethod === 'GET') {
      // Get user profile
      const { data: userProfile, error: fetchError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          role,
          profile_picture,
          bio,
          verified,
          created_at,
          last_login,
          preferences,
          address,
          date_of_birth
        `)
        .eq('id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching user profile:', fetchError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to fetch user profile'
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: userProfile
        }),
      };
    }

    if (event.httpMethod === 'PUT') {
      // Update user profile
      const updates = JSON.parse(event.body);
      
      // Remove sensitive fields that shouldn't be updated via this endpoint
      const allowedFields = [
        'first_name',
        'last_name',
        'phone',
        'bio',
        'preferences',
        'address',
        'date_of_birth'
      ];

      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'No valid fields to update'
          }),
        };
      }

      filteredUpdates.updated_at = new Date().toISOString();

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(filteredUpdates)
        .eq('id', user.id)
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          role,
          profile_picture,
          bio,
          verified,
          created_at,
          last_login,
          preferences,
          address,
          date_of_birth
        `)
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to update user profile'
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: updatedUser
        }),
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('User profile function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};