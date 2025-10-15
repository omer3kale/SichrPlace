import { createClient } from '@supabase/supabase-js';

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
    
    if (query.in) {
      Object.entries(query.in).forEach(([key, values]) => {
        queryBuilder = queryBuilder.in(key, values);
      });
    }
    
    if (query.order) {
      queryBuilder = queryBuilder.order(query.order.column, { ascending: query.order.ascending });
    }
    
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
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

const safeInsert = async (table, data) => {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    return { data: result, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { 
        data: null, 
        error: { message: `Table ${table} does not exist`, code: 'TABLE_MISSING' }
      };
    }
    return { data: null, error };
  }
};

const safeUpdate = async (table, data, conditions) => {
  try {
    let queryBuilder = supabase.from(table).update(data);
    
    Object.entries(conditions).forEach(([key, value]) => {
      queryBuilder = queryBuilder.eq(key, value);
    });
    
    const { data: result, error } = await queryBuilder.select().single();
    return { data: result, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { 
        data: null, 
        error: { message: `Table ${table} does not exist`, code: 'TABLE_MISSING' }
      };
    }
    return { data: null, error };
  }
};

const safeDelete = async (table, conditions) => {
  try {
    let queryBuilder = supabase.from(table);
    
    Object.entries(conditions).forEach(([key, value]) => {
      queryBuilder = queryBuilder.delete().eq(key, value);
    });
    
    const { data, error } = await queryBuilder.select();
    return { data, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { data: [], error: null };
    }
    return { data: null, error };
  }
};

const safeCount = async (table, conditions = {}) => {
  try {
    let queryBuilder = supabase.from(table).select('*', { count: 'exact', head: true });
    
    Object.entries(conditions).forEach(([key, value]) => {
      queryBuilder = queryBuilder.eq(key, value);
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
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      throw httpError(401, 'Invalid or expired token.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, status, account_status, is_blocked')
      .eq('id', data.user.id)
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

    return { token, authUser: data.user, profile };
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'Authentication failed');
  }
};

// Review validation and sanitization
const validateReviewData = (data) => {
  const errors = [];
  
  if (!data.apartment_id) {
    errors.push('Apartment ID is required');
  }
  
  if (!data.rating || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    errors.push('Rating must be an integer between 1 and 5');
  }
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }
  
  if (!data.comment || typeof data.comment !== 'string' || data.comment.trim().length < 10) {
    errors.push('Comment must be at least 10 characters long');
  }
  
  if (data.title && data.title.length > 100) {
    errors.push('Title cannot exceed 100 characters');
  }
  
  if (data.comment && data.comment.length > 2000) {
    errors.push('Comment cannot exceed 2000 characters');
  }
  
  return errors;
};

const sanitizeReviewInput = (data) => {
  return {
    apartment_id: data.apartment_id,
    rating: parseInt(data.rating, 10),
    title: data.title?.trim(),
    comment: data.comment?.trim(),
    viewing_request_id: data.viewing_request_id || null,
  };
};

// Action handlers
const ACTION_CONFIG = {
  GET: {
    handler: 'handleGetReviews',
    requiresAuth: false,
  },
  POST: {
    handler: 'handleCreateReview',
    requiresAuth: true,
  },
  PUT: {
    handler: 'handleUpdateReview',
    requiresAuth: true,
  },
  DELETE: {
    handler: 'handleDeleteReview',
    requiresAuth: true,
  },
};

const handleGetReviews = async (event, authContext) => {
  const { apartment_id, user_id, status } = event.queryStringParameters || {};
  
  let query = {
    select: `
      id,
      apartment_id,
      user_id,
      viewing_request_id,
      rating,
      title,
      comment,
      status,
      created_at,
      updated_at,
      users!inner(id, email, username, first_name, last_name)
    `,
    order: { column: 'created_at', ascending: false }
  };
  
  // Build conditions based on query parameters
  const conditions = {};
  
  if (apartment_id) {
    conditions.apartment_id = apartment_id;
  }
  
  if (user_id) {
    conditions.user_id = user_id;
  }
  
  // Only show approved reviews for non-authenticated users
  // Authenticated users can see their own reviews regardless of status
  if (!authContext) {
    conditions.status = 'approved';
  } else if (status) {
    conditions.status = status;
  } else {
    // Authenticated users see approved reviews + their own reviews
    if (!user_id || user_id !== authContext.profile.id) {
      conditions.status = 'approved';
    }
  }
  
  if (Object.keys(conditions).length > 0) {
    query.eq = conditions;
  }
  
  const { data: reviews, error } = await safeSelect('reviews', query);
  
  if (error) {
    throw httpError(500, 'Failed to fetch reviews', error);
  }
  
  // Calculate statistics if apartment_id is provided
  let stats = null;
  if (apartment_id) {
    const { data: allReviews } = await safeSelect('reviews', {
      eq: { apartment_id, status: 'approved' },
      select: 'rating'
    });
    
    if (allReviews && allReviews.length > 0) {
      const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
      const avgRating = totalRating / allReviews.length;
      
      stats = {
        total_reviews: allReviews.length,
        average_rating: Math.round(avgRating * 10) / 10,
        rating_distribution: {
          5: allReviews.filter(r => r.rating === 5).length,
          4: allReviews.filter(r => r.rating === 4).length,
          3: allReviews.filter(r => r.rating === 3).length,
          2: allReviews.filter(r => r.rating === 2).length,
          1: allReviews.filter(r => r.rating === 1).length,
        }
      };
    }
  }
  
  return respond(200, {
    success: true,
    data: reviews || [],
    stats,
    total: reviews?.length || 0
  });
};

const handleCreateReview = async (event, authContext) => {
  const body = JSON.parse(event.body || '{}');
  
  // Validate input
  const validationErrors = validateReviewData(body);
  if (validationErrors.length > 0) {
    throw httpError(400, 'Validation failed', { errors: validationErrors });
  }
  
  const sanitizedData = sanitizeReviewInput(body);
  
  // Check if apartment exists
  const { data: apartment, error: apartmentError } = await safeSelect('apartments', {
    eq: { id: sanitizedData.apartment_id },
    select: 'id, landlord_id',
    single: true
  });
  
  if (apartmentError || !apartment) {
    throw httpError(404, 'Apartment not found');
  }
  
  // Check if user already reviewed this apartment
  const { data: existingReview } = await safeSelect('reviews', {
    eq: { 
      apartment_id: sanitizedData.apartment_id,
      user_id: authContext.profile.id 
    },
    single: true
  });
  
  if (existingReview) {
    throw httpError(409, 'You have already reviewed this apartment');
  }
  
  // Prevent landlords from reviewing their own apartments
  if (apartment.landlord_id === authContext.profile.id) {
    throw httpError(403, 'Landlords cannot review their own apartments');
  }
  
  // Create review
  const reviewData = {
    ...sanitizedData,
    user_id: authContext.profile.id,
    status: 'pending', // All reviews start as pending for moderation
  };
  
  const { data: newReview, error: createError } = await safeInsert('reviews', reviewData);
  
  if (createError) {
    throw httpError(500, 'Failed to create review', createError);
  }
  
  return respond(201, {
    success: true,
    message: 'Review submitted successfully and is pending moderation',
    data: newReview
  });
};

const handleUpdateReview = async (event, authContext) => {
  const reviewId = event.queryStringParameters?.id;
  if (!reviewId) {
    throw httpError(400, 'Review ID is required');
  }
  
  const body = JSON.parse(event.body || '{}');
  
  // Get existing review
  const { data: existingReview, error: reviewError } = await safeSelect('reviews', {
    eq: { id: reviewId },
    single: true
  });
  
  if (reviewError || !existingReview) {
    throw httpError(404, 'Review not found');
  }
  
  // Check ownership (users can only update their own reviews)
  if (existingReview.user_id !== authContext.profile.id && authContext.profile.role !== 'admin') {
    throw httpError(403, 'You can only update your own reviews');
  }
  
  // Admins can update moderation fields, regular users can only update content
  let updateData = {};
  
  if (authContext.profile.role === 'admin') {
    // Admins can update any field
    if (body.status && ['pending', 'approved', 'rejected'].includes(body.status)) {
      updateData.status = body.status;
      updateData.moderated_by = authContext.profile.id;
      updateData.moderated_at = new Date().toISOString();
    }
    
    if (body.moderation_note) {
      updateData.moderation_note = body.moderation_note;
    }
  }
  
  // Regular users can update content if review is pending or they own it
  if (existingReview.user_id === authContext.profile.id) {
    if (body.rating && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5) {
      updateData.rating = body.rating;
    }
    
    if (body.title && body.title.trim().length >= 3) {
      updateData.title = body.title.trim();
    }
    
    if (body.comment && body.comment.trim().length >= 10) {
      updateData.comment = body.comment.trim();
    }
    
    // Reset to pending if content is updated (except for admins)
    if ((updateData.rating || updateData.title || updateData.comment) && authContext.profile.role !== 'admin') {
      updateData.status = 'pending';
      updateData.moderated_by = null;
      updateData.moderated_at = null;
      updateData.moderation_note = null;
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    throw httpError(400, 'No valid fields to update');
  }
  
  const { data: updatedReview, error: updateError } = await safeUpdate('reviews', updateData, { id: reviewId });
  
  if (updateError) {
    throw httpError(500, 'Failed to update review', updateError);
  }
  
  return respond(200, {
    success: true,
    message: 'Review updated successfully',
    data: updatedReview
  });
};

const handleDeleteReview = async (event, authContext) => {
  const reviewId = event.queryStringParameters?.id;
  if (!reviewId) {
    throw httpError(400, 'Review ID is required');
  }
  
  // Get existing review
  const { data: existingReview, error: reviewError } = await safeSelect('reviews', {
    eq: { id: reviewId },
    single: true
  });
  
  if (reviewError || !existingReview) {
    throw httpError(404, 'Review not found');
  }
  
  // Check permissions (users can delete their own reviews, admins can delete any)
  if (existingReview.user_id !== authContext.profile.id && authContext.profile.role !== 'admin') {
    throw httpError(403, 'You can only delete your own reviews');
  }
  
  const { error: deleteError } = await safeDelete('reviews', { id: reviewId });
  
  if (deleteError) {
    throw httpError(500, 'Failed to delete review', deleteError);
  }
  
  return respond(200, {
    success: true,
    message: 'Review deleted successfully'
  });
};

// Main handler
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  try {
    const method = event.httpMethod.toUpperCase();
    const actionConfig = ACTION_CONFIG[method];

    if (!actionConfig) {
      return respond(405, {
        error: { message: `Method ${method} not allowed` }
      }, {
        Allow: Object.keys(ACTION_CONFIG).join(', ')
      });
    }

    let authContext = null;
    if (actionConfig.requiresAuth) {
      authContext = await getAuthContext(event.headers);
    }

    // Route to appropriate handler
    switch (actionConfig.handler) {
      case 'handleGetReviews':
        return await handleGetReviews(event, authContext);
      case 'handleCreateReview':
        return await handleCreateReview(event, authContext);
      case 'handleUpdateReview':
        return await handleUpdateReview(event, authContext);
      case 'handleDeleteReview':
        return await handleDeleteReview(event, authContext);
      default:
        throw httpError(500, 'Invalid action handler');
    }
  } catch (error) {
    if (error.status) {
      return respond(error.status, error);
    }
    
    return respond(500, {
      error: { 
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { details: error.message })
      }
    });
  }
};
