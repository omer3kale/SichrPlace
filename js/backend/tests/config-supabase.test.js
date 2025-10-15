jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('../config/supabase');

const originalEnv = { ...process.env };

const mockSelectChain = (resolveValue) => ({
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue(resolveValue)
    })
  })
});

describe('config/supabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    supabaseConfig.initializeSupabase(process.env, () => {});
    jest.restoreAllMocks();
  });

  test('provides mock supabase when configuration is missing in test environment', () => {
    const exitSpy = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = supabaseConfig.initializeSupabase({ NODE_ENV: 'test' }, exitSpy);

    expect(result.usedMock).toBe(true);
    expect(typeof result.supabase?.from).toBe('function');
    const selectChain = result.supabase.from('test-table').select();
    expect(typeof selectChain.limit).toBe('function');
    const limitResult = selectChain.limit(1);
    expect(typeof limitResult.then).toBe('function');
    limitResult.then(() => {});
    expect(result.supabase).toBe(result.supabasePublic);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('❌ Missing Supabase configuration');
    expect(logSpy).toHaveBeenCalledWith('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('buildMockClient exposes minimal query builder chain', () => {
    const mockClient = supabaseConfig.__internal.buildMockClient();

    const fromResult = mockClient.from('example');
    expect(typeof fromResult.select).toBe('function');

    const selectResult = fromResult.select('id');
    expect(typeof selectResult.limit).toBe('function');

    const limitResult = selectResult.limit(1);
    expect(typeof limitResult.then).toBe('function');
    limitResult.then(() => {});
  });

  test('provides mock supabase when PRE_FLIGHT flag is true outside tests', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.fn();

    const result = supabaseConfig.initializeSupabase({ NODE_ENV: 'production', PRE_FLIGHT: 'true' }, exitSpy);

    expect(result.usedMock).toBe(true);
    expect(result.supabase).toBeDefined();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('handleMissingConfig resets cached clients when not in test mode', () => {
    const env = { NODE_ENV: 'production' };
    const exitSpy = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    createClient.mockImplementation(() => mockSelectChain(Promise.resolve({ error: null })));
    supabaseConfig.initializeSupabase({
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_ANON_KEY: 'anon-key'
    }, jest.fn());

    expect(supabaseConfig.supabase).toBeDefined();
    expect(supabaseConfig.supabasePublic).toBeDefined();

    const result = supabaseConfig.__internal.handleMissingConfig(env, exitSpy);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(result).toEqual({ supabase: undefined, supabasePublic: undefined, usedMock: false, exited: true });
    expect(supabaseConfig.supabase).toBeUndefined();
    expect(supabaseConfig.supabasePublic).toBeUndefined();

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('exits process when configuration missing outside test environment', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.fn();

    const result = supabaseConfig.initializeSupabase({ NODE_ENV: 'development' }, exitSpy);

    expect(errorSpy).toHaveBeenCalledWith('❌ Missing Supabase configuration');
    expect(logSpy).toHaveBeenCalledWith('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ exited: true, usedMock: false, supabase: undefined, supabasePublic: undefined });

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('initializes supabase clients with provided configuration', () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_ANON_KEY: 'anon-key'
    };

    createClient.mockImplementation(() => mockSelectChain(Promise.resolve({ error: null })));

    const result = supabaseConfig.initializeSupabase(env, jest.fn());

    expect(result.usedMock).toBe(false);
    expect(createClient).toHaveBeenNthCalledWith(1, 'https://example.supabase.co', 'service-role-key', expect.objectContaining({ auth: expect.any(Object) }));
    expect(createClient).toHaveBeenNthCalledWith(2, 'https://example.supabase.co', 'anon-key');
    expect(supabaseConfig.supabase).toBeDefined();
    expect(supabaseConfig.supabasePublic).toBeDefined();
  });

  test('creates supabase public client with fallback key when anon key missing', () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    };

    delete env.SUPABASE_ANON_KEY;

    createClient.mockImplementation(() => mockSelectChain(Promise.resolve({ error: null })));

    supabaseConfig.initializeSupabase(env, jest.fn());

    expect(createClient).toHaveBeenNthCalledWith(2, 'https://example.supabase.co', 'service-role-key');
  });

  test('testConnection returns true when Supabase responds successfully', async () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_ANON_KEY: 'anon'
    };

    const client = mockSelectChain(Promise.resolve({ error: null }));
    createClient.mockReturnValue(client);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    supabaseConfig.initializeSupabase(env, jest.fn());

    await expect(supabaseConfig.testConnection()).resolves.toBe(true);
    expect(logSpy).toHaveBeenCalledWith('✅ Supabase connection successful');

    logSpy.mockRestore();
  });

  test('testConnection treats missing table (PGRST116) as success', async () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    };

    const client = mockSelectChain(Promise.resolve({ error: { code: 'PGRST116' } }));
    createClient.mockReturnValue(client);

    supabaseConfig.initializeSupabase(env, jest.fn());

    await expect(supabaseConfig.testConnection()).resolves.toBe(true);
  });

  test('testConnection returns false when Supabase responds with an error', async () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    };

    const client = mockSelectChain(Promise.resolve({ error: { code: 'OTHER', message: 'failed' } }));
    createClient.mockReturnValue(client);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    supabaseConfig.initializeSupabase(env, jest.fn());

    await expect(supabaseConfig.testConnection()).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('❌ Supabase connection failed:', 'failed');

    errorSpy.mockRestore();
  });

  test('testConnection returns false immediately when configuration missing', async () => {
    supabaseConfig.initializeSupabase({ NODE_ENV: 'test' }, jest.fn());

    await expect(supabaseConfig.testConnection()).resolves.toBe(false);
  });

  test('logs error when testConnection encounters unexpected failure during initialization', async () => {
    const env = {
      ...originalEnv,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    };

    const client = mockSelectChain(Promise.resolve({ error: { code: 'OTHER', message: 'boom' } }));
    createClient.mockReturnValue(client);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    supabaseConfig.initializeSupabase(env, jest.fn());

    await expect(supabaseConfig.testConnection()).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('❌ Supabase connection failed:', 'boom');

    errorSpy.mockRestore();
  });
});
