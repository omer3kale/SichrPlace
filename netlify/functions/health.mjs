import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for health function');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

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

export const handler = async (event, context) => {
  console.log('Health check handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const { httpMethod } = event;
    
    // Only allow GET requests
    if (httpMethod !== 'GET') {
      throw httpError(405, 'Method not allowed');
    }

    const startTime = Date.now();
    
    // Check database connection
    let databaseStatus = 'healthy';
    let databaseLatency = 0;
    let userCount = 0;
    let apartmentCount = 0;
    let viewingRequestCount = 0;

    try {
      const dbStartTime = Date.now();
      
      // Test database connection with a simple query
      const { data: testData, error: testError } = await safeSelect(
        supabase
          .from('profiles')
          .select('id')
          .limit(1),
        'profiles',
        'Health check database connection test'
      );

      if (testError) {
        throw testError;
      }

      databaseLatency = Date.now() - dbStartTime;

      // Get basic statistics
      const [usersResult, apartmentsResult, viewingRequestsResult] = await Promise.all([
        safeSelect(
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          'profiles',
          'Count profiles for health check'
        ),
        safeSelect(
          supabase.from('apartments').select('id', { count: 'exact', head: true }),
          'apartments',
          'Count apartments for health check'
        ),
        safeSelect(
          supabase.from('viewing_requests').select('id', { count: 'exact', head: true }),
          'viewing_requests',
          'Count viewing requests for health check'
        )
      ]);

      userCount = usersResult.data?.count || 0;
      apartmentCount = apartmentsResult.data?.count || 0;
      viewingRequestCount = viewingRequestsResult.data?.count || 0;

    } catch (error) {
      console.error('Database health check failed:', error);
      databaseStatus = 'unhealthy';
      databaseLatency = Date.now() - startTime;
    }

    // Calculate total response time
    const totalLatency = Date.now() - startTime;

    // Determine overall health status
    const isHealthy = databaseStatus === 'healthy' && totalLatency < 5000; // 5 second threshold

    const healthStatus = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      services: {
        database: {
          status: databaseStatus,
          latency_ms: databaseLatency,
          provider: 'Supabase'
        },
        api: {
          status: 'healthy',
          latency_ms: totalLatency,
          provider: 'Netlify Functions'
        }
      },
      statistics: {
        users: userCount,
        apartments: apartmentCount,
        viewing_requests: viewingRequestCount,
        last_updated: new Date().toISOString()
      },
      system: {
        node_version: process.version,
        memory_usage: process.memoryUsage(),
        platform: process.platform
      }
    };

    const statusCode = isHealthy ? 200 : 503;
    const headers = {
      ...buildHeaders(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify(healthStatus),
    };

  } catch (error) {
    console.error('Health check handler error:', error);
    
    const status = error.status || 500;
    const message = status === 500 ? 'Health check failed' : error.message;
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: message
    };

    if (error.details && status !== 500) {
      errorResponse.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details || error.message;
    }

    return {
      statusCode: status,
      headers: buildHeaders(),
      body: JSON.stringify(errorResponse),
    };
  }
};