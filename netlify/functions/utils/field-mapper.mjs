// Field Mapper Utility
// Provides two-way mappings between the English-first canonical schema and legacy German columns.

const createFieldAlias = (...aliases) => aliases.filter(Boolean);

export const FIELD_ALIASES = {
  apartments: {
    title: createFieldAlias('title', 'titel'),
    description: createFieldAlias('description', 'beschreibung'),
    price: createFieldAlias('price', 'kaltmiete'),
    total_rent: createFieldAlias('total_rent', 'warmmiete'),
    address: createFieldAlias('address', 'strasse'),
    house_number: createFieldAlias('house_number', 'hausnummer'),
    postal_code: createFieldAlias('postal_code', 'plz'),
    city: createFieldAlias('city', 'ort'),
    state: createFieldAlias('state', 'bundesland'),
    size_sqm: createFieldAlias('size', 'wohnflaeche'),
    rooms: createFieldAlias('rooms', 'zimmer'),
    bedrooms: createFieldAlias('bedrooms', 'schlafzimmer'),
    bathrooms: createFieldAlias('bathrooms', 'badezimmer'),
    floor: createFieldAlias('floor', 'etage'),
    landlord_id: createFieldAlias('landlord_id', 'owner_id', 'vermieter_id'),
    available_from: createFieldAlias('available_from', 'verfuegbar_ab'),
    available_until: createFieldAlias('available_until', 'verfuegbar_bis'),
    latitude: createFieldAlias('latitude', 'breitengrad'),
    longitude: createFieldAlias('longitude', 'laengengrad')
  },
  users: {
    first_name: createFieldAlias('first_name', 'vorname'),
    last_name: createFieldAlias('last_name', 'nachname'),
    phone: createFieldAlias('phone', 'telefon'),
    username: createFieldAlias('username', 'benutzername'),
    role: createFieldAlias('role', 'rolle'),
    user_type: createFieldAlias('user_type', 'nutzertyp')
  },
  reviews: {
    title: createFieldAlias('title', 'titel'),
    comment: createFieldAlias('comment', 'kommentar'),
    rating: createFieldAlias('rating', 'gesamtbewertung')
  },
  viewing_requests: {
    apartment_id: createFieldAlias('apartment_id', 'apartment_id'),
    requester_id: createFieldAlias('requester_id', 'mieter_id'),
    landlord_id: createFieldAlias('landlord_id', 'vermieter_id'),
    status: createFieldAlias('status', 'status'),
    requested_date: createFieldAlias('requested_date', 'preferred_date_1', 'wunschdatum_1'),
    alternative_date_1: createFieldAlias('alternative_date_1', 'preferred_date_2', 'wunschdatum_2'),
    alternative_date_2: createFieldAlias('alternative_date_2', 'preferred_date_3', 'wunschdatum_3'),
    preferred_date_1: createFieldAlias('preferred_date_1', 'requested_date', 'wunschdatum_1'),
    preferred_date_2: createFieldAlias('preferred_date_2', 'alternative_date_1', 'wunschdatum_2'),
    preferred_date_3: createFieldAlias('preferred_date_3', 'alternative_date_2', 'wunschdatum_3'),
    confirmed_date: createFieldAlias('confirmed_date', 'bestaetigtes_datum')
  }
};

const resolveAliasValue = (record, aliases) => {
  if (!record) return undefined;
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== null) {
      return record[alias];
    }
  }
  return undefined;
};

const cloneWithAliases = (record, aliasMap, { includeFallback = false } = {}) => {
  if (!record) return record;

  const cloned = { ...record };

  Object.entries(aliasMap).forEach(([canonicalKey, aliases]) => {
    const value = resolveAliasValue(record, aliases);
    if (value !== undefined) {
      cloned[canonicalKey] = value;
      if (includeFallback) {
        aliases.forEach(alias => {
          cloned[alias] = value;
        });
      }
    }
  });

  return cloned;
};

export function applyAliasesForWrite(record, aliasMap) {
  if (!record) return record;

  const prepared = { ...record };

  Object.entries(aliasMap).forEach(([canonicalKey, aliases]) => {
    const value = resolveAliasValue(prepared, aliases) ?? prepared[canonicalKey];
    if (value === undefined) return;

    // Ensure canonical key is set
    prepared[canonicalKey] = value;
    // Mirror to every alias to keep German fields populated for legacy consumers
    aliases.forEach(alias => {
      prepared[alias] = value;
    });
  });

  return prepared;
}

export function mapApartmentToFrontend(apartment, { keepLegacy = false } = {}) {
  return cloneWithAliases(apartment, FIELD_ALIASES.apartments, { includeFallback: keepLegacy });
}

export function mapUserToFrontend(user, { keepLegacy = false } = {}) {
  return cloneWithAliases(user, FIELD_ALIASES.users, { includeFallback: keepLegacy });
}

export function mapReviewToFrontend(review, { keepLegacy = false } = {}) {
  return cloneWithAliases(review, FIELD_ALIASES.reviews, { includeFallback: keepLegacy });
}

export function mapArrayToFrontend(array, type = 'apartment', options = {}) {
  if (!Array.isArray(array)) return array;

  const mapper = {
    apartment: mapApartmentToFrontend,
    user: mapUserToFrontend,
    review: mapReviewToFrontend
  }[type];

  return array.map(item => mapper(item, options));
}

export function getColumnAliases(table, canonicalKey) {
  const aliasMap = FIELD_ALIASES[table];
  if (!aliasMap) return [canonicalKey];
  const aliases = aliasMap[canonicalKey];
  if (!aliases || aliases.length === 0) return [canonicalKey];
  return aliases;
}

export function primaryColumn(table, canonicalKey) {
  return getColumnAliases(table, canonicalKey)[0];
}

export function buildOrCondition(table, canonicalKey, operator, value) {
  const aliases = getColumnAliases(table, canonicalKey);
  if (aliases.length <= 1) {
    return `${aliases[0]}.${operator}.${value}`;
  }
  return aliases.map(alias => `${alias}.${operator}.${value}`).join(',');
}

export function mirrorAliasesIntoPayload(table, payload) {
  const aliasMap = FIELD_ALIASES[table];
  if (!aliasMap) return payload;
  return applyAliasesForWrite(payload, aliasMap);
}