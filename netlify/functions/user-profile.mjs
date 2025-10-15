import { createClient } from '@supabase/supabase-js';
import { mapUserToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for user-profile function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const PROFILE_SELECT_FIELDS = `
  id,
  email,
  username,
  first_name,
  last_name,
  phone,
  role,
  user_type,
  profile_image,
  bio,
  preferences,
  notification_settings,
  privacy_settings,
  address,
  house_number,
  postal_code,
  city,
  state,
  land,
  geburtsdatum,
  created_at,
  updated_at,
  last_login
`;

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

const httpError = (status, message, details = null) => {
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
    throw httpError(400, 'Request body must be valid JSON');
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
      .select('id, email, role, status, account_status, is_blocked, is_admin, is_staff')
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

  // Check if account is blocked or suspended
  if (profile.is_blocked || ['suspended', 'deleted'].includes(profile.account_status) || profile.status === 'suspended') {
    throw httpError(403, 'Account access restricted');
  }

  // Check role requirements
  if (options.requireAdmin && !profile.is_admin) {
    throw httpError(403, 'Admin access required');
  }

  return { user: data.user, profile, token };
};

const sanitizeObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return undefined;
};

const sanitizeProfile = (user) => {
  if (!user) return null;
  const allowedFields = [
    'id',
    'email',
    'username',
    'first_name',
    'last_name',
    'phone',
    'role',
    'user_type',
    'profile_image',
    'bio',
    'preferences',
    'notification_settings',
    'privacy_settings',
    'address',
    'house_number',
    'postal_code',
    'city',
    'state',
    'land',
    'geburtsdatum',
    'created_at',
    'updated_at',
    'last_login',
  ];

  const filtered = {};
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(user, field)) {
      filtered[field] = user[field];
    }
  });

  return mapUserToFrontend(filtered, { keepLegacy: true });
};

const buildUpdatePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return {};

  const updates = {};
  const stringFields = {
    first_name: 80,
    last_name: 80,
    phone: 40,
    username: 60,
    bio: 500,
    address: 120,
    house_number: 20,
    postal_code: 16,
    city: 80,
    state: 80,
    land: 80,
    profile_image: 2048,
  };

  Object.entries(stringFields).forEach(([key, maxLength]) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;

    if (typeof payload[key] === 'string') {
      const sanitized = sanitizeString(payload[key], { maxLength, allowEmpty: true });
      if (sanitized === '') {
        updates[key] = null;
      } else if (sanitized) {
        updates[key] = sanitized;
      }
    } else if (payload[key] === null) {
      updates[key] = null;
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, 'preferences')) {
    const preferences = sanitizeObject(payload.preferences);
    updates.preferences = preferences ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notification_settings')) {
    const notificationSettings = sanitizeObject(payload.notification_settings);
    updates.notification_settings = notificationSettings ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'privacy_settings')) {
    const privacySettings = sanitizeObject(payload.privacy_settings);
    updates.privacy_settings = privacySettings ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'geburtsdatum')) {
    if (payload.geburtsdatum === null || payload.geburtsdatum === '') {
      updates.geburtsdatum = null;
    } else {
      const dateValue = new Date(payload.geburtsdatum);
      if (!Number.isNaN(dateValue.getTime())) {
        updates.geburtsdatum = dateValue.toISOString();
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'user_type')) {
    if (payload.user_type === null) {
      updates.user_type = null;
    } else if (['applicant', 'landlord'].includes(payload.user_type)) {
      updates.user_type = payload.user_type;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'role')) {
    if (payload.role === null) {
      updates.role = null;
    } else if (['user', 'tenant', 'landlord', 'admin'].includes(payload.role)) {
      updates.role = payload.role;
    }
  }

  return updates;
};

const fetchProfileRecord = async (userId) => {
  const { data, error } = await safeSelect(
    supabase
      .from('profiles')
      .select(PROFILE_SELECT_FIELDS)
      .eq('id', userId)
      .single(),
    'profiles',
    'Failed to load profile information'
  );

  if (error) {
    throw error;
  }

  return data;
};

const handleGetProfile = async (userId) => {
  const profileRecord = await fetchProfileRecord(userId);
  return respond(200, {
    success: true,
    data: sanitizeProfile(profileRecord),
  });
};

const handleUpdateProfile = async (userId, body) => {
  const payload = parseRequestBody(body);
  const updates = buildUpdatePayload(payload);

  if (Object.keys(updates).length === 0) {
    throw httpError(400, 'No valid fields provided for update.');
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await safeUpdate(
    supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(PROFILE_SELECT_FIELDS)
      .single(),
    'profiles',
    'Failed to update profile'
  );

  if (error) {
    throw error;
  }

  return respond(200, {
    success: true,
    data: sanitizeProfile(data),
  });
};

export const handler = async (event) => {
  console.log('User profile handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const { profile } = await getAuthContext(event);
    const userId = profile.id;

    switch (event.httpMethod) {
      case 'GET':
        return await handleGetProfile(userId);
      case 'PUT':
        return await handleUpdateProfile(userId, event.body);
      default:
        throw httpError(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('User profile handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Profile operation failed' : error.message;
    
    const errorResponse = {
      success: false,
      error: message
    };

    if (error.details && status !== 500) {
      errorResponse.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details || error.message;
    }

    return respond(status, errorResponse);
  }
};