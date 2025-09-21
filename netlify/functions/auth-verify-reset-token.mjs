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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token is required' })
      };
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Invalid or expired reset token' 
        })
      };
    }

    if (decoded.type !== 'password_reset') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Invalid token type' 
        })
      };
    }

    // Find user and verify reset token exists and hasn't been used
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, reset_token, reset_token_expires')
      .eq('id', decoded.userId)
      .eq('reset_token', token)
      .single();

    if (userError || !user) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Invalid reset token or already used' 
        })
      };
    }

    // Check if token has expired
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Reset token has expired' 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        message: 'Reset token is valid',
        email: user.email,
        expiresAt: user.reset_token_expires
      })
    };

  } catch (error) {
    console.error('Verify reset token error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        valid: false, 
        error: 'Internal server error' 
      })
    };
  }
};