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
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Health check successful',
        timestamp: new Date().toISOString(),
        environment: {
          supabaseUrl: (process.env.SUPABASE_URL) ? 'configured' : 'missing',
          supabaseKey: (process.env.SUPABASE_SERVICE_ROLE_KEY1 || process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'configured' : 'missing',
          jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing'
        }
      }),
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
        success: false,
        message: 'Health check failed',
        error: error.message
      }),
    };
  }
};