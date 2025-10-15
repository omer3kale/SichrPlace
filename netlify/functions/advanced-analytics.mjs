import { createClient } from '@supabase/supabase-js';
import { mapArrayToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for advanced-analytics function');
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

const DEFAULT_METRICS = ['users', 'properties', 'search', 'revenue', 'performance'];

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

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return defaultValue;
};

const resolveTimeRange = (value) => {
  const normalized = (value || '7d').toLowerCase();
  const range = TIME_RANGES[normalized] || TIME_RANGES['7d'];
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
    key: TIME_RANGES[normalized] ? normalized : '7d',
    startDate,
    endDate: now,
  };
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
    throw httpError(403, 'User account is not permitted to access advanced analytics.');
  }

  return { token, user: data.user, profile };
};

const parseMetricsParam = (raw) => {
  if (!raw || (typeof raw === 'string' && raw.trim().toLowerCase() === 'all')) {
    return new Set(DEFAULT_METRICS);
  }

  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',').map((item) => item.trim())
    : [];

  const normalized = values
    .map((item) => item.toLowerCase())
    .filter((item) => DEFAULT_METRICS.includes(item));

  if (!normalized.length) {
    return new Set(DEFAULT_METRICS);
  }

  return new Set(normalized);
};

const createDatasetLoaders = ({ startIso, previousStartIso, previousEndIso }) => ({
  totalUsersAll: () => safeCount('users'),
  newUsers: () => safeCount('users', (builder) => builder.gte('created_at', startIso)),
  userActivityCurrent: () =>
    safeSelect('user_activity', 'user_id, action, created_at, metadata', (builder) => builder.gte('created_at', startIso)),
  userActivityPrevious: () =>
    safeSelect('user_activity', 'user_id, created_at', (builder) => builder.gte(previousStartIso).lt('created_at', previousEndIso)),
  userSessionsCurrent: () => safeSelect('user_sessions', 'user_id, last_activity', (builder) => builder.gte('last_activity', startIso)),
  totalPropertiesAll: () => safeCount('apartments'),
  newProperties: () => safeCount('apartments', (builder) => builder.gte('created_at', startIso)),
  apartmentViewsCurrent: () => safeSelect('apartment_views', 'apartment_id, created_at', (builder) => builder.gte('created_at', startIso)),
  bookingsCurrent: () =>
    safeSelect(
      'bookings',
      'apartment_id, status, total_amount, commission_amount, created_at, check_in_date, check_out_date',
      (builder) => builder.gte('created_at', startIso),
    ),
  apartmentsAll: () => safeSelect('apartments', 'id, title, price, city'),
  bookingRequestsCurrent: () => safeCount('booking_requests', (builder) => builder.gte('created_at', startIso)),
  searchLogsCurrent: () =>
    safeSelect(
      'search_logs',
      'query, results_count, filters, metadata, created_at, location',
      (builder) => builder.gte('created_at', startIso),
    ),
});

const processTimeSeriesData = (data, timeRangeKey, dateField) => {
  if (!data?.length) return [];

  const groupBy = timeRangeKey === '24h' ? 'hour' : 'day';
  const grouped = {};

  data.forEach((item) => {
    const value = item?.[dateField];
    if (!value) return;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return;

    const key = groupBy === 'hour' ? `${date.toISOString().slice(0, 13)}:00:00.000Z` : date.toISOString().slice(0, 10);
    grouped[key] = (grouped[key] || 0) + 1;
  });

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const buildTopPropertyInsights = (apartments = [], bookings = [], views = []) => {
  if (!apartments.length) return [];

  const map = apartments.reduce((acc, apartment) => {
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
    const entry = map.get(view.apartment_id);
    if (entry) {
      entry.view_count += 1;
    }
  });

  bookings.forEach((booking) => {
    if (!booking?.apartment_id) return;
    const entry = map.get(booking.apartment_id);
    if (!entry) return;
    entry.booking_count += 1;
    const amount = Number.parseFloat(booking.total_amount);
    if (Number.isFinite(amount)) {
      entry.total_revenue += amount;
    }
  });

  return Array.from(map.values())
    .filter((entry) => entry.booking_count > 0 || entry.view_count > 0)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);
};

const gatherUserAnalytics = async ({ getDataset, timeRangeKey }) => {
  const [totalUsers, newUsers, currentActivity, previousActivity, sessions] = await Promise.all(
    ['totalUsersAll', 'newUsers', 'userActivityCurrent', 'userActivityPrevious', 'userSessionsCurrent'].map((key) =>
      getDataset(key),
    ),
  );

  const activeUsersSet = new Set();
  currentActivity.forEach((item) => {
    if (item?.user_id) {
      activeUsersSet.add(item.user_id);
    }
  });
  sessions.forEach((item) => {
    if (item?.user_id) {
      activeUsersSet.add(item.user_id);
    }
  });

  const previousActiveSet = new Set();
  previousActivity.forEach((item) => {
    if (item?.user_id) {
      previousActiveSet.add(item.user_id);
    }
  });

  const retainedUsers = [...activeUsersSet].filter((userId) => previousActiveSet.has(userId)).length;
  const actionsTotal = currentActivity.length;
  const activeUsers = activeUsersSet.size;

  const retentionRate = activeUsers > 0 ? Number(((retainedUsers / activeUsers) * 100).toFixed(2)) : 0;
  const engagementScore = activeUsers > 0 ? Math.min(100, Math.round((actionsTotal / activeUsers) * 12)) : 0;
  const avgActionsPerActiveUser = activeUsers > 0 ? Number((actionsTotal / activeUsers).toFixed(2)) : 0;

  return {
    total_users: totalUsers,
    active_users: activeUsers,
    new_registrations: newUsers,
    retention_rate: retentionRate,
    user_engagement_score: engagementScore,
    avg_actions_per_active_user: avgActionsPerActiveUser,
    actions_total: actionsTotal,
    time_series: processTimeSeriesData(currentActivity, timeRangeKey, 'created_at'),
  };
};

const gatherPropertyAnalytics = async ({ getDataset }) => {
  const [
    totalProperties,
    newListings,
    views,
    bookings,
    apartments,
    bookingRequests,
  ] = await Promise.all(
    [
      'totalPropertiesAll',
      'newProperties',
      'apartmentViewsCurrent',
      'bookingsCurrent',
      'apartmentsAll',
      'bookingRequestsCurrent',
    ].map((key) => getDataset(key)),
  );

  const propertiesViewed = views.length;
  const confirmedBookings = bookings.filter((booking) =>
    ['confirmed', 'completed'].includes((booking?.status || '').toLowerCase()),
  );

  const conversionRate = propertiesViewed
    ? Number(((confirmedBookings.length / propertiesViewed) * 100).toFixed(2))
    : 0;

  const topProperties = buildTopPropertyInsights(apartments, confirmedBookings, views);

  return {
    total_properties: totalProperties,
    new_listings: newListings,
    properties_viewed: propertiesViewed,
    booking_requests: bookingRequests,
    conversion_rate: conversionRate,
    top_properties: mapArrayToFrontend(topProperties),
  };
};

const gatherSearchAnalytics = async ({ getDataset }) => {
  const searchLogs = await getDataset('searchLogsCurrent');
  if (!searchLogs.length) {
    return {
      total_searches: 0,
      popular_locations: [],
      search_conversion: 0,
      avg_search_results: 0,
      zero_result_rate: 0,
    };
  }

  let resultsTotal = 0;
  let successCount = 0;
  let zeroResults = 0;
  const locationMap = new Map();

  const registerLocation = (value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    const entry = locationMap.get(key) || { name: normalized, count: 0 };
    entry.count += 1;
    locationMap.set(key, entry);
  };

  searchLogs.forEach((log) => {
    const resultsCount = Number.parseFloat(log?.results_count);
    if (Number.isFinite(resultsCount)) {
      resultsTotal += resultsCount;
      if (resultsCount > 0) {
        successCount += 1;
      } else {
        zeroResults += 1;
      }
    }

    registerLocation(log?.location);
    registerLocation(log?.metadata?.location || log?.metadata?.city);

    if (Array.isArray(log?.filters)) {
      log.filters.forEach((filter) => {
        if (typeof filter === 'string') {
          registerLocation(filter);
        } else if (filter && typeof filter === 'object') {
          registerLocation(filter.location || filter.value || filter.name);
        }
      });
    }

    if (typeof log?.query === 'string') {
      registerLocation(log.query);
    }
  });

  const totalSearches = searchLogs.length;
  const searchConversion = Number(((successCount / totalSearches) * 100).toFixed(2));
  const avgSearchResults = Number((resultsTotal / totalSearches).toFixed(2));
  const zeroResultRate = Number(((zeroResults / totalSearches) * 100).toFixed(2));

  const popularLocations = Array.from(locationMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((entry) => entry.name);

  return {
    total_searches: totalSearches,
    popular_locations: popularLocations,
    search_conversion: searchConversion,
    avg_search_results: avgSearchResults,
    zero_result_rate: zeroResultRate,
  };
};

const gatherRevenueAnalytics = async ({ getDataset }) => {
  const bookings = await getDataset('bookingsCurrent');
  if (!bookings.length) {
    return {
      total_revenue: 0,
      commission_earned: 0,
      net_revenue: 0,
      avg_transaction_value: 0,
      payment_success_rate: 0,
      bookings_processed: 0,
    };
  }

  let totalRevenue = 0;
  let totalCommission = 0;
  let successfulCount = 0;

  bookings.forEach((booking) => {
    const status = (booking?.status || '').toLowerCase();
    const amount = Number.parseFloat(booking?.total_amount);
    const commission = Number.parseFloat(booking?.commission_amount);
    if (['confirmed', 'completed'].includes(status)) {
      if (Number.isFinite(amount)) {
        totalRevenue += amount;
      }
      if (Number.isFinite(commission)) {
        totalCommission += commission;
      }
      successfulCount += 1;
    }
  });

  const bookingsProcessed = bookings.length;
  const avgTransactionValue = successfulCount > 0 ? Number((totalRevenue / successfulCount).toFixed(2)) : 0;
  const paymentSuccessRate = Number(((successfulCount / bookingsProcessed) * 100).toFixed(2));

  return {
    total_revenue: Number(totalRevenue.toFixed(2)),
    commission_earned: Number(totalCommission.toFixed(2)),
    net_revenue: Number((totalRevenue - totalCommission).toFixed(2)),
    avg_transaction_value: avgTransactionValue,
    payment_success_rate: paymentSuccessRate,
    bookings_processed: bookingsProcessed,
  };
};

const gatherPerformanceAnalytics = async ({ getDataset }) => {
  const activity = await getDataset('userActivityCurrent');
  if (!activity.length) {
    return {
      avg_page_load_time: null,
      function_response_times: {},
      error_rates: {},
      uptime_percentage: 99.9,
      samples: {
        page_loads: 0,
        function_calls: 0,
      },
    };
  }

  const pageLoadSamples = [];
  const functionStats = new Map();
  let totalErrors = 0;

  activity.forEach((entry) => {
    const metadata = entry?.metadata || {};
    const pageLoadMs = Number(
      metadata.page_load_time_ms ?? metadata.pageLoadTimeMs ?? metadata.page_load_time ?? metadata.pageLoadTime,
    );
    if (Number.isFinite(pageLoadMs)) {
      pageLoadSamples.push(pageLoadMs);
    }

    const functionName = metadata.function_name || metadata.functionName || metadata.lambda || metadata.handler;
    const durationMs = Number(
      metadata.duration_ms ?? metadata.durationMs ?? metadata.response_time_ms ?? metadata.responseTimeMs,
    );
    const status = typeof metadata.status === 'string' ? metadata.status.toLowerCase() : null;
    const errorFlag = metadata.error === true || metadata.is_error === true || status === 'error';

    if (functionName && Number.isFinite(durationMs)) {
      const key = functionName;
      const info = functionStats.get(key) || { totalDuration: 0, count: 0, errorCount: 0 };
      info.totalDuration += durationMs;
      info.count += 1;
      if (errorFlag) {
        info.errorCount += 1;
      }
      functionStats.set(key, info);
    } else if (errorFlag) {
      totalErrors += 1;
    }
  });

  const averagePageLoadMs = pageLoadSamples.length
    ? pageLoadSamples.reduce((sum, value) => sum + value, 0) / pageLoadSamples.length
    : null;
  const avgPageLoadTime = averagePageLoadMs != null ? `${(averagePageLoadMs / 1000).toFixed(2)}s` : null;

  const functionResponseTimes = {};
  const errorRates = {};
  let totalFunctionCalls = 0;

  functionStats.forEach((info, name) => {
    totalFunctionCalls += info.count;
    functionResponseTimes[name] = Number((info.totalDuration / info.count).toFixed(2));
    errorRates[name] = info.count ? Number(((info.errorCount / info.count) * 100).toFixed(2)) : 0;
    totalErrors += info.errorCount;
  });

  const uptimePercentage = totalFunctionCalls
    ? Number((100 - (totalErrors / totalFunctionCalls) * 100).toFixed(2))
    : 99.9;

  return {
    avg_page_load_time: avgPageLoadTime,
    function_response_times: functionResponseTimes,
    error_rates: errorRates,
    uptime_percentage: uptimePercentage,
    samples: {
      page_loads: pageLoadSamples.length,
      function_calls: totalFunctionCalls,
    },
  };
};

const METRIC_HANDLERS = {
  users: gatherUserAnalytics,
  properties: gatherPropertyAnalytics,
  search: gatherSearchAnalytics,
  revenue: gatherRevenueAnalytics,
  performance: gatherPerformanceAnalytics,
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) {
      const error = httpError(405, 'Method not allowed. Only GET and POST are supported.', {
        allowed_methods: ['GET', 'POST'],
      });
      error.allow = 'GET, POST, OPTIONS';
      throw error;
    }

    const query = event.queryStringParameters || {};
    const bodyPayload = method === 'POST' ? parseRequestBody(event.body) : {};

    const timeRangeValue =
      bodyPayload.timeframe || bodyPayload.time_range || query.timeframe || query.time_range;
    const metricsRaw = bodyPayload.metrics ?? query.metrics;
    const includePerformance = parseBoolean(
      bodyPayload.include_performance ?? query.include_performance ?? true,
      true,
    );

    const { key: timeRangeKey, startDate, endDate } = resolveTimeRange(timeRangeValue);
    const startIso = startDate.toISOString();
    const periodMs = endDate.getTime() - startDate.getTime();
    const previousStartIso = new Date(startDate.getTime() - periodMs).toISOString();
    const previousEndIso = startIso;

    const authContext = await getAuthContext(event.headers || {});
    const role = authContext.profile?.role ? authContext.profile.role.toLowerCase() : null;
    const allowedRoles = ['admin', 'analytics'];
    if (!allowedRoles.includes(role)) {
      throw httpError(403, 'User role is not authorized to access advanced analytics.', {
        required_roles: allowedRoles,
      });
    }

    const selectedMetrics = parseMetricsParam(metricsRaw);
    if (!includePerformance) {
      selectedMetrics.delete('performance');
    }

    const datasetLoaders = createDatasetLoaders({
      startIso,
      previousStartIso,
      previousEndIso,
    });

    const datasetCache = {};
    const getDataset = async (key) => {
      if (!datasetLoaders[key]) {
        throw httpError(400, `Unknown dataset key requested: ${key}`);
      }
      if (!datasetCache[key]) {
        datasetCache[key] = datasetLoaders[key]();
      }
      return datasetCache[key];
    };

    const context = {
      getDataset,
      timeRangeKey,
    };

    const analyticsData = {
      timestamp: new Date().toISOString(),
      timeframe: timeRangeKey,
    };

    for (const metric of selectedMetrics) {
      const handlerFn = METRIC_HANDLERS[metric];
      if (!handlerFn) continue;
      const result = await handlerFn(context);
      if (metric === 'users') {
        analyticsData.user_analytics = result;
      } else if (metric === 'properties') {
        analyticsData.property_analytics = result;
      } else if (metric === 'search') {
        analyticsData.search_analytics = result;
      } else if (metric === 'revenue') {
        analyticsData.revenue_analytics = result;
      } else if (metric === 'performance') {
        analyticsData.performance_analytics = result;
      }
    }

    return respond(200, headers, {
      success: true,
      data: analyticsData,
      message: 'Advanced analytics retrieved successfully',
    });
  } catch (error) {
    console.error('advanced-analytics error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'Advanced analytics failed' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};