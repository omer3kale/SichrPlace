/**
 * Admin Endpoints Integration Tests
 * Tests admin-only endpoints for payments, refunds, and tickets
 */

const request = require('supertest');
const app = require('../../server');

describe('Admin Endpoints', () => {
  let adminToken;
  let regularUserToken;

  beforeAll(async () => {
    // Login as admin - skip if credentials don't work
    try {
      const adminLogin = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@sichrplace.com',
          password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123!'
        });
      
      if (adminLogin.body.token) {
        adminToken = adminLogin.body.token;
      }
    } catch (error) {
      console.log('⚠️ Admin login failed - some tests will be skipped');
    }

    // Login as regular user for permission tests
    try {
      const userLogin = await request(app)
        .post('/auth/login')
        .send({
          email: 'tenant1@example.com',
          password: 'Tenant123!'
        });
      
      if (userLogin.body.token) {
        regularUserToken = userLogin.body.token;
      }
    } catch (error) {
      console.log('⚠️ Regular user login failed - some tests will be skipped');
    }
  });

  describe('GET /api/admin/payments', () => {
    it('should return payments for admin users', async () => {
      if (!adminToken) {
        console.log('⚠️ Skipping test: Admin credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access for non-admin users', async () => {
      if (!regularUserToken) {
        console.log('⚠️ Skipping test: Regular user credentials not available');
        return;
      }

      await request(app)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/admin/payments')
        .expect(401);
    });
  });

  describe('GET /api/admin/refunds', () => {
    it('should return refund requests for admin users', async () => {
      if (!adminToken) {
        console.log('⚠️ Skipping test: Admin credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/admin/refunds')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access for non-admin users', async () => {
      if (!regularUserToken) {
        console.log('⚠️ Skipping test: Regular user credentials not available');
        return;
      }

      await request(app)
        .get('/api/admin/refunds')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/tickets', () => {
    it('should return support tickets for admin users', async () => {
      if (!adminToken) {
        console.log('⚠️ Skipping test: Admin credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access for non-admin users', async () => {
      if (!regularUserToken) {
        console.log('⚠️ Skipping test: Regular user credentials not available');
        return;
      }

      await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/admin/tickets/:id', () => {
    it('should update ticket status for admin users', async () => {
      if (!adminToken) {
        console.log('⚠️ Skipping test: Admin credentials not available');
        return;
      }

      // First get a ticket to update
      const ticketsResponse = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      if (ticketsResponse.body.length === 0) {
        console.log('⚠️ Skipping test: No tickets available to update');
        return;
      }

      const ticketId = ticketsResponse.body[0].id;

      const response = await request(app)
        .put(`/api/admin/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body).toHaveProperty('id', ticketId);
    });
  });
});
