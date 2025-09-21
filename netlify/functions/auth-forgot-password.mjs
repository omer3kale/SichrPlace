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
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, username')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal if email exists or not for security
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'If this email exists in our system, you will receive a password reset link.'
        })
      };
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        type: 'password_reset'
      },
      jwtSecret,
      { expiresIn: '1h' } // Short expiry for security
    );

    // Update user with reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: new Date(Date.now() + 3600000).toISOString() // 1 hour
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Reset token update error:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate reset token' })
      };
    }

    // Log password reset request
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'password_reset_request',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    // In a real application, you would send an email here
    // For now, we'll return the token for testing purposes
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password reset instructions have been sent to your email.',
        resetToken: resetToken, // Remove this in production
        resetUrl: `${process.env.FRONTEND_URL || 'https://sichrplace.netlify.app'}/reset-password?token=${resetToken}`
      })
    };

  } catch (error) {
    console.error('Forgot password error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};