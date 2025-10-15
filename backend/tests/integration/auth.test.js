/**
 * Authentication Endpoints Integration Tests
 * Tests user registration, login, logout, and password reset
 */

const request = require('supertest');
const app = require('../../server');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe('Authentication Endpoints', () => {
  let testUserId;
  const timestamp = Date.now();
  const testEmail = `test-${timestamp}@sichrplace.test`;
  const testUsername = `testuser${timestamp}`;
  const testPassword = 'TestPassword123!';

  afterAll(async () => {
    // Cleanup: Delete test user if created
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  describe('POST /auth/register', () => {
    it('should create a new user account', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: 'tenant',
          terms: 'true'
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      testUserId = response.body.user.id;
    });

    it('should reject registration with existing email', async () => {
      await request(app)
        .post('/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          username: `${testUsername}-duplicate`,
          email: testEmail,
          password: testPassword,
          role: 'tenant',
          terms: 'true'
        })
        .expect(409);
    });

    it('should reject registration with weak password', async () => {
      await request(app)
        .post('/auth/register')
        .send({
          firstName: 'Another',
          lastName: 'User',
          username: `testuser${Date.now()}`,
          email: `another-${Date.now()}@sichrplace.test`,
          password: '123',
          role: 'tenant',
          terms: 'true'
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject login with incorrect password', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!'
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@sichrplace.test',
          password: testPassword
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully (route not implemented yet)', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });
});
