jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

jest.mock('../services/UserService', () => ({
  findById: jest.fn()
}));

const jwt = require('jsonwebtoken');
const UserService = require('../services/UserService');
const auth = require('../middleware/auth');
const { handleTestEnvironment } = require('../middleware/testSupport');

describe('auth middleware', () => {
  const originalEnv = process.env.NODE_ENV;
  let res;
  let next;

  const createResponse = () => {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    res = createResponse();
    next = jest.fn();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('allows request to proceed when user is already attached in test environment', async () => {
    const req = {
      user: { id: 'user-123' },
      headers: {},
      body: {}
    };

    await auth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('handleTestEnvironment short-circuits when user exists', () => {
    const req = { user: { id: 'existing-user' }, headers: {}, body: {} };
  const handled = handleTestEnvironment(req, next);

    expect(handled).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('injects user from headers during tests', async () => {
    const req = {
      headers: {
        'x-test-user-id': 'user-456',
        'x-test-role': 'admin'
      },
      body: {}
    };

    await auth(req, res, next);

    expect(req.user).toEqual({
      id: 'user-456',
      email: 'ci@sichrplace.dev',
      role: 'admin'
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('handleTestEnvironment injects from headers and returns true', () => {
    const req = {
      headers: { 'x-test-user-id': 'user-helper', 'x-test-role': 'super' },
      body: {}
    };

  const handled = handleTestEnvironment(req, next);

    expect(handled).toBe(true);
    expect(req.user).toEqual({
      id: 'user-helper',
      email: 'ci@sichrplace.dev',
      role: 'super'
    });
  });

  test('injects user from request body when headers missing', async () => {
    const req = {
      headers: {},
      body: {
        userId: 'body-user-1'
      }
    };

    await auth(req, res, next);

    expect(req.user).toEqual({
      id: 'body-user-1',
      email: 'ci@sichrplace.dev',
      role: 'user'
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('handleTestEnvironment injects from body data', () => {
    const req = { headers: {}, body: { userId: 'body-helper' } };

  const handled = handleTestEnvironment(req, next);

    expect(handled).toBe(true);
    expect(req.user).toEqual({
      id: 'body-helper',
      email: 'ci@sichrplace.dev',
      role: 'user'
    });
  });

  test('returns 401 when no authorization header is present', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {},
      body: {}
    };

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is malformed', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer'
      },
      body: {}
    };

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Malformed token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user is not found', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer valid-token'
      },
      body: {}
    };

    jwt.verify.mockReturnValue({ id: 'user-not-found' });
    UserService.findById.mockResolvedValue(null);

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when user is blocked', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer valid-token'
      },
      body: {}
    };

    jwt.verify.mockReturnValue({ id: 'blocked-user' });
    UserService.findById.mockResolvedValue({ id: 'blocked-user', blocked: true });

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'User is blocked' });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches user and calls next when token is valid', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer valid-token'
      },
      body: {}
    };

    const user = { id: 'user-789', blocked: false };
    jwt.verify.mockReturnValue({ id: 'user-789' });
    UserService.findById.mockResolvedValue(user);

    await auth(req, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when JWT verification fails', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer invalid-token'
      },
      body: {}
    };

    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user lookup rejects', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      headers: {
        authorization: 'Bearer valid-token'
      },
      body: {}
    };

    jwt.verify.mockReturnValue({ id: 'explode' });
    UserService.findById.mockRejectedValue(new Error('db down'));

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('falls through to standard auth when test headers missing', async () => {
    process.env.NODE_ENV = 'test';
    const req = {
      headers: {},
      body: {}
    };

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('handleTestEnvironment returns false when no overrides found', () => {
    const req = { headers: {}, body: undefined };

  const handled = handleTestEnvironment(req, next);

    expect(handled).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
});
