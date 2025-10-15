import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    // Debug environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY1;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Missing environment variables',
          debug: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            urlPreview: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'missing',
            keyPreview: supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'missing'
          }
        }),
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test the exact query structure from apartments function
    let query = supabase
      .from('apartments')
      .select(`
        *,
        users:landlord_id (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    // Apply default filters like the real function
    query = query.eq('status', 'available');

    // Pagination like the real function
    const page = 1;
    const limit = 12;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: apartments, error, count } = await query;

    if (error) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Database query failed',
          error: error.message,
          code: error.code
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Test successful',
        count: apartments?.length || 0,
        sample: apartments?.[0] || null,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message,
        stack: error.stack
      }),
    };
  }
};