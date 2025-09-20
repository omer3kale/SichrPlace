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
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role, username')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    throw new Error(`User not found: ${error?.message}`);
  }

  return user;
};

// Helper function to validate review data
const validateReview = (data) => {
  const { apartmentId, rating, title, comment } = data;
  const errors = [];

  if (!apartmentId) errors.push('Apartment ID is required');
  if (!rating || rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5');
  if (!title || title.length < 5 || title.length > 100) errors.push('Title must be between 5 and 100 characters');
  if (!comment || comment.length < 10 || comment.length > 1000) errors.push('Comment must be between 10 and 1000 characters');

  return errors;
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
        return await getReviews(event.queryStringParameters, headers);
      case 'POST':
        const user = await authenticateToken(event.headers);
        return await createReview(user, event.body, headers);
      case 'PUT':
        const userForUpdate = await authenticateToken(event.headers);
        return await updateReview(userForUpdate, event.path, event.body, headers);
      case 'DELETE':
        const userForDelete = await authenticateToken(event.headers);
        return await deleteReview(userForDelete, event.path, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Reviews function error:', error);
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

// GET reviews with filters
const getReviews = async (queryParams, headers) => {
  try {
    const { 
      apartmentId, 
      userId, 
      rating, 
      limit = '10', 
      offset = '0',
      status = 'approved' 
    } = queryParams || {};

    let query = supabase
      .from('reviews')
      .select(`
        id,
        apartment_id,
        user_id,
        rating,
        title,
        comment,
        status,
        created_at,
        updated_at,
        users:user_id (
          id,
          username,
          first_name,
          last_name,
          profile_picture
        ),
        apartments:apartment_id (
          id,
          title,
          location
        )
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (apartmentId) {
      query = query.eq('apartment_id', apartmentId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (rating) {
      query = query.eq('rating', parseInt(rating));
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);

    // Get review statistics for apartment if apartmentId is provided
    let stats = null;
    if (apartmentId) {
      const { data: statsData, error: statsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('apartment_id', apartmentId)
        .eq('status', 'approved');

      if (!statsError && statsData) {
        const ratings = statsData.map(r => r.rating);
        const totalReviews = ratings.length;
        const averageRating = totalReviews > 0 
          ? (ratings.reduce((sum, rating) => sum + rating, 0) / totalReviews).toFixed(1)
          : 0;
        
        stats = {
          totalReviews,
          averageRating: parseFloat(averageRating),
          ratingDistribution: {
            5: ratings.filter(r => r === 5).length,
            4: ratings.filter(r => r === 4).length,
            3: ratings.filter(r => r === 3).length,
            2: ratings.filter(r => r === 2).length,
            1: ratings.filter(r => r === 1).length
          }
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data || [],
        stats,
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

// POST create review
const createReview = async (user, body, headers) => {
  try {
    const data = JSON.parse(body || '{}');
    const validationErrors = validateReview(data);
    
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          errors: validationErrors
        })
      };
    }

    const { apartmentId, rating, title, comment } = data;

    // Check if user has already reviewed this apartment
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('apartment_id', apartmentId)
      .eq('user_id', user.id)
      .single();

    if (existingReview) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'You have already reviewed this apartment'
        })
      };
    }

    // Create review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert([{
        apartment_id: apartmentId,
        user_id: user.id,
        rating: parseInt(rating),
        title,
        comment,
        status: 'pending' // Reviews need moderation
      }])
      .select(`
        id,
        apartment_id,
        user_id,
        rating,
        title,
        comment,
        status,
        created_at,
        users:user_id (
          id,
          username,
          first_name,
          last_name
        )
      `);

    if (error) throw new Error(`Failed to create review: ${error.message}`);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Review submitted successfully and is pending moderation',
        data: review[0]
      })
    };
  } catch (error) {
    throw error;
  }
};

// PUT update review
const updateReview = async (user, path, body, headers) => {
  try {
    const pathParts = path.split('/');
    const reviewId = pathParts[pathParts.length - 1];
    
    if (!reviewId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Review ID is required' })
      };
    }

    const data = JSON.parse(body || '{}');
    
    // Check if this is a moderation action (admin only)
    if (data.action === 'moderate' && data.status) {
      if (user.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Admin access required for moderation' })
        };
      }

      const { data: updated, error } = await supabase
        .from('reviews')
        .update({ 
          status: data.status,
          moderated_at: new Date(),
          moderated_by: user.id
        })
        .eq('id', reviewId)
        .select();

      if (error) throw new Error(`Failed to moderate review: ${error.message}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Review ${data.status}`,
          data: updated[0]
        })
      };
    }

    // Regular review update (only by owner)
    const validationErrors = validateReview(data);
    
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          errors: validationErrors
        })
      };
    }

    const { rating, title, comment } = data;

    const { data: updated, error } = await supabase
      .from('reviews')
      .update({ 
        rating: parseInt(rating),
        title,
        comment,
        status: 'pending', // Reset to pending after edit
        updated_at: new Date()
      })
      .eq('id', reviewId)
      .eq('user_id', user.id) // Only owner can update
      .select();

    if (error) throw new Error(`Failed to update review: ${error.message}`);

    if (!updated || updated.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Review not found or access denied'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Review updated successfully',
        data: updated[0]
      })
    };
  } catch (error) {
    throw error;
  }
};

// DELETE review
const deleteReview = async (user, path, headers) => {
  try {
    const pathParts = path.split('/');
    const reviewId = pathParts[pathParts.length - 1];
    
    if (!reviewId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Review ID is required' })
      };
    }

    let query = supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    // Only admin or review owner can delete
    if (user.role !== 'admin') {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.select();

    if (error) throw new Error(`Failed to delete review: ${error.message}`);

    if (!data || data.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Review not found or access denied'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Review deleted successfully'
      })
    };
  } catch (error) {
    throw error;
  }
};