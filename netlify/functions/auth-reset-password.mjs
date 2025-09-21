import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    const { token, newPassword } = JSON.parse(event.body);

    if (!token || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token and new password are required' })
      };
    }

    if (newPassword.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' })
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
        body: JSON.stringify({ error: 'Invalid or expired reset token' })
      };
    }

    if (decoded.type !== 'password_reset') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid token type' })
      };
    }

    // Find user and verify reset token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('reset_token', token)
      .single();

    if (userError || !user) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid reset token or user not found' })
      };
    }

    // Check if token has expired
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Reset token has expired' })
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and clear reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        password_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Password update error:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update password' })
      };
    }

    // Log password reset completion
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'password_reset_complete',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // Generate new login token
    const loginToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        verified: user.verified
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password has been reset successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.user_type,
          verified: user.verified
        },
        token: loginToken
      })
    };

  } catch (error) {
    console.error('Reset password error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};