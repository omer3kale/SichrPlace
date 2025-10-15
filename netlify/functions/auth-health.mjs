import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
    environment: process.env.NODE_ENV || 'production'
  };

  // Check 1: Supabase URL Configuration
  if (!supabaseUrl) {
    health.checks.supabaseUrl = { 
      status: 'error', 
      message: 'SUPABASE_URL not configured' 
    };
    health.status = 'degraded';
  } else {
    health.checks.supabaseUrl = { 
      status: 'ok',
      configured: true
    };
  }

  // Check 2: Supabase Service Role Key
  if (!supabaseServiceKey) {
    health.checks.supabaseKey = { 
      status: 'error', 
      message: 'SUPABASE_SERVICE_ROLE_KEY not configured' 
    };
    health.status = 'degraded';
  } else {
    health.checks.supabaseKey = { 
      status: 'ok',
      configured: true
    };
  }

  // Check 3: JWT Secret
  if (!jwtSecret) {
    health.checks.jwt = { 
      status: 'error', 
      message: 'JWT_SECRET not configured' 
    };
    health.status = 'degraded';
  } else if (jwtSecret === 'default-secret') {
    health.checks.jwt = { 
      status: 'error', 
      message: 'JWT_SECRET using insecure default value' 
    };
    health.status = 'degraded';
  } else if (jwtSecret.length < 32) {
    health.checks.jwt = { 
      status: 'warning', 
      message: 'JWT_SECRET is too short (recommend 64+ characters)' 
    };
    health.status = 'degraded';
  } else {
    health.checks.jwt = { 
      status: 'ok',
      length: jwtSecret.length
    };
  }

  // Check 4: Supabase Database Connection
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const startDb = Date.now();
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      const dbTime = Date.now() - startDb;
      
      if (error) {
        health.checks.database = { 
          status: 'error', 
          message: error.message,
          responseTime: `${dbTime}ms`
        };
        health.status = 'degraded';
      } else {
        health.checks.database = { 
          status: 'ok',
          responseTime: `${dbTime}ms`
        };
      }
    } catch (err) {
      health.checks.database = { 
        status: 'error', 
        message: err.message 
      };
      health.status = 'degraded';
    }
  }

  // Overall health summary
  health.summary = {
    critical: Object.values(health.checks).filter(c => c.status === 'error').length,
    warnings: Object.values(health.checks).filter(c => c.status === 'warning').length,
    healthy: Object.values(health.checks).filter(c => c.status === 'ok').length
  };

  const statusCode = health.status === 'ok' ? 200 : 503;

  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(health, null, 2),
  };
};
