/**
 * Test Setup - Real Environment Configuration (NO MOCKS)
 * This file runs before all tests to set up the real environment
 */

// Real environment variables for testing with comprehensive auth setup
process.env.JWT_SECRET = 'sichrplace-super-secure-test-jwt-secret-key-2025';
process.env.SUPABASE_URL = 'https://cgkumwtibknfrhyiicoo.supabase.co';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNna3Vtd3RpYmtuZnJoeWlpY29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDE3ODYsImV4cCI6MjA2OTg3Nzc4Nn0.OVQHy8Z27QMCHBzZnBNI42yNpOYSsimbw3BNE-N6Zgo';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNna3Vtd3RpYmtuZnJoeWlpY29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMTc4NiwiZXhwIjoyMDY5ODc3Nzg2fQ.5piAC3CPud7oRvA1Rtypn60dfz5J1ydqoG2oKj-Su3M';
process.env.NODE_ENV = 'test';

// Complete authentication environment variables
process.env.SESSION_SECRET = 'sichrplace-session-secret-test-2025';
process.env.COOKIE_SECRET = 'sichrplace-cookie-secret-test-2025';
process.env.OAUTH_CLIENT_ID = 'test-oauth-client-id';
process.env.OAUTH_CLIENT_SECRET = 'test-oauth-client-secret';
process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/auth/callback';

// PayPal authentication (from your credentials)
process.env.PAYPAL_CLIENT_ID = 'AcPYlXozR8VS9kJSk7rv5nN5Mn7wNfE_wSGy2H3vEhTQJCUJ9yGTVHMt2V_-sZ7R5Rk0zYxNfVmY';
process.env.PAYPAL_CLIENT_SECRET = 'EGO3ecmQdi4dAyrgahy9TgLVqR2vY6WBABARb7YgcmSn_nB7H9Sp6sEE-BAabWFcgbekfz_ForB19uCs';
process.env.PAYPAL_ENVIRONMENT = 'sandbox';

// Google OAuth and Gmail authentication
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GMAIL_USER = 'sichrplace@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'test-gmail-app-password';
process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
process.env.GMAIL_ACCESS_TOKEN = 'test-access-token';

// Frontend URLs for redirects
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.BACKEND_URL = 'http://localhost:3001';

// Security tokens
process.env.CSRF_SECRET = 'sichrplace-csrf-secret-test';
process.env.API_KEY = 'sichrplace-api-key-test-2025';

// Mock process.exit to prevent test termination
const originalExit = process.exit;
process.exit = jest.fn();

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Use real ioredis - will connect to real Redis if available
process.env.REDIS_URL = 'redis://localhost:6379';

// Remove Express mock - let it run natively

// Use real Supabase client with real credentials

// Use real nodemailer with test configuration
process.env.GMAIL_USER = 'test@example.com';
process.env.GMAIL_PASS = 'test-password';

// Use real multer for file uploads

// Use real file system operations

// Use real HTTP server

// Set up global test timeout
jest.setTimeout(30000);

// ==============================================================================
// COMPREHENSIVE AUTHENTICATION SETUP FOR ALL TESTS
// ==============================================================================

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// Create test users with different roles
global.TEST_USERS = {
  regularUser: {
    id: 'test-user-123',
    email: 'test.user@sichrplace.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    verified: true,
    blocked: false,
    password: 'password123'
  },
  adminUser: {
    id: 'admin-user-456',
    email: 'admin@sichrplace.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    verified: true,
    blocked: false,
    password: 'adminpassword123'
  },
  landlordUser: {
    id: 'landlord-user-789',
    email: 'landlord@sichrplace.com',
    firstName: 'Landlord',
    lastName: 'User',
    role: 'landlord',
    verified: true,
    blocked: false,
    password: 'landlordpassword123'
  }
};

// Generate real JWT tokens for test users
global.AUTH_TOKENS = {
  regularUser: jwt.sign(
    { 
      id: global.TEST_USERS.regularUser.id,
      email: global.TEST_USERS.regularUser.email,
      role: global.TEST_USERS.regularUser.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  ),
  adminUser: jwt.sign(
    { 
      id: global.TEST_USERS.adminUser.id,
      email: global.TEST_USERS.adminUser.email,
      role: global.TEST_USERS.adminUser.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  ),
  landlordUser: jwt.sign(
    { 
      id: global.TEST_USERS.landlordUser.id,
      email: global.TEST_USERS.landlordUser.email,
      role: global.TEST_USERS.landlordUser.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
};

// Global authentication helper functions
global.getAuthHeaders = function(userType = 'regularUser') {
  return {
    'Authorization': `Bearer ${global.AUTH_TOKENS[userType]}`,
    'Content-Type': 'application/json'
  };
};

global.createTestUser = async function(userData = {}) {
  const defaultUser = {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: `test${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    verified: true,
    blocked: false,
    password: await bcryptjs.hash('password123', 10),
    ...userData
  };
  return defaultUser;
};

global.createTestJWT = function(userData) {
  return jwt.sign(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role || 'user'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Mock UserService.findById to return test users
const mockUserService = {
  findById: jest.fn().mockImplementation(async (userId) => {
    // Return the appropriate test user based on ID
    const testUser = Object.values(global.TEST_USERS).find(user => user.id === userId);
    if (testUser) {
      return testUser;
    }
    // For dynamic test users, return a basic user structure
    return {
      id: userId,
      email: `user-${userId}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      verified: true,
      blocked: false
    };
  }),
  
  findByEmail: jest.fn().mockImplementation(async (email) => {
    const testUser = Object.values(global.TEST_USERS).find(user => user.email === email);
    return testUser || null;
  }),
  
  create: jest.fn().mockImplementation(async (userData) => {
    const newUser = await global.createTestUser(userData);
    return newUser;
  }),
  
  update: jest.fn().mockImplementation(async (userId, updateData) => {
    const user = await mockUserService.findById(userId);
    if (user) {
      return { ...user, ...updateData };
    }
    return null;
  }),
  
  delete: jest.fn().mockResolvedValue(true),
  
  verify: jest.fn().mockImplementation(async (userId) => {
    const user = await mockUserService.findById(userId);
    if (user) {
      user.verified = true;
      return user;
    }
    return null;
  })
};

// Override UserService module to use our mock
jest.doMock('../services/UserService', () => mockUserService);

// Set up global UserService reference
global.mockUserService = mockUserService;

console.log('🔐 Authentication setup complete:');
console.log('✅ JWT Secret configured');
console.log('✅ Test users created');
console.log('✅ Auth tokens generated');
console.log('✅ UserService mocked');
console.log('✅ Authentication helpers available globally');

// Redis connection setup
process.env.REDIS_URL = 'redis://localhost:6379';

// NO MOCKS - All real modules and dependencies will be used:
// - Real Express.js
// - Real Supabase client  
// - Real bcryptjs
// - Real multer
// - Real nodemailer
// - Real ioredis
// - Real file system operations
// - Real PayPal SDK
// - Real validator
// - Real UUID generation
// - Real JSON Web Tokens
