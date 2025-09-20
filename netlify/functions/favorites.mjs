import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  
  // Get user from database
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
    const user = await authenticateToken(event.headers);
    
    switch (event.httpMethod) {
      case 'GET':
        return await getFavorites(user, headers);
      case 'POST':
        return await toggleFavorite(user, event.body, headers);
      case 'DELETE':
        return await deleteFavorite(user, event.path, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Favorites function error:', error);
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

// GET user favorites
const getFavorites = async (user, headers) => {
  try {
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        id,
        apartment_id,
        created_at,
        apartments:apartment_id (
          id,
          title,
          description,
          price,
          images,
          size,
          rooms,
          location
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to fetch favorites: ${error.message}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data || []
      })
    };
  } catch (error) {
    throw error;
  }
};

// POST toggle favorite (add/remove)
const toggleFavorite = async (user, body, headers) => {
  try {
    const { apartmentId } = JSON.parse(body || '{}');
    
    if (!apartmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Apartment ID is required' })
      };
    }

    // Check if already favorite
    const { data: existing } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('apartment_id', apartmentId)
      .single();

    let result;
    let action;

    if (existing) {
      // Remove from favorites
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('apartment_id', apartmentId);

      if (error) throw new Error(`Failed to remove favorite: ${error.message}`);
      
      result = { removed: true };
      action = 'removed';
    } else {
      // Add to favorites
      const { data, error } = await supabase
        .from('user_favorites')
        .insert([{
          user_id: user.id,
          apartment_id: apartmentId
        }])
        .select();

      if (error) throw new Error(`Failed to add favorite: ${error.message}`);
      
      result = data[0];
      action = 'added';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        action,
        data: result
      })
    };
  } catch (error) {
    throw error;
  }
};

// DELETE specific favorite
const deleteFavorite = async (user, path, headers) => {
  try {
    // Extract apartment ID from path
    const apartmentId = path.split('/').pop();
    
    if (!apartmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Apartment ID is required' })
      };
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('apartment_id', apartmentId);

    if (error) {
      throw new Error(`Failed to remove favorite: ${error.message}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Favorite removed successfully'
      })
    };
  } catch (error) {
    throw error;
  }
};