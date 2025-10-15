const express = require('express');
const router = express.Router();
const AdvancedSearchService = require('../services/AdvancedSearchService');
const auth = require('../middleware/auth');

const pickQueryValue = (query, keys, defaultValue = undefined) => {
  for (const key of keys) {
    if (query[key] !== undefined) {
      return query[key];
    }
  }
  return defaultValue;
};

const parseFloatParam = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseIntParam = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBooleanParam = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return null;
};

/**
 * @route   GET /api/search/advanced
 * @desc    Advanced apartment search with comprehensive filtering
 * @access  Public (enhanced features for authenticated users)
 */
router.get('/advanced', async (req, res) => {
  try {
    const searchParams = {
      query: req.query.q || req.query.query || '',
      location: req.query.location || '',
      city: pickQueryValue(req.query, ['city', 'ort'], ''),
      area: pickQueryValue(req.query, ['area', 'district', 'stadtteil'], ''),
  minPrice: parseFloatParam(pickQueryValue(req.query, ['minPrice'])) ?? 0,
  maxPrice: parseFloatParam(pickQueryValue(req.query, ['maxPrice'])),
      minKaltmiete: parseFloatParam(pickQueryValue(req.query, ['minKaltmiete', 'min_kaltmiete'])),
      maxKaltmiete: parseFloatParam(pickQueryValue(req.query, ['maxKaltmiete', 'max_kaltmiete'])),
      minWarmmiete: parseFloatParam(pickQueryValue(req.query, ['minWarmmiete', 'min_warmmiete'])),
      maxWarmmiete: parseFloatParam(pickQueryValue(req.query, ['maxWarmmiete', 'max_warmmiete'])),
      priceType: pickQueryValue(req.query, ['priceType', 'price_type'], 'both'),
      minRooms: parseIntParam(pickQueryValue(req.query, ['minRooms', 'min_rooms'])),
      maxRooms: parseIntParam(pickQueryValue(req.query, ['maxRooms', 'max_rooms'])),
      rooms: parseIntParam(pickQueryValue(req.query, ['rooms'])),
      bedrooms: parseIntParam(req.query.bedrooms),
      bathrooms: parseIntParam(req.query.bathrooms),
      singleBeds: parseIntParam(pickQueryValue(req.query, ['singleBeds', 'single_beds'])),
      doubleBeds: parseIntParam(pickQueryValue(req.query, ['doubleBeds', 'double_beds'])),
      minSize: parseFloatParam(pickQueryValue(req.query, ['minSize', 'min_area', 'minWohnflaeche'])),
      maxSize: parseFloatParam(pickQueryValue(req.query, ['maxSize', 'max_area', 'maxWohnflaeche'])),
      propertyType: req.query.propertyType || req.query.property_type || '',
      amenities: req.query.amenities ? req.query.amenities.split(',') : [],
      locationFeatures: pickQueryValue(req.query, ['locationFeatures', 'location_features'])
        ? pickQueryValue(req.query, ['locationFeatures', 'location_features']).split(',')
        : [],
      moveInDate: req.query.moveInDate || req.query.move_in_date || null,
      moveOutDate: req.query.moveOutDate || req.query.move_out_date || null,
      timeSlotType: pickQueryValue(req.query, ['timeSlotType', 'timeslot_type'], ''),
      earliestMoveIn: parseBooleanParam(pickQueryValue(req.query, ['earliestMoveIn', 'earliest_move_in'])) || false,
      furnishedStatus: pickQueryValue(req.query, ['furnishedStatus', 'furnished_status', 'furnished'], ''),
      petsAllowed: parseBooleanParam(pickQueryValue(req.query, ['petsAllowed', 'pets_allowed'])),
      excludeExchange: parseBooleanParam(pickQueryValue(req.query, ['excludeExchange', 'exclude_exchange'])) || false,
      parkingType: pickQueryValue(req.query, ['parkingType', 'parking_type'], ''),
      keywords: pickQueryValue(req.query, ['keywords', 'searchTerm'], ''),
      sortBy: req.query.sortBy || req.query.sort_by || 'created_at',
      sortOrder: req.query.sortOrder || req.query.sort_order || 'desc',
  limit: parseIntParam(req.query.limit) ?? 20,
  offset: parseIntParam(req.query.offset) ?? 0,
      userId: req.user ? req.user.id : null,
  includeUnavailable: parseBooleanParam(req.query.includeUnavailable) || false
    };

    const results = await AdvancedSearchService.searchApartments(searchParams);

    res.json(results);

  } catch (error) {
    console.error('Advanced search API error:', error);
    res.status(500).json({
      success: false,
      error: 'Advanced search failed',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search autocomplete suggestions
 * @access  Public
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Query must be at least 2 characters'
      });
    }

    const suggestions = await AdvancedSearchService.getSearchSuggestions(
      query, 
      parseInt(limit)
    );

    res.json(suggestions);

  } catch (error) {
    console.error('Search suggestions API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/search/popular
 * @desc    Get popular search terms
 * @access  Public
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const popularSearches = await AdvancedSearchService.getPopularSearches(
      parseInt(limit)
    );

    res.json(popularSearches);

  } catch (error) {
    console.error('Popular searches API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular searches',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/search/save-alert
 * @desc    Save a search alert for notifications
 * @access  Private
 */
router.post('/save-alert', auth, async (req, res) => {
  try {
    const {
      name,
      query,
      filters = {},
      emailNotifications = true,
      smsNotifications = false
    } = req.body;

    if (!name || !query) {
      return res.status(400).json({
        success: false,
        error: 'Name and query are required'
      });
    }

    const alertData = {
      userId: req.user.id,
      name,
      query,
      filters,
      emailNotifications,
      smsNotifications
    };

    const result = await AdvancedSearchService.saveSearchAlert(alertData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Save search alert API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save search alert',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/search/analytics
 * @desc    Get search analytics and performance data
 * @access  Private (Admin only for detailed analytics)
 */
router.get('/analytics', auth, async (req, res) => {
  try {
    // For now, allow all authenticated users to see basic analytics
    // In production, this might be restricted to admins
    const {
      startDate,
      endDate,
      userId
    } = req.query;

    const analyticsParams = {
      startDate,
      endDate,
      userId: userId || req.user.id
    };

    const analytics = await AdvancedSearchService.getSearchAnalytics(analyticsParams);

    res.json(analytics);

  } catch (error) {
    console.error('Search analytics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search analytics',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/search/filters
 * @desc    Get available filter options and their values
 * @access  Public
 */
router.get('/filters', async (req, res) => {
  try {
    // Return available filter options
    const filterOptions = {
      propertyTypes: [
        { value: 'apartment', label: 'Apartment', count: 45 },
        { value: 'studio', label: 'Studio', count: 32 },
        { value: 'loft', label: 'Loft', count: 14 },
        { value: 'house', label: 'House', count: 19 },
        { value: 'shared_room', label: 'Shared Room', count: 28 },
        { value: 'private_room', label: 'Private Room', count: 18 }
      ],
      rentBands: {
        kaltmiete: [
          { min: 0, max: 600, label: 'Budget (bis €600)', count: 22 },
          { min: 600, max: 1000, label: 'Mid-range (€600 - €1.000)', count: 48 },
          { min: 1000, max: 1600, label: 'Premium (€1.000 - €1.600)', count: 26 },
          { min: 1600, max: null, label: 'Luxury (ab €1.600)', count: 11 }
        ],
        warmmiete: [
          { min: 0, max: 900, label: 'Budget (bis €900)', count: 19 },
          { min: 900, max: 1400, label: 'Mid-range (€900 - €1.400)', count: 37 },
          { min: 1400, max: 2200, label: 'Premium (€1.400 - €2.200)', count: 21 },
          { min: 2200, max: null, label: 'Luxury (ab €2.200)', count: 8 }
        ]
      },
      furnishedOptions: [
        { value: 'furnished', label: 'Fully furnished', count: 33 },
        { value: 'semi_furnished', label: 'Partially furnished', count: 18 },
        { value: 'unfurnished', label: 'Unfurnished', count: 53 }
      ],
      petPolicies: [
        { value: 'allowed', label: 'Pets allowed', count: 42 },
        { value: 'not_allowed', label: 'Pets not allowed', count: 31 },
        { value: 'on_request', label: 'Pets on request', count: 12 }
      ],
      locationFeatures: [
        { value: 'public_transport', label: 'Near public transport', count: 64 },
        { value: 'shopping', label: 'Near shopping', count: 51 },
        { value: 'schools', label: 'Near schools', count: 33 },
        { value: 'restaurants', label: 'Near restaurants', count: 46 },
        { value: 'parks', label: 'Close to parks', count: 39 },
        { value: 'city_center', label: 'City center', count: 28 }
      ],
      amenities: [
        { value: 'wifi', label: 'WiFi', count: 95 },
        { value: 'heating', label: 'Heating', count: 88 },
        { value: 'air_conditioning', label: 'Air conditioning', count: 21 },
        { value: 'washing_machine', label: 'Washing machine', count: 78 },
        { value: 'dryer', label: 'Dryer', count: 55 },
        { value: 'dishwasher', label: 'Dishwasher', count: 65 },
        { value: 'tv', label: 'TV', count: 43 },
        { value: 'kitchen', label: 'Full kitchen', count: 81 },
        { value: 'private_bathroom', label: 'Private bathroom', count: 72 },
        { value: 'wheelchair_accessible', label: 'Wheelchair accessible', count: 17 },
        { value: 'lift', label: 'Elevator', count: 42 },
        { value: 'balcony', label: 'Balcony', count: 52 },
        { value: 'terrace', label: 'Terrace', count: 29 }
      ],
      timeSlots: [
        { value: 'flexible', label: 'Flexible availability', count: 37 },
        { value: 'fixed', label: 'Fixed timeslots', count: 24 }
      ],
      roomCounts: [
        { value: 1, label: '1 Room studio', count: 45 },
        { value: 2, label: '2 Rooms', count: 38 },
        { value: 3, label: '3 Rooms', count: 25 },
        { value: 4, label: '4 Rooms', count: 12 },
        { value: 5, label: '5+ Rooms', count: 7 }
      ]
    };

    res.json({
      success: true,
      data: filterOptions
    });

  } catch (error) {
    console.error('Filter options API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get filter options',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/search/quick
 * @desc    Quick search endpoint for simple queries
 * @access  Public
 */
router.post('/quick', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const searchParams = {
      query,
      limit: parseInt(limit),
      sortBy: 'created_at',
      sortOrder: 'desc',
      userId: req.user ? req.user.id : null
    };

    const results = await AdvancedSearchService.searchApartments(searchParams);

    res.json(results);

  } catch (error) {
    console.error('Quick search API error:', error);
    res.status(500).json({
      success: false,
      error: 'Quick search failed',
      message: error.message
    });
  }
});

module.exports = router;
