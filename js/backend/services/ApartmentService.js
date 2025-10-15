const { supabase } = require('../config/supabase');

/**
 * Updated ApartmentService for German Rental Database Schema
 * Handles German rental market terminology and structure
 */
class ApartmentService {
  static async create(apartmentData) {
    // Transform input data to German schema format
    const germanData = this.transformToGermanSchema(apartmentData);
    
    const { data, error } = await supabase
      .from('apartments')
      .insert([germanData])
      .select()
      .single();
    
    if (error) throw error;
    
    // Add calculated warmmiete for response
    const response = {
      ...data,
      warmmiete: data.kaltmiete + data.nebenkosten_warm + data.nebenkosten_kalt,
      formatted_address: `${data.strasse} ${data.hausnummer}, ${data.plz} ${data.ort}, ${data.bundesland}`
    };
    
    return response;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('apartments')
      .select(`
        *,
        vermieter:users!apartments_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    // Add calculated fields and German formatting
    return this.formatGermanResponse(data);
  }

  static async list(options = {}) {
    let query = supabase
      .from('apartments')
      .select(`
        *,
        vermieter:users!apartments_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname
        )
      `);
    
    // German rental market filters
    if (options.city || options.ort) {
      query = query.ilike('ort', `%${options.city || options.ort}%`);
    }
    
    if (options.plz) {
      query = query.eq('plz', options.plz);
    }
    
    if (options.bundesland) {
      query = query.eq('bundesland', options.bundesland);
    }
    
    if (options.stadtteil) {
      query = query.ilike('stadtteil', `%${options.stadtteil}%`);
    }
    
    // German pricing filters (Kaltmiete)
    if (options.minKaltmiete || options.minPrice) {
      query = query.gte('kaltmiete', options.minKaltmiete || options.minPrice);
    }
    
    if (options.maxKaltmiete || options.maxPrice) {
      query = query.lte('kaltmiete', options.maxKaltmiete || options.maxPrice);
    }
    
    // Warmmiete filtering (calculated field)
    if (options.minWarmmiete) {
      // Use RPC function for calculated field filtering
      query = query.gte('kaltmiete_plus_nebenkosten', options.minWarmmiete);
    }
    
    if (options.maxWarmmiete) {
      query = query.lte('kaltmiete_plus_nebenkosten', options.maxWarmmiete);
    }
    
    // Room filters
    if (options.minZimmer || options.minRooms) {
      query = query.gte('zimmer', options.minZimmer || options.minRooms);
    }
    
    if (options.maxZimmer || options.maxRooms) {
      query = query.lte('zimmer', options.maxZimmer || options.maxRooms);
    }
    
    // Size filters (Wohnfläche)
    if (options.minWohnflaeche || options.minSize) {
      query = query.gte('wohnflaeche', options.minWohnflaeche || options.minSize);
    }
    
    if (options.maxWohnflaeche || options.maxSize) {
      query = query.lte('wohnflaeche', options.maxWohnflaeche || options.maxSize);
    }
    
    // German rental features
    if (options.moebliert !== undefined) {
      if (options.moebliert === true || options.moebliert === 'true') {
        query = query.eq('moebliert_typ', 'moebliert');
      } else if (options.moebliert === false || options.moebliert === 'false') {
        query = query.eq('moebliert_typ', 'unmoebliert');
      }
    }
    
    // Backward compatibility for 'furnished' filter
    if (options.furnished !== undefined) {
      if (options.furnished === true || options.furnished === 'true') {
        query = query.eq('moebliert_typ', 'moebliert');
      } else if (options.furnished === false || options.furnished === 'false') {
        query = query.eq('moebliert_typ', 'unmoebliert');
      }
    }
    
    // Pet policy (Haustiere)
    if (options.haustiere !== undefined) {
      if (options.haustiere === true || options.haustiere === 'erlaubt') {
        query = query.in('haustiere', ['erlaubt', 'nach_vereinbarung']);
      } else if (options.haustiere === false || options.haustiere === 'nicht_erlaubt') {
        query = query.eq('haustiere', 'nicht_erlaubt');
      }
    }
    
    // Backward compatibility for petFriendly
    if (options.petFriendly !== undefined) {
      if (options.petFriendly === true || options.petFriendly === 'true') {
        query = query.in('haustiere', ['erlaubt', 'nach_vereinbarung']);
      } else {
        query = query.eq('haustiere', 'nicht_erlaubt');
      }
    }
    
    // Parking (Stellplatz)
    if (options.stellplatz !== undefined || options.parking !== undefined) {
      const parkingValue = options.stellplatz || options.parking;
      if (parkingValue === true || parkingValue === 'true') {
        query = query.neq('stellplatz', 'keiner');
      } else if (parkingValue === false || parkingValue === 'false') {
        query = query.eq('stellplatz', 'keiner');
      }
    }
    
    // Status filter
    if (options.status) {
      query = query.eq('status', options.status);
    } else {
      query = query.eq('status', 'verfuegbar'); // Default to available
    }
    
    // Owner filter (Vermieter)
    if (options.vermieterId || options.ownerId) {
      query = query.eq('vermieter_id', options.vermieterId || options.ownerId);
    }
    
    // Energy efficiency
    if (options.energieeffizienzklasse) {
      query = query.eq('energieeffizienzklasse', options.energieeffizienzklasse);
    }
    
    // Rental type
    if (options.vermietung_typ) {
      query = query.eq('vermietung_typ', options.vermietung_typ);
    }
    
    // Date filters
    if (options.verfuegbar_ab) {
      query = query.gte('verfuegbar_ab', options.verfuegbar_ab);
    }
    
    // Sorting
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    
    // Map old sorting fields to German schema
    const sortMapping = {
      'price': 'kaltmiete',
      'created_at': 'created_at',
      'rooms': 'zimmer',
      'size': 'wohnflaeche',
      'city': 'ort'
    };
    
    const germanSortField = sortMapping[sortBy] || sortBy;
    query = query.order(germanSortField, sortOrder);
    
    // Pagination
    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Format all responses with German rental calculations
    return data.map(apartment => this.formatGermanResponse(apartment));
  }

  static async update(id, updateData) {
    // Transform update data to German schema
    const germanData = this.transformToGermanSchema(updateData);
    
    const { data, error } = await supabase
      .from('apartments')
      .update(germanData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.formatGermanResponse(data);
  }

  static async delete(id) {
    const { data, error } = await supabase
      .from('apartments')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async findByOwner(ownerId) {
    const { data, error } = await supabase
      .from('apartments')
      .select(`
        *,
        vermieter:users!apartments_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .eq('vermieter_id', ownerId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data.map(apartment => this.formatGermanResponse(apartment));
  }

  /**
   * Transform legacy field names to German schema
   */
  static transformToGermanSchema(data) {
    const transformed = { ...data };
    
    // Field mappings from old schema to German schema
    const fieldMapping = {
      'title': 'titel',
      'description': 'beschreibung',
      'address': 'strasse',
      'house_number': 'hausnummer',
      'city': 'ort',
      'postal_code': 'plz',
      'state': 'bundesland',
      'rent_amount': 'kaltmiete',
      'additional_costs_warm': 'nebenkosten_warm',
      'additional_costs_cold': 'nebenkosten_kalt',
      'deposit_amount': 'kaution',
      'size_sqm': 'wohnflaeche',
      'total_area': 'gesamtflaeche',
      'rooms': 'zimmer',
      'bedrooms': 'schlafzimmer',
      'bathrooms': 'badezimmer',
      'floor': 'etage',
      'total_floors': 'etagen_gesamt',
      'elevator': 'aufzug',
      'year_built': 'baujahr',
      'owner_id': 'vermieter_id',
      'landlord_id': 'vermieter_id',
      'images': 'bilder',
      'pets_allowed': 'haustiere',
      'smoking_allowed': 'rauchen',
      'furnished': 'moebliert_typ',
      'available_from': 'verfuegbar_ab'
    };
    
    // Apply field mappings
    Object.keys(fieldMapping).forEach(oldField => {
      if (transformed[oldField] !== undefined) {
        transformed[fieldMapping[oldField]] = transformed[oldField];
        delete transformed[oldField];
      }
    });
    
    // Handle special transformations
    if (transformed.furnished !== undefined) {
      transformed.moebliert_typ = transformed.furnished === true ? 'moebliert' : 'unmoebliert';
      delete transformed.furnished;
    }
    
    if (transformed.pets_allowed !== undefined) {
      transformed.haustiere = transformed.pets_allowed === true ? 'erlaubt' : 'nicht_erlaubt';
      delete transformed.pets_allowed;
    }
    
    return transformed;
  }

  /**
   * Format response with German rental calculations and display info
   */
  static formatGermanResponse(apartment) {
    return {
      ...apartment,
      // Calculated warmmiete
      warmmiete: apartment.kaltmiete + apartment.nebenkosten_warm + apartment.nebenkosten_kalt,
      
      // Formatted address
      formatted_address: `${apartment.strasse} ${apartment.hausnummer}, ${apartment.plz} ${apartment.ort}, ${apartment.bundesland}`,
      
      // German rental display formatting
      rent_display: {
        kaltmiete: `€${apartment.kaltmiete}`,
        nebenkosten_warm: `€${apartment.nebenkosten_warm}`,
        nebenkosten_kalt: `€${apartment.nebenkosten_kalt}`,
        warmmiete: `€${apartment.kaltmiete + apartment.nebenkosten_warm + apartment.nebenkosten_kalt}`,
        kaution: `€${apartment.kaution}`
      },
      
      // Backward compatibility fields for existing frontend
      price: apartment.kaltmiete, // Map to old 'price' field
      location: apartment.ort,    // Map to old 'location' field
      address: `${apartment.strasse} ${apartment.hausnummer}`,
      city: apartment.ort,
      postal_code: apartment.plz,
      rooms: apartment.zimmer,
      size: apartment.wohnflaeche,
      furnished: apartment.moebliert_typ === 'moebliert',
      pet_friendly: apartment.haustiere === 'erlaubt' || apartment.haustiere === 'nach_vereinbarung',
      owner_id: apartment.vermieter_id,
      images: apartment.bilder
    };
  }
}

module.exports = ApartmentService;