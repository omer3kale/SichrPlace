const request = require('supertest');
const express = require('express');

jest.mock('../services/AdvancedSearchService', () => ({
  searchApartments: jest.fn().mockResolvedValue({
    success: true,
    data: [{ id: 'apt-001' }],
    metadata: { filters: {}, pagination: {} }
  })
}));

const AdvancedSearchService = require('../services/AdvancedSearchService');
const router = require('../routes/advancedSearch');

describe('GET /api/search/advanced parameter normalization', () => {
  const buildApp = () => {
    const app = express();
    app.use('/api/search', router);
    return app;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps German rental parameters to service search payload', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/search/advanced')
      .query({
        q: 'Berlin Mitte',
        ort: 'Berlin',
        stadtteil: 'Mitte',
        min_kaltmiete: '800',
        maxWarmmiete: '1800',
        price_type: 'WARM',
        min_rooms: '2',
        bedrooms: '1',
        bathrooms: '2',
        single_beds: '1',
        double_beds: '2',
        amenities: 'wifi,balkon',
        location_features: 'parks,shopping',
        move_in_date: '2025-01-01',
        move_out_date: '2025-07-01',
        timeslot_type: 'flexible',
        earliest_move_in: 'true',
        pets_allowed: 'no',
        exclude_exchange: '1',
        furnished_status: 'furnished',
        parking_type: 'garage',
        limit: '15',
        offset: '30',
        includeUnavailable: 'false'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ id: 'apt-001' }],
      metadata: { filters: {}, pagination: {} }
    });

    expect(AdvancedSearchService.searchApartments).toHaveBeenCalledTimes(1);
    expect(AdvancedSearchService.searchApartments).toHaveBeenCalledWith(expect.objectContaining({
      query: 'Berlin Mitte',
      city: 'Berlin',
      area: 'Mitte',
      minKaltmiete: 800,
      maxWarmmiete: 1800,
      priceType: 'WARM',
      minRooms: 2,
      bedrooms: 1,
      bathrooms: 2,
      singleBeds: 1,
      doubleBeds: 2,
      amenities: ['wifi', 'balkon'],
      locationFeatures: ['parks', 'shopping'],
      moveInDate: '2025-01-01',
      moveOutDate: '2025-07-01',
      timeSlotType: 'flexible',
      earliestMoveIn: true,
      petsAllowed: false,
      excludeExchange: true,
      furnishedStatus: 'furnished',
      parkingType: 'garage',
      limit: 15,
      offset: 30,
      includeUnavailable: false
    }));
  });

  test('defaults to safe numeric fallbacks when values missing', async () => {
    const app = buildApp();

    await request(app)
      .get('/api/search/advanced')
      .query({});

    expect(AdvancedSearchService.searchApartments).toHaveBeenCalledWith(expect.objectContaining({
      minPrice: 0,
      maxPrice: null,
      limit: 20,
      offset: 0,
      earliestMoveIn: false
    }));
  });
});
