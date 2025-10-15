import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { hashToken } from '../../utils/tokenHash.js';

// Environment validation
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET');
}

// Initialize Supabase client with hardened configuration
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

// Helper function to sanitize email input
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().substring(0, 254);
};

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Helper function to create HTTP errors
const httpError = (statusCode, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Safe database operations
const safeSelect = async (table, query) => {
  try {
    const result = await supabase.from(table).select(query.select).eq(query.column, query.value).single();
    return result;
  } catch (error) {
    console.error(`Database select error in ${table}:`, error);
    return { data: null, error };
  }
};

const safeUpdate = async (table, data, whereClause) => {
  try {
    const result = await supabase.from(table).update(data).eq(whereClause.column, whereClause.value);
    return result;
  } catch (error) {
    console.error(`Database update error in ${table}:`, error);
    return { data: null, error };
  }
};

const safeInsert = async (table, data) => {
  try {
    const result = await supabase.from(table).insert(data);
    return result;
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
      throw httpError(405, 'Method not allowed');
    }

    // Parse and validate input
    const { email } = parseRequestBody(event.body);

    if (!email) {
      throw httpError(400, 'Email is required');
    }

    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
      throw httpError(400, 'Invalid email format');
    }

    // Find user by email using safe database operation
    const { data: user, error: userError } = await safeSelect('users', {
      select: 'id, email, username, first_name, last_name',
      column: 'email',
      value: sanitizedEmail
    });

    if (userError || !user) {
      // Don't reveal if email exists or not for security
      return respond({
        success: true,
        message: 'If this email exists in our system, you will receive a password reset link.'
      });
    }

    // Generate reset token (raw) and hash for storage
    const resetToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        type: 'password_reset'
      },
      jwtSecret,
      { expiresIn: '1h' } // Short expiry for security
    );

    const resetTokenHash = hashToken(resetToken);

    // Update user with reset token hash using safe database operation
    const { error: updateError } = await safeUpdate('users', {
      reset_token_hash: resetTokenHash,
      reset_token_expires: new Date(Date.now() + 3600000).toISOString() // 1 hour
    }, {
      column: 'id',
      value: user.id
    });

    if (updateError) {
      console.error('Reset token update error:', updateError);
      throw httpError(500, 'Failed to generate reset token');
    }

    // Log password reset request with safe database operation
    await safeInsert('activity_logs', {
      user_id: user.id,
      action: 'password_reset_request',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // Send password reset email with the raw token embedded in link
    try {
      // Lazy import to avoid heavy dependency on cold start if not configured
      const { default: EmailServiceClass } = await import('../../js/backend/services/emailService.js');
      const emailService = new EmailServiceClass();
      await emailService.sendPasswordResetEmail(user.email, user.username || user.first_name || 'there', resetToken);
    } catch (mailErr) {
      console.warn('Email dispatch skipped or failed:', mailErr?.message || mailErr);
    }

    return respond({
      success: true,
      message: 'Password reset instructions have been sent to your email.'
      // resetToken: resetToken, // REMOVED FOR SECURITY - Never expose tokens in production
      // resetUrl: resetUrl      // REMOVED FOR SECURITY - Send via email only
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    
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
        message: 'Password reset request failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};