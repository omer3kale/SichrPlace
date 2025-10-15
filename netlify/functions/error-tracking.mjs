import { createClient } from '@supabase/supabase-js';

// Environment validation
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Initialize Supabase client with hardened configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to build standardized headers
const buildHeaders = (additionalHeaders = {}) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Access-Control-Request-Headers',
  ...additionalHeaders
});

// Helper function to create standardized responses
const respond = (data, additionalHeaders = {}) => ({
  statusCode: 200,
  headers: buildHeaders(additionalHeaders),
  body: JSON.stringify(data)
});

// Helper function to parse request body safely
const parseRequestBody = (body) => {
  if (!body) throw new Error('Request body is required');
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
};

// Helper function to sanitize string inputs
const sanitizeString = (value, maxLength = 2000) => {
  if (typeof value !== 'string') return null;
  return value.trim().substring(0, maxLength) || null;
};

// Helper function to sanitize numeric inputs
const sanitizeNumber = (value) => {
  const num = parseInt(value);
  return isNaN(num) ? null : num;
};

// Helper function to create HTTP errors
const httpError = (statusCode, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Safe database operations
const safeInsert = async (table, data) => {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select();
    return { data: result, error };
  } catch (error) {
    console.error(`Database insert error in ${table}:`, error);
    return { data: null, error };
  }
};

export const handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: buildHeaders(), body: '' };
    }

    if (event.httpMethod !== 'POST') {
      throw httpError(405, 'Method not allowed - use POST for error logging');
    }

    // Parse and validate input
    const errorData = parseRequestBody(event.body);

    // Validate required fields
    if (!errorData.message || !errorData.type) {
      throw httpError(400, 'Missing required fields: message, type');
    }

    // Prepare sanitized error log data
    const errorLog = {
      error_message: sanitizeString(errorData.message, 2000),
      error_type: sanitizeString(errorData.type, 100),
      error_stack: sanitizeString(errorData.error || errorData.stack, 5000),
      filename: sanitizeString(errorData.filename, 500),
      line_number: sanitizeNumber(errorData.lineno),
      column_number: sanitizeNumber(errorData.colno),
      url: sanitizeString(errorData.url, 1000),
      user_agent: sanitizeString(errorData.userAgent, 500),
      user_id: sanitizeString(errorData.userId, 100) || 'anonymous',
      status_code: sanitizeNumber(errorData.status),
      timestamp: errorData.timestamp ? new Date(errorData.timestamp).toISOString() : new Date().toISOString(),
      session_id: sanitizeString(errorData.sessionId, 100),
      additional_data: errorData.additionalData ? JSON.stringify(errorData.additionalData).substring(0, 5000) : null,
      created_at: new Date().toISOString()
    };

    // Try to store error in database, but continue even if it fails
    const { data, error: dbError } = await safeInsert('error_logs', errorLog);
    
    if (dbError) {
      console.error('Database error when logging error:', dbError);
    }

    // Always log to console for Netlify function logs (primary error tracking)
    console.error(`[ERROR] ${errorLog.error_type}: ${errorLog.error_message}`);
    if (errorLog.error_stack) console.error('Stack:', errorLog.error_stack);
    if (errorLog.url) console.error('URL:', errorLog.url);
    if (errorLog.user_id && errorLog.user_id !== 'anonymous') console.error('User:', errorLog.user_id);
    console.error('Full error data:', JSON.stringify(errorLog, null, 2));

    return respond({
      success: true,
      message: 'Error logged successfully'
    });

  } catch (error) {
    console.error('Error tracking function error:', error);
    
    // Handle HTTP errors (from httpError helper)
    if (error.statusCode) {
      return {
        statusCode: error.statusCode,
        headers: buildHeaders(),
        body: JSON.stringify({
          success: false,
          message: error.message,
          ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details })
        })
      };
    }
    
    // Handle unexpected errors
    return {
      statusCode: 500,
      headers: buildHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Error tracking failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};