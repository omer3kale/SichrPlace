import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { hashToken } from '../../utils/tokenHash.js';

// Environment variable validation with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY1 || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY1 || process.env.SUPABASE_ANON_KEY;
const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

// More robust environment validation
function validateEnvironment() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY1 or SUPABASE_SERVICE_ROLE_KEY');
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

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

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

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        user_type: userType,
        full_name: fullName || username,
        phone: phone || null,
        verified: false,
        verification_token_hash: verificationTokenHash,
        email_verification_expires: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create user' })
      };
    }

    // Create profile entry based on user type
    if (userType === 'landlord') {
      await supabase.from('landlord_profiles').insert({
        user_id: newUser.id,
        created_at: new Date().toISOString()
      });
    } else {
      await supabase.from('applicant_profiles').insert({
        user_id: newUser.id,
        created_at: new Date().toISOString()
      });
    }

    // Log registration activity
    await supabase.from('activity_logs').insert({
      user_id: newUser.id,
      action: 'user_registration',
      details: { user_type: userType },
      created_at: new Date().toISOString()
    });

    // Send verification email
    try {
      const { default: EmailServiceClass } = await import('../../js/backend/services/emailService.js');
      const emailService = new EmailServiceClass();
      await emailService.sendVerificationEmail(newUser.email, newUser.full_name || newUser.username || 'there', verificationToken);
    } catch (mailErr) {
      console.warn('Verification email dispatch skipped or failed:', mailErr?.message || mailErr);
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};