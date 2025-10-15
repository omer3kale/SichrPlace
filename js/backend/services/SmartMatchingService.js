const supabaseModule = require('../config/supabase');

let supabaseClient = supabaseModule && supabaseModule.supabase
  ? supabaseModule.supabase
  : supabaseModule;

const DEFAULT_FETCH_LIMIT = 120;
const SCORE_WEIGHTS = {
  budget: 22,
  location: 18,
  propertyType: 10,
  rooms: 8,
  amenities: 15,
  pets: 6,
  furnished: 4,
  distance: 10,
  availability: 7
};

const FALLBACK_APARTMENTS = [
  {
    id: 'demo-berlin-01',
    title: 'Demo • Helle 2-Zimmer-Wohnung in Berlin Mitte',
    description: 'Referenzangebot für lokale Entwicklung ohne Datenbankverbindung.',
    city: 'Berlin',
    postal_code: '10117',
    price: 1190,
    size: 60,
    rooms: 2,
    bathrooms: 1,
    amenities: ['balcony', 'dishwasher', 'elevator'],
    pet_friendly: true,
    furnished: true,
    latitude: 52.5208,
    longitude: 13.4095,
    available_from: new Date().toISOString(),
    status: 'available',
    images: []
  },
  {
    id: 'demo-hamburg-01',
    title: 'Demo • Modernes Loft in Hamburg Hafencity',
    description: 'Fallback-Datensatz für Smart Matching.',
    city: 'Hamburg',
    postal_code: '20457',
    price: 1490,
    size: 75,
    rooms: 3,
    bathrooms: 1,
    amenities: ['balcony', 'garage', 'internet'],
    pet_friendly: false,
    furnished: false,
    latitude: 53.5413,
    longitude: 9.9841,
    available_from: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    status: 'available',
    images: []
  },
  {
    id: 'demo-munich-01',
    title: 'Demo • Ruhiges Apartment nahe Englischer Garten',
    description: 'Fallback-Datensatz für Smart Matching.',
    city: 'München',
    postal_code: '80802',
    price: 1790,
    size: 70,
    rooms: 3,
    bathrooms: 1,
    amenities: ['garden', 'parking', 'internet'],
    pet_friendly: true,
    furnished: false,
    latitude: 48.1592,
    longitude: 11.5926,
    available_from: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    status: 'available',
    images: []
  }
];

const isSupabaseReady = () => Boolean(supabaseClient && typeof supabaseClient.from === 'function');

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
};

const calculateDistanceKm = (origin, destination) => {
  if (!origin || !destination) return null;

  const { lat: lat1, lon: lon1 } = origin;
  const { lat: lat2, lon: lon2 } = destination;

  if (
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
  ) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normaliseTenantPreferences = (row) => {
  if (!row) {
    return {
      raw: null,
      fallback: true,
      budgetMin: null,
      budgetMax: null,
      preferredCities: new Set(),
      preferredPostalCodes: new Set(),
      propertyTypes: new Set(),
      amenities: new Set(),
      minRooms: null,
      maxRooms: null,
      petFriendly: null,
      furnished: null,
      maxDistanceKm: null,
      anchorLocation: null,
      moveInDate: null
    };
  }

  const preferences = row.preferences || {};
  const safeLower = (value) => (typeof value === 'string' ? value.toLowerCase() : value);

  const cityList = ensureArray(
    preferences.cities ||
    preferences.locations ||
    preferences.preferredCities ||
    preferences.preferred_locations
  ).map((item) => item.toString().trim()).filter(Boolean);

  const propertyTypeList = ensureArray(
    preferences.propertyTypes ||
    preferences.property_types ||
    preferences.types
  ).map((item) => item.toString().trim().toLowerCase());

  const amenitiesList = ensureArray(preferences.amenities).map((item) => item.toString().trim().toLowerCase());

  const anchor = preferences.preferred_location || preferences.location || preferences.anchorLocation;
  const anchorLocation = anchor && typeof anchor === 'object'
    ? {
        lat: toNumberOrNull(anchor.lat ?? anchor.latitude ?? anchor.latitute),
        lon: toNumberOrNull(anchor.lon ?? anchor.lng ?? anchor.longitude),
        label: anchor.label || anchor.city || null
      }
    : null;

  return {
    raw: row,
    fallback: false,
    budgetMin: toNumberOrNull(row.budget_min ?? preferences.budget_min ?? preferences.budgetMin),
    budgetMax: toNumberOrNull(row.budget_max ?? preferences.budget_max ?? preferences.budgetMax),
    preferredCities: new Set(cityList.map((item) => item.toLowerCase())),
    preferredPostalCodes: new Set(
      ensureArray(preferences.postalCodes || preferences.zipCodes || preferences.postcodes)
        .map((item) => item.toString().trim())
        .filter(Boolean)
    ),
    propertyTypes: new Set(propertyTypeList),
    amenities: new Set(amenitiesList),
    minRooms: toNumberOrNull(preferences.minRooms ?? preferences.rooms?.min ?? row.min_rooms ?? row.preferences?.min_rooms),
    maxRooms: toNumberOrNull(preferences.maxRooms ?? preferences.rooms?.max ?? row.max_rooms ?? row.preferences?.max_rooms),
    petFriendly: typeof (preferences.petFriendly ?? row.pet_friendly) === 'boolean'
      ? Boolean(preferences.petFriendly ?? row.pet_friendly)
      : null,
    furnished: typeof (preferences.furnished ?? row.preferences?.furnished ?? row.furnished) === 'boolean'
      ? Boolean(preferences.furnished ?? row.preferences?.furnished ?? row.furnished)
      : null,
    maxDistanceKm: toNumberOrNull(row.max_distance_km ?? preferences.maxDistanceKm ?? preferences.max_distance_km),
    anchorLocation,
    moveInDate: toDateOrNull(row.preferred_move_in_date ?? preferences.move_in_date ?? preferences.moveInDate)
  };
};

const scoreApartmentForTenant = (apartment, pref) => {
  const scoreBreakdown = [];
  const disqualifiers = [];
  const matchedAmenities = [];
  let score = 0;
  let maxScore = 0;

  const price = toNumberOrNull(apartment.price);

  if (pref.budgetMin !== null || pref.budgetMax !== null) {
    maxScore += SCORE_WEIGHTS.budget;
    if (price === null) {
      disqualifiers.push('price_unknown');
    } else {
      const withinMin = pref.budgetMin === null || price >= pref.budgetMin;
      const withinMax = pref.budgetMax === null || price <= pref.budgetMax;

      if (withinMin && withinMax) {
        score += SCORE_WEIGHTS.budget;
        scoreBreakdown.push('Budget passt zum Angebot');
      } else if (pref.budgetMax !== null && price > pref.budgetMax * 1.2) {
        disqualifiers.push('price_too_high');
      } else if (pref.budgetMin !== null && price < pref.budgetMin * 0.7) {
        // too cheap can indicate quality mismatch – treat softly
        scoreBreakdown.push('Preise darunter (mögliche Alternative)');
        score += SCORE_WEIGHTS.budget * 0.4;
      }
    }
  }

  const apartmentCity = (apartment.city || apartment.location || '').toString().trim().toLowerCase();
  if (pref.preferredCities.size > 0) {
    maxScore += SCORE_WEIGHTS.location;
    if (pref.preferredCities.has(apartmentCity)) {
      score += SCORE_WEIGHTS.location;
      scoreBreakdown.push('Bevorzugte Stadt stimmt überein');
    } else {
      scoreBreakdown.push('Andere Stadt als bevorzugt');
    }
  }

  if (pref.preferredPostalCodes.size > 0) {
    maxScore += SCORE_WEIGHTS.location * 0.5;
    if (apartment.postal_code && pref.preferredPostalCodes.has(apartment.postal_code.toString())) {
      score += SCORE_WEIGHTS.location * 0.5;
      scoreBreakdown.push('Bevorzugte PLZ getroffen');
    }
  }

  if (pref.propertyTypes.size > 0) {
    maxScore += SCORE_WEIGHTS.propertyType;
    const apartmentType = (apartment.property_type || apartment.type || '')
      .toString()
      .trim()
      .toLowerCase();

    if (apartmentType && pref.propertyTypes.has(apartmentType)) {
      score += SCORE_WEIGHTS.propertyType;
      scoreBreakdown.push('Gewünschter Immobilientyp');
    }
  }

  if (pref.minRooms !== null || pref.maxRooms !== null) {
    maxScore += SCORE_WEIGHTS.rooms;
    const rooms = toNumberOrNull(apartment.rooms);

    if (rooms === null) {
      scoreBreakdown.push('Zimmeranzahl unbekannt');
    } else {
      const meetsMin = pref.minRooms === null || rooms >= pref.minRooms;
      const meetsMax = pref.maxRooms === null || rooms <= pref.maxRooms;

      if (meetsMin && meetsMax) {
        score += SCORE_WEIGHTS.rooms;
        scoreBreakdown.push('Zimmeranzahl im gewünschten Bereich');
      } else if (!meetsMin) {
        disqualifiers.push('not_enough_rooms');
      } else if (!meetsMax) {
        scoreBreakdown.push('Mehr Zimmer als gewünscht (weiche Abweichung)');
        score += SCORE_WEIGHTS.rooms * 0.4;
      }
    }
  }

  if (pref.amenities.size > 0) {
    maxScore += SCORE_WEIGHTS.amenities;
    const apartmentAmenities = ensureArray(apartment.amenities).map((item) => item.toString().trim().toLowerCase());
    const overlaps = apartmentAmenities.filter((amenity) => pref.amenities.has(amenity));

    if (overlaps.length > 0) {
      matchedAmenities.push(...overlaps);
      const amenityScore = Math.min(overlaps.length / pref.amenities.size, 1) * SCORE_WEIGHTS.amenities;
      score += amenityScore;
      scoreBreakdown.push(`${overlaps.length} Wunsch-Ausstattungen gefunden`);
    }
  }

  if (pref.petFriendly !== null) {
    maxScore += SCORE_WEIGHTS.pets;
    if (apartment.pet_friendly === pref.petFriendly) {
      score += SCORE_WEIGHTS.pets;
      scoreBreakdown.push(pref.petFriendly ? 'Haustiere erlaubt' : 'Haustierfreie Wohnung');
    } else if (pref.petFriendly && !apartment.pet_friendly) {
      disqualifiers.push('pets_not_allowed');
    }
  }

  if (pref.furnished !== null) {
    maxScore += SCORE_WEIGHTS.furnished;
    if (typeof apartment.furnished === 'boolean' && apartment.furnished === pref.furnished) {
      score += SCORE_WEIGHTS.furnished;
      scoreBreakdown.push(pref.furnished ? 'Möbliert wie gewünscht' : 'Unmöbliert wie gewünscht');
    }
  }

  const apartmentLocation = {
    lat: toNumberOrNull(apartment.latitude),
    lon: toNumberOrNull(apartment.longitude)
  };
  const distanceKm = calculateDistanceKm(pref.anchorLocation, apartmentLocation);

  if (pref.anchorLocation && pref.maxDistanceKm) {
    maxScore += SCORE_WEIGHTS.distance;
    if (distanceKm !== null && distanceKm <= pref.maxDistanceKm) {
      score += SCORE_WEIGHTS.distance;
      scoreBreakdown.push(`Innerhalb ${pref.maxDistanceKm} km (${distanceKm.toFixed(1)} km)`);
    } else if (distanceKm !== null) {
      scoreBreakdown.push(`Entfernung ${distanceKm.toFixed(1)} km (außerhalb)`);
    }
  }

  if (pref.moveInDate) {
    maxScore += SCORE_WEIGHTS.availability;
    const availableFrom = toDateOrNull(apartment.available_from);
    if (availableFrom && availableFrom <= pref.moveInDate) {
      score += SCORE_WEIGHTS.availability;
      scoreBreakdown.push('Einzugstermin passt');
    } else if (availableFrom) {
      const diffDays = Math.round((availableFrom - pref.moveInDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) {
        score += SCORE_WEIGHTS.availability * 0.6;
        scoreBreakdown.push(`Einzug ${diffDays} Tage nach Wunschtermin`);
      } else {
        scoreBreakdown.push('Einzugstermin weicht deutlich ab');
      }
    }
  }

  const hardStop = disqualifiers.includes('price_too_high') || disqualifiers.includes('pets_not_allowed') || disqualifiers.includes('not_enough_rooms');

  const coverage = maxScore > 0 ? Math.max(10, Math.round((score / maxScore) * 100)) : 50;

  return {
    apartment,
    score,
    scoreMax: maxScore,
    scorePercent: Math.max(0, Math.min(100, coverage)),
    breakdown: scoreBreakdown,
    disqualifiers,
    matchedAmenities,
    distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(1)) : null,
    hardStop
  };
};

const fetchTenantPreferenceRow = async (userId, userType = 'tenant') => {
  if (!isSupabaseReady()) return { data: null, error: null };

  try {
    const { data, error } = await supabaseClient
      .from('matching_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('user_type', userType)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      return { data: null, error };
    }

    return { data: Array.isArray(data) ? data[0] || null : data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const fetchCandidateApartments = async (pref, limit = DEFAULT_FETCH_LIMIT) => {
  if (!isSupabaseReady()) {
    return { data: FALLBACK_APARTMENTS.slice(0, limit), error: null, fallback: true };
  }

  try {
    let query = supabaseClient
      .from('apartments')
      .select(`
        id,
        owner_id,
        title,
        description,
        location,
        city,
        postal_code,
        price,
        size,
        rooms,
        bathrooms,
        status,
        available_from,
        available_to,
        amenities,
        pet_friendly,
        furnished,
        property_type,
        latitude,
        longitude,
        images,
        created_at
      `)
      .eq('status', 'available')
      .limit(limit);

    if (pref.budgetMin !== null) {
      query = query.gte('price', pref.budgetMin * 0.7);
    }
    if (pref.budgetMax !== null) {
      query = query.lte('price', pref.budgetMax * 1.25);
    }
    if (pref.preferredCities.size > 0) {
      query = query.in('city', Array.from(pref.preferredCities));
    }
    if (pref.preferredPostalCodes.size > 0) {
      query = query.in('postal_code', Array.from(pref.preferredPostalCodes));
    }
    if (pref.propertyTypes.size > 0) {
      query = query.in('property_type', Array.from(pref.propertyTypes));
    }
    if (pref.minRooms !== null) {
      query = query.gte('rooms', pref.minRooms);
    }
    if (pref.maxRooms !== null) {
      query = query.lte('rooms', pref.maxRooms);
    }

    const { data, error } = await query;

    if (error) {
      return { data: FALLBACK_APARTMENTS.slice(0, limit), error, fallback: true };
    }

    return { data: data || [], error: null, fallback: false };
  } catch (error) {
    return { data: FALLBACK_APARTMENTS.slice(0, limit), error, fallback: true };
  }
};

const fetchLandlordApartments = async (userId) => {
  if (!isSupabaseReady()) {
    return { data: FALLBACK_APARTMENTS, error: null, fallback: true };
  }

  try {
    const { data, error } = await supabaseClient
      .from('apartments')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};

const fetchTenantPreferencePool = async (limit = 200) => {
  if (!isSupabaseReady()) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabaseClient
      .from('matching_preferences')
      .select('*')
      .eq('user_type', 'tenant')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
};

const fetchUsersByIds = async (ids) => {
  if (!isSupabaseReady() || ids.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email, first_name, last_name, phone, username, role')
      .in('id', ids);

    if (error || !Array.isArray(data)) {
      return new Map();
    }

    return new Map(data.map((user) => [user.id, user]));
  } catch (error) {
    return new Map();
  }
};

class SmartMatchingService {
  static async getTenantMatches(userId, options = {}) {
    const { data: prefRow, error: prefError } = await fetchTenantPreferenceRow(userId, 'tenant');
    const preferences = normaliseTenantPreferences(prefRow);

    const fetchLimit = toNumberOrNull(options.fetchLimit) || DEFAULT_FETCH_LIMIT;
    const { data: apartments, error: apartmentError, fallback } = await fetchCandidateApartments(preferences, fetchLimit);

    const matches = apartments
      .map((apartment) => scoreApartmentForTenant(apartment, preferences))
      .filter((match) => !match.hardStop)
      .sort((a, b) => b.scorePercent - a.scorePercent)
      .slice(0, toNumberOrNull(options.limit) || 20)
      .map((match) => ({
        apartment: match.apartment,
        score: match.scorePercent,
        insights: match.breakdown,
        matchedAmenities: match.matchedAmenities,
        distanceKm: match.distanceKm,
        rawScore: match.score,
        scoreMax: match.scoreMax,
        disqualifiers: match.disqualifiers
      }));

    return {
      success: true,
      data: matches,
      meta: {
        preferenceFound: Boolean(prefRow),
        fallbackUsed: fallback,
        preferenceFallback: preferences.fallback,
        candidateCount: apartments.length,
        warnings: [prefError, apartmentError].filter(Boolean).map((err) => err.message || 'Unbekannter Fehler'),
        generatedAt: new Date().toISOString()
      }
    };
  }

  static async getLandlordMatches(userId, options = {}) {
    const { data: landlordApartments, error: landlordError } = await fetchLandlordApartments(userId);

    if (!landlordApartments || landlordApartments.length === 0) {
      return {
        success: true,
        data: [],
        meta: {
          message: 'Keine aktiven Inserate gefunden – Smart Matching benötigt mindestens eine veröffentlichte Wohnung.',
          generatedAt: new Date().toISOString(),
          warnings: landlordError ? [landlordError.message || 'Fehler beim Laden der Inserate'] : []
        }
      };
    }

    const { data: tenantPreferences, error: tenantPrefError } = await fetchTenantPreferencePool(options.fetchLimit || 200);
    const tenantIds = tenantPreferences.map((pref) => pref.user_id);
    const tenantMap = await fetchUsersByIds(tenantIds);

    const landlordMatches = tenantPreferences
      .map((prefRow) => {
        const normalised = normaliseTenantPreferences(prefRow);
        const bestMatch = landlordApartments
          .map((apartment) => scoreApartmentForTenant(apartment, normalised))
          .filter((match) => !match.hardStop)
          .sort((a, b) => b.scorePercent - a.scorePercent)[0];

        if (!bestMatch || bestMatch.scorePercent < 25) {
          return null;
        }

        const tenant = tenantMap.get(prefRow.user_id) || {};

        return {
          tenantId: prefRow.user_id,
          tenant: {
            id: prefRow.user_id,
            email: tenant.email || null,
            firstName: tenant.first_name || tenant.firstName || null,
            lastName: tenant.last_name || tenant.lastName || null,
            phone: tenant.phone || null,
            username: tenant.username || null
          },
          score: bestMatch.scorePercent,
          bestApartmentId: bestMatch.apartment.id,
          apartmentTitle: bestMatch.apartment.title,
          matchedAmenities: bestMatch.matchedAmenities,
          distanceKm: bestMatch.distanceKm,
          insights: bestMatch.breakdown,
          rawScore: bestMatch.score,
          scoreMax: bestMatch.scoreMax
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, toNumberOrNull(options.limit) || 25);

    return {
      success: true,
      data: landlordMatches,
      meta: {
        apartmentsConsidered: landlordApartments.length,
        tenantPoolSize: tenantPreferences.length,
        generatedAt: new Date().toISOString(),
        warnings: [tenantPrefError, landlordError].filter(Boolean).map((err) => err.message || 'Unbekannter Fehler')
      }
    };
  }

  static async getPreferences(userId, userType = 'tenant') {
    const { data, error } = await fetchTenantPreferenceRow(userId, userType);
    if (error) {
      return {
        success: false,
        error: error.message || 'Fehler beim Laden der Präferenzen'
      };
    }

    return {
      success: true,
      data: normaliseTenantPreferences(data),
      meta: {
        preferenceFound: Boolean(data),
        generatedAt: new Date().toISOString()
      }
    };
  }

  static async upsertPreferences(userId, userType = 'tenant', payload = {}) {
    if (!isSupabaseReady()) {
      return {
        success: false,
        error: 'Supabase-Konfiguration fehlt – Präferenzen können lokal nicht gespeichert werden.'
      };
    }

    const sanitisedPayload = {
      user_id: userId,
      user_type: userType,
      preferences: payload.preferences || {},
      budget_min: toNumberOrNull(payload.budgetMin ?? payload.budget_min),
      budget_max: toNumberOrNull(payload.budgetMax ?? payload.budget_max),
      max_distance_km: toNumberOrNull(payload.maxDistanceKm ?? payload.max_distance_km),
      pet_friendly: typeof payload.petFriendly === 'boolean' ? payload.petFriendly : null,
      smoking_allowed: typeof payload.smokingAllowed === 'boolean' ? payload.smokingAllowed : null,
      lease_duration_months: toNumberOrNull(payload.leaseDurationMonths ?? payload.lease_duration_months),
      preferred_move_in_date: payload.preferredMoveInDate || payload.preferred_move_in_date || null,
      updated_at: new Date().toISOString(),
      is_active: payload.isActive !== undefined ? Boolean(payload.isActive) : true
    };

    try {
      const { data, error } = await supabaseClient
        .from('matching_preferences')
        .upsert(sanitisedPayload, { onConflict: 'user_id,user_type' })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message || 'Präferenzen konnten nicht gespeichert werden.'
        };
      }

      return {
        success: true,
        data: normaliseTenantPreferences(data),
        meta: {
          savedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unerwarteter Fehler beim Speichern der Präferenzen.'
      };
    }
  }
}

SmartMatchingService.__setSupabaseClient = (client) => {
  supabaseClient = client;
};

SmartMatchingService.__internals = {
  normaliseTenantPreferences,
  scoreApartmentForTenant,
  calculateDistanceKm
};

module.exports = SmartMatchingService;
