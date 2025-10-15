const request = require('supertest');
const express = require('express');

jest.mock('../services/AdvancedSearchService');

const router = require('../routes/advancedSearch');

describe('GET /api/search/filters metadata endpoint', () => {
  const buildApp = () => {
    const app = express();
    app.use('/api/search', router);
    return app;
  };

  test('returns curated filter metadata with expected structure', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/search/filters');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        propertyTypes: expect.any(Array),
        rentBands: expect.objectContaining({
          kaltmiete: expect.any(Array),
          warmmiete: expect.any(Array)
        }),
        furnishedOptions: expect.any(Array),
        petPolicies: expect.any(Array),
        locationFeatures: expect.any(Array),
        amenities: expect.any(Array),
        timeSlots: expect.any(Array),
        roomCounts: expect.any(Array)
      })
    });
  });

  test('property types include all required values', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const propertyTypes = response.body.data.propertyTypes;
    const values = propertyTypes.map(pt => pt.value);

    expect(values).toContain('apartment');
    expect(values).toContain('studio');
    expect(values).toContain('loft');
    expect(values).toContain('house');
    expect(values).toContain('shared_room');
    expect(values).toContain('private_room');
  });

  test('rent bands include cold and warm miete ranges', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const { kaltmiete, warmmiete } = response.body.data.rentBands;

    expect(kaltmiete.length).toBeGreaterThan(0);
    expect(warmmiete.length).toBeGreaterThan(0);

    kaltmiete.forEach(band => {
      expect(band).toHaveProperty('min');
      expect(band).toHaveProperty('max');
      expect(band).toHaveProperty('label');
      expect(band).toHaveProperty('count');
    });

    warmmiete.forEach(band => {
      expect(band).toHaveProperty('min');
      expect(band).toHaveProperty('label');
      expect(band).toHaveProperty('count');
    });
  });

  test('amenities include all spec-required values', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const amenities = response.body.data.amenities;
    const values = amenities.map(a => a.value);

    const requiredAmenities = [
      'washing_machine',
      'dryer',
      'dishwasher',
      'tv',
      'lift',
      'kitchen',
      'air_conditioning',
      'wifi',
      'heating',
      'private_bathroom',
      'wheelchair_accessible',
      'balcony',
      'terrace'
    ];

    requiredAmenities.forEach(amenity => {
      expect(values).toContain(amenity);
    });
  });

  test('furnished options include all three states', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const furnishedOptions = response.body.data.furnishedOptions;
    const values = furnishedOptions.map(opt => opt.value);

    expect(values).toContain('furnished');
    expect(values).toContain('semi_furnished');
    expect(values).toContain('unfurnished');
  });

  test('time slots include flexible and fixed options', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const timeSlots = response.body.data.timeSlots;
    const values = timeSlots.map(ts => ts.value);

    expect(values).toContain('flexible');
    expect(values).toContain('fixed');
  });

  test('location features include transport and amenities', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/search/filters');

    const locationFeatures = response.body.data.locationFeatures;
    const values = locationFeatures.map(lf => lf.value);

    expect(values).toContain('public_transport');
    expect(values).toContain('shopping');
    expect(values).toContain('schools');
    expect(values).toContain('parks');
  });
});
