/**
 * Health Check Endpoint Integration Tests
 * Tests the /api/health endpoint to ensure the API is running
 */

const request = require('supertest');
const app = require('../../server');

describe('Health Check Endpoint', () => {
  describe('GET /api/health', () => {
    it('should return 200 status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
    });

    it('should return status ok', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should return database connection status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('connected');
      expect(response.body.database).toHaveProperty('status');
      expect(typeof response.body.database.connected).toBe('boolean');
    });

    it('should return timestamp', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond within 1 second', async () => {
      const startTime = Date.now();
      await request(app).get('/api/health');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
