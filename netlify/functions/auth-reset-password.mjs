import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hashToken } from '../../utils/tokenHash.js';
import { mapUserToFrontend } from './utils/field-mapper.mjs';

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

// Helper function to sanitize string inputs
const sanitizeString = (value, maxLength = 200) => {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
};

// Helper function to validate password strength
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' };
  }
  return { valid: true };
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
    const result = await supabase.from(table).select(query.select).eq(query.column, query.value).eq(query.column2, query.value2).single();
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
    const { token, newPassword } = parseRequestBody(event.body);

    if (!token || !newPassword) {
      throw httpError(400, 'Token and new password are required');
    }

    const sanitizedToken = sanitizeString(token, 1000);
    if (!sanitizedToken) {
      throw httpError(400, 'Valid reset token is required');
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw httpError(400, passwordValidation.message);
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(sanitizedToken, jwtSecret);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      throw httpError(400, 'Invalid or expired reset token');
    }

    if (decoded.type !== 'password_reset') {
      throw httpError(400, 'Invalid token type');
    }

    // Find user and verify reset token using safe database operation
    const { data: user, error: userError } = await safeSelect('users', {
      select: '*',
      column: 'id',
      value: decoded.userId,
      column2: 'reset_token_hash',
      value2: hashToken(sanitizedToken)
    });

    if (userError || !user) {
      throw httpError(400, 'Invalid reset token or user not found');
    }

    // Check if token has expired
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      throw httpError(400, 'Reset token has expired');
    }

    // Hash new password with enhanced security
    const hashedPassword = await bcrypt.hash(newPassword, 14); // Increased from 12 to 14 for better security

    // Update user password and clear reset token using safe database operation
    const { error: updateError } = await safeUpdate('users', {
      password: hashedPassword,
      reset_token_hash: null,
      reset_token_expires: null,
      password_updated_at: new Date().toISOString()
    }, {
      column: 'id',
      value: user.id
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      throw httpError(500, 'Failed to update password');
    }

    // Log password reset completion with safe database operation
    await safeInsert('activity_logs', {
      user_id: user.id,
      action: 'password_reset_complete',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // Generate new login token with enhanced security
    const loginToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        verified: user.verified,
        iat: Math.floor(Date.now() / 1000) // Issued at timestamp
      },
      jwtSecret,
      { 
        expiresIn: '7d',
        issuer: 'sichrplace-auth',
        subject: user.id.toString()
      }
    );

    return respond({
      success: true,
      message: 'Password has been reset successfully',
      user: mapUserToFrontend(user),
      token: loginToken
    });

  } catch (error) {
    console.error('Reset password error:', error);
    
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
        message: 'Password reset failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};