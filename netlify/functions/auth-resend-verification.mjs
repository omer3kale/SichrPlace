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

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    if (user.verified) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Account is already verified' })
      };
    }

    // Generate new verification token
    const verificationToken = jwt.sign(
      { email: user.email, type: 'email_verification' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Update user with new verification token
    const { error: updateError } = await supabase
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_resent_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Resend verification update error:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to resend verification' })
      };
    }

    // Log resend verification activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'verification_resent',
      details: { email: user.email },
      created_at: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Verification email has been resent to your email address.',
        verificationToken: verificationToken, // Remove this in production
        verificationUrl: `${process.env.FRONTEND_URL || 'https://sichrplace.netlify.app'}/verify-email?token=${verificationToken}`
      })
    };

  } catch (error) {
    console.error('Resend verification error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};