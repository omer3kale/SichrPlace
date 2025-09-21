import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
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
    // Generate a secure random CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    // Store the token in session/cache (for now, we'll return it directly)
    // In production, you might want to store this in Redis or a session store
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Set-Cookie': `csrf-token=${csrfToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
      },
      body: JSON.stringify({
        success: true,
        csrfToken,
        expiresIn: 3600 // 1 hour
      })
    };

  } catch (error) {
    console.error('CSRF token generation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};