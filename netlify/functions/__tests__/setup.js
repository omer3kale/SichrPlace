// Netlify Functions Test Setup
require('dotenv/config');

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.SLACK_ERROR_WEBHOOK = process.env.SLACK_ERROR_WEBHOOK || 'https://hooks.slack.com/test/webhook';
process.env.UPTIMEROBOT_API_KEY = process.env.UPTIMEROBOT_API_KEY || 'test-uptimerobot-key';

// Global test timeout
jest.setTimeout(15000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// Global mocks for Netlify context
global.mockNetlifyContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1.0.0',
  invokedFunctionArn: 'arn:aws:lambda:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id'
};

global.mockNetlifyEvent = {
  httpMethod: 'GET',
  path: '/test',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Test Agent'
  },
  queryStringParameters: {},
  body: null,
  isBase64Encoded: false
};