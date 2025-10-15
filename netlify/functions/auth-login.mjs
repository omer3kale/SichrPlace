import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Supabase configuration with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper functions
const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, body) => ({
  statusCode,
  headers: buildHeaders(),
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const httpError = (status, message, details = null) => {
  const error = { error: { message, status } };
  if (details && process.env.NODE_ENV !== 'production') {
    error.error.details = details;
  }
  return { status, ...error };
};

// Input validation for login
const validateLoginInput = (data) => {
  const errors = [];
  
  if (!data.email && !data.emailOrUsername) {
    errors.push('Email or username is required');
  }
  
  if (!data.password) {
    errors.push('Password is required');
  }
  
  if (data.password && data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  // Sanitize email/username
  const emailOrUsername = data.email || data.emailOrUsername;
  const email = emailOrUsername?.toLowerCase().trim();
  
  if (email && !email.includes('@') && email.length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  
  if (email && email.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      email,
      password: data.password,
      remember: !!data.remember
    }
  };
};

// Rate limiting (simplified in-memory approach)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (identifier) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || [];
  
  // Clean old attempts
  const recentAttempts = attempts.filter(time => now - time < LOCKOUT_TIME);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return { allowed: false, remainingTime: LOCKOUT_TIME - (now - recentAttempts[0]) };
  }
  
  return { allowed: true };
};

const recordFailedAttempt = (identifier) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || [];
  attempts.push(now);
  loginAttempts.set(identifier, attempts);
};

const clearFailedAttempts = (identifier) => {
  loginAttempts.delete(identifier);
};

// Field mapping for frontend compatibility
const mapUserToFrontend = (user) => {
  if (!user) return null;
  
  // Return role exactly as stored in database (supports both 'role' and 'user_type' columns)
  const userRole = user.role || user.user_type || 'applicant';
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: userRole, // Database values: 'applicant', 'landlord', 'admin', 'customer_manager', 'tenant'
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    status: user.status,
    email_verified: user.email_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login: user.last_login,
  };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, {
      error: { message: 'Method not allowed' }
    });
  }

  try {
    // Parse and validate input
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      throw httpError(400, 'Invalid JSON format');
    }

    const validation = validateLoginInput(requestData);
    if (!validation.valid) {
      throw httpError(400, 'Validation failed', { errors: validation.errors });
    }

    const { email, password, remember } = validation.sanitized;
    
    // Simple rate limiting based on email/IP
    const identifier = email || event.headers['x-forwarded-for'] || 'unknown';
    const rateLimitCheck = checkRateLimit(identifier);
    
    if (!rateLimitCheck.allowed) {
      throw httpError(429, 'Too many login attempts. Please try again later.', {
        retryAfter: Math.ceil(rateLimitCheck.remainingTime / 1000)
      });
    }

    // Find user by email or username
    let user = null;
    let userError = null;

    if (email.includes('@')) {
      // Search by email
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      user = data;
      userError = error;
    } else {
      // Search by username
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', email)
        .single();
      user = data;
      userError = error;
    }

    if (userError || !user) {
      recordFailedAttempt(identifier);
      throw httpError(401, 'Invalid credentials');
    }

    // Verify password (support both legacy and current column names)
    const passwordHash = user.password_hash || user.password;
    const isValidPassword = passwordHash ? await bcrypt.compare(password, passwordHash) : false;
    
    if (!isValidPassword) {
      recordFailedAttempt(identifier);
      throw httpError(401, 'Invalid credentials');
    }

    // Check if user account is active
    if (user.status && user.status !== 'active') {
      throw httpError(403, 'Account is not active. Please contact support.');
    }

    // Check for blocked/suspended accounts
    if (user.is_blocked || ['suspended', 'deleted'].includes(user.account_status)) {
      throw httpError(403, 'Account is suspended or blocked');
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(identifier);

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'applicant',
      username: user.username,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
      { expiresIn: remember ? '30d' : '24h' }
    );

    // Update last login timestamp
    try {
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    } catch (updateError) {
      // Non-critical error, continue with login
      console.warn('Failed to update last login:', updateError);
    }

    // Return success response
    return respond(200, {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        ...mapUserToFrontend(user),
        lastLogin: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.status) {
      return respond(error.status, error);
    }
    
    console.error('Login error:', error);
    return respond(500, {
      error: { 
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { details: error.message })
      }
    });
  }
};