import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend, mapUserToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for recently-viewed function');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const isSchemaMismatchError = (error) => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  if (message.includes('does not exist')) {
    if (message.includes('column') || message.includes('relation') || message.includes('foreign key')) {
      return true;
    }
  }
  if (message.includes('schema') && message.includes('mismatch')) {
    return true;
  }
  return false;
};

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
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

const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    if (typeof body === 'object') {
      return body;
    }
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON');
  }
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clampNumber = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

// Standardized helper functions
const isMissingTableError = (error) => {
  return error && error.code === 'PGRST116';
};

const safeSelect = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Query failed`, error.message);
  }
};

const safeInsert = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Table not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Insert failed`, error.message);
  }
};

const safeUpdate = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Update failed`, error.message);
  }
};

const safeDelete = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Delete failed`, error.message);
  }
};

const getAuthContext = async (event, options = {}) => {
  const token = extractBearerToken(event.headers || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'Invalid or expired token');
  }

  const { data: profile, error: profileError } = await safeSelect(
    supabase
      .from('profiles')
      .select('id, email, role, status, account_status, is_blocked, is_admin, is_staff, notification_preferences')
      .eq('id', data.user.id)
      .single(),
    'profiles',
    'Failed to fetch user profile'
  );

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw httpError(403, 'User profile not found');
  }

  // Check account status
  if (profile.is_blocked) {
    throw httpError(403, 'Account is blocked');
  }

  if (profile.account_status === 'suspended') {
    throw httpError(403, 'Account is suspended');
  }

  // Check role requirements if specified
  if (options.requireAdmin && !profile.is_admin) {
    throw httpError(403, 'Admin access required');
  }

  if (options.requireAnalytics && !(profile.is_admin || profile.is_staff || profile.role === 'analytics')) {
    throw httpError(403, 'Analytics access required');
  }

  return {
    user: data.user,
    profile,
    isAdmin: profile.is_admin,
    isStaff: profile.is_staff
  };
};



const getAuthenticatedUser = async (headers) => {
  const token = extractBearerToken(headers);
  if (!token) {
    return { error: httpError(401, 'Authorization token is required.') };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { error: httpError(401, 'Invalid or expired token.') };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, is_blocked, status, account_status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return { error: httpError(403, 'User profile not found.') };
  }

  if (profile.is_blocked || ['suspended', 'deleted'].includes(profile.account_status)) {
    return { error: httpError(403, 'User account is not permitted to access recently viewed data.') };
  }

  return { profile };
};

export const handler = async (event, context) => {
  console.log('Recently viewed handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    if (event.httpMethod === 'GET') {
      const limit = clampNumber(event.queryStringParameters?.limit, {
        min: 1,
        max: 50,
        fallback: 10,
      });

      if (authResult.error) {
        if (authResult.error.status === 401) {
          return respond(200, headers, {
            success: true,
            data: [],
            message: 'Authentication required to view recent history.',
          });
        }

        const status = authResult.error.status || 403;
        return respond(status, headers, {
          success: false,
          error: authResult.error.message,
        });
      }

      const userId = authResult.profile.id;

      const fetchRecentlyViewed = async (selectClause) => {
        return supabase
          .from('recently_viewed')
          .select(selectClause)
          .eq('user_id', userId)
          .order('viewed_at', { ascending: false })
          .limit(limit);
      };

      const englishSelect = `
        *,
        apartment:apartments (
          *,
          landlord:users!apartments_owner_id_fkey(id, username, first_name, last_name, email, phone)
        )
      `;

      const germanSelect = `
        *,
        apartment:apartments (
          *,
          landlord:users!apartments_owner_id_fkey(id, username, first_name, last_name, email, phone),
          images:apartment_images(url, is_main)
        )
      `;

      let recentlyViewedResponse = await fetchRecentlyViewed(englishSelect);

      if (recentlyViewedResponse.error && isSchemaMismatchError(recentlyViewedResponse.error)) {
        recentlyViewedResponse = await fetchRecentlyViewed(germanSelect);
      }

      if (recentlyViewedResponse.error) {
        console.error('Get recently viewed error:', recentlyViewedResponse.error);
        throw httpError(500, 'Failed to get recently viewed apartments.', recentlyViewedResponse.error.message);
      }

      const normalized = (recentlyViewedResponse.data || []).map((entry) => {
        const apartment = entry.apartment ? mapApartmentToFrontend(entry.apartment) : null;
        const landlord = entry.apartment?.landlord ? mapUserToFrontend(entry.apartment.landlord) : null;

        if (apartment) {
          apartment.landlord = landlord;
        }

        return {
          id: entry.id,
          user_id: entry.user_id,
          apartment_id: entry.apartment_id,
          viewed_at: entry.viewed_at,
          apartment,
        };
      });

      return respond(200, headers, {
        success: true,
        data: normalized,
        total: normalized.length,
      });

    } else if (event.httpMethod === 'POST') {
      if (authResult.error) {
        const status = authResult.error.status || 401;
        return respond(status, headers, {
          success: false,
          error: status === 401 ? 'Authentication required.' : authResult.error.message,
        });
      }

      const userId = authResult.profile.id;
      const payload = parseRequestBody(event.body);
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

      // Check if apartment exists
      const tryFetchApartment = async (columns) => (
        supabase
          .from('apartments')
          .select(columns)
          .eq('id', apartmentId)
          .single()
      );

      let apartmentResponse = await tryFetchApartment('id, title');

      if (apartmentResponse.error && isSchemaMismatchError(apartmentResponse.error)) {
        apartmentResponse = await tryFetchApartment('id, title');
      }

      const apartment = apartmentResponse.data;
      const apartmentError = apartmentResponse.error;

      if (apartmentError || !apartment) {
        return respond(404, headers, {
          success: false,
          error: 'Apartment not found.',
        });
      }

      // Check if already in recently viewed
      const { data: existing, error: existingError } = await supabase
        .from('recently_viewed')
        .select('id')
        .eq('user_id', userId)
        .eq('apartment_id', apartmentId)
        .maybeSingle();

      if (existingError) {
        throw httpError(500, 'Failed to check recently viewed status.', existingError.message);
      }

      if (existing) {
        // Update viewed timestamp
        const { error: updateError } = await supabase
          .from('recently_viewed')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Update recently viewed error:', updateError);
          throw httpError(500, 'Failed to update view timestamp.', updateError.message);
        }
      } else {
        // Add new entry
        const { error: insertError } = await supabase
          .from('recently_viewed')
          .insert({
            user_id: userId,
            apartment_id: apartmentId,
            viewed_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Insert recently viewed error:', insertError);
          throw httpError(500, 'Failed to add to recently viewed.', insertError.message);
        }

        // Clean up old entries (keep only last 50)
        const { data: oldEntries } = await supabase
          .from('recently_viewed')
          .select('id')
          .eq('user_id', userId)
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

      return respond(200, headers, {
        success: true,
        message: 'Added to recently viewed',
      });

    } else if (event.httpMethod === 'DELETE') {
      if (authResult.error) {
        const status = authResult.error.status || 401;
        return respond(status, headers, {
          success: false,
          error: status === 401 ? 'Authentication required.' : authResult.error.message,
        });
      }

      const userId = authResult.profile.id;

      const { error } = await supabase
        .from('recently_viewed')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Clear recently viewed error:', error);
        throw httpError(500, 'Failed to clear recently viewed.', error.message);
      }

      return respond(200, headers, {
        success: true,
        message: 'Recently viewed history cleared',
      });

    } else {
      return respond(405, headers, {
        success: false,
        error: 'Method not allowed',
      });
    }

  } catch (error) {
    console.error('Recently viewed error:', error);
    const status = error.status || 500;
    return respond(status, headers, {
      success: false,
      error: status === 500 ? 'Recently viewed operation failed.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};