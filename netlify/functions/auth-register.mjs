import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
  console.error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
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

    // Create verification token
    const verificationToken = jwt.sign(
      { email, type: 'email_verification' },
      jwtSecret,
      { expiresIn: '24h' }
    );

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
        verification_token: verificationToken,
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
        },
        verificationToken
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