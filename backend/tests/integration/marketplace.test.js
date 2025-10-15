/**
 * Marketplace Endpoints Integration Tests
 * Tests marketplace listings, contacts, and chat functionality
 */

const request = require('supertest');
const app = require('../../server');

describe('Marketplace Endpoints', () => {
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

  describe('GET /api/marketplace/listings', () => {
    it('should return all marketplace listings', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return listings without authentication', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter listings by category', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings?category=furniture')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('category', 'furniture');
      }
    });

    it('should filter listings by status', async () => {
      const response = await request(app)
        .get('/api/marketplace/listings?status=available')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('status', 'available');
      }
    });
  });

  describe('POST /api/marketplace/listings', () => {
    let createdListingId;

    it('should create a new marketplace listing', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .post('/api/marketplace/listings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Listing',
          description: 'Test description',
          category: 'furniture',
          price: 50.00,
          condition: 'good'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', 'Test Listing');
      createdListingId = response.body.id;
    });

    it('should reject listing creation without authentication', async () => {
      await request(app)
        .post('/api/marketplace/listings')
        .send({
          title: 'Test Listing',
          description: 'Test description',
          category: 'furniture',
          price: 50.00
        })
        .expect(401);
    });

    afterAll(async () => {
      // Cleanup: Delete created listing
      if (createdListingId && userToken) {
        await request(app)
          .delete(`/api/marketplace/listings/${createdListingId}`)
          .set('Authorization', `Bearer ${userToken}`);
      }
    });
  });

  describe('POST /api/marketplace/contact', () => {
    it('should send a contact message for a listing', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      // First get a listing to contact about
      const listingsResponse = await request(app)
        .get('/api/marketplace/listings');

      if (listingsResponse.body.length === 0) {
        console.log('⚠️ Skipping test: No listings available');
        return;
      }

      const listingId = listingsResponse.body[0].id;

      const response = await request(app)
        .post('/api/marketplace/contact')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          listingId: listingId,
          message: 'Is this still available?'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('listing_id', listingId);
    });

    it('should reject contact without authentication', async () => {
      await request(app)
        .post('/api/marketplace/contact')
        .send({
          listingId: 'some-id',
          message: 'Test message'
        })
        .expect(401);
    });
  });

  describe('GET /api/marketplace/chats', () => {
    it('should return user chats', async () => {
      if (!userToken) {
        console.log('⚠️ Skipping test: User credentials not available');
        return;
      }

      const response = await request(app)
        .get('/api/marketplace/chats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access without authentication', async () => {
      await request(app)
        .get('/api/marketplace/chats')
        .expect(401);
    });
  });
});
