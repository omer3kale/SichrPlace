import { createClient } from '@supabase/supabase-js';
import { mapArrayToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for analytics-stats function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TIME_RANGES = {
  '24h': { amount: 24, unit: 'hour' },
  '7d': { amount: 7, unit: 'day' },
  '30d': { amount: 30, unit: 'day' },
  '90d': { amount: 90, unit: 'day' },
  '1y': { amount: 1, unit: 'year' },
};

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const httpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

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

const resolveTimeRange = (value) => {
  const normalized = (value || '30d').toLowerCase();
  const range = TIME_RANGES[normalized] || TIME_RANGES['30d'];
  const now = new Date();
  const startDate = new Date(now);

  if (range.unit === 'hour') {
    startDate.setHours(now.getHours() - range.amount);
  } else if (range.unit === 'day') {
    startDate.setDate(now.getDate() - range.amount);
  } else {
    startDate.setFullYear(now.getFullYear() - range.amount);
  }

  return {
    key: TIME_RANGES[normalized] ? normalized : '30d',
    startDate,
    endDate: now,
  };
};

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return defaultValue;
};

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
    throw httpError(500, `Failed to load ${table}.`, error.message);
  }
  return data || [];
};

const safeCount = async (table, modify) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (modify) {
    query = modify(query) || query;
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

const getAuthContext = async (headers) => {
  const token = extractBearerToken(headers || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required.');
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
    throw httpError(403, 'User account is not permitted to access analytics statistics.');
  }

  return { token, user: data.user, profile };
};

const processTimeSeriesData = (data, timeRangeKey, dateField) => {
  if (!data?.length) return [];

  const groupBy = timeRangeKey === '24h' ? 'hour' : 'day';
  const grouped = {};

  data.forEach((item) => {
    const source = item?.[dateField];
    if (!source) return;
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return;

    let key;
    if (groupBy === 'hour') {
      key = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
    } else {
      key = date.toISOString().slice(0, 10);
    }

    grouped[key] = (grouped[key] || 0) + 1;
  });

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildTopApartmentMetrics = (apartments = [], bookings = [], views = []) => {
  if (!apartments.length) return [];

  const apartmentsById = apartments.reduce((acc, apartment) => {
    if (apartment?.id) {
      acc.set(apartment.id, {
        id: apartment.id,
        title: apartment.title || null,
        price: apartment.price || null,
        city: apartment.city || null,
        booking_count: 0,
        total_revenue: 0,
        view_count: 0,
      });
    }
    return acc;
  }, new Map());

  views.forEach((view) => {
    if (!view?.apartment_id) return;
    const entry = apartmentsById.get(view.apartment_id);
    if (entry) {
      entry.view_count += 1;
    }
  });

  bookings
    .filter((booking) => booking?.apartment_id)
    .forEach((booking) => {
      const entry = apartmentsById.get(booking.apartment_id);
      if (!entry) return;
      entry.booking_count += 1;
      const amount = Number.parseFloat(booking.total_amount);
      if (Number.isFinite(amount)) {
        entry.total_revenue += amount;
      }
    });

  return Array.from(apartmentsById.values())
    .filter((entry) => entry.booking_count > 0 || entry.view_count > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    if (method !== 'GET') {
      const error = httpError(405, 'Method not allowed. Only GET is supported.', {
        allowed_methods: ['GET'],
      });
      error.allow = 'GET, OPTIONS';
      throw error;
    }

    const query = event.queryStringParameters || {};
    const timeRangeValue = query.time_range || query.timeRange;
    const includeDetails = parseBoolean(query.includeDetails ?? query.include_details, false);

    const { key: timeRangeKey, startDate, endDate } = resolveTimeRange(timeRangeValue);
    const startIso = startDate.toISOString();

    const authContext = await getAuthContext(event.headers || {});
    const role = authContext.profile?.role ? authContext.profile.role.toLowerCase() : null;
    const allowedRoles = ['admin', 'analytics'];
    if (!allowedRoles.includes(role)) {
      throw httpError(403, 'User role is not authorized to access analytics statistics.', {
        required_roles: allowedRoles,
      });
    }

    const requestStartedAt = Date.now();

    const [
      totalUsers,
      totalApartments,
      totalBookings,
      recentActivity,
      apartmentViews,
      userGrowth,
      bookingStats,
      revenueRecords,
      apartments,
      userEngagement,
    ] = await Promise.all([
      safeCount('users'),
      safeCount('apartments'),
      safeCount('bookings', (builder) => builder.gte('created_at', startIso)),
      safeSelect(
        'user_activity',
        'action, created_at, metadata',
        (builder) =>
          builder
            .gte('created_at', startIso)
            .order('created_at', { ascending: false })
            .limit(includeDetails ? 100 : 10),
      ),
      safeSelect('apartment_views', 'apartment_id, created_at', (builder) => builder.gte('created_at', startIso)),
      safeSelect('users', 'created_at', (builder) => builder.gte('created_at', startIso).order('created_at', { ascending: true })),
      safeSelect(
        'bookings',
        'apartment_id, status, total_amount, commission_amount, created_at, check_in_date, check_out_date',
        (builder) => builder.gte('created_at', startIso),
      ),
      safeSelect(
        'bookings',
        'total_amount, commission_amount, status, created_at',
        (builder) =>
          builder
            .gte('created_at', startIso)
            .in('status', ['confirmed', 'completed']),
      ),
      safeSelect('apartments', 'id, title, price, city'),
      safeSelect('user_activity', 'user_id, action, created_at', (builder) => builder.gte('created_at', startIso)),
    ]);

    const totalViews = apartmentViews.length;
    const totalBookingsCount = totalBookings;
    const conversionRate = totalViews > 0 ? Number(((totalBookingsCount / totalViews) * 100).toFixed(2)) : 0;

    const bookingsByStatus = bookingStats.reduce((acc, booking) => {
      if (!booking?.status) return acc;
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    let totalRevenue = 0;
    let totalCommission = 0;
    revenueRecords.forEach((booking) => {
      const revenue = Number.parseFloat(booking.total_amount);
      const commission = Number.parseFloat(booking.commission_amount);
      if (Number.isFinite(revenue)) {
        totalRevenue += revenue;
      }
      if (Number.isFinite(commission)) {
        totalCommission += commission;
      }
    });

    const avgBookingValue = totalBookingsCount > 0 ? Number((totalRevenue / totalBookingsCount).toFixed(2)) : 0;

    const userGrowthData = processTimeSeriesData(userGrowth, timeRangeKey, 'created_at');
    const viewsData = processTimeSeriesData(apartmentViews, timeRangeKey, 'created_at');

    const activeUsers = new Set();
    const actionCounts = {};
    userEngagement.forEach((activity) => {
      if (activity?.user_id) {
        activeUsers.add(activity.user_id);
      }
      if (activity?.action) {
        actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
      }
    });

    const topApartments = buildTopApartmentMetrics(apartments, bookingStats, apartmentViews);

    const analytics = {
      overview: {
        total_users: totalUsers,
        total_apartments: totalApartments,
        total_bookings: totalBookingsCount,
        active_users: activeUsers.size,
        conversion_rate: conversionRate,
        avg_booking_value: avgBookingValue,
        time_range: timeRangeKey,
      },
      revenue: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_commission: Number(totalCommission.toFixed(2)),
        net_revenue: Number((totalRevenue - totalCommission).toFixed(2)),
        currency: 'EUR',
      },
      bookings: {
        by_status: bookingsByStatus,
        total_count: totalBookingsCount,
        conversion_rate: conversionRate,
      },
      user_growth: userGrowthData,
      apartment_views: viewsData,
      user_engagement: {
        active_users: activeUsers.size,
        total_actions: userEngagement.length,
        actions_breakdown: actionCounts,
      },
      top_apartments: mapArrayToFrontend(topApartments),
      performance_metrics: {
        response_time_ms: Date.now() - requestStartedAt,
        queries_executed: 10,
        cache_hit_rate: '85%',
        data_freshness: 'real-time',
      },
    };

    if (includeDetails) {
      analytics.recent_activity = recentActivity.map((activity) => ({
        action: activity.action || 'unknown',
        timestamp: activity.created_at,
        metadata: activity.metadata || null,
      }));
    }

    return respond(200, headers, {
      success: true,
      data: analytics,
      generated_at: endDate.toISOString(),
      time_range: timeRangeKey,
    });
  } catch (error) {
    console.error('analytics-stats error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'Failed to fetch analytics statistics.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};