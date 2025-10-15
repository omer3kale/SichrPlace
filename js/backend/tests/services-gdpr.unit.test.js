const mockSupabase = {
  from: jest.fn()
};

jest.mock('../config/supabase', () => ({
  supabase: mockSupabase,
  supabasePublic: mockSupabase
}));

const { FeedbackService, GdprService } = require('../services/GdprService');

const createChain = (payload, overrides = {}) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(payload),
    maybeSingle: jest.fn().mockResolvedValue(payload),
    then: (resolve) => Promise.resolve().then(() => resolve(payload))
  };

  return Object.assign(chain, overrides);
};

describe('GdprService (unit)', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
  });

  test('getDataBreaches returns records with filters applied', async () => {
    const result = { data: [{ id: 'breach-1' }], error: null };
    const chain = createChain(result);
    mockSupabase.from.mockReturnValueOnce(chain);

    const data = await GdprService.getDataBreaches({ severity: 'high', status: 'open' });

    expect(mockSupabase.from).toHaveBeenCalledWith('data_breaches');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'severity', 'high');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'status', 'open');
    expect(data).toEqual(result.data);
  });

  test('createDPIA inserts record and returns created entity', async () => {
    const dpiaData = { project: 'New Feature' };
    const result = { data: { id: 'dpia-1', project: 'New Feature' }, error: null };
    const chain = createChain(result);
    mockSupabase.from.mockReturnValueOnce(chain);

    const created = await GdprService.createDPIA(dpiaData);

    expect(mockSupabase.from).toHaveBeenCalledWith('dpias');
    expect(chain.insert).toHaveBeenCalledWith([dpiaData]);
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(created).toEqual(result.data);
  });

  test('getDataProcessingLogs respects filters', async () => {
    const result = { data: [{ id: 'log-1' }], error: null };
    const chain = createChain(result);
    mockSupabase.from.mockReturnValueOnce(chain);

    const data = await GdprService.getDataProcessingLogs({ user_id: 'user-1', action: 'export' });

    expect(mockSupabase.from).toHaveBeenCalledWith('data_processing_logs');
    expect(chain.limit).toHaveBeenCalledWith(1000);
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'action', 'export');
    expect(data).toEqual(result.data);
  });

  test('exportUserData aggregates user data using maybeSingle', async () => {
    const profileResult = { data: { id: 'user-123' }, error: null };
    const userQuery = createChain(profileResult);
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return userQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const consentsSpy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue([{ id: 'consent-1' }]);
    const requestsSpy = jest.spyOn(GdprService, 'getRequests').mockResolvedValue([{ id: 'req-1' }]);
    const logsSpy = jest.spyOn(GdprService, 'getProcessingLogs').mockResolvedValue([{ id: 'log-1' }]);

    const result = await GdprService.exportUserData({ userId: 'user-123' });

    expect(userQuery.select).toHaveBeenCalledWith('*');
    expect(userQuery.eq).toHaveBeenCalledWith('id', 'user-123');
    expect(userQuery.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      profile: { id: 'user-123' },
      consents: [{ id: 'consent-1' }],
      requests: [{ id: 'req-1' }],
      processingLogs: [{ id: 'log-1' }]
    });

    consentsSpy.mockRestore();
    requestsSpy.mockRestore();
    logsSpy.mockRestore();
  });

  test('exportUserData falls back to single when maybeSingle is unavailable', async () => {
    const profileResult = { data: { id: 'user-999' }, error: null };
    const userQuery = createChain(profileResult, { maybeSingle: undefined });
    userQuery.single = jest.fn().mockResolvedValue(profileResult);

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return userQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const consentsSpy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue([]);
    const requestsSpy = jest.spyOn(GdprService, 'getRequests').mockResolvedValue([]);
    const logsSpy = jest.spyOn(GdprService, 'getProcessingLogs').mockResolvedValue([]);

    const result = await GdprService.exportUserData({ userId: 'user-999' });

    expect(userQuery.single).toHaveBeenCalledTimes(1);
    expect(result.profile).toEqual({ id: 'user-999' });
    expect(result.consents).toEqual([]);

    consentsSpy.mockRestore();
    requestsSpy.mockRestore();
    logsSpy.mockRestore();
  });

  test('exportUserData throws when profile query returns unexpected error', async () => {
  const profileResult = { data: null, error: { code: 'OTHER', message: 'failure' } };
  const userQuery = createChain(profileResult);
    mockSupabase.from.mockReturnValueOnce(userQuery);

    await expect(GdprService.exportUserData({ userId: 'user-000' })).rejects.toEqual(profileResult.error);
  });

  test('exportUserData returns empty collections when profile missing', async () => {
    const profileResult = { data: null, error: { code: 'PGRST116' } };
    const userQuery = createChain(profileResult);
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return userQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const consentsSpy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue(null);
    const requestsSpy = jest.spyOn(GdprService, 'getRequests').mockResolvedValue(null);
    const logsSpy = jest.spyOn(GdprService, 'getProcessingLogs').mockResolvedValue(null);

    const result = await GdprService.exportUserData({ userId: 'user-321' });

    expect(result.profile).toBeNull();
    expect(result.consents).toEqual([]);
    expect(result.requests).toEqual([]);
    expect(result.processingLogs).toEqual([]);

    consentsSpy.mockRestore();
    requestsSpy.mockRestore();
    logsSpy.mockRestore();
  });

  test('createGdprRequest proxies to createRequest', async () => {
    const spy = jest.spyOn(GdprService, 'createRequest').mockResolvedValue({ id: 'req-123' });
    const payload = { request_type: 'access' };

    const result = await GdprService.createGdprRequest(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ id: 'req-123' });
    spy.mockRestore();
  });

  test('recordConsent proxies to createConsent', async () => {
    const spy = jest.spyOn(GdprService, 'createConsent').mockResolvedValue({ id: 'consent-1' });
    const payload = { user_id: 'user-1' };

    const result = await GdprService.recordConsent(payload);

    expect(spy).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ id: 'consent-1' });
    spy.mockRestore();
  });

  test('findExistingRequest returns existing data', async () => {
    const payload = { data: { id: 'req-1' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.findExistingRequest('user-1', 'access');

    expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_requests');
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'request_type', 'access');
    expect(chain.in).toHaveBeenCalledWith('status', ['pending', 'processing']);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('findExistingRequest ignores missing-table error', async () => {
    const payload = { data: null, error: { code: 'PGRST116' } };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.findExistingRequest('user-1', 'access');

    expect(result).toBeNull();
  });

  test('findExistingRequest rethrows unexpected errors', async () => {
    const payload = { data: null, error: { code: 'OTHER', message: 'fail' } };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    await expect(GdprService.findExistingRequest('user-1', 'access')).rejects.toEqual(payload.error);
  });

  test('createRequest inserts and returns request with relations', async () => {
    const payload = { data: { id: 'req-123' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const body = { user_id: 'user-1', request_type: 'access' };
    const result = await GdprService.createRequest(body);

    expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_requests');
    expect(chain.insert).toHaveBeenCalledWith([body]);
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('user:users'));
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('getRequests applies filters and ordering', async () => {
    const payload = { data: [{ id: 'req-1' }], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.getRequests({ userId: 'user-1', status: 'pending', requestType: 'access' });

    expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_requests');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(chain.eq).toHaveBeenNthCalledWith(3, 'request_type', 'access');
    expect(result).toEqual(payload.data);
  });

  test('updateRequestStatus persists status changes and timestamps', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const payload = { data: { id: 'req-1', status: 'completed' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.updateRequestStatus('req-1', 'completed', 'done');

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', notes: 'done', completed_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'req-1');
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);

    jest.useRealTimers();
  });

  test('logDataProcessing writes audit entry', async () => {
    const payload = { data: { id: 'log-123' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const log = { action: 'export', user_id: 'user-1' };
    const result = await GdprService.logDataProcessing(log);

    expect(mockSupabase.from).toHaveBeenCalledWith('data_processing_logs');
    expect(chain.insert).toHaveBeenCalledWith([log]);
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('getProcessingLogs applies filters and limits', async () => {
    const payload = { data: [{ id: 'log-1' }], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.getProcessingLogs({ userId: 'user-1', action: 'export', limit: 10 });

    expect(mockSupabase.from).toHaveBeenCalledWith('data_processing_logs');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'action', 'export');
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(payload.data);
  });

  test('getProcessingLogs throws when query returns error', async () => {
    const payload = { data: null, error: new Error('query failed') };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    await expect(GdprService.getProcessingLogs()).rejects.toThrow('query failed');
  });

  test('createConsent inserts new consent when none exists', async () => {
    const existingChain = createChain({ data: null, error: null });
    const insertChain = createChain({ data: { id: 'consent-1' }, error: null });
    mockSupabase.from
      .mockReturnValueOnce(existingChain)
      .mockReturnValueOnce(insertChain);

    const payload = { user_id: 'user-1', purpose_id: 'analytics', granted: true };
    const result = await GdprService.createConsent(payload);

    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'consents');
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'consents');
    expect(insertChain.insert).toHaveBeenCalledWith([payload]);
    expect(result).toEqual({ id: 'consent-1' });
  });

  test('createConsent updates existing consent when found', async () => {
    const existing = { id: 'consent-1', granted_at: '2024-01-01T00:00:00Z' };
    const existingChain = createChain({ data: existing, error: null });
    mockSupabase.from.mockReturnValueOnce(existingChain);

    const updateSpy = jest.spyOn(GdprService, 'updateConsent').mockResolvedValue({ id: 'consent-1' });

    const payload = { user_id: 'user-1', purpose_id: 'analytics', granted: false };
    const result = await GdprService.createConsent(payload);

    expect(updateSpy).toHaveBeenCalledWith('consent-1', expect.objectContaining({ granted: false }));
    expect(result).toEqual({ id: 'consent-1' });

    updateSpy.mockRestore();
  });

  test('createConsent reset timestamps when re-granting consent', async () => {
    const existing = {
      id: 'consent-2',
      granted_at: '2024-01-01T00:00:00Z',
      withdrawn_at: '2024-02-01T00:00:00Z'
    };
    const existingChain = createChain({ data: existing, error: null });
    mockSupabase.from.mockReturnValueOnce(existingChain);

    const updateSpy = jest.spyOn(GdprService, 'updateConsent').mockResolvedValue({ id: 'consent-2' });

    const payload = { user_id: 'user-1', purpose_id: 'analytics', granted: true };
    const result = await GdprService.createConsent(payload);

    expect(updateSpy).toHaveBeenCalledWith(
      'consent-2',
      expect.objectContaining({ granted: true, withdrawn_at: null })
    );
    expect(result).toEqual({ id: 'consent-2' });

    updateSpy.mockRestore();
  });

  test('updateConsent updates row and returns result', async () => {
    const payload = { data: { id: 'consent-1', granted: true }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const updates = { granted: true };
    const result = await GdprService.updateConsent('consent-1', updates);

    expect(mockSupabase.from).toHaveBeenCalledWith('consents');
    expect(chain.update).toHaveBeenCalledWith(updates);
    expect(chain.eq).toHaveBeenCalledWith('id', 'consent-1');
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('getUserConsents fetches joined consent data', async () => {
    const payload = { data: [{ id: 'consent-1' }], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.getUserConsents('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('consents');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual(payload.data);
  });

  test('getUserConsent aggregates consent metadata', async () => {
    const consentRecords = [
      {
        id: 'c1',
        purpose: { name: 'analytics' },
        granted: true,
        granted_at: '2025-01-01T00:00:00Z',
        withdrawn_at: null,
        privacy_policy_version: '1.0',
        terms_version: '2.0',
        created_at: '2025-01-01T00:00:00Z'
      },
      {
        id: 'c2',
        purpose_id: 'marketing',
        granted: false,
        granted_at: null,
        withdrawal_timestamp: '2025-02-01T00:00:00Z'
      }
    ];

    const spy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue(consentRecords);

    const result = await GdprService.getUserConsent('user-1');

    expect(result).toEqual({
      consentTypes: {
        analytics: {
          granted: true,
          granted_at: '2025-01-01T00:00:00Z',
          withdrawn_at: null
        },
        marketing: {
          granted: false,
          granted_at: null,
          withdrawn_at: '2025-02-01T00:00:00Z'
        }
      },
      privacyPolicyVersion: '1.0',
      termsVersion: '2.0',
      createdAt: '2025-01-01T00:00:00Z'
    });

    spy.mockRestore();
  });

  test('getUserConsent returns null when no consent records', async () => {
    const spy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue([]);

    const result = await GdprService.getUserConsent('user-1');

    expect(result).toBeNull();

    spy.mockRestore();
  });

  test('getUserConsent falls back to first record when timestamps missing', async () => {
    const consentRecords = [
      {
        id: 'c1',
        purpose: { name: 'analytics' },
        granted: true,
        granted_at: null,
        created_at: '2025-03-01T00:00:00Z'
      },
      {
        id: 'c2',
        purpose_id: 'marketing',
        granted: true,
        granted_at: null,
        created_at: '2025-03-02T00:00:00Z'
      }
    ];

    const spy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue(consentRecords);

    const result = await GdprService.getUserConsent('user-2');

    expect(result.createdAt).toBe('2025-03-01T00:00:00Z');
    expect(result.privacyPolicyVersion).toBeNull();

    spy.mockRestore();
  });

  test('getUserConsent uses legacy keys when purpose metadata missing', async () => {
    const consentRecords = [
      {
        id: 'legacy-consent',
        purpose: 'legacyPurpose',
        granted: true,
        granted_at: '2025-04-01T00:00:00Z'
      },
      {
        id: 'fallback-consent',
        granted: false,
        granted_at: null
      }
    ];

    const spy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue(consentRecords);

    const result = await GdprService.getUserConsent('user-legacy');

    expect(result.consentTypes).toHaveProperty('legacyPurpose');
    expect(result.consentTypes).toHaveProperty('fallback-consent');

    spy.mockRestore();
  });

  test('getUserConsent returns null createdAt when timestamps unavailable', async () => {
    const consentRecords = [
      {
        id: 'no-timestamp-consent',
        granted: true,
        granted_at: null
      }
    ];

    const spy = jest.spyOn(GdprService, 'getUserConsents').mockResolvedValue(consentRecords);

    const result = await GdprService.getUserConsent('user-no-ts');

    expect(result.createdAt).toBeNull();

    spy.mockRestore();
  });

  test('getConsentPurposes supports pagination window', async () => {
    const payload = { data: [{ id: 'purpose-1' }], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await GdprService.getConsentPurposes({ skip: 5, limit: 10 });

    expect(mockSupabase.from).toHaveBeenCalledWith('consent_purposes');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.range).toHaveBeenCalledWith(5, 14);
    expect(result).toEqual(payload.data);
  });

  test('countConsentPurposes returns total count', async () => {
    const payload = { count: 3, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const count = await GdprService.countConsentPurposes();

    expect(chain.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(count).toBe(3);
  });

  test('getConsentStatistics summarises per-purpose totals', async () => {
    const payload = {
      data: [
        { purpose: 'analytics', consented: true },
        { purpose: 'analytics', consented: false, withdrawal_timestamp: '2025-01-02T00:00:00Z' },
        { purpose: 'analytics', consented: false, expiry_date: '2020-01-01T00:00:00Z' },
        { purpose: 'marketing', consented: true }
      ],
      error: null
    };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const stats = await GdprService.getConsentStatistics();

    expect(stats).toEqual([
      {
        _id: 'analytics',
        total: 3,
        consented: 1,
        withdrawn: 1,
        expired: 1
      },
      {
        _id: 'marketing',
        total: 1,
        consented: 1,
        withdrawn: 0,
        expired: 0
      }
    ]);
  });

  test('updateConsentPurpose updates a consent purpose record', async () => {
    const payload = { data: { id: 'purpose-1', name: 'Updated' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const updates = { name: 'Updated' };
    const result = await GdprService.updateConsentPurpose('purpose-1', updates);

    expect(mockSupabase.from).toHaveBeenCalledWith('consent_purposes');
    expect(chain.update).toHaveBeenCalledWith(updates);
    expect(chain.eq).toHaveBeenCalledWith('id', 'purpose-1');
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });
});

describe('FeedbackService', () => {
  beforeEach(() => {
    mockSupabase.from.mockReset();
  });

  test('create inserts feedback with user join', async () => {
    const payload = { data: { id: 'fb-1' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const feedback = { message: 'Great app' };
    const result = await FeedbackService.create(feedback);

    expect(mockSupabase.from).toHaveBeenCalledWith('feedback');
    expect(chain.insert).toHaveBeenCalledWith([feedback]);
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('user:users'));
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('create throws when supabase returns error', async () => {
    const payload = { data: null, error: new Error('insert failed') };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    await expect(FeedbackService.create({ message: 'boom' })).rejects.toThrow('insert failed');
  });

  test('findById retrieves feedback with user relation', async () => {
    const payload = { data: { id: 'fb-2' }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await FeedbackService.findById('fb-2');

    expect(chain.eq).toHaveBeenCalledWith('id', 'fb-2');
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('list applies filters, sorting and pagination', async () => {
    const payload = { data: [{ id: 'fb-3' }], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const options = {
      category: 'bug',
      rating: 5,
      resolved: true,
      userId: 'user-1',
      limit: 2,
      offset: 5
    };

    const result = await FeedbackService.list(options);

    expect(chain.eq).toHaveBeenNthCalledWith(1, 'category', 'bug');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'rating', 5);
    expect(chain.eq).toHaveBeenNthCalledWith(3, 'resolved', true);
    expect(chain.eq).toHaveBeenNthCalledWith(4, 'user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(chain.range).toHaveBeenCalledWith(5, 6);
    expect(result).toEqual(payload.data);
  });

  test('list omits pagination when offset and limit missing', async () => {
    const payload = { data: [{ id: 'fb-3' }], error: null };
    const chain = createChain(payload);
    chain.limit = jest.fn().mockReturnThis();
    chain.range = jest.fn().mockReturnThis();
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await FeedbackService.list({});

    expect(chain.limit).not.toHaveBeenCalled();
    expect(chain.range).not.toHaveBeenCalled();
    expect(result).toEqual(payload.data);
  });

  test('list uses default window when offset provided without limit', async () => {
    const payload = { data: [{ id: 'fb-7' }], error: null };
    const chain = createChain(payload);
    chain.limit = jest.fn().mockReturnThis();
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await FeedbackService.list({ offset: 3 });

    expect(chain.limit).not.toHaveBeenCalled();
    expect(chain.range).toHaveBeenCalledWith(3, 12);
    expect(result).toEqual(payload.data);
  });

  test('update modifies feedback entry', async () => {
    const payload = { data: { id: 'fb-4', resolved: true }, error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const updates = { resolved: true };
    const result = await FeedbackService.update('fb-4', updates);

    expect(chain.update).toHaveBeenCalledWith(updates);
    expect(chain.eq).toHaveBeenCalledWith('id', 'fb-4');
    expect(chain.select).toHaveBeenCalledTimes(1);
    expect(chain.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(payload.data);
  });

  test('markResolved delegates to update', async () => {
    const spy = jest.spyOn(FeedbackService, 'update').mockResolvedValue({ id: 'fb-5', resolved: true });

    const result = await FeedbackService.markResolved('fb-5', false);

    expect(spy).toHaveBeenCalledWith('fb-5', { resolved: false });
    expect(result).toEqual({ id: 'fb-5', resolved: true });

    spy.mockRestore();
  });

  test('delete removes feedback entry', async () => {
    const payload = { error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await FeedbackService.delete('fb-6');

    expect(chain.delete).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith('id', 'fb-6');
    expect(result).toBe(true);
  });

  test('getStatistics returns aggregated metrics', async () => {
    const payload = {
      data: [
        { rating: 5, resolved: true, category: 'bug' },
        { rating: 4, resolved: false, category: 'feature' },
        { rating: null, resolved: false, category: 'feature' },
        { rating: 3, resolved: false }
      ],
      error: null
    };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const stats = await FeedbackService.getStatistics();

  expect(stats.total).toBe(4);
  expect(stats.resolved).toBe(1);
  expect(stats.unresolved).toBe(3);
  expect(stats.averageRating).toBe('4.00');
  expect(stats.byCategory).toEqual({ bug: 1, feature: 2, general: 1 });
    expect(stats.byRating['5']).toBe(1);
  });

  test('getStatistics handles empty dataset', async () => {
    const payload = { data: [], error: null };
    const chain = createChain(payload);
    mockSupabase.from.mockReturnValueOnce(chain);

    const stats = await FeedbackService.getStatistics();

    expect(stats.total).toBe(0);
    expect(stats.averageRating).toBe(0);
    expect(stats.byCategory).toEqual({});
  });
});
