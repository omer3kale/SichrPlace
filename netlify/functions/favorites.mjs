import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables for favorites function');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const getHeader = (headers = {}, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
  const value = getHeader(headers, 'authorization');
  if (!value) return null;
  const parts = value.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

const httpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    if (typeof body === 'object') {
      return body;
    }
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON.');
  }
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed.length === 0 ? (allowEmpty ? '' : null) : trimmed;
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isMissingTableError = (error) => error?.code === 'PGRST116';

const safeSelect = async (table, columns, modify) => {
  let query = supabase.from(table).select(columns);
  if (modify) {
    query = modify(query) || query;
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw httpError(500, `Failed to load ${table}`, error.message);
  }
  return data || [];
};

const safeInsert = async (table, data) => {
  const { data: result, error } = await supabase
    .from(table)
    .insert([data])
    .select();
  
  if (error) {
    throw httpError(500, `Failed to insert into ${table}`, error.message);
  }
  return result;
};

const safeDelete = async (table, condition) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .match(condition);
  
  if (error) {
    throw httpError(500, `Failed to delete from ${table}`, error.message);
  }
};

const getAuthContext = async (headers) => {
  const token = extractBearerToken(headers || {});
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

    return { user: data.user, profile };
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'Authentication failed');
  }
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const { user, profile } = await getAuthContext(event.headers || {});
    const userId = profile.id;

    if (method === 'GET') {
      return await getFavorites(userId, headers);
    }
    
    if (method === 'POST') {
      return await toggleFavorite(userId, event.body, headers);
    }
    
    if (method === 'DELETE') {
      return await deleteFavorite(userId, event, headers);
    }

    const error = httpError(405, 'Method not allowed', {
      allowed_methods: ['GET', 'POST', 'DELETE'],
    });
    error.allow = 'GET, POST, DELETE, OPTIONS';
    throw error;
  } catch (error) {
      console.error('favorites error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'Favorites operation failed.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};

// GET user favorites
const getFavorites = async (userId, headers) => {
  try {
    const data = await safeSelect(
      'favorites',
      `
        id,
        apartment_id,
        created_at,
        apartments:apartment_id (
          id,
          title,
          description,
          price,
          bilder,
          size,
          rooms,
          address,
          city
        )
      `,
      (query) => query.eq('user_id', userId).order('created_at', { ascending: false })
    );

    // Map apartment data from German to English field names
    const mappedData = data.map((favorite) => ({
      ...favorite,
      apartments: favorite.apartments ? mapApartmentToFrontend(favorite.apartments) : null,
    }));

    return respond(200, headers, {
      success: true,
      data: mappedData,
      total: mappedData.length,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    throw error;
  }
};

// POST toggle favorite (add/remove)
const toggleFavorite = async (userId, body, headers) => {
  try {
    const payload = parseRequestBody(body);
    const apartmentIdRaw = payload.apartmentId || payload.apartment_id;
    const apartmentId = sanitizeString(apartmentIdRaw, { maxLength: 36 });

    if (!apartmentId) {
      return respond(400, headers, {
        success: false,
        error: 'Apartment ID is required.',
      });
    }

    if (apartmentId.length === 36 && !isUuid(apartmentId)) {
      return respond(400, headers, {
        success: false,
        error: 'Apartment ID must be a valid UUID.',
      });
    }

    // Check if already favorite
    const { data: existing, error: existingError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('apartment_id', apartmentId)
      .maybeSingle();

    if (existingError) {
      throw httpError(500, 'Failed to check existing favorites.', existingError.message);
    }

    let result;
    let action;

    if (existing) {
      // Remove from favorites
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('apartment_id', apartmentId);

      if (error) throw httpError(500, 'Failed to remove favorite.', error.message);
      
      result = { removed: true };
      action = 'removed';
    } else {
      // Add to favorites
      const { data, error } = await supabase
        .from('favorites')
        .insert([{
          user_id: userId,
          apartment_id: apartmentId,
          created_at: new Date().toISOString(),
        }])
        .select();

      if (error) throw httpError(500, 'Failed to add favorite.', error.message);

      result = data?.[0] || null;
      action = 'added';
    }

    return respond(200, headers, {
      success: true,
      action,
      data: result,
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    throw error;
  }
};

// DELETE specific favorite
const deleteFavorite = async (userId, event, headers) => {
  try {
    const pathId = sanitizeString(event.path?.split('/')?.pop() || '', { maxLength: 36, allowEmpty: true });
    const queryId = sanitizeString(event.queryStringParameters?.apartment_id, { maxLength: 36 });
    const apartmentId = queryId || pathId;

    if (!apartmentId) {
      return respond(400, headers, {
        success: false,
        error: 'Apartment ID is required.',
      });
    }

    if (apartmentId.length === 36 && !isUuid(apartmentId)) {
      return respond(400, headers, {
        success: false,
        error: 'Apartment ID must be a valid UUID.',
      });
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('apartment_id', apartmentId);

    if (error) {
      throw httpError(500, 'Failed to remove favorite.', error.message);
    }

    return respond(200, headers, {
      success: true,
      message: 'Favorite removed successfully.',
      data: { apartment_id: apartmentId },
    });
  } catch (error) {
    console.error('Delete favorite error:', error);
    throw error;
  }
};