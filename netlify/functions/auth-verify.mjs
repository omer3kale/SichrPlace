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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
};

// Helper function to sanitize string inputs
const sanitizeString = (value, maxLength = 1000) => {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
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

    // Allow both GET and POST for verification links
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
      throw httpError(405, 'Method not allowed');
    }

    // Extract token from body or query parameters
    const bodyData = parseRequestBody(event.body);
    const verificationToken = bodyData.token || event.queryStringParameters?.token;

    if (!verificationToken) {
      throw httpError(400, 'Verification token required');
    }

    const sanitizedToken = sanitizeString(verificationToken, 1000);
    if (!sanitizedToken) {
      throw httpError(400, 'Valid verification token is required');
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(sanitizedToken, jwtSecret);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      throw httpError(400, 'Invalid or expired verification token');
    }

    if (decoded.type !== 'email_verification') {
      throw httpError(400, 'Invalid token type');
    }

    // Find user by email and verification token using safe database operation
    const { data: user, error: userError } = await safeSelect('users', {
      select: '*',
      column: 'email',
      value: decoded.email,
      column2: 'verification_token_hash',
      value2: hashToken(sanitizedToken)
    });

    if (userError || !user) {
      throw httpError(404, 'User not found or token already used');
    }

    if (user.verified) {
      throw httpError(400, 'Account already verified');
    }

    // Update user as verified and clear verification token using safe database operation
    const { error: updateError } = await safeUpdate('users', {
      verified: true,
      verification_token_hash: null,
      verified_at: new Date().toISOString()
    }, {
      column: 'id',
      value: user.id
    });

    if (updateError) {
      console.error('Verification update error:', updateError);
      throw httpError(500, 'Failed to verify account');
    }

    // Log verification activity with safe database operation
    await safeInsert('activity_logs', {
      user_id: user.id,
      action: 'email_verification',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // Generate login token for immediate access with enhanced security
    const loginToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        verified: true,
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
      message: 'Email verification successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,
        verified: true
      },
      token: loginToken
    });

  } catch (error) {
    console.error('Email verification error:', error);
    
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
        message: 'Email verification failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};