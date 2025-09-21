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

  try {
    const user = getUserFromToken(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      // Get recently viewed apartments
      const limit = Math.min(50, Math.max(1, parseInt(event.queryStringParameters?.limit || '10')));

      if (!user) {
        // Return empty result for unauthenticated users
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: [],
            message: 'Authentication required to view recent history'
          })
        };
      }

      const { data: recentlyViewed, error } = await supabase
        .from('recently_viewed')
        .select(`
          *,
          apartment:apartments (
            *,
            landlord:users!apartments_landlord_id_fkey(username, full_name),
            images:apartment_images(url, is_main)
          )
        `)
        .eq('user_id', user.userId)
        .order('viewed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Get recently viewed error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to get recently viewed apartments' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: recentlyViewed
        })
      };

    } else if (event.httpMethod === 'POST') {
      // Add apartment to recently viewed
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Authentication required' })
        };
      }

      const { apartmentId } = JSON.parse(event.body);

      if (!apartmentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Apartment ID is required' })
        };
      }

      // Check if apartment exists
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .select('id, title')
        .eq('id', apartmentId)
        .single();

      if (apartmentError || !apartment) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Apartment not found' })
        };
      }

      // Check if already in recently viewed
      const { data: existing } = await supabase
        .from('recently_viewed')
        .select('id')
        .eq('user_id', user.userId)
        .eq('apartment_id', apartmentId)
        .single();

      if (existing) {
        // Update viewed timestamp
        const { error: updateError } = await supabase
          .from('recently_viewed')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Update recently viewed error:', updateError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update view timestamp' })
          };
        }
      } else {
        // Add new entry
        const { error: insertError } = await supabase
          .from('recently_viewed')
          .insert({
            user_id: user.userId,
            apartment_id: apartmentId,
            viewed_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Insert recently viewed error:', insertError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to add to recently viewed' })
          };
        }

        // Clean up old entries (keep only last 50)
        const { data: oldEntries } = await supabase
          .from('recently_viewed')
          .select('id')
          .eq('user_id', user.userId)
          .order('viewed_at', { ascending: false })
          .range(50, 1000);

        if (oldEntries && oldEntries.length > 0) {
          const oldIds = oldEntries.map(entry => entry.id);
          await supabase
            .from('recently_viewed')
            .delete()
            .in('id', oldIds);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Added to recently viewed'
        })
      };

    } else if (event.httpMethod === 'DELETE') {
      // Clear recently viewed history
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Authentication required' })
        };
      }

      const { error } = await supabase
        .from('recently_viewed')
        .delete()
        .eq('user_id', user.userId);

      if (error) {
        console.error('Clear recently viewed error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to clear recently viewed' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Recently viewed history cleared'
        })
      };

    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Recently viewed error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};