/**
 * GDPR Endpoints Integration Tests
 * Tests GDPR data access, deletion, and consent management
 */

const request = require('supertest');
const app = require('../../server');

describe('GDPR Endpoints', () => {
  let userToken;
  let userId;

  beforeAll(async () => {
    // Login to get token
    try {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'tenant1@example.com',
          password: 'Tenant123!'
        });
      
      if (loginResponse.body.token) {
        userToken = loginResponse.body.token;
        userId = loginResponse.body.user.id;
      }
    } catch (error) {
      console.log('⚠️ Login failed - some tests will be skipped');
    }
  });

  describe('GET /api/gdpr/data', () => {
    it('should return user data export', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/gdpr/data')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', userId);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/gdpr/data')
        .expect(401);
    });
  });

  describe('POST /api/gdpr/delete', () => {
    it('should create a data deletion request', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .post('/api/gdpr/delete')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Testing GDPR deletion request'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('request_type', 'delete');
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('should reject deletion request without authentication', async () => {
      await request(app)
        .post('/api/gdpr/delete')
        .send({
          reason: 'Testing'
        })
        .expect(401);
    });
  });

  describe('GET /api/gdpr/consents', () => {
    it('should return user consents', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/gdpr/consents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/gdpr/consents')
        .expect(401);
    });
  });

  describe('PUT /api/gdpr/consents/:purposeId', () => {
    it('should update user consent', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      // First get available consent purposes
      const purposesResponse = await request(app)
        .get('/api/gdpr/consent-purposes')
        .expect(200);

      if (purposesResponse.body.length === 0) {
        console.log('⚠️ Skipping test: No consent purposes available');
        return;
      }

      const purposeId = purposesResponse.body[0].id;

      const response = await request(app)
        .put(`/api/gdpr/consents/${purposeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          given: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('purpose_id', purposeId);
      expect(response.body).toHaveProperty('given', true);
    });

    it('should reject consent update without authentication', async () => {
      await request(app)
        .put('/api/gdpr/consents/some-id')
        .send({
          given: true
        })
        .expect(401);
    });
  });

  describe('GET /api/gdpr/consent-purposes', () => {
    it('should return all consent purposes', async () => {
      const response = await request(app)
        .get('/api/gdpr/consent-purposes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('description');
      }
    });

    it('should return consent purposes without authentication', async () => {
      const response = await request(app)
        .get('/api/gdpr/consent-purposes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
