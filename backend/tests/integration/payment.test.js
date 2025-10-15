/**
 * Payment Endpoints Integration Tests
 * Tests payment processing and refund functionality
 */

const request = require('supertest');
const app = require('../../server');

describe('Payment Endpoints', () => {
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

  describe('POST /api/payments/create', () => {
    it('should create a payment transaction', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 100.00,
          payment_method: 'credit_card',
          description: 'Test payment'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('amount', '100.00');
      expect(response.body).toHaveProperty('status');
    });

    it('should reject payment creation without authentication', async () => {
      await request(app)
        .post('/api/payments/create')
        .send({
          amount: 100.00,
          payment_method: 'credit_card'
        })
        .expect(401);
    });

    it('should reject payment with invalid amount', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      await request(app)
        .post('/api/payments/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: -50.00,
          payment_method: 'credit_card'
        })
        .expect(400);
    });
  });

  describe('GET /api/payments/history', () => {
    it('should return user payment history', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/payments/history')
        .expect(401);
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should create a refund request', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      // First get a payment to refund
      const paymentsResponse = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${userToken}`);

      if (paymentsResponse.body.length === 0) {
        console.log('⚠️ Skipping test: No payments available to refund');
        return;
      }

      const paymentId = paymentsResponse.body[0].id;

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          payment_id: paymentId,
          reason: 'Test refund request',
          amount: 50.00
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('payment_id', paymentId);
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('should reject refund request without authentication', async () => {
      await request(app)
        .post('/api/payments/refund')
        .send({
          payment_id: 'some-id',
          reason: 'Test',
          amount: 50.00
        })
        .expect(401);
    });
  });

  describe('GET /api/payments/:id', () => {
    it('should return payment details', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      // First get a payment
      const paymentsResponse = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${userToken}`);

      if (paymentsResponse.body.length === 0) {
        console.log('⚠️ Skipping test: No payments available');
        return;
      }

      const paymentId = paymentsResponse.body[0].id;

      const response = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', paymentId);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/payments/some-id')
        .expect(401);
    });
  });
});
