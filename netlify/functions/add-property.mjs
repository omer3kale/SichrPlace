import { createClient } from '@supabase/supabase-js';

// Supabase configuration with service role
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

// Helper functions
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

const extractBearerToken = (headers) => {
  const authHeader = headers.authorization || headers.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

// Supabase error checking
const isMissingTableError = (error) => {
  return error?.code === 'PGRST116' || error?.message?.includes('relation') && error?.message?.includes('does not exist');
};

// Safe query operations with missing table resilience
const safeSelect = async (table, query = {}) => {
  try {
    let queryBuilder = supabase.from(table).select(query.select || '*');
    
    if (query.eq) {
      Object.entries(query.eq).forEach(([key, value]) => {
        queryBuilder = queryBuilder.eq(key, value);
      });
    }
    
    if (query.filters && typeof query.filters === 'function') {
      queryBuilder = query.filters(queryBuilder);
    }
    
    if (query.order) {
      queryBuilder = queryBuilder.order(query.order.column, { ascending: query.order.ascending });
    }
    
    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }
    
    if (query.range) {
      queryBuilder = queryBuilder.range(query.range.from, query.range.to);
    }
    
    if (query.single) {
      queryBuilder = queryBuilder.single();
    }
    
    const { data, error } = await queryBuilder;
    return { data, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { data: query.single ? null : [], error: null };
    }
    return { data: null, error };
  }
};

const safeInsert = async (table, data) => {
  try {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    return { data: result, error };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { 
        data: null, 
        error: { message: `Table ${table} does not exist`, code: 'TABLE_MISSING' }
      };
    }
    return { data: null, error };
  }
};

// Authentication with comprehensive validation
const getAuthContext = async (eventHeaders) => {
  const token = extractBearerToken(eventHeaders || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required.');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      throw httpError(401, 'Invalid or expired token.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, status, account_status, is_blocked')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw httpError(401, 'User profile not found.');
    }

    if (
      profile.is_blocked ||
      ['suspended', 'deleted'].includes(profile.account_status) ||
      profile.status === 'suspended'
    ) {
      throw httpError(403, 'Account suspended or blocked');
    }

    return { token, authUser: data.user, profile };
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'Authentication failed');
  }
};

// Role-based access control
const requireRole = (profile, allowedRoles) => {
  if (!allowedRoles.includes(profile.role)) {
    throw httpError(403, `Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }
};

// Input validation helpers
const sanitizeString = (value, options = {}) => {
  if (typeof value !== 'string') return options.fallback || '';
  const trimmed = value.trim();
  if (options.maxLength && trimmed.length > options.maxLength) {
    return trimmed.substring(0, options.maxLength);
  }
  return trimmed;
};

const clampNumber = (value, options = {}) => {
  const num = parseFloat(value);
  if (isNaN(num)) return options.fallback || options.min || 0;
  
  if (options.min !== undefined && num < options.min) return options.min;
  if (options.max !== undefined && num > options.max) return options.max;
  return num;
};

// Field mapping for frontend compatibility
const mapApartmentToFrontend = (apartment) => {
  if (!apartment) return null;
  
  return {
    ...apartment,
    // Map German fields to English for frontend
    rent_amount: apartment.price,
    additional_costs_warm: apartment.nebenkosten_warm,
    additional_costs_cold: apartment.nebenkosten_kalt,
    deposit_amount: apartment.kaution,
    size_sqm: apartment.size,
    total_area: apartment.gesamtflaeche,
    furnished_type: apartment.moebliert_typ,
    pets_allowed: apartment.haustiere,
    smoking_allowed: apartment.rauchen,
    available_from: apartment.verfuegbar_ab,
    available_until: apartment.verfuegbar_bis,
    minimum_lease_duration: apartment.mindestmietdauer,
    contract_type: apartment.mietvertrag_typ,
    rental_type: apartment.vermietung_typ,
    images: apartment.bilder,
    public_transport: apartment.oeffentliche_verkehrsmittel,
    shopping_options: apartment.einkaufsmoeglichkeiten,
    house_rules: apartment.hausordnung,
    special_features: apartment.besonderheiten,
    other_info: apartment.sonstiges,
  };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const authContext = await getAuthContext(event.headers || {});

    if (method === 'POST') {
      return await handleCreateProperty(event, authContext);
    }

    if (method === 'GET') {
      return await handleGetProperties(event, authContext);
    }

    return respond(405, {
      error: { message: `Method ${method} not allowed` }
    });
  } catch (error) {
    if (error.status) {
      return respond(error.status, error);
    }
    
    return respond(500, {
      error: { 
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { details: error.message })
      }
    });
  }
};

const handleCreateProperty = async (event, authContext) => {
  requireRole(authContext.profile, ['landlord', 'admin']);

  const body = JSON.parse(event.body || '{}');
  const {
    title,
    description,
    address,
    house_number,
    city,
    postal_code,
    state,
    district,
    rent_amount, // This will be price
    additional_costs_warm, // nebenkosten_warm
    additional_costs_cold, // nebenkosten_kalt
    deposit_amount, // kaution
    deposit_type,
    commission, // provision
    size_sqm, // size
    total_area, // gesamtflaeche
    rooms, // rooms
    bedrooms, // bedrooms
    bathrooms, // bathrooms
    furnished_type, // moebliert_typ
    kitchen_type, // kueche
    pets_allowed, // haustiere
    smoking_allowed, // rauchen
    available_from, // verfuegbar_ab
    available_until, // verfuegbar_bis
    minimum_lease_duration, // mindestmietdauer
    contract_type, // mietvertrag_typ
    rental_type, // vermietung_typ
    floor, // floor
    total_floors, // etagen_gesamt
    elevator, // aufzug
    year_built, // baujahr
    year_renovated, // saniert_jahr
    energy_certificate_type, // energieausweis_typ
    energy_efficiency_class, // energieeffizienzklasse
    energy_consumption, // energieverbrauch
    heating_type, // heizungsart
    energy_source, // energietraeger
    balcony_terrace, // balkon_terrasse
    balcony_size, // balkon_groesse
    garden, // garten
    garden_size, // garten_groesse
    cellar, // keller
    attic, // dachboden
    parking_type, // stellplatz
    parking_spaces, // stellplaetze_anzahl
    garage,
    internet,
    internet_speed, // internet_geschwindigkeit
    cable_tv, // kabel_tv
    images,
    amenities,
    public_transport, // oeffentliche_verkehrsmittel
    shopping_options, // einkaufsmoeglichkeiten
    house_rules, // hausordnung
    special_features, // besonderheiten
    other_info, // sonstiges
    // Legacy fields for backward compatibility
    furnished,
    utilities_included,
    nearby_transport,
    property_type,
    balcony,
    parking,
    internet_included,
    washing_machine,
    dishwasher,
    microwave,
    lease_duration,
    rent_type
  } = body;

  // Validate required fields (German rental market requirements)
  const requiredFields = { title, description, address, city, postal_code, rent_amount, rooms };
  const missingFields = Object.entries(requiredFields)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    throw httpError(400, 'Missing required fields', {
      missing_fields: missingFields,
      required: ['title', 'description', 'address', 'city', 'postal_code', 'rent_amount', 'rooms'],
    });
  }

  // Validate German postal code format (5 digits)
  if (postal_code && !/^\d{5}$/.test(postal_code)) {
    throw httpError(400, 'Invalid postal code format', {
      expected: 'Exactly 5 digits (German postal code format)',
      received: postal_code,
    });
  }

  const propertyData = {
    // Basic Information (German)
    title: sanitizeString(title, { maxLength: 200 }),
    description: sanitizeString(description, { maxLength: 2000 }),
    
    // German Address Format
    address: sanitizeString(address, { maxLength: 200 }),
    house_number: sanitizeString(house_number, { maxLength: 10 }) || '1',
    postal_code: sanitizeString(postal_code, { maxLength: 5 }),
    city: sanitizeString(city, { maxLength: 100 }),
    state: sanitizeString(state, { maxLength: 100 }) || 'Nordrhein-Westfalen',
    stadtteil: sanitizeString(district, { maxLength: 100 }),
    land: 'Deutschland',
    
    // German Rental Pricing Structure
    price: clampNumber(rent_amount, { min: 1, max: 50000 }), // Cold rent (base rent)
    nebenkosten_warm: clampNumber(additional_costs_warm, { min: 0, max: 10000 }),
    nebenkosten_kalt: clampNumber(additional_costs_cold, { min: 0, max: 10000 }),
    kaution: clampNumber(deposit_amount, { min: 0, max: 100000, fallback: clampNumber(rent_amount, { min: 1, max: 50000 }) * 2 }), // Default 2 months
    kaution_type: sanitizeString(deposit_type, { maxLength: 50 }) || 'geld',
    provision: clampNumber(commission, { min: 0, max: 10000 }),
    
    // Property Details (German)
    size: clampNumber(size_sqm, { min: 1, max: 2000 }),
    gesamtflaeche: clampNumber(total_area, { min: 1, max: 5000 }),
    rooms: clampNumber(rooms, { min: 1, max: 20 }),
    bedrooms: clampNumber(bedrooms, { min: 0, max: 10 }),
    bathrooms: clampNumber(bathrooms, { min: 1, max: 10, fallback: 1 }),
    
    // Building Information
    floor: clampNumber(floor, { min: -5, max: 50 }),
    etagen_gesamt: clampNumber(total_floors, { min: 1, max: 100 }),
    aufzug: !!elevator,
    baujahr: clampNumber(year_built, { min: 1800, max: new Date().getFullYear() }),
    saniert_jahr: clampNumber(year_renovated, { min: 1800, max: new Date().getFullYear() }),
    
    // Energy Information
    energieausweis_typ: sanitizeString(energy_certificate_type, { maxLength: 50 }) || 'verbrauch',
    energieeffizienzklasse: sanitizeString(energy_efficiency_class, { maxLength: 5 }),
    energieverbrauch: clampNumber(energy_consumption, { min: 0, max: 1000 }),
    heizungsart: sanitizeString(heating_type, { maxLength: 100 }) || 'Zentralheizung',
    energietraeger: sanitizeString(energy_source, { maxLength: 100 }) || 'Gas',
    
    // Amenities & Features (German)
    moebliert_typ: sanitizeString(furnished_type, { maxLength: 50 }) || (furnished === true ? 'moebliert' : 'unmoebliert'),
    kueche: sanitizeString(kitchen_type, { maxLength: 100 }) || 'einbaukueche',
    haustiere: sanitizeString(pets_allowed, { maxLength: 50 }) || 'nach_vereinbarung',
    rauchen: sanitizeString(smoking_allowed, { maxLength: 50 }) || 'nicht_erlaubt',
    
    // Property Features
    balkon_terrasse: clampNumber(balcony_terrace, { min: 0, max: 10, fallback: balcony === true ? 1 : 0 }),
    balkon_groesse: clampNumber(balcony_size, { min: 0, max: 200 }),
    garten: !!garden,
    garten_groesse: clampNumber(garden_size, { min: 0, max: 10000 }),
    keller: !!cellar,
    dachboden: !!attic,
    
    // Parking & Technical
    stellplatz: sanitizeString(parking_type, { maxLength: 50 }) || (parking === true ? 'tiefgarage' : 'keiner'),
    stellplaetze_anzahl: clampNumber(parking_spaces, { min: 0, max: 10, fallback: parking === true ? 1 : 0 }),
    garage: !!garage,
    internet: !!(internet || internet_included),
    internet_geschwindigkeit: sanitizeString(internet_speed, { maxLength: 50 }),
    kabel_tv: !!cable_tv,
    
    // Rental Terms (German)
    verfuegbar_ab: available_from ? new Date(available_from).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    verfuegbar_bis: available_until ? new Date(available_until).toISOString().split('T')[0] : null,
    mindestmietdauer: clampNumber(minimum_lease_duration, { min: 1, max: 60, fallback: lease_duration === 'short' ? 3 : null }),
    mietvertrag_typ: sanitizeString(contract_type, { maxLength: 50 }) || 'unbefristet',
    vermietung_typ: sanitizeString(rental_type || rent_type, { maxLength: 50 }) || 'langzeit',
    
    // Status & Management
    status: 'verfuegbar',
    landlord_id: authContext.authUser.id,
    created_by: authContext.authUser.id,
    
    // Media & Additional Info
    bilder: Array.isArray(images) ? images : [],
    oeffentliche_verkehrsmittel: Array.isArray(public_transport || nearby_transport) ? (public_transport || nearby_transport) : [],
    einkaufsmoeglichkeiten: Array.isArray(shopping_options) ? shopping_options : [],
    hausordnung: house_rules ? [sanitizeString(house_rules, { maxLength: 1000 })] : [],
    besonderheiten: sanitizeString(special_features, { maxLength: 1000 }),
    sonstiges: sanitizeString(other_info, { maxLength: 1000 }) || '',
    
    // Legacy compatibility fields (if needed by frontend)
    property_type: sanitizeString(property_type, { maxLength: 50 }) || 'apartment',
    amenities: Array.isArray(amenities) ? amenities : []
  };

  const { data: newProperty, error } = await safeInsert('apartments', propertyData);

  if (error) {
    throw httpError(500, 'Failed to create property', error);
  }

  return respond(201, {
    success: true,
    data: {
      ...mapApartmentToFrontend(newProperty), // Map German fields to English for frontend
      // Include calculated total_rent for frontend display
      total_rent: (newProperty.price + newProperty.nebenkosten_warm + newProperty.nebenkosten_kalt),
      formatted_address: `${newProperty.address} ${newProperty.house_number}, ${newProperty.postal_code} ${newProperty.city}, ${newProperty.state}`,
      // German rental terminology for display
      rent_display: {
        price: `€${newProperty.price}`,
        nebenkosten_warm: `€${newProperty.nebenkosten_warm}`,
        nebenkosten_kalt: `€${newProperty.nebenkosten_kalt}`,
        total_rent: `€${(newProperty.price + newProperty.nebenkosten_warm + newProperty.nebenkosten_kalt)}`,
        kaution: `€${newProperty.kaution}`
      }
    },
    message: 'Immobilie erfolgreich hinzugefügt (Property added successfully)'
  });
};

const handleGetProperties = async (event, authContext) => {
  const query = event.queryStringParameters || {};
  const { 
    city, 
    min_rent, 
    max_rent, 
    min_rooms, 
    max_rooms, 
    furnished, 
    pets_allowed: pets,
    parking,
    limit = 50,
    offset = 0
  } = query;

  const { data: properties, error } = await safeSelect('apartments', {
    select: `
      *,
      users:landlord_id (
        id,
        first_name,
        last_name,
        phone,
        email
      )
    `,
    filters: (queryBuilder) => {
      let q = queryBuilder.eq('status', 'verfuegbar');

      if (city) {
        q = q.ilike('city', `%${city}%`);
      }
      if (min_rent) {
        q = q.gte('price', clampNumber(min_rent, { min: 0, max: 50000 }));
      }
      if (max_rent) {
        q = q.lte('price', clampNumber(max_rent, { min: 0, max: 50000 }));
      }
      if (min_rooms) {
        q = q.gte('rooms', clampNumber(min_rooms, { min: 1, max: 20 }));
      }
      if (max_rooms) {
        q = q.lte('rooms', clampNumber(max_rooms, { min: 1, max: 20 }));
      }
      if (furnished === 'true') {
        q = q.eq('moebliert_typ', 'moebliert');
      }
      if (pets === 'true') {
        q = q.in('haustiere', ['erlaubt', 'nach_vereinbarung']);
      }
      if (parking === 'true') {
        q = q.neq('stellplatz', 'keiner');
      }

      const limitNum = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
      const offsetNum = clampNumber(offset, { min: 0, max: 10000, fallback: 0 });
      q = q.range(offsetNum, offsetNum + limitNum - 1);
      q = q.order('created_at', { ascending: false });

      return q;
    }
  });

  if (error) {
    throw httpError(500, 'Failed to fetch properties', error);
  }

  // Calculate total_rent for each property and format response
  const formattedProperties = (properties || []).map(property => ({
    ...property,
    total_rent: property.price + property.nebenkosten_warm + property.nebenkosten_kalt,
    formatted_address: `${property.address} ${property.house_number}, ${property.postal_code} ${property.city}`,
    rent_display: {
      price: `€${property.price}`,
      nebenkosten_warm: `€${property.nebenkosten_warm}`,
      nebenkosten_kalt: `€${property.nebenkosten_kalt}`,
      total_rent: `€${property.price + property.nebenkosten_warm + property.nebenkosten_kalt}`,
      kaution: `€${property.kaution}`
    }
  }));

  return respond(200, {
    success: true,
    data: formattedProperties,
    count: formattedProperties.length,
    message: 'Properties fetched successfully'
  });
};