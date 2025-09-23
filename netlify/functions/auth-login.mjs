import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { SecretManager } from '../../utils/secretManager.js';
import { logger } from '../../utils/secureLogger.js';
import { checkRateLimit, recordAuthFailure, clearAuthFailures } from '../../utils/rateLimiter.js';
import { validateAuth } from '../../utils/inputValidator.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  // Generate correlation ID for tracking
  const correlationId = logger.generateCorrelationId();
  
  // Check rate limiting first
  const rateLimitResult = checkRateLimit(event, 'auth');
  if (rateLimitResult.statusCode === 429) {
    logger.security('Rate limit exceeded for login attempt', {
      ip: event.headers['x-forwarded-for'] || 'unknown',
      userAgent: event.headers['user-agent'] || 'unknown'
    }, correlationId);
    return rateLimitResult;
  }
  
  // Get security headers
  const securityHeaders = SecretManager.createSecurityHeaders();
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...securityHeaders,
        ...rateLimitResult.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    logger.security('Invalid HTTP method for login', {
      method: event.httpMethod,
      ip: event.headers['x-forwarded-for'] || 'unknown'
    }, correlationId);
    
    return {
      statusCode: 405,
      headers: {
        ...securityHeaders,
        ...rateLimitResult.headers,
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
    };
  }

  try {
    // Parse and validate input
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      logger.security('Invalid JSON in login request', {
        error: parseError.message,
        ip: event.headers['x-forwarded-for'] || 'unknown'
      }, correlationId);
      
      return {
        statusCode: 400,
        headers: {
          ...securityHeaders,
          ...rateLimitResult.headers,
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid request format'
        }),
      };
    }

    // Validate input with comprehensive security checks
    const validation = validateAuth(requestData);
    if (!validation.valid) {
      logger.security('Invalid input in login request', {
        errors: validation.errors,
        ip: event.headers['x-forwarded-for'] || 'unknown'
      }, correlationId);
      
      return {
        statusCode: 400,
        headers: {
          ...securityHeaders,
          ...rateLimitResult.headers,
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid input data',
          errors: validation.errors
        }),
      };
    }

    const { email, password, remember } = validation.sanitized;

    // Find user in database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      // Record failed attempt for rate limiting
      const isBlocked = recordAuthFailure(event, email);
      
      logger.security('Login attempt with non-existent email', {
        email: email,
        ip: event.headers['x-forwarded-for'] || 'unknown',
        userAgent: event.headers['user-agent'] || 'unknown',
        blocked: isBlocked
      }, correlationId);
      
      return {
        statusCode: 401,
        headers: {
          ...securityHeaders,
          ...rateLimitResult.headers,
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid email or password'
        }),
      };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      // Record failed attempt for rate limiting
      const isBlocked = recordAuthFailure(event, email);
      
      logger.security('Login attempt with invalid password', {
        email: email,
        userId: user.user_id,
        ip: event.headers['x-forwarded-for'] || 'unknown',
        userAgent: event.headers['user-agent'] || 'unknown',
        blocked: isBlocked
      }, correlationId);
      
      return {
        statusCode: 401,
        headers: {
          ...securityHeaders,
          ...rateLimitResult.headers,
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid email or password'
        }),
      };
    }

    // Check if user is active
    if (user.status !== 'active') {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Account is not active. Please contact support.'
        }),
      };
    }

    // Clear any previous failed attempts on successful login
    clearAuthFailures(event, email);
    
    // Log successful authentication
    logger.audit('User login successful', user.user_id, 'authentication', {
      email: email,
      remember: remember,
      ip: event.headers['x-forwarded-for'] || 'unknown',
      userAgent: event.headers['user-agent'] || 'unknown'
    }, correlationId);

    // Generate secure JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role || 'tenant',
        fullName: user.full_name
      },
      process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
      { 
        expiresIn: remember ? '30d' : '24h' 
      }
    );

    // Update last login
    await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.user_id);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        ...securityHeaders,
        ...rateLimitResult.headers,
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role || 'tenant',
          phone: user.phone,
          profilePicture: user.profile_picture,
          lastLogin: new Date().toISOString()
        }
      }),
    };

  } catch (error) {
    console.error('Login error:', error);
    // Secure error logging
    const errorId = logger.error('Login function error', {
      error: error.message,
      stack: error.stack,
      ip: event.headers['x-forwarded-for'] || 'unknown'
    }, correlationId);
    
    return {
      statusCode: 500,
      headers: {
        ...securityHeaders,
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        errorId: errorId, // For support purposes
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};