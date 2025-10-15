const jwt = require('jsonwebtoken');

/**
 * Test Authentication Helper
 * Provides real JWT tokens for testing with your real auth system
 */

// Your real JWT secret (should match what's in your environment)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

/**
 * Generate a real JWT token for testing
 * @param {Object} payload - User data to encode in token
 * @returns {string} JWT token
 */
function generateTestToken(payload = {}) {
  const defaultPayload = {
    id: 'test-user-123',
    email: 'test@sichrplace.com',
    username: 'testuser',
    role: 'user',
    ...payload
  };

  return jwt.sign(defaultPayload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Generate admin JWT token for testing
 * @returns {string} Admin JWT token
 */
function generateAdminToken() {
  return generateTestToken({
    id: 'admin-user-123',
    email: 'admin@sichrplace.com',
    username: 'admin',
    role: 'admin'
  });
}

/**
 * Get authorization header with valid token
 * @param {Object} payload - Optional user payload
 * @returns {Object} Headers object with Authorization
 */
function getAuthHeader(payload = {}) {
  const token = generateTestToken(payload);
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Get admin authorization header
 * @returns {Object} Headers object with admin Authorization
 */
function getAdminAuthHeader() {
  const token = generateAdminToken();
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Create test user in database (if needed)
 * @param {Object} userData - User data
 * @returns {Object} Created user data
 */
async function createTestUser(userData = {}) {
  const defaultUser = {
    id: 'test-user-123',
    email: 'test@sichrplace.com',
    username: 'testuser',
    password: 'test123456',
    role: 'user',
    ...userData
  };

  // You can add real user creation logic here if needed
  return defaultUser;
}

module.exports = {
  generateTestToken,
  generateAdminToken,
  getAuthHeader,
  getAdminAuthHeader,
  createTestUser,
  JWT_SECRET
};