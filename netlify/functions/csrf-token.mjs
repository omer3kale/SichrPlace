import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables for csrf-token function');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

export const handler = async (event, context) => {
  console.log('CSRF token handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  if (event.httpMethod !== 'GET') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    // Generate a secure random CSRF token
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    // Store the token in session/cache (for now, we'll return it directly)
    // In production, you might want to store this in Redis or a session store
    
    return respond({
      success: true,
      data: {
        csrfToken,
        expiresIn: 3600, // 1 hour
        expiresAt: expiresAt.toISOString()
      }
    }, {
      'Set-Cookie': `csrf-token=${csrfToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
    });

  } catch (error) {
    console.error('CSRF token generation error:', error);
    throw httpError(500, 'Failed to generate CSRF token', { 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};