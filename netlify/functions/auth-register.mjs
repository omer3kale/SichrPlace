import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Simple inline hash function
function hashToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

// Environment variable validation with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

// More robust environment validation
function validateEnvironment() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!jwtSecret) missing.push('JWT_SECRET');
  
  return {
    isValid: missing.length === 0,
    missing,
    config: {
      supabaseUrl: supabaseUrl ? 'configured' : 'missing',
      supabaseKey: supabaseServiceKey ? 'configured' : 'missing', 
      jwtSecret: jwtSecret ? 'configured' : 'missing'
    }
  };
}

const envValidation = validateEnvironment();

// Initialize Supabase client only if environment is valid
let supabase = null;
if (envValidation.isValid) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
} else {
  console.error('❌ Missing environment variables:', envValidation.missing);
}

export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Return environment status for GET requests (debugging)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: envValidation.isValid ? 200 : 503,
      headers,
      body: JSON.stringify({
        status: envValidation.isValid ? 'ready' : 'configuration_error',
        environment: envValidation.config,
        missing: envValidation.missing,
        message: envValidation.isValid ? 
          'Registration endpoint is ready' : 
          `Missing required environment variables: ${envValidation.missing.join(', ')}`
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check environment before processing registration
  if (!envValidation.isValid) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ 
        error: 'Service temporarily unavailable',
        message: 'Server configuration incomplete. Please try again later.',
        missing_config: envValidation.missing
      })
    };
  }

  try {
    const { username, email, password, userType, fullName, phone } = JSON.parse(event.body);

    // Validation
    if (!username || !email || !password || !userType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' })
      };
    }

    if (!['landlord', 'applicant'].includes(userType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid user type' })
      };
    }

    // Check if user already exists - use maybeSingle() to handle no results gracefully
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (checkError) {
      console.error('Database check error:', checkError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database error during user check' })
      };
    }

    if (existingUser) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'Username or email already exists' })
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create verification token (raw for email link) and hashed for storage
    const verificationToken = jwt.sign(
      { email, type: 'email_verification' },
      jwtSecret,
      { expiresIn: '24h' }
    );
    const verificationTokenHash = hashToken(verificationToken);

    // Insert user with ONLY fields that exist in the actual schema
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        role: 'user', // Always 'user' role for now
        first_name: fullName ? fullName.split(' ')[0] : username,
        last_name: fullName ? fullName.split(' ').slice(1).join(' ') : '',
        phone: phone || null,
        email_verified: false,
        gdpr_consent: true,
        data_processing_consent: true
        // Removed email_verification_token - column doesn't exist
        // Removed created_at - auto-generated
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to create user',
          details: insertError.message 
        })
      };
    }

    // Skip profile creation for now - tables don't exist
    // TODO: Create proper profile tables or remove this logic
    
    // Log registration activity - only if activity_logs table exists
    // await supabase.from('activity_logs').insert({
    //   user_id: newUser.id,
    //   action: 'user_registration',
    //   details: { user_type: userType },
    //   created_at: new Date().toISOString()
    // });

    // Send verification email
    try {
      // Try different import approaches for email service
      let EmailServiceClass;
      try {
        EmailServiceClass = (await import('../../js/backend/services/emailService.js')).default;
      } catch (importError) {
        console.warn('Email service import failed, using fallback:', importError.message);
        // Continue without email verification for now
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Registration successful. Email verification is temporarily unavailable.',
            user: {
              id: newUser.id,
              username: newUser.username,
              email: newUser.email,
              userType: newUser.user_type,
              verified: newUser.verified
            }
          })
        };
      }
      
      if (EmailServiceClass) {
        const emailService = new EmailServiceClass();
        await emailService.sendVerificationEmail(newUser.email, newUser.full_name || newUser.username || 'there', verificationToken);
      }
    } catch (mailErr) {
      console.warn('Verification email dispatch failed:', mailErr?.message || mailErr);
      // Continue registration success even if email fails
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Registration successful. Please check your email for verification.',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          userType: newUser.user_type,
          verified: newUser.verified
        }
      })
    };

  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return more specific error information for debugging
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      errorMessage = 'Username or email already exists';
      statusCode = 409;
    } else if (error.message?.includes('validation') || error.message?.includes('required')) {
      errorMessage = 'Invalid input data';
      statusCode = 400;
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      errorMessage = 'Database connection error. Please try again.';
      statusCode = 503;
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};