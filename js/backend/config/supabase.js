const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase;
let supabasePublic;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase configuration');
  console.log('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  if (process.env.NODE_ENV === 'test' || process.env.PRE_FLIGHT === 'true') {
    // Provide a lightweight mock so the rest of the app can load for preflight checks.
    const mock = () => ({ select: () => ({ then: () => {} }) });
    supabase = { from: () => ({ select: () => ({ limit: () => ({ then: () => {} }) }) }) };
    supabasePublic = supabase;
  } else {
    process.exit(1);
  }
} else {
  // Create Supabase client with service role for backend operations
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Create public client for frontend operations
  supabasePublic = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey);
}

// (Replaced by conditional initialization above)

// Test connection
const testConnection = async () => {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      // In preflight mode treat missing config as soft-fail
      return false;
    }
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') { // table missing is acceptable during early migrations
      throw error;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    return false;
  }
};

module.exports = {
  supabase,
  supabasePublic,
  testConnection
};
