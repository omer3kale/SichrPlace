import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for user-activity-tracking function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TIME_RANGES = {
  '1h': { amount: 1, unit: 'hour' },
  '24h': { amount: 24, unit: 'hour' },
  '7d': { amount: 7, unit: 'day' },
  '30d': { amount: 30, unit: 'day' },
};

const ACTION_CONFIG = {
  track: { methods: ['POST'], requiresAuth: false, handler: handleTrackActivity },
  get_stats: { methods: ['GET'], requiresAuth: true, handler: handleGetUserActivityStats },
  get_popular_pages: { methods: ['GET'], requiresAuth: true, handler: handleGetPopularPages },
  get_user_journey: { methods: ['GET'], requiresAuth: true, handler: handleGetUserJourney },
  get_user_engagement: { methods: ['GET'], requiresAuth: true, handler: handleGetUserEngagement },
  get_platform_metrics: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetPlatformMetrics,
  },
  get_feature_usage: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetFeatureUsage,
  },
  get_retention_churn: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetRetentionChurn,
  },
  get_funnel_analysis: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetFunnelAnalysis,
  },
  get_active_users: {
    methods: ['GET'],
    requiresAuth: true,
    handler: handleGetActiveUsers,
  },
  get_session_stats: {
    methods: ['GET'],
    requiresAuth: true,
    handler: handleGetSessionStats,
  },
  get_conversion_rates: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetConversionRates,
  },
  get_cohort_analysis: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetCohortAnalysis,
  },
  get_custom_event_stats: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetCustomEventStats,
  },
  get_heatmap_data: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetHeatmapData,
  },
  get_time_on_platform: {
    methods: ['GET'],
    requiresAuth: true,
    handler: handleGetTimeOnPlatform,
  },
  get_user_growth: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetUserGrowth,
  },
  get_engagement_trends: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetEngagementTrends,
  },
  get_top_users: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetTopUsers,
  },
  get_feedback_stats: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetFeedbackStats,
  },
  get_notification_stats: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetNotificationStats,
  },
  get_search_analytics: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetSearchAnalytics,
  },
  get_real_time_analytics: {
    methods: ['GET'],
    requiresAuth: true,
    allowedRoles: ['admin', 'analytics'],
    handler: handleGetRealTimeAnalytics,
  },
};

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const getHeader = (headers = {}, name) => {
  if (!headers) return null;
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
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
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON.');
  }
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  const limited = maxLength && trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  return allowEmpty ? limited : limited || null;
};

const sanitizeObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return undefined;
};

const isMissingTableError = (error) => error?.code === 'PGRST116';

const buildEmptyStats = (timeRange) => ({
  total_activities: 0,
  unique_users: 0,
  unique_sessions: 0,
  time_range: timeRange,
  generated_at: new Date().toISOString(),
  breakdown: {
    by_action: {},
    by_device: {},
    by_browser: {},
    by_hour: {},
  },
});

const buildActionDetails = () => ({
  available_actions: Object.entries(ACTION_CONFIG).map(([action, config]) => ({
    action,
    methods: config.methods,
    requires_auth: config.requiresAuth,
  })),
});

const resolveTimeRange = (value) => {
  const normalized = (value || '24h').toLowerCase();
  const range = TIME_RANGES[normalized] || TIME_RANGES['24h'];
  const now = new Date();
  const startDate = new Date(now);
  if (range.unit === 'hour') {
    startDate.setHours(now.getHours() - range.amount);
  } else {
    startDate.setDate(now.getDate() - range.amount);
  }
  return { key: TIME_RANGES[normalized] ? normalized : '24h', startDate };
};

const getAuthContext = async (eventHeaders, { required = true } = {}) => {
  const token = extractBearerToken(eventHeaders || {});
  if (!token) {
    if (required) {
      throw httpError(401, 'Authorization token is required.');
    }
    return { token: null, user: null, profile: null };
  }

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
    throw httpError(403, 'User profile not found.');
  }

  if (
    profile.is_blocked ||
    ['suspended', 'deleted'].includes(profile.account_status) ||
    profile.status === 'suspended'
  ) {
    throw httpError(403, 'User account is not permitted to access activity tracking.');
  }

  return { token, user: data.user, profile };
};

const extractClientIp = (headers = {}, requestContext = {}) => {
  const normalized = Object.entries(headers || {}).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});

  const forwarded = normalized['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = normalized['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  return (
    requestContext?.identity?.sourceIp ||
    requestContext?.http?.sourceIp ||
    'unknown'
  );
};

const safeSelect = async (table, columns, apply) => {
  let query = supabase.from(table).select(columns);
  if (apply) {
    query = apply(query) || query;
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw httpError(500, `Failed to load ${table}.`, error.message);
  }
  return data || [];
};

const safeCount = async (table, apply) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (apply) {
    query = apply(query) || query;
  }
  const { count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return 0;
    }
    throw httpError(500, `Failed to count ${table}.`, error.message);
  }
  return count || 0;
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const actionValue = sanitizeString(event.queryStringParameters?.action, {
      maxLength: 120,
      allowEmpty: false,
    });

    if (!actionValue) {
      throw httpError(400, 'Action parameter is required.', buildActionDetails());
    }

    const actionConfig = ACTION_CONFIG[actionValue];
    if (!actionConfig) {
      throw httpError(400, 'Invalid action specified.', buildActionDetails());
    }

    if (!actionConfig.methods.includes(method)) {
      const error = httpError(405, `Action "${actionValue}" is not available for ${method} requests.`, {
        action: actionValue,
        allowed_methods: actionConfig.methods,
      });
      error.allow = actionConfig.methods.join(', ');
      throw error;
    }

    const userContext = await getAuthContext(event.headers || {}, {
      required: actionConfig.requiresAuth,
    });

    if (actionConfig.allowedRoles?.length) {
      const roleValue = userContext.profile?.role ? userContext.profile.role.toLowerCase() : null;
      const allowed = actionConfig.allowedRoles.some((role) => role.toLowerCase() === roleValue);
      if (!allowed) {
        throw httpError(403, 'User role is not authorized for this analytics action.', {
          required_roles: actionConfig.allowedRoles,
        });
      }
    }

    const context = {
      event,
      headers,
      method,
      query: event.queryStringParameters || {},
      body: event.body,
      userContext,
    };

    return await actionConfig.handler(context);
  } catch (error) {
    console.error('user-activity-tracking error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'User activity tracking failed.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};

async function handleTrackActivity({ event, headers, body, userContext }) {
  const payload = parseRequestBody(body);

  const action = sanitizeString(payload.action, { maxLength: 120, allowEmpty: false });
  const pageUrl = sanitizeString(payload.page_url, { maxLength: 2048, allowEmpty: false });

  if (!action || !pageUrl) {
    throw httpError(400, 'Action and page_url are required for tracking.', buildActionDetails());
  }

  const pageTitle =
    sanitizeString(payload.page_title, { maxLength: 256, allowEmpty: true }) ||
    extractPageTitle(pageUrl);
  const referrer = sanitizeString(payload.referrer, { maxLength: 2048, allowEmpty: true });
  const userAgent = sanitizeString(payload.user_agent, { maxLength: 512, allowEmpty: true });
  const sessionId =
    sanitizeString(payload.session_id, { maxLength: 120, allowEmpty: true }) || generateSessionId();
  const metadata = sanitizeObject(payload.metadata) ?? {};

  const clientIP = extractClientIp(event.headers || {}, event.requestContext || {});
  const deviceInfo = parseUserAgent(userAgent || '');

  const activityData = {
    user_id: userContext.profile?.id || null,
    session_id: sessionId,
    action,
    page_url: pageUrl,
    page_title: pageTitle,
    referrer: referrer || null,
    user_agent: userAgent || null,
    ip_address: clientIP,
    device_type: deviceInfo.device_type,
    browser: deviceInfo.browser,
    operating_system: deviceInfo.os,
    metadata,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_activity')
    .insert(activityData)
    .select('id')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw httpError(500, 'User activity storage table is not available.', error.message);
    }
    throw httpError(500, 'Failed to track user activity.', error.message);
  }

  if (userContext.profile?.id) {
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .upsert(
        {
          user_id: userContext.profile.id,
          session_id: sessionId,
          last_activity: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'session_id',
          ignoreDuplicates: false,
        },
      );

    if (sessionError && !isMissingTableError(sessionError)) {
      console.error('Failed to upsert user session:', sessionError);
    }
  }

  return respond(200, headers, {
    success: true,
    message: 'Activity tracked successfully.',
    activity_id: data?.id || null,
    session_id: sessionId,
  });
}

async function handleGetUserActivityStats({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(
    query.time_range || query.timeRange,
  );

  const { data, error } = await supabase
    .from('user_activity')
    .select('action, page_url, device_type, browser, created_at, user_id, session_id')
    .gte('created_at', startDate.toISOString());

  if (error) {
    if (isMissingTableError(error)) {
      return respond(200, headers, {
        success: true,
        data: buildEmptyStats(timeRange),
      });
    }
    throw httpError(500, 'Failed to load user activity statistics.', error.message);
  }

  const activities = data || [];
  const stats = {
    total_activities: activities.length,
    unique_users: new Set(activities.filter((item) => item.user_id).map((item) => item.user_id)).size,
    unique_sessions: new Set(activities.map((item) => item.session_id)).size,
    time_range: timeRange,
    generated_at: new Date().toISOString(),
  };

  const actionCounts = {};
  const deviceCounts = {};
  const browserCounts = {};
  const hourlyActivity = {};

  activities.forEach((activity) => {
    const actionName = activity.action || 'unknown';
    actionCounts[actionName] = (actionCounts[actionName] || 0) + 1;

    const device = activity.device_type || 'unknown';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;

    const browser = activity.browser || 'unknown';
    browserCounts[browser] = (browserCounts[browser] || 0) + 1;

    const hour = new Date(activity.created_at).getHours();
    hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
  });

  stats.breakdown = {
    by_action: actionCounts,
    by_device: deviceCounts,
    by_browser: browserCounts,
    by_hour: hourlyActivity,
  };

  return respond(200, headers, {
    success: true,
    data: stats,
  });
}

async function handleGetPopularPages({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(
    query.time_range || query.timeRange,
  );

  const { data, error } = await supabase
    .from('user_activity')
    .select('page_url, page_title, created_at, user_id')
    .eq('action', 'page_view')
    .gte('created_at', startDate.toISOString());

  if (error) {
    if (isMissingTableError(error)) {
      return respond(200, headers, {
        success: true,
        data: {
          popular_pages: [],
          total_pages: 0,
          time_range: timeRange,
          generated_at: new Date().toISOString(),
        },
      });
    }
    throw httpError(500, 'Failed to load popular pages.', error.message);
  }

  const pageStats = new Map();
  (data || []).forEach((view) => {
    if (!view?.page_url) return;
    const key = view.page_url;
    if (!pageStats.has(key)) {
      pageStats.set(key, {
        url: key,
        title: view.page_title || extractPageTitle(key),
        total_views: 0,
        unique_visitors: new Set(),
        last_viewed: view.created_at,
      });
    }

    const entry = pageStats.get(key);
    entry.total_views += 1;
    if (view.user_id) {
      entry.unique_visitors.add(view.user_id);
    }
    if (view.created_at && new Date(view.created_at) > new Date(entry.last_viewed)) {
      entry.last_viewed = view.created_at;
    }
  });

  const popularPages = Array.from(pageStats.values())
    .map((entry) => ({
      ...entry,
      unique_visitors: entry.unique_visitors.size,
    }))
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, 20);

  return respond(200, headers, {
    success: true,
    data: {
      popular_pages: popularPages,
      total_pages: pageStats.size,
      time_range: timeRange,
      generated_at: new Date().toISOString(),
    },
  });
}

async function handleGetUserJourney({ headers, query, userContext }) {
  const userId = userContext.profile?.id;
  if (!userId) {
    throw httpError(401, 'User authentication is required for journey insights.');
  }

  const { key: timeRange, startDate } = resolveTimeRange(
    query.time_range || query.timeRange,
  );

  const { data, error } = await supabase
    .from('user_activity')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return respond(200, headers, {
        success: true,
        data: {
          user_id: userId,
          sessions: [],
          total_sessions: 0,
          total_activities: 0,
          time_range: timeRange,
          generated_at: new Date().toISOString(),
        },
      });
    }
    throw httpError(500, 'Failed to load user journey.', error.message);
  }

  const sessions = new Map();
  (data || []).forEach((activity) => {
    const sessionId = activity.session_id || 'unknown';
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        session_id: sessionId,
        start_time: activity.created_at,
        end_time: activity.created_at,
        activities: [],
        pages_visited: new Set(),
        actions_performed: new Set(),
      });
    }

    const session = sessions.get(sessionId);
    session.activities.push(activity);
    if (activity.page_url) {
      session.pages_visited.add(activity.page_url);
    }
    if (activity.action) {
      session.actions_performed.add(activity.action);
    }
    if (activity.created_at && new Date(activity.created_at) > new Date(session.end_time)) {
      session.end_time = activity.created_at;
    }
  });

  const userJourney = Array.from(sessions.values()).map((session) => ({
    session_id: session.session_id,
    start_time: session.start_time,
    end_time: session.end_time,
    duration_minutes: Math.max(
      0,
      Math.round((new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)),
    ),
    pages_visited: Array.from(session.pages_visited),
    actions_performed: Array.from(session.actions_performed),
    total_activities: session.activities.length,
  }));

  return respond(200, headers, {
    success: true,
    data: {
      user_id: userId,
      sessions: userJourney,
      total_sessions: userJourney.length,
      total_activities: data?.length || 0,
      time_range: timeRange,
      generated_at: new Date().toISOString(),
    },
  });
}

async function handleGetUserEngagement({ headers, query, userContext }) {
  const userId = userContext.profile?.id;
  if (!userId) {
    throw httpError(401, 'Authentication is required to retrieve personal engagement metrics.');
  }

  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);
  const endDate = new Date().toISOString();

  const activities = await safeSelect(
    'user_activity',
    'action, created_at, metadata, session_id, page_url',
    (builder) =>
      builder
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate)
        .order('created_at', { ascending: false }),
  );

  const byAction = {};
  const dailyActivity = {};
  const sessions = new Set();

  activities.forEach((activity) => {
    const action = activity.action || 'unknown';
    byAction[action] = (byAction[action] || 0) + 1;

    const day = activity.created_at ? activity.created_at.split('T')[0] : 'unknown';
    dailyActivity[day] = (dailyActivity[day] || 0) + 1;

    if (activity.session_id) {
      sessions.add(activity.session_id);
    }
  });

  const sortedDaily = Object.entries(dailyActivity).sort((a, b) => b[1] - a[1]);
  const daysInRange = Math.max(
    1,
    Math.round((new Date(endDate) - startDate) / (1000 * 60 * 60 * 24)),
  );

  const engagementScore = Math.min(
    100,
    Math.round(((activities.length || 0) / daysInRange) * 12),
  );

  return respond(200, headers, {
    success: true,
    data: {
      total_actions: activities.length,
      actions_by_type: byAction,
      daily_activity: dailyActivity,
      most_active_day: sortedDaily[0] || null,
      first_activity: activities[activities.length - 1]?.created_at || null,
      last_activity: activities[0]?.created_at || null,
      sessions: sessions.size,
      engagement_score: engagementScore,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: endDate,
    },
  });
}

async function handleGetPlatformMetrics({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);
  const endDate = new Date().toISOString();

  const [users, apartments, reviews, messages, bookings] = await Promise.all([
    safeSelect('users', 'id, created_at'),
    safeSelect('apartments', 'id, created_at, status'),
    safeSelect('reviews', 'id, created_at, rating'),
    safeSelect('messages', 'id, created_at'),
    safeSelect('bookings', 'id, created_at, status, total_amount'),
  ]);

  const usersRecent = users.filter((item) => new Date(item.created_at) >= startDate);
  const apartmentsRecent = apartments.filter((item) => new Date(item.created_at) >= startDate);

  const bookingsConfirmed = bookings.filter((item) => item.status === 'confirmed');
  const conversionRate = bookings.length
    ? Math.round((bookingsConfirmed.length / bookings.length) * 10000) / 100
    : 0;

  const totalRevenue = bookingsConfirmed.reduce((sum, booking) => {
    const amount = Number.parseFloat(booking.total_amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return respond(200, headers, {
    success: true,
    data: {
      totals: {
        users: users.length,
        apartments: apartments.length,
        reviews: reviews.length,
        messages: messages.length,
        bookings: bookings.length,
      },
      growth_since_start: {
        users: usersRecent.length,
        apartments: apartmentsRecent.length,
      },
      engagement: {
        reviews_per_apartment:
          apartments.length > 0 ? Number((reviews.length / apartments.length).toFixed(2)) : 0,
        messages_per_user:
          users.length > 0 ? Number((messages.length / users.length).toFixed(2)) : 0,
      },
      bookings: {
        confirmed: bookingsConfirmed.length,
        pending: bookings.filter((item) => item.status === 'pending').length,
        conversion_rate: conversionRate,
        total_revenue: Number(totalRevenue.toFixed(2)),
      },
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: endDate,
    },
  });
}

async function handleGetFeatureUsage({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'action, user_id, metadata, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const usage = activities.reduce(
    (acc, item) => {
      const action = item.action || 'other';
      acc.actions[action] = (acc.actions[action] || 0) + 1;
      if (item.user_id) {
        acc.uniqueUsers.add(item.user_id);
      }
      return acc;
    },
    { actions: {}, uniqueUsers: new Set() },
  );

  return respond(200, headers, {
    success: true,
    data: {
      total_events: activities.length,
      actions: usage.actions,
      unique_users: usage.uniqueUsers.size,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetRetentionChurn({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'user_id, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const activeUsers = new Set();
  const lastActivityByUser = new Map();

  activities.forEach((item) => {
    if (!item.user_id) return;
    activeUsers.add(item.user_id);
    lastActivityByUser.set(item.user_id, item.created_at);
  });

  const churnedUsers = Array.from(lastActivityByUser.entries()).filter(([_, date]) => {
    const lastActive = new Date(date);
    return (new Date() - lastActive) / (1000 * 60 * 60 * 24) > 14;
  });

  const retainedUsers = activeUsers.size - churnedUsers.length;

  return respond(200, headers, {
    success: true,
    data: {
      active_users: activeUsers.size,
      retained_users: retainedUsers,
      churned_users: churnedUsers.length,
      churn_rate:
        activeUsers.size > 0
          ? Number(((churnedUsers.length / activeUsers.size) * 100).toFixed(2))
          : 0,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetFunnelAnalysis({ headers, query }) {
  const steps = ['page_view', 'register', 'favorite_property', 'booking_request', 'booking_confirmed'];
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'user_id, action, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const funnel = steps.map((step) => ({ step, count: 0 }));
  const usersByStep = new Map();

  activities.forEach((item) => {
    if (!item.user_id) return;
    const stepIndex = steps.indexOf(item.action);
    if (stepIndex === -1) return;

    for (let i = 0; i <= stepIndex; i += 1) {
      if (!usersByStep.has(`${i}:${item.user_id}`)) {
        usersByStep.set(`${i}:${item.user_id}`, true);
        funnel[i].count += 1;
      }
    }
  });

  return respond(200, headers, {
    success: true,
    data: {
      funnel,
      conversion_rate:
        funnel[0].count > 0
          ? Number(((funnel[funnel.length - 1].count / funnel[0].count) * 100).toFixed(2))
          : 0,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetActiveUsers({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'user_id, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const uniqueUsers = new Set(activities.filter((item) => item.user_id).map((item) => item.user_id));

  return respond(200, headers, {
    success: true,
    data: {
      active_users: uniqueUsers.size,
      total_events: activities.length,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetSessionStats({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const sessions = await safeSelect(
    'user_sessions',
    'user_id, session_id, created_at, last_activity',
    (builder) => builder.gte('updated_at', startDate.toISOString()),
  );

  const durations = sessions
    .map((session) => {
      if (!session.last_activity || !session.created_at) return 0;
      const duration = new Date(session.last_activity) - new Date(session.created_at);
      return Math.max(0, duration / (1000 * 60));
    })
    .filter((value) => Number.isFinite(value));

  const averageDuration =
    durations.length > 0
      ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(2))
      : 0;

  return respond(200, headers, {
    success: true,
    data: {
      sessions: sessions.length,
      average_duration_minutes: averageDuration,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetConversionRates({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const bookings = await safeSelect(
    'bookings',
    'id, status, created_at, total_amount',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const requests = bookings.length;
  const confirmed = bookings.filter((item) => item.status === 'confirmed');
  const revenue = confirmed.reduce((sum, booking) => {
    const amount = Number.parseFloat(booking.total_amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return respond(200, headers, {
    success: true,
    data: {
      requests,
      confirmed: confirmed.length,
      conversion_rate: requests > 0 ? Number(((confirmed.length / requests) * 100).toFixed(2)) : 0,
      revenue: Number(revenue.toFixed(2)),
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetCohortAnalysis({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const users = await safeSelect(
    'users',
    'id, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const cohorts = users.reduce((acc, user) => {
    if (!user.created_at) return acc;
    const joined = new Date(user.created_at);
    const weekStart = new Date(Date.UTC(joined.getUTCFullYear(), joined.getUTCMonth(), joined.getUTCDate()));
    const day = weekStart.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
    const cohortKey = weekStart.toISOString().slice(0, 10);
    const entry = acc.get(cohortKey) || { cohort: cohortKey, users: 0 };
    entry.users += 1;
    acc.set(cohortKey, entry);
    return acc;
  }, new Map());

  const data = Array.from(cohorts.values()).sort((a, b) => (a.cohort > b.cohort ? 1 : -1));

  return respond(200, headers, {
    success: true,
    data: {
      cohorts: data,
      total_new_users: users.length,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetCustomEventStats({ headers, query }) {
  const eventName = sanitizeString(query.event || query.event_name, { maxLength: 120, allowEmpty: false });
  if (!eventName) {
    throw httpError(400, 'event query parameter is required for custom event statistics.');
  }

  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'user_id, session_id, metadata, created_at',
    (builder) => builder.eq('action', eventName).gte('created_at', startDate.toISOString()),
  );

  const uniqueUsers = new Set();
  const uniqueSessions = new Set();
  const metadataSamples = [];

  activities.forEach((activity) => {
    if (activity.user_id) uniqueUsers.add(activity.user_id);
    if (activity.session_id) uniqueSessions.add(activity.session_id);
    if (activity.metadata) metadataSamples.push(activity.metadata);
  });

  return respond(200, headers, {
    success: true,
    data: {
      event: eventName,
      total_events: activities.length,
      unique_users: uniqueUsers.size,
      unique_sessions: uniqueSessions.size,
      sample_metadata: metadataSamples.slice(0, 10),
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetHeatmapData({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'page_url, metadata, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const heatmap = activities.reduce((acc, activity) => {
    const url = activity.page_url || 'unknown';
    if (!acc[url]) {
      acc[url] = {
        page_url: url,
        clicks: 0,
        scroll_events: 0,
        custom_points: [],
      };
    }

    const entry = acc[url];
    const type = activity.metadata?.interaction_type || activity.metadata?.type;
    if (type === 'click') entry.clicks += 1;
    else if (type === 'scroll') entry.scroll_events += 1;

    if (Array.isArray(activity.metadata?.coordinates)) {
      entry.custom_points.push(...activity.metadata.coordinates.slice(0, 5));
    }

    return acc;
  }, {});

  return respond(200, headers, {
    success: true,
    data: {
      pages: Object.values(heatmap).map((item) => ({
        ...item,
        custom_points: item.custom_points.slice(0, 50),
      })),
      total_events: activities.length,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetTimeOnPlatform({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const sessions = await safeSelect(
    'user_sessions',
    'user_id, created_at, last_activity',
    (builder) => builder.gte('updated_at', startDate.toISOString()),
  );

  const totals = sessions.reduce((acc, session) => {
    if (!session.user_id || !session.created_at || !session.last_activity) return acc;
    const duration = Math.max(0, new Date(session.last_activity) - new Date(session.created_at));
    const entry = acc.get(session.user_id) || { user_id: session.user_id, total_ms: 0, sessions: 0 };
    entry.total_ms += duration;
    entry.sessions += 1;
    acc.set(session.user_id, entry);
    return acc;
  }, new Map());

  const results = Array.from(totals.values()).map((entry) => ({
    user_id: entry.user_id,
    total_minutes: Number((entry.total_ms / (1000 * 60)).toFixed(2)),
    average_session_minutes: entry.sessions > 0 ? Number(((entry.total_ms / entry.sessions) / (1000 * 60)).toFixed(2)) : 0,
    sessions: entry.sessions,
  }));

  return respond(200, headers, {
    success: true,
    data: {
      users: results.sort((a, b) => b.total_minutes - a.total_minutes).slice(0, 50),
      average_minutes:
        results.length > 0
          ? Number((results.reduce((sum, entry) => sum + entry.total_minutes, 0) / results.length).toFixed(2))
          : 0,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetUserGrowth({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const users = await safeSelect('users', 'id, created_at');

  const now = new Date();
  const periodMs = Math.max(1, now.getTime() - startDate.getTime());
  const previousPeriodStart = new Date(startDate.getTime() - periodMs);
  const previousPeriodEnd = new Date(startDate);

  const newUsers = users.filter((user) => user.created_at && new Date(user.created_at) >= startDate);
  const previousPeriodUsers = users.filter((user) => {
    if (!user.created_at) return false;
    const created = new Date(user.created_at);
    return created >= previousPeriodStart && created < previousPeriodEnd;
  });

  const growthRate = previousPeriodUsers.length
    ? Number((((newUsers.length - previousPeriodUsers.length) / previousPeriodUsers.length) * 100).toFixed(2))
    : newUsers.length > 0
    ? 100
    : 0;

  return respond(200, headers, {
    success: true,
    data: {
      total_users: users.length,
      new_users: newUsers.length,
      previous_period_users: previousPeriodUsers.length,
      growth_rate: growthRate,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: now.toISOString(),
    },
  });
}

async function handleGetEngagementTrends({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'action, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const byDay = activities.reduce((acc, activity) => {
    const day = activity.created_at ? activity.created_at.split('T')[0] : 'unknown';
    const action = activity.action || 'other';
    if (!acc[day]) {
      acc[day] = { total: 0, actions: {} };
    }
    acc[day].total += 1;
    acc[day].actions[action] = (acc[day].actions[action] || 0) + 1;
    return acc;
  }, {});

  const trend = Object.entries(byDay)
    .map(([day, value]) => ({ date: day, total: value.total, actions: value.actions }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return respond(200, headers, {
    success: true,
    data: {
      daily_trend: trend,
      average_daily_activity:
        trend.length > 0 ? Number((trend.reduce((sum, entry) => sum + entry.total, 0) / trend.length).toFixed(2)) : 0,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetTopUsers({ headers, query }) {
  const limit = Number.parseInt(query.limit, 10) || 20;
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const activities = await safeSelect(
    'user_activity',
    'user_id, action, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const users = activities.reduce((acc, activity) => {
    if (!activity.user_id) return acc;
    const entry = acc.get(activity.user_id) || { user_id: activity.user_id, actions: 0, last_activity: null };
    entry.actions += 1;
    if (!entry.last_activity || new Date(activity.created_at) > new Date(entry.last_activity)) {
      entry.last_activity = activity.created_at;
    }
    acc.set(activity.user_id, entry);
    return acc;
  }, new Map());

  const topUsers = Array.from(users.values())
    .sort((a, b) => b.actions - a.actions)
    .slice(0, Math.min(Math.max(limit, 1), 100));

  return respond(200, headers, {
    success: true,
    data: {
      users: topUsers,
      total_tracked_users: users.size,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetFeedbackStats({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const feedback = await safeSelect(
    'feedback',
    'id, created_at, rating, category',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const categories = feedback.reduce((acc, item) => {
    const category = item.category || 'general';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const ratings = feedback
    .map((item) => Number.parseFloat(item.rating))
    .filter((value) => Number.isFinite(value));

  const averageRating = ratings.length > 0 ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : 0;

  return respond(200, headers, {
    success: true,
    data: {
      total_feedback: feedback.length,
      categories,
      average_rating: averageRating,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetNotificationStats({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const notifications = await safeSelect(
    'notifications',
    'id, type, status, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const byType = {};
  const byStatus = {};

  notifications.forEach((notification) => {
    const type = notification.type || 'general';
    const status = notification.status || 'pending';
    byType[type] = (byType[type] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  return respond(200, headers, {
    success: true,
    data: {
      total_notifications: notifications.length,
      by_type: byType,
      by_status: byStatus,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetSearchAnalytics({ headers, query }) {
  const { key: timeRange, startDate } = resolveTimeRange(query.time_range || query.timeRange);

  const searches = await safeSelect(
    'search_logs',
    'query, filters, results_count, created_at',
    (builder) => builder.gte('created_at', startDate.toISOString()),
  );

  const terms = {};
  const filters = {};
  let zeroResults = 0;

  searches.forEach((entry) => {
    const term = sanitizeString(entry.query, { maxLength: 160, allowEmpty: true }) || 'unknown';
    terms[term] = (terms[term] || 0) + 1;
    if (Array.isArray(entry.filters)) {
      entry.filters.forEach((filter) => {
        const key = typeof filter === 'string' ? filter : filter?.name;
        if (!key) return;
        filters[key] = (filters[key] || 0) + 1;
      });
    }
    if (!Number.isFinite(entry.results_count) || Number(entry.results_count) === 0) {
      zeroResults += 1;
    }
  });

  const sortedTerms = Object.entries(terms)
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return respond(200, headers, {
    success: true,
    data: {
      total_searches: searches.length,
      common_terms: sortedTerms,
      common_filters: filters,
      zero_result_rate: searches.length ? Number(((zeroResults / searches.length) * 100).toFixed(2)) : 0,
    },
    time_range: {
      key: timeRange,
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
  });
}

async function handleGetRealTimeAnalytics({ headers }) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [recentActivity, activeSessions] = await Promise.all([
    safeSelect('user_activity', 'action, created_at', (builder) =>
      builder.gte('created_at', fiveMinutesAgo.toISOString()).lte('created_at', now.toISOString()),
    ),
    safeSelect('user_sessions', 'session_id, last_activity', (builder) =>
      builder.gte('last_activity', fiveMinutesAgo.toISOString()),
    ),
  ]);

  const byAction = recentActivity.reduce((acc, activity) => {
    const action = activity.action || 'other';
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});

  return respond(200, headers, {
    success: true,
    data: {
      window_minutes: 5,
      total_events: recentActivity.length,
      actions: byAction,
      active_sessions: new Set(activeSessions.map((session) => session.session_id)).size,
    },
    time_range: {
      key: '5m',
      start: fiveMinutesAgo.toISOString(),
      end: now.toISOString(),
    },
  });
}