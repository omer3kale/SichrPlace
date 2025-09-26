import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for error logging
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only handle POST requests for error logging
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed - use POST for error logging'
      })
    };
  }

  try {
    const errorData = JSON.parse(event.body);

    // Validate required fields
    if (!errorData.message || !errorData.type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: message, type'
        })
      };
    }

    // Prepare error log data
    const errorLog = {
      error_message: errorData.message,
      error_type: errorData.type,
      error_stack: errorData.error || errorData.stack,
      filename: errorData.filename,
      line_number: errorData.lineno,
      column_number: errorData.colno,
      url: errorData.url,
      user_agent: errorData.userAgent,
      user_id: errorData.userId || 'anonymous',
      status_code: errorData.status,
      timestamp: errorData.timestamp || new Date().toISOString(),
      session_id: errorData.sessionId,
      additional_data: errorData.additionalData ? JSON.stringify(errorData.additionalData) : null,
      created_at: new Date().toISOString()
    };

    // Try to store error in database, but continue even if it fails
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .insert([errorLog])
        .select();

      if (error) {
        console.error('Database error:', error);
      }
    } catch (dbError) {
      console.error('Database connection error:', dbError);
    }

    // Always log to console for Netlify function logs (primary error tracking)
    console.error(`[ERROR] ${errorData.type}: ${errorData.message}`);
    if (errorData.error) console.error('Stack:', errorData.error);
    if (errorData.url) console.error('URL:', errorData.url);
    if (errorData.userId) console.error('User:', errorData.userId);
    console.error('Full error data:', JSON.stringify(errorLog, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Error logged successfully'
      })
    };

  } catch (error) {
    console.error('Error tracking function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};