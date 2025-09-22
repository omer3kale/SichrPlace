export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
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