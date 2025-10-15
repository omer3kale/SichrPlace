import { createClient } from '@supabase/supabase-js';
import { mapUserToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for user-management function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const publicSupabase =
  supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

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
  last_login,
  account_status,
  email_verified
`;

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

const sanitizeUserRecord = (user) => {
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
    'account_status',
    'email_verified',
  ];

  const filtered = {};
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(user, field)) {
      filtered[field] = user[field];
    }
  });

  return mapUserToFrontend(filtered, { keepLegacy: true });
};

const isMissingTableError = (error) => error?.code === 'PGRST116';

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

const sanitizeObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return undefined;
};

const clampNumber = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const buildProfileUpdatePayload = (payload) => {
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
    const notification = sanitizeObject(payload.notification_settings);
    updates.notification_settings = notification ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'privacy_settings')) {
    const privacy = sanitizeObject(payload.privacy_settings);
    updates.privacy_settings = privacy ?? null;
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

const collectUserStats = async (userId) => {
  const results = await Promise.all([
    supabase
      .from('apartments')
      .select('id, views_count, status', { count: 'exact' })
      .eq('landlord_id', userId),
    supabase
      .from('bookings')
      .select('id, status, total_amount')
      .eq('requester_id', userId),
    supabase
      .from('reviews')
      .select('id, rating')
      .eq('requester_id', userId),
    supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId),
    supabase
      .from('messages')
      .select('id, created_at')
      .eq('sender_id', userId),
    supabase
      .from('user_activity')
      .select('id, action, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const [apartmentsRes, bookingsRes, reviewsRes, favoritesRes, messagesRes, activityRes] = results;

  if (
    [apartmentsRes, bookingsRes, reviewsRes, favoritesRes, messagesRes, activityRes].some(
      (res) => res?.error && !isMissingTableError(res.error),
    )
  ) {
    const firstError = [
      apartmentsRes,
      bookingsRes,
      reviewsRes,
      favoritesRes,
      messagesRes,
      activityRes,
    ].find((res) => res?.error && !isMissingTableError(res.error))?.error;
    throw httpError(500, 'Failed to collect user statistics.', firstError?.message);
  }

  const apartments = apartmentsRes?.data || [];
  const bookings = bookingsRes?.data || [];
  const reviews = reviewsRes?.data || [];
  const favorites = favoritesRes?.data || [];
  const messages = messagesRes?.data || [];
  const activity = activityRes?.data || [];

  const totalViews = apartments.reduce((sum, apt) => sum + (Number(apt.views_count) || 0), 0);
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const totalBookingSpend = bookings.reduce(
    (sum, b) => sum + (Number.isFinite(Number(b.total_amount)) ? Number(b.total_amount) : 0),
    0,
  );
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length
    : 0;

  const mostCommonAction = activity.reduce((acc, entry) => {
    if (!entry?.action) return acc;
    acc[entry.action] = (acc[entry.action] || 0) + 1;
    return acc;
  }, {});

  const topAction = Object.entries(mostCommonAction).reduce(
    (top, [action, count]) => {
      if (!top || count > top.count) {
        return { action, count };
      }
      return top;
    },
    null,
  );

  return {
    apartments: {
      total: apartments.length,
      active: apartments.filter((apt) => apt.status === 'active').length,
      total_views: totalViews,
    },
    bookings: {
      total: bookings.length,
      confirmed: confirmedBookings.length,
      total_spent: Number(totalBookingSpend.toFixed(2)),
    },
    reviews: {
      total: reviews.length,
      average_rating: Number(averageRating.toFixed(2)),
    },
    favorites: {
      total: favorites.length,
    },
    messages: {
      total: messages.length,
      last_30_days: messages.filter((msg) => {
        if (!msg?.created_at) return false;
        const created = new Date(msg.created_at);
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return created > cutoff;
      }).length,
    },
    activity: {
      total_actions: activity.length,
      last_activity: activity[0]?.created_at || null,
      most_common_action: topAction?.action || null,
    },
  };
};

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

const handleGetUserProfile = async ({ headers, userId }) => {
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_SELECT_FIELDS)
    .eq('id', userId)
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return respond(200, headers, { success: true, data: null });
    }
    if (error.code === 'PGRST116') {
      throw httpError(404, 'Profile not found.');
    }
    throw httpError(500, 'Failed to load profile information.', error.message);
  }

  return respond(200, headers, {
    success: true,
    data: sanitizeUserRecord(data),
  });
};

const handleUpdateUserProfile = async ({ headers, userId, body }) => {
  const payload = parseRequestBody(body);
  const updates = buildProfileUpdatePayload(payload);

  if (Object.keys(updates).length === 0) {
    throw httpError(400, 'No valid fields provided for update.');
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select(PROFILE_SELECT_FIELDS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw httpError(404, 'Profile not found.');
    }
    throw httpError(500, 'Failed to update profile.', error.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Profile updated successfully.',
    data: sanitizeUserRecord(data),
  });
};

const handleGetUserStats = async ({ headers, userId }) => {
  const stats = await collectUserStats(userId);
  return respond(200, headers, {
    success: true,
    data: stats,
  });
};

const handleGetUserActivity = async ({ headers, userId, query }) => {
  const { limit = '50', offset = '0', action_type: actionType } = query || {};

  const parsedLimit = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
  const parsedOffset = clampNumber(offset, { min: 0, max: 10000, fallback: 0 });
  const sanitizedActionType = sanitizeString(actionType, { maxLength: 120, allowEmpty: true });

  let builder = supabase
    .from('user_activity')
    .select('id, user_id, action, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1);

  if (sanitizedActionType) {
    builder = builder.eq('action', sanitizedActionType);
  }

  const { data, error } = await builder;

  if (error) {
    if (isMissingTableError(error)) {
      return respond(200, headers, {
        success: true,
        data: {
          activities: [],
          pagination: {
            limit: parsedLimit,
            offset: parsedOffset,
            returned: 0,
          },
        },
      });
    }
    throw httpError(500, 'Failed to load user activity.', error.message);
  }

  return respond(200, headers, {
    success: true,
    data: {
      activities: data || [],
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        returned: data?.length || 0,
      },
    },
  });
};

const handleUpdatePreferences = async ({ headers, userId, body }) => {
  const payload = parseRequestBody(body);
  const allowedKeys = ['preferences', 'notification_settings', 'privacy_settings'];

  const updatePayload = {};
  allowedKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
    const sanitized = sanitizeObject(payload[key]);
    updatePayload[key] = sanitized ?? null;
  });

  if (Object.keys(updatePayload).length === 0) {
    throw httpError(400, 'No valid preference fields provided.');
  }

  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select('preferences, notification_settings, privacy_settings')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw httpError(404, 'Profile not found.');
    }
    throw httpError(500, 'Failed to update preferences.', error.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Preferences updated successfully.',
    data,
  });
};

const handleUpdatePassword = async ({ headers, userId, userEmail, body }) => {
  if (!publicSupabase) {
    throw httpError(503, 'Password updates are temporarily unavailable.');
  }

  const payload = parseRequestBody(body);
  const currentPassword = sanitizeString(payload.current_password, {
    maxLength: 128,
    allowEmpty: false,
  });
  const newPassword = sanitizeString(payload.new_password, {
    maxLength: 128,
    allowEmpty: false,
  });

  if (!currentPassword || !newPassword) {
    throw httpError(400, 'Current and new passwords are required.');
  }

  if (newPassword.length < 8) {
    throw httpError(400, 'New password must be at least 8 characters long.');
  }

  if (!userEmail) {
    throw httpError(400, 'Unable to verify user email for password update.');
  }

  const { error: signInError } = await publicSupabase.auth.signInWithPassword({
    email: userEmail,
    password: currentPassword,
  });

  if (signInError) {
    throw httpError(400, 'Current password is incorrect.');
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw httpError(500, 'Failed to update password.', updateError.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Password updated successfully.',
  });
};

const handleUpdateAvatar = async ({ headers, userId, body }) => {
  const payload = parseRequestBody(body);
  const profileImage = sanitizeString(payload.profile_image, { maxLength: 2048, allowEmpty: false });

  if (!profileImage) {
    throw httpError(400, 'A valid profile_image string is required.');
  }

  const updates = {
    profile_image: profileImage,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, profile_image, updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw httpError(404, 'Profile not found.');
    }
    throw httpError(500, 'Failed to update avatar.', error.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Avatar updated successfully.',
    data,
  });
};

const handleDeleteAccount = async ({ headers, userId, body }) => {
  const payload = parseRequestBody(body);
  const deleteReason = sanitizeString(payload.reason, { maxLength: 500, allowEmpty: true });

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw httpError(500, 'Failed to delete user account.', deleteError.message);
  }

  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('users')
    .update({
      account_status: 'deleted',
      deleted_at: timestamp,
      delete_reason: deleteReason && deleteReason.length > 0 ? deleteReason : null,
    })
    .eq('id', userId);

  if (updateError && !isMissingTableError(updateError)) {
    throw httpError(500, 'Failed to mark account as deleted.', updateError.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Account deleted successfully.',
  });
};

const ACTION_CONFIG = {
  get_user_profile: { methods: ['GET'], handler: handleGetUserProfile },
  update_user_profile: { methods: ['PUT', 'POST'], handler: handleUpdateUserProfile },
  get_user_stats: { methods: ['GET'], handler: handleGetUserStats },
  get_user_activity: { methods: ['GET'], handler: handleGetUserActivity },
  update_preferences: { methods: ['PUT', 'POST'], handler: handleUpdatePreferences },
  update_password: { methods: ['PUT', 'POST'], handler: handleUpdatePassword },
  update_avatar: { methods: ['PUT', 'POST'], handler: handleUpdateAvatar },
  delete_account: { methods: ['DELETE', 'POST'], handler: handleDeleteAccount },
};

const buildActionDetails = () => ({
  available_actions: Object.entries(ACTION_CONFIG).map(([action, config]) => ({
    action,
    methods: config.methods,
  })),
});

export const handler = async (event) => {
  const headers = buildHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authResult = await getAuthContext(event.headers || {});

    const method = (event.httpMethod || 'GET').toUpperCase();
    const actionValue = sanitizeString(event.queryStringParameters?.action, {
      maxLength: 120,
      allowEmpty: false,
    });

    if (!actionValue) {
      throw httpError(400, 'Missing action parameter.', buildActionDetails());
    }

    const actionConfig = ACTION_CONFIG[actionValue];
    if (!actionConfig) {
      throw httpError(400, 'Invalid action specified.', buildActionDetails());
    }

    if (!actionConfig.methods.includes(method)) {
      const error = httpError(
        405,
        `Action "${actionValue}" is not available for ${method} requests.`,
        {
          action: actionValue,
          allowed_methods: actionConfig.methods,
        },
      );
      error.allow = actionConfig.methods.join(', ');
      throw error;
    }

    const context = {
      headers,
      userId: authResult.profile.id,
      userEmail: authResult.authUser.email || authResult.profile.email,
      body: event.body,
      query: event.queryStringParameters || {},
    };

    return await actionConfig.handler(context);
  } catch (error) {
    console.error('user-management error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'User management operation failed.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};