const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase;
let supabasePublic;

const buildMockClient = () => {
  const thenFn = () => {};

  const limitFn = () => ({ then: thenFn });

  const selectFn = () => ({ limit: limitFn });

  const fromFn = () => ({ select: selectFn });

  return { from: fromFn };
};

const handleMissingConfig = (env, exitFn) => {
  console.error('❌ Missing Supabase configuration');
  console.log('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');

  if (env.NODE_ENV === 'test' || env.PRE_FLIGHT === 'true') {
    const mockClient = buildMockClient();
    supabase = mockClient;
    supabasePublic = mockClient;
    return { supabase, supabasePublic, usedMock: true, exited: false };
  }

  exitFn(1);
  supabase = undefined;
  supabasePublic = undefined;
  return { supabase, supabasePublic, usedMock: false, exited: true };
};

const initializeSupabase = (env = process.env, exitFn = process.exit) => {
  supabaseUrl = env.SUPABASE_URL;
  supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return handleMissingConfig(env, exitFn);
  }

  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  supabasePublic = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey);
  return { supabase, supabasePublic, usedMock: false, exited: false };
};

initializeSupabase();

const testConnection = async () => {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey || !supabase) {
      return false;
    }

    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
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
  initializeSupabase,
  testConnection,
  get supabase() {
    return supabase;
  },
  get supabasePublic() {
    return supabasePublic;
  },
  __internal: {
    buildMockClient,
    handleMissingConfig
  }
};
