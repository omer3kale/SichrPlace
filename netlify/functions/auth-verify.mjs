import { createClient } from '@supabase/supabase-js';
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
    const { token } = JSON.parse(event.body || '{}');
    
    // Try to get token from query params if not in body
    const verificationToken = token || event.queryStringParameters?.token;

    if (!verificationToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Verification token required' })
      };
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(verificationToken, jwtSecret);
    } catch (jwtError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired verification token' })
      };
    }

    if (decoded.type !== 'email_verification') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid token type' })
      };
    }

    // Find user by email and verification token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', decoded.email)
      .eq('verification_token', verificationToken)
      .single();

    if (userError || !user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found or token already used' })
      };
    }

    if (user.verified) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Account already verified' })
      };
    }

    // Update user as verified and clear verification token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        verified: true,
        verification_token: null,
        verified_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Verification update error:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to verify account' })
      };
    }

    // Log verification activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'email_verification',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // Generate login token for immediate access
    const loginToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        verified: true
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
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
      })
    };

  } catch (error) {
    console.error('Email verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};