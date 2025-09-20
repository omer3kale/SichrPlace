import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  try {
    const { httpMethod } = event;
    
    // Only allow GET requests
    if (httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Method not allowed'
        }),
      };
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
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      if (testError) {
        throw testError;
      }

      databaseLatency = Date.now() - dbStartTime;

      // Get basic statistics
      const [usersResult, apartmentsResult, viewingRequestsResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('apartments').select('id', { count: 'exact', head: true }),
        supabase.from('viewing_requests').select('id', { count: 'exact', head: true })
      ]);

      userCount = usersResult.count || 0;
      apartmentCount = apartmentsResult.count || 0;
      viewingRequestCount = viewingRequestsResult.count || 0;

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

    return {
      statusCode: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(healthStatus),
    };

  } catch (error) {
    console.error('Health check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      }),
    };
  }
};