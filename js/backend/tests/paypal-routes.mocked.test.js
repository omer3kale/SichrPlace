const express = require('express');
const request = require('supertest');
const { getAuthHeader } = require('./helpers/testAuth');

// Using real PayPal SDK and auth middleware - no mocks needed
const paypalRouter = require('../routes/paypal');

const app = express();
app.use(express.json());
app.use('/', paypalRouter);

describe('PayPal Routes (Real)', () => {
  const authHeaders = getAuthHeader();

  it('GET /config returns config', async () => {
    const res = await request(app)
      .get('/config')
      .set(authHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('clientId');
  });

  it('POST /create returns approvalUrl', async () => {
    const res = await request(app)
      .post('/create')
      .set(authHeaders)
      .send({ amount: 10 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('approvalUrl');
  });

  it('POST /execute returns completed', async () => {
    const res = await request(app)
      .post('/execute')
      .set(authHeaders)
      .send({ paymentId: 'PAYID-123', payerId: 'PAYERID-456' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('POST /webhook returns received', async () => {
    const res = await request(app)
      .post('/webhook')
      .set(authHeaders)
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'TXN-789' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('received', true);
  });
});
