import { createClient } from '@supabase/supabase-js';

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

const safeCount = async (query) => {
  try {
    const result = await query;
    return { count: result.count, error: result.error };
  } catch (error) {
    return { count: 0, error };
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

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Authentication context (for future use)
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

// Enhanced input validation matching original design plan
const sanitizeSearchInput = (queryParams) => {
  const sanitized = {
    page: clampNumber(queryParams.page, 1, 1000) || 1,
    limit: clampNumber(queryParams.limit, 1, 100) || 20,
    sortBy: ['created_at', 'price', 'kaltmiete', 'warmmiete', 'size', 'rooms', 'city', 'move_in_date'].includes(queryParams.sortBy) ? queryParams.sortBy : 'created_at',
    sortOrder: ['asc', 'desc'].includes(queryParams.sortOrder) ? queryParams.sortOrder : 'desc'
  };
  
  // Text search terms - enhanced sanitization
  const searchTerm = sanitizeString(queryParams.q || queryParams.search);
  if (searchTerm) {
    sanitized.searchTerm = searchTerm;
  }
  
  // Location filters - comprehensive validation
  const city = sanitizeString(queryParams.city);
  if (city) sanitized.city = city;
  
  const state = sanitizeString(queryParams.state);
  if (state) sanitized.state = state;
  
  const district = sanitizeString(queryParams.stadtteil || queryParams.district);
  if (district) sanitized.district = district;
  
  // Postal code validation - German format
  if (queryParams.postal_code) {
    const postalCode = sanitizeString(queryParams.postal_code, 5);
    if (/^\d{5}$/.test(postalCode)) {
      sanitized.postal_code = postalCode;
    }
  }
  
  // German rental price filters - kalt/warm miete distinction
  const minKaltmiete = clampNumber(queryParams.minKaltmiete || queryParams.minPrice, 0, 50000);
  if (minKaltmiete !== null) sanitized.minKaltmiete = minKaltmiete;
  
  const maxKaltmiete = clampNumber(queryParams.maxKaltmiete || queryParams.maxPrice, 0, 50000);
  if (maxKaltmiete !== null) sanitized.maxKaltmiete = maxKaltmiete;
  
  const minWarmmiete = clampNumber(queryParams.minWarmmiete || queryParams.minTotalRent, 0, 50000);
  if (minWarmmiete !== null) sanitized.minWarmmiete = minWarmmiete;
  
  const maxWarmmiete = clampNumber(queryParams.maxWarmmiete || queryParams.maxTotalRent, 0, 50000);
  if (maxWarmmiete !== null) sanitized.maxWarmmiete = maxWarmmiete;
  
  // Price type preference (kalt vs warm miete)
  const priceType = ['kalt', 'warm', 'both'].includes(queryParams.priceType) ? queryParams.priceType : 'both';
  sanitized.priceType = priceType;
  
  // Property type filters - matching original design plan
  const validPropertyTypes = ['shared_room', 'private_room', 'studio', 'loft', 'apartment', 'house'];
  const propertyType = sanitizeString(queryParams.propertyType || queryParams.property_type);
  if (propertyType && validPropertyTypes.includes(propertyType)) {
    sanitized.propertyType = propertyType;
  }
  
  // Room and bed filters - enhanced for original plan
  const rooms = clampNumber(queryParams.rooms || queryParams.zimmer, 1, 20);
  if (rooms !== null) sanitized.rooms = rooms;
  
  const minRooms = clampNumber(queryParams.minRooms || queryParams.minZimmer, 1, 20);
  if (minRooms !== null) sanitized.minRooms = minRooms;
  
  const maxRooms = clampNumber(queryParams.maxRooms || queryParams.maxZimmer, 1, 20);
  if (maxRooms !== null) sanitized.maxRooms = maxRooms;
  
  // Bed configuration - single and double beds as per plan
  const singleBeds = clampNumber(queryParams.singleBeds || queryParams.einzelbetten, 0, 10);
  if (singleBeds !== null) sanitized.singleBeds = singleBeds;
  
  const doubleBeds = clampNumber(queryParams.doubleBeds || queryParams.doppelbetten, 0, 10);
  if (doubleBeds !== null) sanitized.doubleBeds = doubleBeds;
  
  const bathrooms = clampNumber(queryParams.bathrooms || queryParams.badezimmer, 0, 10);
  if (bathrooms !== null) sanitized.bathrooms = bathrooms;
  
  // Time-based filters - move-in/move-out dates as per original plan
  const moveInDate = queryParams.moveInDate || queryParams.move_in_date;
  if (moveInDate && !isNaN(Date.parse(moveInDate))) {
    sanitized.moveInDate = new Date(moveInDate).toISOString().split('T')[0];
  }
  
  const moveOutDate = queryParams.moveOutDate || queryParams.move_out_date;
  if (moveOutDate && !isNaN(Date.parse(moveOutDate))) {
    sanitized.moveOutDate = new Date(moveOutDate).toISOString().split('T')[0];
  }
  
  const earliestMoveIn = queryParams.earliestMoveIn === 'true' || queryParams.earliest_move_in === 'true';
  sanitized.earliestMoveIn = earliestMoveIn;
  
  const timeSlotType = ['flexible', 'fixed'].includes(queryParams.timeSlotType) ? queryParams.timeSlotType : null;
  if (timeSlotType) sanitized.timeSlotType = timeSlotType;
  
  // Size filters - square meters
  const size = clampNumber(queryParams.size, 1, 2000);
  if (size !== null) sanitized.size = size;
  
  const minSize = clampNumber(queryParams.minSize, 1, 2000);
  if (minSize !== null) sanitized.minSize = minSize;
  
  const maxSize = clampNumber(queryParams.maxSize, 1, 2000);
  if (maxSize !== null) sanitized.maxSize = maxSize;
  
  // Furnished status - three options as per original plan
  const validFurnishedOptions = ['furnished', 'unfurnished', 'semi_furnished'];
  const furnishedStatus = sanitizeString(queryParams.furnishedStatus || queryParams.moebliert_status);
  if (furnishedStatus && validFurnishedOptions.includes(furnishedStatus)) {
    sanitized.furnishedStatus = furnishedStatus;
  }
  
  // Boolean feature filters - enhanced amenities from original plan
  const parseBoolean = (value) => {
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return null;
  };
  
  // Advanced amenities as per original design
  const amenities = {};
  const amenityFields = [
    'washing_machine', 'dryer', 'dishwasher', 'tv', 'lift', 'kitchen', 
    'air_conditioning', 'wifi', 'heating', 'private_bathroom', 
    'wheelchair_accessible', 'balcony', 'terrace'
  ];
  
  amenityFields.forEach(amenity => {
    const value = parseBoolean(queryParams[amenity] || queryParams[amenity.replace('_', '')]);
    if (value !== null) amenities[amenity] = value;
  });
  
  if (Object.keys(amenities).length > 0) sanitized.amenities = amenities;
  
  // Other filters
  const petsAllowed = parseBoolean(queryParams.pets_allowed || queryParams.haustiere);
  if (petsAllowed !== null) sanitized.petsAllowed = petsAllowed;
  
  const excludeExchange = parseBoolean(queryParams.excludeExchange || queryParams.exclude_exchange);
  if (excludeExchange !== null) sanitized.excludeExchange = excludeExchange;
  
  return sanitized;
};

// Enhanced response formatting with German rental calculations
const formatGermanResponse = (apartment) => {
  if (!apartment) return null;
  
  const totalRent = (apartment.price || 0) + (apartment.nebenkosten_warm || 0) + (apartment.nebenkosten_kalt || 0);
  
  return {
    id: apartment.id,
    title: apartment.title,
    description: apartment.description,
    
    // German address format
    address: apartment.address,
    house_number: apartment.house_number,
    postal_code: apartment.postal_code,
    city: apartment.city,
    state: apartment.state,
    stadtteil: apartment.stadtteil,
    formatted_address: `${apartment.address} ${apartment.house_number}, ${apartment.postal_code} ${apartment.city}`,
    
    // German rental pricing
    price: apartment.price, // Cold rent
    nebenkosten_warm: apartment.nebenkosten_warm,
    nebenkosten_kalt: apartment.nebenkosten_kalt,
    total_rent: totalRent,
    kaution: apartment.kaution,
    provision: apartment.provision,
    
    // Property details
    rooms: apartment.rooms,
    bedrooms: apartment.bedrooms,
    bathrooms: apartment.bathrooms,
    size: apartment.size,
    gesamtflaeche: apartment.gesamtflaeche,
    floor: apartment.floor,
    
    // German features
    moebliert_typ: apartment.moebliert_typ,
    furnished: apartment.moebliert_typ === 'moebliert',
    haustiere: apartment.haustiere,
    pets_allowed: ['erlaubt', 'nach_vereinbarung'].includes(apartment.haustiere),
    stellplatz: apartment.stellplatz,
    parking: apartment.stellplatz !== 'keiner',
    aufzug: apartment.aufzug,
    elevator: apartment.aufzug,
    balkon_terrasse: apartment.balkon_terrasse,
    balcony: apartment.balkon_terrasse > 0,
    garten: apartment.garten,
    garden: apartment.garten,
    
    // Energy and building info
    energieeffizienzklasse: apartment.energieeffizienzklasse,
    baujahr: apartment.baujahr,
    heizungsart: apartment.heizungsart,
    
    // Rental terms
    verfuegbar_ab: apartment.verfuegbar_ab,
    available_from: apartment.verfuegbar_ab,
    mietvertrag_typ: apartment.mietvertrag_typ,
    vermietung_typ: apartment.vermietung_typ,
    
    // Media and additional info
    bilder: apartment.bilder || [],
    images: apartment.bilder || [],
    
    // Landlord info (if included)
    landlord: apartment.landlord || apartment.users,
    landlord_id: apartment.landlord_id,
    
    // Status and timestamps
    status: apartment.status,
    created_at: apartment.created_at,
    updated_at: apartment.updated_at,
    
    // Display formatting
    rent_display: {
      price: `€${apartment.price || 0}`,
      nebenkosten_warm: `€${apartment.nebenkosten_warm || 0}`,
      nebenkosten_kalt: `€${apartment.nebenkosten_kalt || 0}`,
      total_rent: `€${totalRent}`,
      kaution: `€${apartment.kaution || 0}`
    }
  };
};

// Enhanced search query builder with comprehensive filtering
const buildSearchQuery = (filters) => {
  let query = supabase
    .from('apartments')
    .select(`
      *,
      landlord:landlord_id (
        id,
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('status', 'available');
  
  // Text search across multiple fields
  if (filters.searchTerm) {
    const searchTerm = `%${filters.searchTerm}%`;
    query = query.or(
      `title.ilike.${searchTerm},` +
      `description.ilike.${searchTerm},` +
      `address.ilike.${searchTerm},` +
      `city.ilike.${searchTerm},` +
      `stadtteil.ilike.${searchTerm}`
    );
  }
  
  // Location filters
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }
  if (filters.postal_code) {
    query = query.eq('postal_code', filters.postal_code);
  }
  if (filters.state) {
    query = query.ilike('state', `%${filters.state}%`);
  }
  if (filters.district) {
    query = query.ilike('stadtteil', `%${filters.district}%`);
  }
  
  // Property type filter
  if (filters.propertyType) {
    query = query.eq('property_type', filters.propertyType);
  }
  
  // German rental price filters with kalt/warm miete
  if (filters.priceType === 'kalt' || filters.priceType === 'both') {
    if (filters.minKaltmiete) {
      query = query.gte('kaltmiete', filters.minKaltmiete);
    }
    if (filters.maxKaltmiete) {
      query = query.lte('kaltmiete', filters.maxKaltmiete);
    }
  }
  
  if (filters.priceType === 'warm' || filters.priceType === 'both') {
    if (filters.minWarmmiete) {
      query = query.gte('warmmiete', filters.minWarmmiete);
    }
    if (filters.maxWarmmiete) {
      query = query.lte('warmmiete', filters.maxWarmmiete);
    }
  }
  
  // Time-based filters
  if (filters.moveInDate) {
    query = query.lte('available_from', filters.moveInDate);
  }
  if (filters.moveOutDate) {
    query = query.gte('available_until', filters.moveOutDate);
  }
  if (filters.timeSlotType) {
    query = query.eq('timeslot_type', filters.timeSlotType);
  }
  
  // Room and bed configuration filters
  if (filters.rooms) {
    query = query.eq('rooms', filters.rooms);
  }
  if (filters.minRooms) {
    query = query.gte('rooms', filters.minRooms);
  }
  if (filters.maxRooms) {
    query = query.lte('rooms', filters.maxRooms);
  }
  if (filters.singleBeds) {
    query = query.eq('single_beds', filters.singleBeds);
  }
  if (filters.doubleBeds) {
    query = query.eq('double_beds', filters.doubleBeds);
  }
  if (filters.bathrooms) {
    query = query.eq('bathrooms', filters.bathrooms);
  }
  
  // Size filters
  if (filters.size) {
    query = query.eq('size', filters.size);
  }
  if (filters.minSize) {
    query = query.gte('size', filters.minSize);
  }
  if (filters.maxSize) {
    query = query.lte('size', filters.maxSize);
  }
  
  // Furnished status filter
  if (filters.furnishedStatus) {
    query = query.eq('furnished_status', filters.furnishedStatus);
  }
  
  // Advanced amenities filters
  if (filters.amenities) {
    Object.keys(filters.amenities).forEach(amenity => {
      query = query.eq(amenity, filters.amenities[amenity]);
    });
  }
  
  // Other boolean filters
  if (filters.petsAllowed !== null && filters.petsAllowed !== undefined) {
    if (filters.petsAllowed) {
      query = query.in('pets_policy', ['allowed', 'negotiable']);
    } else {
      query = query.eq('pets_policy', 'not_allowed');
    }
  }
  
  if (filters.excludeExchange) {
    query = query.neq('listing_type', 'exchange');
  }
  
  // Earliest move-in sorting
  if (filters.earliestMoveIn) {
    query = query.order('available_from', { ascending: true });
  }
  
  // Sorting
  const sortBy = filters.sortBy || 'created_at';
  const sortOrder = filters.sortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  
  // Pagination
  const offset = (filters.page - 1) * filters.limit;
  query = query.range(offset, offset + filters.limit - 1);
  
  return query;
};

// Enhanced main search handler with comprehensive error handling
export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }
  
  // Only allow GET method
  if (event.httpMethod !== 'GET') {
    return respond(405, httpError(405, 'Method not allowed', { allowed: ['GET', 'OPTIONS'] }));
  }
  
  try {
    const queryParams = event.queryStringParameters || {};
    
    // Enhanced input validation and sanitization
    const filters = sanitizeSearchInput(queryParams);
    
    // Build comprehensive search query
    const searchQuery = buildSearchQuery(filters);
    const { data: apartments, error } = await safeSelect(searchQuery);
    
    if (error) {
      console.error('Search query error:', error);
      return respond(500, httpError(500, 'Database query failed', error));
    }
    
    // Get total count for pagination
    const countQuery = supabase
      .from('apartments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available');
    
    const { count: totalCount } = await safeCount(countQuery);
    
    // Format results with enhanced German schema
    const formattedApartments = apartments.map(formatGermanResponse);
    
    const response = {
      success: true,
      data: {
        apartments: formattedApartments,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / filters.limit),
          hasNext: (filters.page * filters.limit) < (totalCount || 0),
          hasPrev: filters.page > 1
        },
        filters: {
          applied: filters,
          available: {
            cities: [], // Could be populated from a separate query if needed
            priceRange: { min: 0, max: 50000 },
            roomRange: { min: 1, max: 20 }
          }
        },
        meta: {
          count: apartments.length,
          searchTerm: filters.searchTerm || null,
          timestamp: new Date().toISOString(),
          version: '2.0'
        }
      }
    };
    
    return respond(200, response);
    
  } catch (error) {
    console.error('Search handler error:', error);
    
    const errorResponse = httpError(
      500, 
      'Search operation failed', 
      error.message
    );
    
    return respond(500, errorResponse);
  }
};
