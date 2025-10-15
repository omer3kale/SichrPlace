import { jest } from '@jest/globals';

const invokeHandler = async () => {
  const mod = await import('../cache-management.mjs');
  return mod.handler;
};

describe('cache-management handler smoke tests', () => {
  test('set and get cache value lifecycle', async () => {
    const handler = await invokeHandler();

    const setEvent = {
      httpMethod: 'POST',
      queryStringParameters: { action: 'set' },
      body: JSON.stringify({
        action: 'set',
        key: 'test-key',
        value: { hello: 'world' },
        ttl: 120
      })
    };

    const setResponse = await handler(setEvent, global.mockNetlifyContext);
    expect(setResponse.statusCode).toBe(200);

    const getEvent = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'get',
        key: 'test-key'
      }
    };

    const getResponse = await handler(getEvent, global.mockNetlifyContext);
    expect(getResponse.statusCode).toBe(200);

    const payload = JSON.parse(getResponse.body);
    expect(payload.success).toBe(true);
    expect(payload.data?.value).toEqual({ hello: 'world' });
  });

  test('flush action clears matching keys', async () => {
    const handler = await invokeHandler();

    await handler(
      {
        httpMethod: 'POST',
        queryStringParameters: { action: 'set' },
        body: JSON.stringify({ action: 'set', key: 'user:1', value: 'cached', ttl: 60 })
      },
      global.mockNetlifyContext
    );

    const flushResponse = await handler(
      {
        httpMethod: 'POST',
        queryStringParameters: { action: 'flush' },
        body: JSON.stringify({ action: 'flush', pattern: '^user:' })
      },
      global.mockNetlifyContext
    );

    expect(flushResponse.statusCode).toBe(200);

    const getResponse = await handler(
      {
        httpMethod: 'GET',
        queryStringParameters: { action: 'get', key: 'user:1' }
      },
      global.mockNetlifyContext
    );

    expect(getResponse.statusCode).toBe(404);
  });
});
