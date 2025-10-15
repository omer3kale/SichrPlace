const SmartMatchingService = require('../services/SmartMatchingService');

describe('SmartMatchingService', () => {
  beforeEach(() => {
    SmartMatchingService.__setSupabaseClient(null);
  });

  test('getTenantMatches returns fallback data when Supabase is unavailable', async () => {
    const result = await SmartMatchingService.getTenantMatches('tenant-123');

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.preferenceFallback).toBe(true);
  });

  test('scoreApartmentForTenant rewards aligned budget and city', () => {
    const preferences = SmartMatchingService.__internals.normaliseTenantPreferences({
      budget_min: 900,
      budget_max: 1500,
      preferences: {
        cities: ['Berlin'],
        amenities: ['balcony', 'internet']
      }
    });

    const apartment = {
      id: 'apt-1',
      price: 1200,
      city: 'Berlin',
      postal_code: '10115',
      rooms: 2,
      amenities: ['balcony', 'elevator'],
      pet_friendly: true,
      furnished: true,
      latitude: 52.52,
      longitude: 13.405,
      available_from: new Date().toISOString()
    };

    const result = SmartMatchingService.__internals.scoreApartmentForTenant(apartment, preferences);

    expect(result.scorePercent).toBeGreaterThan(60);
    expect(result.disqualifiers).toHaveLength(0);
    expect(result.matchedAmenities).toContain('balcony');
  });

  test('calculateDistanceKm handles valid coordinates', () => {
    const distance = SmartMatchingService.__internals.calculateDistanceKm(
      { lat: 52.52, lon: 13.405 },
      { lat: 48.137, lon: 11.575 }
    );

    expect(distance).toBeGreaterThan(480);
    expect(distance).toBeLessThan(510);
  });
});
