import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend, mapArrayToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for apartments function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Transform legacy parameters to German schema filters
const transformFilters = (queryParams) => {
  const filters = {};
  
  // Direct German parameter mappings
  if (queryParams.city || queryParams.city) filters.city = queryParams.city || queryParams.city;
  if (queryParams.postal_code) filters.postal_code = queryParams.postal_code;
  if (queryParams.state) filters.state = queryParams.state;
  if (queryParams.stadtteil) filters.stadtteil = queryParams.stadtteil;
  
  // Price filters (German rental structure)
  if (queryParams.minPrice || queryParams.minPrice) {
    filters.minPrice = parseInt(queryParams.minPrice || queryParams.minPrice);
  }
  if (queryParams.maxPrice || queryParams.maxPrice) {
    filters.maxPrice = parseInt(queryParams.maxPrice || queryParams.maxPrice);
  }
  if (queryParams.minTotalRent) filters.minTotalRent = parseInt(queryParams.minTotalRent);
  if (queryParams.maxTotalRent) filters.maxTotalRent = parseInt(queryParams.maxTotalRent);
  
  // Room filters
  if (queryParams.rooms || queryParams.bedrooms || queryParams.rooms) {
    filters.rooms = parseInt(queryParams.rooms || queryParams.bedrooms || queryParams.rooms);
  }
  if (queryParams.minZimmer || queryParams.minRooms) {
    filters.minZimmer = parseInt(queryParams.minZimmer || queryParams.minRooms);
  }
  if (queryParams.maxZimmer || queryParams.maxRooms) {
    filters.maxZimmer = parseInt(queryParams.maxZimmer || queryParams.maxRooms);
  }
  if (queryParams.bathrooms || queryParams.bathrooms) {
    filters.bathrooms = parseInt(queryParams.bathrooms || queryParams.bathrooms);
  }
  
  // Size filters
  if (queryParams.size || queryParams.size) {
    filters.size = parseInt(queryParams.size || queryParams.size);
  }
  if (queryParams.minSize || queryParams.minSize) {
    filters.minSize = parseInt(queryParams.minSize || queryParams.minSize);
  }
  if (queryParams.maxSize || queryParams.maxSize) {
    filters.maxSize = parseInt(queryParams.maxSize || queryParams.maxSize);
  }
  
  // German rental features
  if (queryParams.moebliert !== undefined) {
    filters.moebliert = queryParams.moebliert;
  } else if (queryParams.furnished !== undefined) {
    filters.moebliert = queryParams.furnished === 'true' ? 'moebliert' : 'unmoebliert';
  }
  
  if (queryParams.haustiere !== undefined) {
    filters.haustiere = queryParams.haustiere;
  } else if (queryParams.petFriendly !== undefined) {
    filters.haustiere = queryParams.petFriendly === 'true' ? 'erlaubt' : 'nicht_erlaubt';
  }
  
  if (queryParams.stellplatz !== undefined || queryParams.parking !== undefined) {
    filters.stellplatz = queryParams.stellplatz || (queryParams.parking === 'true' ? 'vorhanden' : 'keiner');
  }
  
  // Energy efficiency
  if (queryParams.energieeffizienzklasse) filters.energieeffizienzklasse = queryParams.energieeffizienzklasse;
  
  // Rental type
  if (queryParams.vermietung_typ) filters.vermietung_typ = queryParams.vermietung_typ;
  
  // Date filters
  if (queryParams.verfuegbar_ab || queryParams.available_from) {
    filters.verfuegbar_ab = queryParams.verfuegbar_ab || queryParams.available_from;
  }
  
  return filters;
};

// Format apartment response with German rental info and frontend mapping
const formatApartmentResponse = (apartment) => {
  const total_rent = apartment.price + apartment.nebenkosten_warm + apartment.nebenkosten_kalt;
  
  return {
    ...apartment,
    ...mapApartmentToFrontend(apartment), // Use field mapper for consistent mapping
    // Calculated fields
    total_rent,
    total_rent: total_rent, // Frontend-friendly field name
    formatted_address: `${apartment.address} ${apartment.house_number}, ${apartment.postal_code} ${apartment.city}, ${apartment.state}`,
    
    // German rental display
    rent_display: {
      price: `€${apartment.price}`,
      nebenkosten_warm: `€${apartment.nebenkosten_warm}`,
      nebenkosten_kalt: `€${apartment.nebenkosten_kalt}`,
      total_rent: `€${total_rent}`,
      kaution: `€${apartment.kaution}`
    },
    
    // Additional frontend compatibility
    location: apartment.city,
    furnished: apartment.moebliert_typ === 'moebliert',
    pet_friendly: apartment.haustiere === 'erlaubt' || apartment.haustiere === 'nach_vereinbarung',
    owner_id: apartment.landlord_id,
    images: apartment.bilder
  };
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const query = event.queryStringParameters || {};
    const { user, profile } = await tryGetAuthContext(event.headers || {});

    if (method === 'GET') {
      const page = clampNumber(query.page, { min: 1, max: 1000, fallback: 1 });
      const limit = clampNumber(query.limit, { min: 1, max: 50, fallback: 12 });
      const sortBy = sanitizeString(query.sortBy || query.sort_by, { maxLength: 50 }) || 'created_at';
      const sortOrder = sanitizeString(query.sortOrder || query.sort_order, { maxLength: 10 }) || 'desc';

      const filters = transformFilters(query);
      const offset = (page - 1) * limit;

      const apartments = await safeSelect(
        'apartments',
        `
          *,
          landlord:users!apartments_owner_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone,
            username
          )
        `,
        (queryBuilder) => {
          let q = queryBuilder;

          // Apply German rental filters
          if (filters.city) {
            q = q.ilike('city', `%${filters.city}%`);
          }
          if (filters.postal_code) {
            q = q.eq('postal_code', filters.postal_code);
          }
          if (filters.state) {
            q = q.eq('state', filters.state);
          }
          if (filters.stadtteil) {
            q = q.ilike('stadtteil', `%${filters.stadtteil}%`);
          }
          if (filters.minPrice) {
            q = q.gte('price', filters.minPrice);
          }
          if (filters.maxPrice) {
            q = q.lte('price', filters.maxPrice);
          }
          if (filters.rooms) {
            q = q.eq('rooms', filters.rooms);
          }
          if (filters.minZimmer) {
            q = q.gte('rooms', filters.minZimmer);
          }
          if (filters.maxZimmer) {
            q = q.lte('rooms', filters.maxZimmer);
          }
          if (filters.bathrooms) {
            q = q.eq('bathrooms', filters.bathrooms);
          }
          if (filters.size) {
            q = q.eq('size', filters.size);
          }
          if (filters.minSize) {
            q = q.gte('size', filters.minSize);
          }
          if (filters.maxSize) {
            q = q.lte('size', filters.maxSize);
          }
          if (filters.moebliert) {
            if (filters.moebliert === 'moebliert' || filters.moebliert === 'true') {
              q = q.eq('moebliert_typ', 'moebliert');
            } else if (filters.moebliert === 'unmoebliert' || filters.moebliert === 'false') {
              q = q.eq('moebliert_typ', 'unmoebliert');
            }
          }
          if (filters.haustiere) {
            if (filters.haustiere === 'erlaubt' || filters.haustiere === 'true') {
              q = q.in('haustiere', ['erlaubt', 'nach_vereinbarung']);
            } else if (filters.haustiere === 'nicht_erlaubt' || filters.haustiere === 'false') {
              q = q.eq('haustiere', 'nicht_erlaubt');
            }
          }
          if (filters.stellplatz) {
            if (filters.stellplatz === 'vorhanden' || filters.stellplatz === 'true') {
              q = q.neq('stellplatz', 'keiner');
            } else if (filters.stellplatz === 'keiner' || filters.stellplatz === 'false') {
              q = q.eq('stellplatz', 'keiner');
            }
          }
          if (filters.energieeffizienzklasse) {
            q = q.eq('energieeffizienzklasse', filters.energieeffizienzklasse);
          }
          if (filters.vermietung_typ) {
            q = q.eq('vermietung_typ', filters.vermietung_typ);
          }
          if (filters.verfuegbar_ab) {
            q = q.gte('verfuegbar_ab', filters.verfuegbar_ab);
          }

          // Default to available apartments
          q = q.eq('status', 'verfuegbar');

          // Sorting
          const sortMapping = {
            price: 'price',
            total_rent: 'price',
            created_at: 'created_at',
            rooms: 'rooms',
            size: 'size',
            city: 'city',
          };
          const dbSortField = sortMapping[sortBy] || 'created_at';
          const ascending = sortOrder === 'asc';
          q = q.order(dbSortField, { ascending });

          // Pagination
          q = q.range(offset, offset + limit - 1);

          return q;
        },
      );

      const formattedApartments = apartments.map(formatApartmentResponse);

      return respond(200, headers, {
        success: true,
        data: formattedApartments,
        count: formattedApartments.length,
        page,
        limit,
        message: 'Apartments retrieved successfully',
      });
    }

    if (method === 'POST') {
      return respond(400, headers, {
        success: false,
        error: 'Use /api/add-property endpoint to create apartments',
      });
    }

    const error = httpError(405, 'Method not allowed. Only GET is supported.', {
      allowed_methods: ['GET'],
    });
    error.allow = 'GET, OPTIONS';
    throw error;
  } catch (error) {
    console.error('apartments error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'Internal server error' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};