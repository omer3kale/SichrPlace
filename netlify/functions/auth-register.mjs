import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail } from './utils/email.mjs';

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

// Hash token for secure storage
const hashToken = (token) => {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
};

// Input validation for registration
const validateRegistrationInput = (data) => {
  const errors = [];
  
  if (!data.username) {
    errors.push('Username is required');
  } else if (data.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  } else if (data.username.length > 50) {
    errors.push('Username cannot exceed 50 characters');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }
  
  if (!data.email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }
  
  if (!data.password) {
    errors.push('Password is required');
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  } else if (data.password.length > 128) {
    errors.push('Password cannot exceed 128 characters');
  }
  
  if (!data.userType) {
    errors.push('User type is required');
  } else if (!['landlord', 'applicant', 'tenant'].includes(data.userType)) {
    errors.push('Invalid user type. Must be landlord, applicant, or tenant');
  }
  
  // Optional field validation
  if (data.fullName && data.fullName.length > 100) {
    errors.push('Full name cannot exceed 100 characters');
  }
  
  if (data.phone && !/^\+?[-\d\s()]{8,20}$/.test(data.phone)) {
    errors.push('Invalid phone number format');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      username: data.username?.trim().toLowerCase(),
      email: data.email?.trim().toLowerCase(),
      password: data.password,
      userType: data.userType,
      fullName: data.fullName?.trim() || '',
      phone: data.phone?.trim() || null,
    }
  };
};

// Field mapping for frontend compatibility
const mapUserToFrontend = (user) => {
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    user_type: user.user_type,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    status: user.status,
    email_verified: user.email_verified,
    verified: user.verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
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

    const validation = validateRegistrationInput(requestData);
    if (!validation.valid) {
      throw httpError(400, 'Validation failed', { errors: validation.errors });
    }

    const { username, email, password, userType, fullName, phone } = validation.sanitized;

    // Check if user already exists (username or email)
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw httpError(500, 'Database error during user check', checkError);
    }

    if (existingUser) {
      const conflictField = existingUser.username === username ? 'Username' : 'Email';
      throw httpError(409, `${conflictField} already exists`);
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create email verification token
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
    const verificationToken = jwt.sign(
      { email, type: 'email_verification' },
      jwtSecret,
      { expiresIn: '24h' }
    );
    const verificationTokenHash = hashToken(verificationToken);

    // Parse full name into first and last name
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || username;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user record
    const userData = {
      username,
      email,
      password: hashedPassword,
      role: userType === 'landlord' ? 'landlord' : 'applicant',
      user_type: userType,
      
      // Personal information
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      
      // Account status
      status: 'active',
      email_verified: false,
      verified: false,
      verification_token_hash: verificationTokenHash,
      
      // GDPR compliance
      gdpr_consent: true,
      data_processing_consent: true,
      
      // Timestamps (created_at is auto-generated)
      updated_at: new Date().toISOString()
    };

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        throw httpError(409, 'Username or email already exists');
      }
      throw httpError(500, 'Failed to create user account', insertError);
    }

    let emailSent = false;
    try {
      const emailResult = await sendVerificationEmail({
        to: email,
        firstName,
        verificationToken
      });
      emailSent = Boolean(emailResult?.success);
    } catch (emailError) {
      console.warn('Failed to send verification email:', emailError.message);
      // Continue registration even if email fails
    }

    // Generate a welcome token for immediate use (optional)
    const welcomeToken = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        username: newUser.username,
        emailVerified: false
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return respond(201, {
      success: true,
      message: emailSent 
        ? 'Registration successful. Please check your email for verification.'
        : 'Registration successful. Email verification is pending.',
      user: mapUserToFrontend(newUser),
      token: welcomeToken, // Allow immediate limited access
      data: {
        redirectUrl: userType === 'landlord' ? '/landlord-dashboard' : '/dashboard',
        emailVerificationRequired: true,
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      }
    });

  } catch (error) {
    if (error.status) {
      return respond(error.status, error);
    }
    
    console.error('Registration error:', error);
    return respond(500, {
      error: { 
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { details: error.message })
      }
    });
  }
};