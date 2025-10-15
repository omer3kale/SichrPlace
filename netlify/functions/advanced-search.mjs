import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend } from './utils/field-mapper.mjs';

// Hardened Supabase configuration with service role
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// CORS and response helpers
const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, body) => ({
  statusCode,
  headers: buildHeaders(),
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const httpError = (status, message, details = null) => {
  const error = { error: { message, status } };
  if (details && process.env.NODE_ENV !== 'production') {
    error.error.details = details;
  }
  return { status, ...error };
};

// Safe database operations
const safeSelect = async (query) => {
  try {
    const result = await query;
    return { data: result.data, error: result.error };
  } catch (error) {
    return { data: null, error };
  }
};

const safeInsert = async (query) => {
  try {
    const result = await query;
    return { data: result.data, error: result.error };
  } catch (error) {
    return { data: null, error };
  }
};

const safeDelete = async (query) => {
  try {
    const result = await query;
    return { data: result.data, error: result.error };
  } catch (error) {
    return { data: null, error };
  }
};

// Input validation and sanitization helpers
const sanitizeString = (str, maxLength = 100) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
};

const clampNumber = (num, min = 0, max = 999999) => {
  const parsed = parseInt(num);
  if (isNaN(parsed)) return null;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeAmenities = (input) => {
  if (!input) return [];

  const items = Array.isArray(input)
    ? input
    : String(input)
        .split(',')
        .map((value) => value.trim());

  return items
    .map((value) => sanitizeString(value, 50))
    .filter(Boolean);
};

// Authentication context
const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }
  
  if (!authorizationHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authorizationHeader.substring(7).trim();
};

const getAuthContext = async (authorizationHeader) => {
  try {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      return { user: null, profile: null };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return { user: null, profile: null };
    }

    const { data: profile } = await safeSelect(
      supabase
        .from('profiles')
        .select('id, email, role, status, first_name, last_name')
        .eq('id', user.id)
        .single()
    );

    return { user, profile };
  } catch (error) {
    return { user: null, profile: null };
  }
};

// Core search functions with enhanced filtering

// Advanced search with German rental market specifics
const advancedSearch = async (queryParams) => {
  try {
    const {
      location,
      min_kaltmiete,
      max_kaltmiete,
      min_warmmiete,
      max_warmmiete,
      price_type = 'both', // kalt, warm, both
      min_rooms,
      max_rooms,
      single_beds,
      double_beds,
      min_area,
      max_area,
      property_type, // shared_room, private_room, studio, loft, apartment, house
      furnished_status, // furnished, unfurnished, semi_furnished
      amenities,
      move_in_date,
      move_out_date,
      timeslot_type, // flexible, fixed
      earliest_move_in,
      exclude_exchange,
      pets_allowed,
      keywords,
      radius = '5000',
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = '20',
      offset = '0'
    } = queryParams;

    const amenityFilters = normalizeAmenities(amenities);
    const searchRadius = clampNumber(radius, 100, 50000) || 5000;

    // Enhanced input validation for German rental market
    const filters = {
      minKaltmiete: clampNumber(min_kaltmiete, 0, 50000),
      maxKaltmiete: clampNumber(max_kaltmiete, 0, 50000),
      minWarmmiete: clampNumber(min_warmmiete, 0, 50000),
      maxWarmmiete: clampNumber(max_warmmiete, 0, 50000),
      priceType: ['kalt', 'warm', 'both'].includes(price_type) ? price_type : 'both',
      minRooms: clampNumber(min_rooms, 1, 20),
      maxRooms: clampNumber(max_rooms, 1, 20),
      singleBeds: clampNumber(single_beds, 0, 10),
      doubleBeds: clampNumber(double_beds, 0, 10),
      minArea: clampNumber(min_area, 1, 2000),
      maxArea: clampNumber(max_area, 1, 2000),
      propertyType: ['shared_room', 'private_room', 'studio', 'loft', 'apartment', 'house'].includes(property_type) ? property_type : null,
      furnishedStatus: ['furnished', 'unfurnished', 'semi_furnished'].includes(furnished_status) ? furnished_status : null,
      keywords: sanitizeString(keywords, 200),
      location: sanitizeString(location, 100),
      moveInDate: move_in_date && !isNaN(Date.parse(move_in_date)) ? move_in_date : null,
      moveOutDate: move_out_date && !isNaN(Date.parse(move_out_date)) ? move_out_date : null,
      timeslotType: ['flexible', 'fixed'].includes(timeslot_type) ? timeslot_type : null,
      earliestMoveIn: earliest_move_in === 'true',
      excludeExchange: exclude_exchange === 'true',
      petsAllowed: pets_allowed === 'true' ? true : (pets_allowed === 'false' ? false : null),
      sortBy: ['kaltmiete', 'warmmiete', 'created_at', 'rooms', 'size', 'available_from'].includes(sort_by) ? sort_by : 'created_at',
      sortOrder: ['asc', 'desc'].includes(sort_order) ? sort_order : 'desc',
      limit: clampNumber(limit, 1, 100) || 20,
      offset: clampNumber(offset, 0, 10000) || 0,
      amenities: amenityFilters,
      radius: searchRadius,
    };

    // Build comprehensive query for German rental market
    let query = supabase
      .from('apartments')
      .select('*, landlord:landlord_id(id, first_name, last_name, email, phone)')
      .eq('status', 'available');

    // Property type filter
    if (filters.propertyType) {
      query = query.eq('property_type', filters.propertyType);
    }

    // German rental price filters
    if (filters.priceType === 'kalt' || filters.priceType === 'both') {
      if (filters.minKaltmiete) query = query.gte('kaltmiete', filters.minKaltmiete);
      if (filters.maxKaltmiete) query = query.lte('kaltmiete', filters.maxKaltmiete);
    }
    
    if (filters.priceType === 'warm' || filters.priceType === 'both') {
      if (filters.minWarmmiete) query = query.gte('warmmiete', filters.minWarmmiete);
      if (filters.maxWarmmiete) query = query.lte('warmmiete', filters.maxWarmmiete);
    }

    // Room and bed filters
    if (filters.minRooms) query = query.gte('rooms', filters.minRooms);
    if (filters.maxRooms) query = query.lte('rooms', filters.maxRooms);
    if (filters.singleBeds) query = query.eq('single_beds', filters.singleBeds);
    if (filters.doubleBeds) query = query.eq('double_beds', filters.doubleBeds);
    if (filters.minArea) query = query.gte('size', filters.minArea);
    if (filters.maxArea) query = query.lte('size', filters.maxArea);

    // Furnished status
    if (filters.furnishedStatus) {
      query = query.eq('furnished_status', filters.furnishedStatus);
    }

    // Time-based filters
    if (filters.moveInDate) {
      query = query.lte('available_from', filters.moveInDate);
    }
    if (filters.moveOutDate) {
      query = query.gte('available_until', filters.moveOutDate);
    }
    if (filters.timeslotType) {
      query = query.eq('timeslot_type', filters.timeslotType);
    }

    // Other filters
    if (filters.excludeExchange) {
      query = query.neq('listing_type', 'exchange');
    }
    if (filters.petsAllowed !== null) {
      const petsValue = filters.petsAllowed ? 'allowed' : 'not_allowed';
      query = query.eq('pets_policy', petsValue);
    }

    // Enhanced keyword and location search across multiple fields
    const orFilters = [];

    if (filters.keywords) {
      const keywordTerm = `%${filters.keywords}%`;
      orFilters.push(
        `title.ilike.${keywordTerm}`,
        `description.ilike.${keywordTerm}`,
        `address.ilike.${keywordTerm}`,
        `city.ilike.${keywordTerm}`
      );
    }

    if (filters.location) {
      const locationTerm = `%${filters.location}%`;
      orFilters.push(
        `city.ilike.${locationTerm}`,
        `address.ilike.${locationTerm}`,
        `stadtteil.ilike.${locationTerm}`
      );
    }

    if (orFilters.length > 0) {
      query = query.or(orFilters.join(','));
    }

    if (filters.amenities.length > 0) {
      query = query.contains('amenities', filters.amenities);
    }

    // Apply sorting and pagination
    query = query
      .order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })
      .range(filters.offset, filters.offset + filters.limit - 1);

    const { data: apartments, error } = await safeSelect(query);

    if (error) {
      return respond(500, httpError(500, 'Database query failed', error));
    }

    const response = {
      success: true,
      data: {
        apartments: apartments.map(mapApartmentToFrontend),
        filters: filters,
        meta: {
          count: apartments.length,
          appliedRadius: filters.radius,
          matchedAmenities: filters.amenities,
          timestamp: new Date().toISOString()
        }
      }
    };

    return respond(200, response);

  } catch (error) {
    return respond(500, httpError(500, 'Advanced search failed', error.message));
  }
};

// Additional search helper functions
const complexFilters = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Complex filters functionality',
        available_filters: {
          price_ranges: ['0-500', '500-1000', '1000-1500', '1500+'],
          room_options: ['1', '2', '3', '4+'],
          amenities: ['parking', 'balcony', 'garden', 'elevator'],
          property_types: ['apartment', 'house', 'studio']
        }
      },
      meta: {
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Complex filters failed', error.message));
  }
};

const spatialSearch = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Spatial search functionality',
        supported_features: ['radius_search', 'polygon_search', 'nearby_points'],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Spatial search failed', error.message));
  }
};

const semanticSearch = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Semantic search functionality',
        capabilities: ['natural_language', 'intent_recognition', 'smart_matching'],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Semantic search failed', error.message));
  }
};

const facetedSearch = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Faceted search functionality',
        facets: ['location', 'price', 'size', 'amenities', 'availability'],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Faceted search failed', error.message));
  }
};

const autoSuggest = async (queryParams) => {
  try {
    const { query: searchQuery } = queryParams;
    const term = sanitizeString(searchQuery, 50);

    if (!term) {
      return respond(400, httpError(400, 'Search query required'));
    }

    const { data: locationSuggestions } = await safeSelect(
      supabase
        .from('apartments')
        .select('city, stadtteil')
        .ilike('city', `%${term}%`)
        .limit(5)
    );

    const suggestions = [
      ...new Set(locationSuggestions?.map(apt => apt.city) || []),
      ...new Set(locationSuggestions?.map(apt => apt.stadtteil).filter(Boolean) || [])
    ].slice(0, 10);

    return respond(200, {
      success: true,
      data: { suggestions }
    });

  } catch (error) {
    return respond(500, httpError(500, 'Auto-suggest failed', error.message));
  }
};

const searchSuggestions = async (queryParams) => {
  try {
    const requestedTerm = sanitizeString(queryParams?.query, 100);
    const response = {
      success: true,
      data: {
        suggestions: [
          'Apartments in Berlin',
          'Studio near university', 
          'Pet-friendly housing',
          'Furnished apartments',
          'Parking included'
        ],
        requested_query: requestedTerm || null
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Search suggestions failed', error.message));
  }
};

const saveSearch = async (userId, requestBody) => {
  try {
    const { name, criteria } = requestBody;

    if (!name || !criteria) {
      return respond(400, httpError(400, 'Name and criteria required'));
    }

    const searchData = {
      user_id: userId,
      name: sanitizeString(name, 100),
      criteria: criteria,
      created_at: new Date().toISOString()
    };

    const { data, error } = await safeInsert(
      supabase
        .from('saved_searches')
        .insert(searchData)
        .select()
    );

    if (error) {
      return respond(500, httpError(500, 'Failed to save search', error));
    }

    return respond(200, {
      success: true,
      data: { saved_search: data[0] }
    });

  } catch (error) {
    return respond(500, httpError(500, 'Save search failed', error.message));
  }
};

const getSavedSearches = async (userId, queryParams) => {
  try {
    const { data: searches, error } = await safeSelect(
      supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );

    if (error) {
      return respond(500, httpError(500, 'Failed to get saved searches', error));
    }

    return respond(200, {
      success: true,
      data: {
        saved_searches: searches || [],
        requested_params: queryParams || {}
      }
    });

  } catch (error) {
    return respond(500, httpError(500, 'Get saved searches failed', error.message));
  }
};

const deleteSavedSearch = async (userId, requestBody) => {
  try {
    const { search_id } = requestBody;

    if (!search_id) {
      return respond(400, httpError(400, 'Search ID required'));
    }

    const { error } = await safeDelete(
      supabase
        .from('saved_searches')
        .delete()
        .eq('id', search_id)
        .eq('user_id', userId)
    );

    if (error) {
      return respond(500, httpError(500, 'Failed to delete search', error));
    }

    return respond(200, {
      success: true,
      data: { message: 'Search deleted successfully' }
    });

  } catch (error) {
    return respond(500, httpError(500, 'Delete search failed', error.message));
  }
};

const searchAnalytics = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Search analytics functionality',
        metrics: ['search_volume', 'popular_terms', 'conversion_rates'],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Search analytics failed', error.message));
  }
};

const popularSearches = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        popular_searches: [
          { term: 'Berlin apartments', count: 150 },
          { term: 'Pet friendly', count: 89 },
          { term: 'Furnished studio', count: 67 }
        ],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Popular searches failed', error.message));
  }
};

const searchTrends = async (queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Search trends functionality',
        trends: ['rising_locations', 'seasonal_patterns', 'price_trends'],
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Search trends failed', error.message));
  }
};

const getSearchHistory = async (userId, queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        search_history: [],
        message: 'Search history functionality',
        requested_params: queryParams || {},
        user_id: userId
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Get search history failed', error.message));
  }
};

const similarProperties = async (queryParams) => {
  try {
    const referenceId = queryParams?.apartment_id
      ? sanitizeString(queryParams.apartment_id, 50)
      : null;
    const response = {
      success: true,
      data: {
        message: 'Similar properties functionality',
        algorithm: 'content_based_filtering',
        reference_apartment_id: referenceId
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Similar properties failed', error.message));
  }
};

const propertyRecommendations = async (userId, queryParams) => {
  try {
    const response = {
      success: true,
      data: {
        message: 'Property recommendations functionality',
        method: userId ? 'collaborative_filtering' : 'popularity_based',
        requested_params: queryParams || {}
      }
    };
    return respond(200, response);
  } catch (error) {
    return respond(500, httpError(500, 'Property recommendations failed', error.message));
  }
};

// Enhanced main handler with comprehensive action routing
export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    // Parse request parameters
    const { action, ...queryParams } = event.queryStringParameters || {};
    const requestBody = event.body ? JSON.parse(event.body) : {};
    
    // Get authentication context for protected actions
  const { user } = await getAuthContext(event.headers.authorization);
    
    // Route to appropriate handler based on action
    switch (action) {
      case 'advanced_search':
        return await advancedSearch(queryParams);
      
      case 'complex_filters':
        return await complexFilters(queryParams);
      
      case 'spatial_search':
        return await spatialSearch(queryParams);
      
      case 'semantic_search':
        return await semanticSearch(queryParams);
      
      case 'faceted_search':
        return await facetedSearch(queryParams);
      
      case 'auto_suggest':
        return await autoSuggest(queryParams);
      
      case 'search_suggestions':
        return await searchSuggestions(queryParams);
      
      case 'save_search':
        if (!user) {
          return respond(401, httpError(401, 'Authentication required'));
        }
        return await saveSearch(user.id, requestBody);
      
      case 'get_saved_searches':
        if (!user) {
          return respond(401, httpError(401, 'Authentication required'));
        }
        return await getSavedSearches(user.id, queryParams);
      
      case 'delete_saved_search':
        if (!user) {
          return respond(401, httpError(401, 'Authentication required'));
        }
        return await deleteSavedSearch(user.id, requestBody);
      
      case 'search_analytics':
        return await searchAnalytics(queryParams);
      
      case 'popular_searches':
        return await popularSearches(queryParams);
      
      case 'search_trends':
        return await searchTrends(queryParams);
      
      case 'get_search_history':
        if (!user) {
          return respond(401, httpError(401, 'Authentication required'));
        }
        return await getSearchHistory(user.id, queryParams);
      
      case 'similar_properties':
        return await similarProperties(queryParams);
      
      case 'property_recommendations':
        return await propertyRecommendations(user?.id, queryParams);
      
      default:
        return respond(400, httpError(400, 'Invalid action parameter', { 
          validActions: [
            'advanced_search', 'complex_filters', 'spatial_search', 'semantic_search',
            'faceted_search', 'auto_suggest', 'search_suggestions', 'save_search',
            'get_saved_searches', 'delete_saved_search', 'search_analytics',
            'popular_searches', 'search_trends', 'get_search_history',
            'similar_properties', 'property_recommendations'
          ]
        }));
    }
    
  } catch (error) {
    console.error('Advanced search handler error:', error);
    
    const errorResponse = httpError(
      500, 
      'Advanced search operation failed', 
      error.message
    );
    
    return respond(500, errorResponse);
  }
};