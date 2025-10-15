const request = require('supertest');
const express = require('express');

const jwt = require('jsonwebtoken');

jest.mock('../services/UserService', () => ({
  findById: jest.fn().mockResolvedValue({
    id: 'test-user-123',
    email: 'test@example.com',
    username: 'testuser'
  })
}));

// Mock GdprService
jest.mock('../services/GdprService');

// Mock the auth middleware before loading the routes
jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    if (!req.headers['x-no-user']) {
      req.user = { 
        id: 'test-user-123', 
        email: 'test@example.com',
        username: 'testuser'
      };
    }
    next();
  };
});

const { GdprService } = require('../services/GdprService');
const UserService = require('../services/UserService');
const gdprRoutes = require('../routes/gdpr');

const app = express();
app.use(express.json());
app.use('/api/gdpr', gdprRoutes);

describe('GDPR Routes Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('real auth middleware coverage', () => {
    const realAuth = jest.requireActual('../middleware/auth');
    const originalEnv = process.env.NODE_ENV;

    const createResponse = () => ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    });

    let res;
    let next;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      res = createResponse();
      next = jest.fn();
      UserService.findById.mockResolvedValue({
        id: 'test-user-123',
        email: 'test@example.com',
        blocked: false
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      process.env.NODE_ENV = originalEnv;
    });

    test('returns 401 when authorization header missing', async () => {
      const req = { headers: {}, body: {} };

      await realAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is malformed', async () => {
      const req = {
        headers: { authorization: 'Bearer' },
        body: {}
      };

      await realAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Malformed token' });
    });

    test('returns 401 when user is not found', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'missing-user' });
      UserService.findById.mockResolvedValueOnce(null);

      const req = {
        headers: { authorization: 'Bearer valid-token' },
        body: {}
      };

      await realAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    test('returns 403 when user is blocked', async () => {
      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'blocked-user' });
      UserService.findById.mockResolvedValueOnce({ id: 'blocked-user', blocked: true });

      const req = {
        headers: { authorization: 'Bearer valid-token' },
        body: {}
      };

      await realAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'User is blocked' });
    });

    test('attaches user and calls next for valid token', async () => {
      const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'test-user-123' });

      const req = {
        headers: { authorization: 'Bearer valid-token' },
        body: {}
      };

      await realAuth(req, res, next);

      expect(verifySpy).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(req.user).toEqual({
        id: 'test-user-123',
        email: 'test@example.com',
        blocked: false
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('returns 401 when JWT verification throws error', async () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('invalid token');
      });

      const req = {
        headers: { authorization: 'Bearer invalid-token' },
        body: {}
      };

      await realAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });
  });

  describe('POST /api/gdpr/consent', () => {
    test('should record user consent successfully', async () => {
      // Mock GdprService methods
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-123' });
      GdprService.createConsent = jest.fn().mockResolvedValue({ 
        id: 'consent-123',
        user_id: 'test-user-123',
        granted: true
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .send({
          consentTypes: {
            necessary: true,
            analytics: true,
            marketing: false,
            functional: true
          },
          privacyPolicyVersion: '2.1'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Consent recorded successfully');
      expect(GdprService.logDataProcessing).toHaveBeenCalled();
      expect(GdprService.createConsent).toHaveBeenCalledTimes(4); // Once for each consent type
    });

    test('should validate required consent types', async () => {
      const response = await request(app)
        .post('/api/gdpr/consent')
        .send({
          consentTypes: null
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle consent recording errors', async () => {
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-123' });
      GdprService.createConsent = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/gdpr/consent')
        .send({
          consentTypes: {
            necessary: true,
            analytics: true
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to record consent');
    });

    test('should handle missing consent service configuration', async () => {
      GdprService.logDataProcessing = undefined;
      GdprService.createConsent = undefined;

      const response = await request(app)
        .post('/api/gdpr/consent')
        .send({
          consentTypes: {
            analytics: true
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to record consent');
    });
  });

  describe('GET /api/gdpr/consent-status', () => {
    test('should return user consent status', async () => {
      const mockConsents = [
        {
          id: 'consent-1',
          purpose: 'analytics',
          granted: true,
          granted_at: '2025-01-01T00:00:00Z'
        },
        {
          id: 'consent-2',
          purpose: 'marketing',
          granted: false,
          granted_at: null
        }
      ];

      GdprService.getUserConsents = jest.fn().mockResolvedValue(mockConsents);

      const response = await request(app)
        .get('/api/gdpr/consent-status');

      expect(response.status).toBe(200);
      expect(response.body.consents).toEqual(mockConsents);
      expect(GdprService.getUserConsents).toHaveBeenCalledWith('test-user-123');
    });

    test('should provide empty array when no consent records exist', async () => {
      GdprService.getUserConsents = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/gdpr/consent-status');

      expect(response.status).toBe(200);
      expect(response.body.consents).toEqual([]);
    });

    test('should handle errors when fetching consent status', async () => {
      GdprService.getUserConsents = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/gdpr/consent-status');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch consent status');
    });
  });

  describe('POST /api/gdpr/withdraw-consent', () => {
    test('should withdraw user consent successfully', async () => {
      GdprService.getUserConsents = jest.fn().mockResolvedValue([
        { id: 'consent-123', purpose: 'analytics' }
      ]);
      GdprService.updateConsent = jest.fn().mockResolvedValue({
        id: 'consent-123',
        granted: false,
        withdrawn_at: '2025-08-06T00:00:00Z'
      });
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-123' });

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({
          consentId: 'consent-123',
          consentType: 'analytics',
          reason: 'User requested withdrawal'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Consent withdrawn successfully');
      expect(GdprService.updateConsent).toHaveBeenCalledWith('consent-123', {
        granted: false,
        withdrawn_at: expect.any(String)
      });
    });

    test('should surface legacy consent identifier when update returns _id', async () => {
      GdprService.updateConsent = jest.fn().mockResolvedValue({ _id: 'legacy-consent-id' });
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-legacy' });

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({
          consentId: 'consent-legacy',
          consentType: 'analytics'
        });

      expect(response.status).toBe(200);
      expect(response.body.consentId).toBe('legacy-consent-id');
    });

    test('should reuse provided consentId when update returns no record', async () => {
      GdprService.updateConsent = jest.fn().mockResolvedValue(null);
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-keep' });

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({
          consentId: 'consent-keep',
          consentType: 'functional'
        });

      expect(response.status).toBe(200);
      expect(response.body.consentId).toBe('consent-keep');
    });

    test('should fall back to aggregated consent when consentId missing', async () => {
      GdprService.getUserConsent = jest.fn().mockResolvedValue({
        consentTypes: { marketing: { given: true } },
        privacyPolicyVersion: '1.0',
        termsVersion: '2.0'
      });
      GdprService.recordConsent = jest.fn().mockResolvedValue({ id: 'consent-agg' });
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-agg' });

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({ consentType: 'marketing' });

      expect(response.status).toBe(200);
      expect(GdprService.recordConsent).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user-123',
        consentTypes: expect.objectContaining({ marketing: expect.objectContaining({ given: false }) })
      }));
      expect(response.body.consentId).toBe('consent-agg');
    });

    test('should return null consentId when no identifiers are available', async () => {
      GdprService.getUserConsent = jest.fn().mockResolvedValue({
        consentTypes: { marketing: { given: true } },
        privacyPolicyVersion: '1.0',
        termsVersion: '2.0'
      });
      GdprService.recordConsent = jest.fn().mockResolvedValue(null);
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-null' });

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({ consentType: 'marketing' });

      expect(response.status).toBe(200);
      expect(response.body.consentId).toBeNull();
    });

    test('should use legacy consent list fallback when aggregated helper missing', async () => {
      const originalGetUserConsent = GdprService.getUserConsent;
      const originalGetUserConsents = GdprService.getUserConsents;
      const originalRecordConsent = GdprService.recordConsent;
      const originalLogDataProcessing = GdprService.logDataProcessing;

      delete GdprService.getUserConsent;

      GdprService.getUserConsents = jest.fn().mockResolvedValue([
        {
          consentTypes: { functional: { given: true, timestamp: '2025-01-01T00:00:00Z' } },
          privacyPolicyVersion: '1.1',
          termsVersion: '2.1'
        }
      ]);
      GdprService.recordConsent = jest.fn().mockResolvedValue({ id: 'consent-legacy' });
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-legacy' });

      try {
        const response = await request(app)
          .post('/api/gdpr/withdraw-consent')
          .send({ consentType: 'functional' });

        expect(response.status).toBe(200);
        expect(GdprService.getUserConsents).toHaveBeenCalledWith('test-user-123');
        expect(GdprService.recordConsent).toHaveBeenCalledWith(expect.objectContaining({
          consentTypes: expect.objectContaining({ functional: expect.objectContaining({ given: false }) })
        }));
      } finally {
        GdprService.getUserConsent = originalGetUserConsent;
        GdprService.getUserConsents = originalGetUserConsents;
        GdprService.recordConsent = originalRecordConsent;
        GdprService.logDataProcessing = originalLogDataProcessing;
      }
    });

    test('should return 404 when consent record is missing', async () => {
      GdprService.getUserConsent = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({ consentType: 'analytics' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('No consent record found');
    });

    test('should handle errors during consent withdrawal', async () => {
      GdprService.updateConsent = jest.fn().mockRejectedValue(new Error('fail'));
      GdprService.logDataProcessing = jest.fn();

      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({
          consentId: 'consent-err',
          consentType: 'analytics'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to withdraw consent');
    });

    test('should validate consent ID', async () => {
      const response = await request(app)
        .post('/api/gdpr/withdraw-consent')
        .send({
          consentType: '',
          reason: 'Test withdrawal'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/gdpr/request', () => {
    test('should create GDPR request successfully', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createRequest = jest.fn().mockResolvedValue({
        id: 'request-123',
        request_type: 'access',
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/gdpr/request')
        .send({
          requestType: 'access',
          description: 'I want to access my personal data'
        });

    expect(response.status).toBe(201);
      expect(response.body.message).toBe('GDPR request submitted successfully');
      expect(GdprService.createRequest).toHaveBeenCalled();
    });

    test('should use default description and expose legacy identifier when provided', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      const legacyRequest = {
        _id: 'legacy-request-id',
        request_type: 'deletion',
        status: 'pending'
      };
      GdprService.createRequest = jest.fn().mockResolvedValue(legacyRequest);

      const response = await request(app)
        .post('/api/gdpr/request')
        .send({
          requestType: 'deletion'
        });

      expect(response.status).toBe(201);
      expect(response.body.requestId).toBe('legacy-request-id');

      const [payload] = GdprService.createRequest.mock.calls[0];
      expect(payload.description).toBe('User requested deletion request');
    });

    test('should prevent duplicate pending requests', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue({
        id: 'existing-request',
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/gdpr/request')
        .send({
          requestType: 'access',
          description: 'Duplicate request'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You already have a pending request of this type');
    });

    test('should validate request type', async () => {
      const response = await request(app)
        .post('/api/gdpr/request')
        .send({
          requestType: '',
          description: 'Invalid request'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle errors when creating GDPR request', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createRequest = jest.fn().mockRejectedValue(new Error('Service down'));

      const response = await request(app)
        .post('/api/gdpr/request')
        .send({
          requestType: 'access',
          description: 'Please send my data'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create GDPR request');
    });
  });

  describe('GET /api/gdpr/requests', () => {
    test('should return user GDPR requests', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          request_type: 'access',
          status: 'pending',
          created_at: '2025-08-01T00:00:00Z'
        },
        {
          id: 'request-2',
          request_type: 'deletion',
          status: 'completed',
          created_at: '2025-07-15T00:00:00Z'
        }
      ];

      GdprService.getRequests = jest.fn().mockResolvedValue(mockRequests);

      const response = await request(app)
        .get('/api/gdpr/requests');

      expect(response.status).toBe(200);
      expect(response.body.requests).toEqual(mockRequests);
      expect(GdprService.getRequests).toHaveBeenCalledWith({ 
        userId: 'test-user-123' 
      });
    });

    test('should default to an empty array when no requests found', async () => {
      GdprService.getRequests = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/gdpr/requests');

      expect(response.status).toBe(200);
      expect(response.body.requests).toEqual([]);
    });

    test('should handle errors when fetching GDPR requests', async () => {
      GdprService.getRequests = jest.fn().mockRejectedValue(new Error('fail'));

      const response = await request(app)
        .get('/api/gdpr/requests');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch GDPR requests');
    });
  });

  describe('GET /api/gdpr/export-data', () => {
    test('should export user data successfully', async () => {
      const mockUserData = {
        profile: { name: 'Test User', email: 'test@example.com' },
        apartments: [],
        messages: [],
        viewingRequests: []
      };

      // Mock export function (would need to be implemented in routes)
      GdprService.exportUserData = jest.fn().mockResolvedValue(mockUserData);

      const response = await request(app)
        .get('/api/gdpr/export-data');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should handle export data errors', async () => {
      GdprService.exportUserData = jest.fn().mockRejectedValue(new Error('Export failed'));
      GdprService.logDataProcessing = jest.fn();

      const response = await request(app)
        .get('/api/gdpr/export-data');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to export data');
    });

    test('should assemble export payload when export service unavailable', async () => {
      GdprService.exportUserData = undefined;
      GdprService.getUserConsents = jest.fn().mockResolvedValue([{ id: 'consent' }]);
      GdprService.getRequests = jest.fn().mockResolvedValue([{ id: 'req' }]);
      GdprService.getProcessingLogs = jest.fn().mockResolvedValue([{ id: 'log' }]);
      GdprService.logDataProcessing = jest.fn().mockResolvedValue({ id: 'log-created' });

      const response = await request(app)
        .get('/api/gdpr/export-data');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        profile: expect.objectContaining({ id: 'test-user-123' }),
        consents: [{ id: 'consent' }],
        requests: [{ id: 'req' }],
        processingLogs: [{ id: 'log' }]
      });
      expect(GdprService.logDataProcessing).toHaveBeenCalled();
    });
  });

  describe('POST /api/gdpr/delete-account', () => {
    test('should initiate account deletion request', async () => {
      GdprService.createRequest = jest.fn().mockResolvedValue({
        id: 'delete-request-123',
        request_type: 'deletion',
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .send({
          confirmation: 'DELETE_MY_ACCOUNT',
          reason: 'No longer need the service'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Account deletion request submitted');
      expect(GdprService.createRequest).toHaveBeenCalledWith({
        user_id: 'test-user-123',
        request_type: 'deletion',
        description: expect.stringContaining('Account deletion'),
        status: 'pending',
        created_at: expect.any(String),
        metadata: expect.objectContaining({
          confirmationPhrase: 'DELETE_MY_ACCOUNT'
        })
      });
    });

    test('should validate deletion confirmation', async () => {
      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .send({
          confirmation: 'WRONG_CONFIRMATION',
          reason: 'Test reason'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid confirmation phrase');
    });

    test('should handle errors when creating deletion request', async () => {
      GdprService.createRequest = jest.fn().mockRejectedValue(new Error('Database error'));
      GdprService.logDataProcessing = jest.fn();

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .send({
          confirmation: 'DELETE_MY_ACCOUNT'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process deletion request');
    });
  });

  describe('GET /api/gdpr/consent', () => {
    test('should return consent payload when available', async () => {
      const consentPayload = { consentTypes: { analytics: { granted: true } } };
      GdprService.getUserConsent = jest.fn().mockResolvedValue(consentPayload);

      const response = await request(app).get('/api/gdpr/consent');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, consent: consentPayload });
      expect(GdprService.getUserConsent).toHaveBeenCalledWith('test-user-123');
    });

    test('should return message when no consent found using fallback list', async () => {
      GdprService.getUserConsent = undefined;
      GdprService.getUserConsents = jest.fn().mockResolvedValue(null);

      const response = await request(app).get('/api/gdpr/consent');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        consent: null,
        message: 'No consent record found'
      });
    });


  describe('authorization guard', () => {
    const unauthorizedCases = [
      { method: 'post', url: '/api/gdpr/consent', payload: { consentTypes: { analytics: true } } },
      { method: 'get', url: '/api/gdpr/consent' },
      { method: 'post', url: '/api/gdpr/request', payload: { requestType: 'access' } },
      { method: 'get', url: '/api/gdpr/requests' },
      { method: 'get', url: '/api/gdpr/export' },
      { method: 'delete', url: '/api/gdpr/account', payload: { confirmation: 'DELETE_MY_ACCOUNT' } },
      { method: 'post', url: '/api/gdpr/withdraw-consent', payload: { consentType: 'analytics' } },
      { method: 'get', url: '/api/gdpr/consent-status' },
      { method: 'get', url: '/api/gdpr/export-data' },
      { method: 'post', url: '/api/gdpr/delete-account', payload: { confirmation: 'DELETE_MY_ACCOUNT' } }
    ];

    test.each(unauthorizedCases)('returns 401 when user missing for %s %s', async ({ method, url, payload }) => {
      let req = request(app)[method](url).set('x-no-user', '1');
      if (payload) {
        req = req.send(payload);
      }

      const response = await req;

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ success: false, error: 'Unauthorized' });
    });
  });
    test('should handle errors fetching consent details', async () => {
      GdprService.getUserConsent = jest.fn().mockRejectedValue(new Error('boom'));

      const response = await request(app).get('/api/gdpr/consent');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch consent status');
    });
  });

  describe('GET /api/gdpr/export', () => {
    test('should create export request successfully', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createRequest = jest.fn().mockResolvedValue({ id: 'req-export-1' });

      const response = await request(app).get('/api/gdpr/export');

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Data export request submitted');
      expect(GdprService.createRequest).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'test-user-123',
        request_type: 'portability',
        metadata: expect.objectContaining({ format: 'json' })
      }));
    });

    test('should prevent duplicate export requests', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue({ id: 'req-export-2' });

      const response = await request(app).get('/api/gdpr/export');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('You already have a pending data export request');
    });

    test('should handle errors when creating export request', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createRequest = jest.fn().mockRejectedValue(new Error('boom'));

      const response = await request(app).get('/api/gdpr/export');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to request data export');
    });
  });

  describe('DELETE /api/gdpr/account', () => {
    test('should submit account deletion request', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createGdprRequest = jest.fn().mockResolvedValue({ _id: 'del-1' });

      const response = await request(app)
        .delete('/api/gdpr/account')
        .send({ confirmation: 'DELETE_MY_ACCOUNT' });

      expect(response.status).toBe(200);
      expect(response.body.requestId).toBe('del-1');
      expect(GdprService.createGdprRequest).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'test-user-123',
        requestType: 'deletion'
      }));
    });

    test('should block duplicate deletion requests', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue({ id: 'exists' });

      const response = await request(app)
        .delete('/api/gdpr/account')
        .send({ confirmation: 'DELETE_MY_ACCOUNT' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You already have a pending account deletion request');
    });

    test('should validate confirmation payload for deletion', async () => {
      const response = await request(app)
        .delete('/api/gdpr/account')
        .send({ confirmation: 'nope' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle errors while creating deletion request', async () => {
      GdprService.findExistingRequest = jest.fn().mockResolvedValue(null);
      GdprService.createGdprRequest = jest.fn().mockRejectedValue(new Error('fail'));

      const response = await request(app)
        .delete('/api/gdpr/account')
        .send({ confirmation: 'DELETE_MY_ACCOUNT' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error');
    });
  });

  describe('Middleware and Error Handling', () => {
    test('should handle missing user authentication', async () => {
      // Create a fresh app that bypasses the mocked auth middleware
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      
      // Load the actual auth middleware (not the mock)
      const realAuth = jest.requireActual('../middleware/auth');
      const gdprRouter = express.Router();
      
      // Set up a simple route with real auth to test unauthorized access
      gdprRouter.post('/consent', realAuth, (req, res) => {
        res.json({ success: true });
      });
      
      appWithoutAuth.use('/api/gdpr', gdprRouter);

      const response = await request(appWithoutAuth)
        .post('/api/gdpr/consent')
        .send({ consentTypes: { necessary: true } });

      expect(response.status).toBe(401);
    });

    test('should handle invalid JSON payload', async () => {
      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should handle service unavailable errors', async () => {
      GdprService.logDataProcessing = jest.fn().mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const response = await request(app)
        .post('/api/gdpr/consent')
        .send({
          consentTypes: { necessary: true }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to record consent');
    });
  });
});
