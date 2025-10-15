jest.mock('../config/supabase', () => {
  const createBuilder = (rows = [], operations = []) => {
    const builder = {
      select: jest.fn(function select(columns) {
        operations.push({ type: 'select', columns });
        return this;
      }),
      eq: jest.fn(function eq(field, value) {
        operations.push({ type: 'eq', field, value });
        return this;
      }),
      neq: jest.fn(function neq(field, value) {
        operations.push({ type: 'neq', field, value });
        return this;
      }),
      gte: jest.fn(function gte(field, value) {
        operations.push({ type: 'gte', field, value });
        return this;
      }),
      lte: jest.fn(function lte(field, value) {
        operations.push({ type: 'lte', field, value });
        return this;
      }),
      ilike: jest.fn(function ilike(field, value) {
        operations.push({ type: 'ilike', field, value });
        return this;
      }),
      contains: jest.fn(function contains(field, value) {
        operations.push({ type: 'contains', field, value });
        return this;
      }),
      or: jest.fn(function or(condition) {
        operations.push({ type: 'or', condition });
        return this;
      }),
      order: jest.fn(function order(field, options) {
        operations.push({ type: 'order', field, options });
        return this;
      }),
      range: jest.fn(function range(start, end) {
        operations.push({ type: 'range', start, end });
        return this;
      })
    };

    const executeResult = { data: rows, error: null, count: rows.length };

    builder.then = function then(resolve, reject) {
      return Promise.resolve(executeResult).then(resolve, reject);
    };

    return builder;
  };

  const mockSupabase = {
    __nextRows: [],
    __operations: [],
    __lastBuilder: null,
    from: jest.fn(() => {
      mockSupabase.__operations = [];
      const builder = createBuilder(mockSupabase.__nextRows, mockSupabase.__operations);
      mockSupabase.__lastBuilder = builder;
      return builder;
    }),
    __setQueryResult(rows) {
      mockSupabase.__nextRows = rows;
    },
    __getOperations() {
      return [...mockSupabase.__operations];
    },
    __getLastBuilder() {
      return mockSupabase.__lastBuilder;
    },
    __reset() {
      mockSupabase.__nextRows = [];
      mockSupabase.__operations = [];
      mockSupabase.__lastBuilder = null;
    }
  };

  return { supabase: mockSupabase };
});

const { supabase } = require('../config/supabase');
const AdvancedSearchService = require('../services/AdvancedSearchService');

const sampleApartments = [
  {
    id: 'apt-001',
    title: 'Modern flat in Berlin',
    ort: 'Berlin',
    stadtteil: 'Mitte',
    kaltmiete: 950,
    warmmiete: 1250,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    single_beds: 1,
    double_beds: 1,
    amenities: ['wifi', 'balcony'],
    available_from: '2025-02-01',
    created_at: '2024-12-01T10:00:00Z'
  }
];

describe('AdvancedSearchService German rental filters', () => {
  beforeEach(() => {
    supabase.__reset();
    supabase.__setQueryResult(sampleApartments);
  });

  test('applies kaltmiete band, amenities, and earliest move-in sorting', async () => {
    const result = await AdvancedSearchService.searchApartments({
      city: 'Berlin',
      minKaltmiete: 850,
      maxKaltmiete: 1300,
      priceType: 'kalt',
      amenities: ['wifi', 'balcony'],
      earliestMoveIn: true,
      minRooms: 2,
      bedrooms: 2,
      bathrooms: 1,
      limit: 5
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.metadata.filters.priceRange).toMatchObject({
      minKaltmiete: 850,
      maxKaltmiete: 1300,
      priceType: 'kalt'
    });
    expect(result.metadata.filters.amenities).toEqual(['wifi', 'balcony']);
    expect(result.metadata.pagination).toMatchObject({ limit: 5, offset: 0, hasMore: false });

    const operations = supabase.__getOperations();

    expect(operations).toEqual(expect.arrayContaining([
      { type: 'eq', field: 'status', value: 'available' },
      { type: 'ilike', field: 'ort', value: '%Berlin%' },
      { type: 'gte', field: 'kaltmiete', value: 850 },
      { type: 'lte', field: 'kaltmiete', value: 1300 },
      { type: 'gte', field: 'rooms', value: 2 },
      { type: 'gte', field: 'bedrooms', value: 2 },
      { type: 'gte', field: 'bathrooms', value: 1 },
      { type: 'contains', field: 'amenities', value: ['wifi'] },
      { type: 'contains', field: 'amenities', value: ['balcony'] },
      { type: 'order', field: 'available_from', options: { ascending: true } },
      { type: 'range', start: 0, end: 4 }
    ]));
  });

  test('applies warmmiete sorting and pagination offsets', async () => {
    const result = await AdvancedSearchService.searchApartments({
      location: 'Hamburg',
      priceType: 'warm',
      minWarmmiete: 1100,
      maxWarmmiete: 2000,
      sortBy: 'price',
      sortOrder: 'asc',
      offset: 10,
      limit: 10,
      includeUnavailable: true
    });

    expect(result.success).toBe(true);
    expect(result.metadata.filters.priceRange).toMatchObject({
      minWarmmiete: 1100,
      maxWarmmiete: 2000,
      priceType: 'warm'
    });
    expect(result.metadata.pagination).toMatchObject({ limit: 10, offset: 10 });

    const operations = supabase.__getOperations();

    expect(operations).toEqual(expect.arrayContaining([
      { type: 'ilike', field: 'location', value: '%Hamburg%' },
      { type: 'gte', field: 'warmmiete', value: 1100 },
      { type: 'lte', field: 'warmmiete', value: 2000 },
      { type: 'order', field: 'warmmiete', options: { ascending: true } },
      { type: 'range', start: 10, end: 19 }
    ]));

    // Ensure we did not filter out unavailable listings when includeUnavailable is true
    expect(operations).not.toEqual(expect.arrayContaining([
      { type: 'eq', field: 'status', value: 'available' }
    ]));
  });

  test('normalizes unsupported priceType to both and falls back to generic price range', async () => {
    const result = await AdvancedSearchService.searchApartments({
      query: 'Cologne',
      priceType: 'invalid',
      minPrice: 700,
      maxPrice: 1400,
      limit: 2
    });

    expect(result.success).toBe(true);
    expect(result.metadata.filters.priceRange.priceType).toBe('both');
    expect(result.metadata.filters.priceRange.minPrice).toBe(700);
    expect(result.metadata.filters.priceRange.maxPrice).toBe(1400);

    const operations = supabase.__getOperations();
    expect(operations).toEqual(expect.arrayContaining([
      { type: 'or', condition: expect.stringContaining('title.ilike.%Cologne%') },
      { type: 'gte', field: 'price', value: 700 },
      { type: 'lte', field: 'price', value: 1400 }
    ]));
  });
});
