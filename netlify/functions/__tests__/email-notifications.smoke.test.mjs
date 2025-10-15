import { jest } from '@jest/globals';

jest.mock('@supabase/supabase-js', () => {
  const createClient = jest.fn();
  return {
    __esModule: true,
    createClient,
    default: { createClient }
  };
});

jest.mock('nodemailer', () => {
  const createTransport = jest.fn();
  return {
    __esModule: true,
    createTransport,
    default: { createTransport }
  };
});

const baseDbState = {
  users: [
    {
      id: 'd2719f47-1a50-4bc9-9e19-4a7ef90b3c4a',
      email: 'user@example.com',
      username: 'Demo User',
      notification_settings: {
        email: true,
        promotional: true
      }
    }
  ],
  profiles: [
    {
      id: 'd2719f47-1a50-4bc9-9e19-4a7ef90b3c4a',
      email: 'user@example.com',
      role: 'admin',
      status: 'active',
      account_status: 'active',
      is_blocked: false,
      is_admin: true,
      is_staff: true,
      notification_preferences: {}
    }
  ],
  notifications: [
    {
      id: '72b97264-2dfc-4b50-8f2d-464c2740f3f8',
      user_id: 'd2719f47-1a50-4bc9-9e19-4a7ef90b3c4a',
      type: 'system_announcement',
      title: 'Existing',
      message: 'Existing notice',
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString()
    }
  ],
  email_logs: []
};

let dbState = {};

const primaryUserId = baseDbState.users[0].id;

const cloneDb = (state) => JSON.parse(JSON.stringify(state));

const applyFilters = (records, filters) =>
  records.filter((record) => filters.every(({ field, value }) => record[field] === value));

const createSelectResponse = (record) => ({ data: record ?? null, error: record ? null : { status: 404 } });

const createSupabaseClient = () => {
  const buildQuery = (table) => {
    const filters = [];

    const queryApi = {
      select: () => queryApi,
      eq: (field, value) => {
        filters.push({ field, value });
        return queryApi;
      },
      match: (criteria) => {
        Object.entries(criteria).forEach(([field, value]) => {
          filters.push({ field, value });
        });
        return queryApi;
      },
      order: () => queryApi,
      limit: () => queryApi,
      range: () => queryApi,
      is: () => queryApi,
      single: async () => {
        const [record] = applyFilters(dbState[table] ?? [], filters);
        return createSelectResponse(record);
      },
      insert: (payload) => {
        const records = Array.isArray(payload) ? payload : [payload];
        const inserted = records.map((record) => {
          const nextId = record.id || `${table}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const stored = { ...record, id: nextId };
          dbState[table] = dbState[table] || [];
          dbState[table].push(stored);
          return stored;
        });

        return {
          select: () => ({
            single: async () => createSelectResponse(inserted[0])
          }),
          then: (resolve) => resolve({ data: inserted, error: null }),
          catch: () => {}
        };
      },
      update: (values) => {
        const updateFilters = [];
        let executed = false;
        let cachedResult = null;

        const ensureResult = () => {
          if (!executed) {
            const records = applyFilters(dbState[table] ?? [], updateFilters);
            if (!records.length) {
              cachedResult = { data: null, error: { status: 404 } };
            } else {
              const updatedRecords = records.map((record) => {
                Object.assign(record, values);
                return record;
              });
              cachedResult = { data: updatedRecords, error: null };
            }
            executed = true;
          }
          return cachedResult;
        };

        const updateChain = {
          eq: (field, value) => {
            updateFilters.push({ field, value });
            return updateChain;
          },
          match: (criteria) => {
            Object.entries(criteria).forEach(([field, value]) => {
              updateFilters.push({ field, value });
            });
            return updateChain;
          },
          select: () => {
            const result = ensureResult();
            return {
              single: async () => createSelectResponse(result.data ? result.data[0] : null),
              then: (resolve) => resolve(result),
              catch: () => {}
            };
          },
          single: async () => createSelectResponse(ensureResult().data ? ensureResult().data[0] : null),
          then: (resolve) => resolve(ensureResult()),
          catch: () => {}
        };

        return updateChain;
      },
      delete: () => ({
        match: (criteria) => {
          const entries = Object.entries(criteria).map(([field, value]) => ({ field, value }));
          return {
            select: () => ({
              single: async () => {
                const tableData = dbState[table] ?? [];
                const index = tableData.findIndex((record) =>
                  entries.every(({ field, value }) => record[field] === value)
                );
                if (index === -1) {
                  return { data: null, error: { status: 404 } };
                }
                const [removed] = tableData.splice(index, 1);
                return { data: removed, error: null };
              }
            })
          };
        }
      })
    };

    return queryApi;
  };

  return {
    auth: {
      // The handler validates profile access via auth user ID, so we reuse the seeded UUID here.
      getUser: jest.fn(async () => ({ data: { user: { id: primaryUserId } }, error: null }))
    },
    from: jest.fn((table) => buildQuery(table))
  };
};
const transporterMock = { sendMail: jest.fn().mockResolvedValue({}) };

let handler;

beforeAll(async () => {
  dbState = cloneDb(baseDbState);

  const supabaseModule = await import('@supabase/supabase-js');
  const nodemailerModule = await import('nodemailer');

  supabaseModule.createClient.mockImplementation(() => createSupabaseClient());
  nodemailerModule.createTransport.mockReturnValue(transporterMock);

  ({ handler } = await import('../email-notifications.mjs'));
});

describe('email-notifications handler smoke tests', () => {
  beforeEach(() => {
    dbState = cloneDb(baseDbState);
    transporterMock.sendMail.mockClear();
  });

  test('send_notification succeeds with authenticated user acting on self', async () => {
    const event = {
      httpMethod: 'POST',
      queryStringParameters: { action: 'send_notification' },
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({
        notification_type: 'system_announcement',
        title: 'Maintenance Notice',
        message: 'Scheduled downtime tonight.'
      })
    };

    const response = await handler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.notification_id).toBeDefined();
    expect(transporterMock.sendMail).toHaveBeenCalledTimes(1);
  });

  test('mark_read updates notification status', async () => {
    const event = {
      httpMethod: 'POST',
      queryStringParameters: { action: 'mark_read' },
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ notification_id: '72b97264-2dfc-4b50-8f2d-464c2740f3f8' })
    };

    const response = await handler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.success).toBe(true);

  const updated = dbState.notifications.find((record) => record.id === '72b97264-2dfc-4b50-8f2d-464c2740f3f8');
    expect(updated?.is_read).toBe(true);
    expect(updated?.read_at).not.toBeNull();
  });

  test('unsubscribe flags notification preferences', async () => {
    const event = {
      httpMethod: 'POST',
      queryStringParameters: { action: 'unsubscribe' },
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ email_type: 'promotional' })
    };

    const response = await handler(event);
    const payload = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(dbState.users[0].notification_settings.promotional).toBe(false);
  });
});
