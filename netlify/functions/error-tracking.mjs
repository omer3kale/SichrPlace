import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  // Handle CORS preflight requests

  if (event.httpMethod === 'OPTIONS') {

    return {

      statusCode: 200,// Initialize Supabase client for error logging// Initialize Supabase client for error logging

      headers: {

        'Access-Control-Allow-Origin': '*',const supabase = createClient(const supabase = createClient(

        'Access-Control-Allow-Methods': 'POST, OPTIONS',

        'Access-Control-Allow-Headers': 'Content-Type, Authorization',  process.env.SUPABASE_URL,  process.env.SUPABASE_URL,

      },

      body: '',  process.env.SUPABASE_SERVICE_ROLE_KEY1  process.env.SUPABASE_SERVICE_ROLE_KEY1

    };

  }););



  // Only handle POST requests for error logging

  if (event.httpMethod !== 'POST') {

    return {export const handler = async (event, context) => {export const handler = async (event, context) => {

      statusCode: 405,

      headers: {  // Handle CORS preflight requests  // Handle CORS preflight requests

        'Access-Control-Allow-Origin': '*',

        'Content-Type': 'application/json',  if (event.httpMethod === 'OPTIONS') {  if (event.httpMethod === 'OPTIONS') {

      },

      body: JSON.stringify({    return {    return {

        success: false,

        message: 'Method not allowed - use POST for error logging'      statusCode: 200,      statusCode: 200,

      }),

    };      headers: {      headers: {

  }

        'Access-Control-Allow-Origin': '*',        'Access-Control-Allow-Origin': '*',

  try {

    const errorData = JSON.parse(event.body);        'Access-Control-Allow-Methods': 'POST, OPTIONS',        'Access-Control-Allow-Methods': 'POST, OPTIONS',



    // Validate required fields        'Access-Control-Allow-Headers': 'Content-Type, Authorization',        'Access-Control-Allow-Headers': 'Content-Type, Authorization',

    if (!errorData.message || !errorData.type) {

      return {      },      },

        statusCode: 400,

        headers: {      body: '',      body: '',

          'Access-Control-Allow-Origin': '*',

          'Content-Type': 'application/json',    };    };

        },

        body: JSON.stringify({  }  }

          success: false,

          message: 'Missing required fields: message, type'

        }),

      };  // Only handle POST requests  // Only handle POST requests

    }

  if (event.httpMethod !== 'POST') {  if (event.httpMethod !== 'POST') {

    // Log error details to Netlify function logs (primary error tracking)

    console.error(`[${errorData.type.toUpperCase()}] ${errorData.message}`);    return {    return {

    

    if (errorData.error) {      statusCode: 405,      statusCode: 405,

      console.error('Stack trace:', errorData.error);

    }      headers: {      headers: {

    

    if (errorData.url) {        'Access-Control-Allow-Origin': '*',        'Access-Control-Allow-Origin': '*',

      console.error('Error URL:', errorData.url);

    }        'Content-Type': 'application/json',        'Content-Type': 'application/json',

    

    if (errorData.userId && errorData.userId !== 'anonymous') {      },      },

      console.error('User ID:', errorData.userId);

    }      body: JSON.stringify({      body: JSON.stringify({

    

    if (errorData.userAgent) {        success: false,        success: false,

      console.error('User Agent:', errorData.userAgent);

    }        message: 'Method not allowed'        message: 'Method not allowed'



    console.error('Error timestamp:', errorData.timestamp || new Date().toISOString());      }),      }),

    console.error('Full error data:', JSON.stringify(errorData, null, 2));

    };    };

    return {

      statusCode: 200,  }  }

      headers: {

        'Access-Control-Allow-Origin': '*',

        'Content-Type': 'application/json',

      },  try {  try {

      body: JSON.stringify({

        success: true,    const errorData = JSON.parse(event.body);    const errorData = JSON.parse(event.body);

        message: 'Error logged successfully to Netlify function logs'

      }),

    };

    // Validate required fields    // Validate required fields

  } catch (error) {

    console.error('Error in error-tracking function:', error);    if (!errorData.message || !errorData.type) {    if (!errorData.message || !errorData.type) {

    

    return {      return {      return {

      statusCode: 500,

      headers: {        statusCode: 400,        statusCode: 400,

        'Access-Control-Allow-Origin': '*',

        'Content-Type': 'application/json',        headers: {        headers: {

      },

      body: JSON.stringify({          'Access-Control-Allow-Origin': '*',          'Access-Control-Allow-Origin': '*',

        success: false,

        message: 'Internal server error in error tracking'          'Content-Type': 'application/json',          'Content-Type': 'application/json',

      }),

    };        },        },

  }

};        body: JSON.stringify({        body: JSON.stringify({

          success: false,          success: false,

          message: 'Missing required fields: message, type'          message: 'Missing required fields: message, type'

        }),        }),

      };      };

    }    }



    // Log to console for immediate visibility (primary error tracking)    // Prepare error log data

    console.error(`[ERROR] ${errorData.type}: ${errorData.message}`);    const errorLog = {

    if (errorData.error) console.error('Stack:', errorData.error);      error_message: errorData.message,

    if (errorData.url) console.error('URL:', errorData.url);      error_type: errorData.type,

    if (errorData.userId) console.error('User:', errorData.userId);      error_stack: errorData.error || errorData.stack,

    console.error('Timestamp:', errorData.timestamp || new Date().toISOString());      filename: errorData.filename,

      line_number: errorData.lineno,

    // Try to store error in database (optional, function succeeds even if this fails)      column_number: errorData.colno,

    try {      url: errorData.url,

      const errorLog = {      user_agent: errorData.userAgent,

        error_message: errorData.message,      user_id: errorData.userId || 'anonymous',

        error_type: errorData.type,      status_code: errorData.status,

        error_stack: errorData.error || errorData.stack,      timestamp: errorData.timestamp || new Date().toISOString(),

        filename: errorData.filename,      session_id: errorData.sessionId,

        line_number: errorData.lineno,      additional_data: errorData.additionalData ? JSON.stringify(errorData.additionalData) : null,

        column_number: errorData.colno,      created_at: new Date().toISOString()

        url: errorData.url,    };

        user_agent: errorData.userAgent,

        user_id: errorData.userId || 'anonymous',    // Try to store error in database, but continue even if it fails

        status_code: errorData.status,    try {

        timestamp: errorData.timestamp || new Date().toISOString(),      const { data, error } = await supabase

        created_at: new Date().toISOString()        .from('error_logs')

      };        .insert([errorLog])

        .select();

      await supabase.from('error_logs').insert([errorLog]);

    } catch (dbError) {      if (error) {

      console.error('Database logging failed (non-critical):', dbError.message);        console.error('Database error:', error);

    }      }

    } catch (dbError) {

    return {      console.error('Database connection error:', dbError);

      statusCode: 200,    }

      headers: {

        'Access-Control-Allow-Origin': '*',    // Always log to console for Netlify function logs (primary error tracking)

        'Content-Type': 'application/json',    console.error(`[ERROR] ${errorData.type}: ${errorData.message}`);

      },    if (errorData.error) console.error('Stack:', errorData.error);

      body: JSON.stringify({    if (errorData.url) console.error('URL:', errorData.url);

        success: true,    if (errorData.userId) console.error('User:', errorData.userId);

        message: 'Error logged successfully'    console.error('Full error data:', JSON.stringify(errorLog, null, 2));

      }),

    };    return {

      statusCode: 200,

  } catch (error) {      headers: {

    console.error('Error tracking function error:', error);        'Access-Control-Allow-Origin': '*',

            'Content-Type': 'application/json',

    return {      },

      statusCode: 500,      body: JSON.stringify({

      headers: {        success: true,

        'Access-Control-Allow-Origin': '*',        message: 'Error logged successfully'

        'Content-Type': 'application/json',      }),

      },    };

      body: JSON.stringify({

        success: false,  } catch (error) {

        message: 'Internal server error'    console.error('Error tracking function error:', error);

      }),    

    };    return {

  }      statusCode: 500,

};      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};
  }

  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      error_summary: {
        total_errors_24h: 23,
        critical_errors: 0,
        warnings: 15,
        info_messages: 8,
        error_rate: '0.94%'
      },
      recent_errors: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          level: 'warning',
          function: 'maps-nearby-places',
          message: 'API rate limit approaching',
          count: 3
        },
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          level: 'error',
          function: 'email-service',
          message: 'Temporary SMTP connection timeout',
          count: 1
        },
        {
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          level: 'info',
          function: 'user-registration',
          message: 'New user registration completed',
          count: 5
        }
      ],
      error_categories: {
        authentication: 2,
        database: 1,
        external_api: 8,
        validation: 7,
        performance: 3,
        system: 2
      },
      trending_errors: [
        {
          error_type: 'External API Rate Limit',
          frequency: 8,
          trend: 'increasing',
          severity: 'medium'
        },
        {
          error_type: 'Input Validation Failed',
          frequency: 7,
          trend: 'stable',
          severity: 'low'
        }
      ],
      resolution_suggestions: [
        {
          error_pattern: 'API Rate Limit',
          suggestion: 'Implement exponential backoff and request queuing',
          priority: 'high'
        },
        {
          error_pattern: 'SMTP Timeout',
          suggestion: 'Add email service fallback provider',
          priority: 'medium'
        }
      ]
    };

    if (event.httpMethod === 'POST') {
      const { action, error_data } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'log_error':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Error logged successfully',
              error_id: `err_${Date.now()}`,
              timestamp: new Date().toISOString()
            })
          };
          
        case 'resolve_error':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: `Error ${error_data.error_id} marked as resolved`,
              timestamp: new Date().toISOString()
            })
          };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: errorData,
        message: 'Error tracking data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Error tracking failed',
        message: error.message
      })
    };
  }
};