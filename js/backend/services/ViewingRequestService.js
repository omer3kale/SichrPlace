const { supabase } = require('../config/supabase');

/**
 * Updated ViewingRequestService for German Rental Database Schema
 * Handles German rental market terminology and structure
 */
class ViewingRequestService {
  static toGermanStatus(status) {
    if (!status) return status;
    const normalized = String(status).toLowerCase();
    const mapping = {
      pending: 'ausstehend',
      ausstehend: 'ausstehend',
      approved: 'bestaetigt',
      confirmed: 'bestaetigt',
      bestaetigt: 'bestaetigt',
      rejected: 'abgelehnt',
      abgelehnt: 'abgelehnt',
      cancelled: 'storniert',
      cancel: 'storniert',
      storniert: 'storniert',
      completed: 'abgeschlossen',
      abgeschlossen: 'abgeschlossen',
      payment_required: 'zahlung_erforderlich',
      zahlung_erforderlich: 'zahlung_erforderlich'
    };
    return mapping[normalized] || status;
  }

  static toLegacyStatus(status) {
    if (!status) return status;
    const normalized = String(status).toLowerCase();
    const mapping = {
      ausstehend: 'pending',
      pending: 'pending',
      bestaetigt: 'approved',
      confirmed: 'approved',
      approved: 'approved',
      abgelehnt: 'rejected',
      rejected: 'rejected',
      storniert: 'cancelled',
      cancelled: 'cancelled',
      abgeschlossen: 'completed',
      completed: 'completed',
      zahlung_erforderlich: 'payment_required',
      payment_required: 'payment_required'
    };
    return mapping[normalized] || status;
  }

  static toGermanPaymentStatus(status) {
    if (!status) return status;
    const normalized = String(status).toLowerCase();
    const mapping = {
      pending: 'ausstehend',
      ausstehend: 'ausstehend',
      paid: 'bezahlt',
      bezahlt: 'bezahlt',
      failed: 'fehlgeschlagen',
      fehlgeschlagen: 'fehlgeschlagen',
      refunded: 'rueckerstattet',
      rueckerstattet: 'rueckerstattet',
      erstattet: 'rueckerstattet',
      reimbursed: 'rueckerstattet'
    };
    return mapping[normalized] || status;
  }

  static toLegacyPaymentStatus(status) {
    if (!status) return status;
    const normalized = String(status).toLowerCase();
    const mapping = {
      ausstehend: 'pending',
      pending: 'pending',
      bezahlt: 'paid',
      paid: 'paid',
      fehlgeschlagen: 'failed',
      failed: 'failed',
      rueckerstattet: 'refunded',
      erstattet: 'refunded',
      refunded: 'refunded'
    };
    return mapping[normalized] || status;
  }

  static normalizeStatusInput(status) {
    if (!status) return null;
    const legacy = this.toLegacyStatus(status);
    const allowed = ['pending', 'approved', 'rejected', 'completed', 'cancelled', 'payment_required'];
    if (!allowed.includes(legacy)) {
      throw new Error(`Invalid status: ${status}`);
    }
    return legacy;
  }

  static normalizePaymentStatusInput(status) {
    if (!status) return null;
    const legacy = this.toLegacyPaymentStatus(status);
    const allowed = ['pending', 'paid', 'failed', 'refunded'];
    if (!allowed.includes(legacy)) {
      throw new Error(`Invalid payment status: ${status}`);
    }
    return legacy;
  }

  static parseDateInput(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  static normalizeReason(reason, fallback) {
    if (typeof reason === 'string') {
      const trimmed = reason.trim();
      if (trimmed.length > 0) {
        return trimmed.slice(0, 500);
      }
    }
    return fallback;
  }

  static isPaidStatus(status) {
    const legacy = this.toLegacyPaymentStatus(status);
    return legacy === 'paid';
  }

  static async create(requestData) {
    // Transform input data to German schema format
    const germanData = this.transformToGermanSchema(requestData);
    
    const { data, error } = await supabase
      .from('viewing_requests')
      .insert([germanData])
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          ort,
          plz,
          kaltmiete,
          bilder,
          vermieter_id
        ),
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .single();
    
    if (error) throw error;
    return this.formatGermanResponse(data);
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('viewing_requests')
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          beschreibung,
          ort,
          plz,
          strasse,
          hausnummer,
          kaltmiete,
          nebenkosten_warm,
          nebenkosten_kalt,
          kaution,
          bilder,
          vermieter_id,
          zimmer,
          wohnflaeche
        ),
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
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
    
    return this.formatGermanResponse(data);
  }

  static async list(options = {}) {
    let query = supabase
      .from('viewing_requests')
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          ort,
          plz,
          kaltmiete,
          bilder
        ),
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email
        )
      `);
    
    // German schema filters
    if (options.mieter_id || options.requesterId) {
      query = query.eq('mieter_id', options.mieter_id || options.requesterId);
    }
    
    if (options.vermieter_id || options.landlordId) {
      query = query.eq('vermieter_id', options.vermieter_id || options.landlordId);
    }
    
    if (options.apartment_id || options.apartmentId) {
      query = query.eq('apartment_id', options.apartment_id || options.apartmentId);
    }
    
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    if (options.zahlungsstatus || options.paymentStatus) {
      query = query.eq('zahlungsstatus', options.zahlungsstatus || options.paymentStatus);
    }
    
    // Date range filters with German field names
    if (options.gewuenschter_termin_von || options.dateFrom) {
      query = query.gte('gewuenschter_termin', options.gewuenschter_termin_von || options.dateFrom);
    }
    
    if (options.gewuenschter_termin_bis || options.dateTo) {
      query = query.lte('gewuenschter_termin', options.gewuenschter_termin_bis || options.dateTo);
    }
    
    // German status filters
    if (options.besichtigungstyp) {
      query = query.eq('besichtigungstyp', options.besichtigungstyp);
    }
    
    // Sorting
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    
    // Map old sorting fields to German schema
    const sortMapping = {
      'created_at': 'created_at',
      'requested_date': 'gewuenschter_termin',
      'status': 'status',
      'payment_status': 'zahlungsstatus'
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
    
    return data.map(request => this.formatGermanResponse(request));
  }

  static async update(id, updateData) {
    // Transform update data to German schema
    const germanData = this.transformToGermanSchema(updateData);
    
    const { data, error } = await supabase
      .from('viewing_requests')
      .update(germanData)
      .eq('id', id)
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          ort,
          plz,
          kaltmiete,
          bilder,
          vermieter_id
        ),
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .single();
    
    if (error) throw error;
    return this.formatGermanResponse(data);
  }

  static async delete(id) {
    const { data, error } = await supabase
      .from('viewing_requests')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async findByMieter(mieterId) {
    const { data, error } = await supabase
      .from('viewing_requests')
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          ort,
          plz,
          kaltmiete,
          bilder,
          vermieter_id
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .eq('mieter_id', mieterId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data.map(request => this.formatGermanResponse(request));
  }

  static async findByVermieter(vermieterId) {
    const { data, error } = await supabase
      .from('viewing_requests')
      .select(`
        *,
        apartment:apartments(
          id,
          titel,
          ort,
          plz,
          kaltmiete,
          bilder
        ),
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .eq('vermieter_id', vermieterId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data.map(request => this.formatGermanResponse(request));
  }

  static async findByApartment(apartmentId) {
    const { data, error } = await supabase
      .from('viewing_requests')
      .select(`
        *,
        mieter:users!viewing_requests_mieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        ),
        vermieter:users!viewing_requests_vermieter_id_fkey(
          id,
          benutzername,
          vorname,
          nachname,
          email,
          telefon
        )
      `)
      .eq('apartment_id', apartmentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data.map(request => this.formatGermanResponse(request));
  }

  static async findByRequester(requesterId) {
    return this.findByMieter(requesterId);
  }

  static async findByLandlord(landlordId) {
    return this.findByVermieter(landlordId);
  }

  static async getStatistics(userId) {
    const [asRequester, asLandlord] = await Promise.all([
      this.findByRequester(userId),
      this.findByLandlord(userId)
    ]);

    const requestMap = new Map();
    asRequester.forEach(request => requestMap.set(request.id, request));
    asLandlord.forEach(request => requestMap.set(request.id, request));

    const requests = Array.from(requestMap.values());
    const now = new Date();

    const stats = {
      total: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
      payment_required: 0,
      upcoming: 0,
      awaiting_payment: 0
    };

    requests.forEach(request => {
      const status = this.toLegacyStatus(request.status) || 'pending';
      if (stats[status] !== undefined) {
        stats[status] += 1;
      }

      const paymentStatus = this.toLegacyPaymentStatus(request.payment_status);
      if (paymentStatus === 'pending') {
        stats.awaiting_payment += 1;
      }

      if (status === 'approved') {
        const confirmedDate = request.confirmed_date ? new Date(request.confirmed_date) : null;
        if (confirmedDate && !Number.isNaN(confirmedDate.getTime()) && confirmedDate > now) {
          stats.upcoming += 1;
        }
      }
    });

    return stats;
  }

  static async approve(id, confirmedDate) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('Viewing request not found');
    }

    const status = this.toLegacyStatus(request.status);
    if (!['pending', 'approved', 'payment_required'].includes(status)) {
      throw new Error('Viewing request cannot be approved from current status');
    }

    const normalizedDate = this.parseDateInput(confirmedDate) || new Date().toISOString();

    return this.update(id, {
      status: 'approved',
      confirmed_date: normalizedDate,
      cancellation_reason: null,
      cancelled_at: null,
      cancelled_by: null
    });
  }

  static async reject(id, reason) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('Viewing request not found');
    }

    const status = this.toLegacyStatus(request.status);
    if (!['pending', 'approved', 'payment_required'].includes(status)) {
      throw new Error('Viewing request cannot be rejected from current status');
    }

    const rejectionReason = this.normalizeReason(reason, 'Rejected by landlord');
    const now = new Date().toISOString();

    return this.update(id, {
      status: 'rejected',
      cancellation_reason: rejectionReason,
      cancelled_at: now,
      cancelled_by: request.landlord_id,
      confirmed_date: null
    });
  }

  static async complete(id) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('Viewing request not found');
    }

    const status = this.toLegacyStatus(request.status);
    if (!['approved', 'completed'].includes(status)) {
      throw new Error('Viewing request must be approved before completion');
    }

    return this.update(id, {
      status: 'completed'
    });
  }

  static async updatePaymentStatus(id, paymentStatus, paymentId) {
    const updatePayload = {};

    if (paymentStatus) {
      updatePayload.payment_status = this.normalizePaymentStatusInput(paymentStatus);
    }

    if (paymentId) {
      updatePayload.payment_id = paymentId;
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.findById(id);
    }

    return this.update(id, updatePayload);
  }

  static async cancel(id, actorId, reason) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('Viewing request not found');
    }

    const status = this.toLegacyStatus(request.status);
    if (status === 'completed') {
      throw new Error('Completed viewing requests cannot be cancelled');
    }

    const actorIsLandlord = actorId && actorId === request.landlord_id;
    const defaultReason = actorIsLandlord ? 'Cancelled by landlord' : 'Cancelled by requester';
    const cancellationReason = this.normalizeReason(reason, defaultReason);
    const now = new Date().toISOString();
    const updates = {
      status: 'cancelled',
      cancellation_reason: cancellationReason,
      cancelled_at: now,
      cancelled_by: actorId || request.requester_id,
      confirmed_date: null
    };

    if (this.isPaidStatus(request.payment_status)) {
      updates.payment_status = 'refunded';
    }

    return this.update(id, updates);
  }

  /**
   * Transform legacy field names to German schema
   */
  static transformToGermanSchema(data) {
    const transformed = { ...data };
    
    // Field mappings from old schema to German schema
    const fieldMapping = {
      requester_id: 'mieter_id',
      landlord_id: 'vermieter_id',
      requested_date: 'gewuenschter_termin',
      requested_time: 'gewuenschte_uhrzeit',
      confirmed_date: 'bestaetigter_termin',
      message: 'nachricht',
      notes: 'abschluss_notizen',
      phone: 'telefon',
      email: 'email',
      payment_status: 'zahlungsstatus',
      payment_id: 'payment_transaction_id',
      viewing_fee: 'besichtigungsgebuehr',
      special_requests: 'besondere_wuensche',
      cancellation_reason: 'stornierungsgrund',
      cancelled_at: 'storniert_am',
      cancelled_by: 'storniert_von'
    };
    
    // Apply field mappings
    Object.keys(fieldMapping).forEach(oldField => {
      if (transformed[oldField] !== undefined) {
        transformed[fieldMapping[oldField]] = transformed[oldField];
        delete transformed[oldField];
      }
    });
    
    // Handle special transformations
    if (transformed.viewing_type !== undefined) {
      // Map viewing types to German
      const typeMapping = {
        'individual': 'einzelbesichtigung',
        'group': 'gruppenbesichtigung',
        'virtual': 'virtuelle_besichtigung'
      };
      transformed.besichtigungstyp = typeMapping[transformed.viewing_type] || transformed.viewing_type;
      delete transformed.viewing_type;
    }

    if (transformed.status !== undefined) {
      transformed.status = this.toGermanStatus(transformed.status);
    }

    if (transformed.zahlungsstatus !== undefined) {
      transformed.zahlungsstatus = this.toGermanPaymentStatus(transformed.zahlungsstatus);
    }

    if (transformed.payment_status !== undefined) {
      transformed.payment_status = this.toGermanPaymentStatus(transformed.payment_status);
    }
    
    
    // Set default viewing fee if not provided
    if (!transformed.besichtigungsgebuehr && !transformed.viewing_fee) {
      transformed.besichtigungsgebuehr = 25.00; // Default €25 viewing fee
    }
    
    return transformed;
  }

  /**
   * Format response with German rental info and backward compatibility
   */
  static formatGermanResponse(request) {
    const status = this.toLegacyStatus(request.status);
    const rawPaymentStatus = request.zahlungsstatus !== undefined ? request.zahlungsstatus : request.payment_status;
    const paymentStatus = this.toLegacyPaymentStatus(rawPaymentStatus);
    const confirmedDate = request.bestaetigter_termin !== undefined ? request.bestaetigter_termin : request.confirmed_date;
    const cancellationReason = request.stornierungsgrund !== undefined ? request.stornierungsgrund : request.cancellation_reason;
    const cancelledAt = request.storniert_am !== undefined ? request.storniert_am : request.cancelled_at;
    const cancelledBy = request.storniert_von !== undefined ? request.storniert_von : request.cancelled_by;
    const notes = request.abschluss_notizen !== undefined ? request.abschluss_notizen : request.notes;

    const viewingTypeMapping = {
      einzelbesichtigung: 'individual',
      gruppenbesichtigung: 'group',
      virtuelle_besichtigung: 'virtual'
    };
    const legacyViewingType = viewingTypeMapping[request.besichtigungstyp] || request.besichtigungstyp;

    const response = {
      ...request,
      // Add calculated apartment fields if apartment data is included
      ...(request.apartment && {
        apartment: {
          ...request.apartment,
          warmmiete: request.apartment.kaltmiete + 
                    (request.apartment.nebenkosten_warm || 0) + 
                    (request.apartment.nebenkosten_kalt || 0),
          formatted_address: request.apartment.strasse ? 
            `${request.apartment.strasse} ${request.apartment.hausnummer}, ${request.apartment.plz} ${request.apartment.ort}` :
            `${request.apartment.plz} ${request.apartment.ort}`,
          // Backward compatibility
          title: request.apartment.titel,
          location: request.apartment.ort,
          price: request.apartment.kaltmiete,
          images: request.apartment.bilder
        }
      }),
      ...(request.mieter && {
        requester: {
          id: request.mieter.id,
          username: request.mieter.benutzername,
          first_name: request.mieter.vorname,
          last_name: request.mieter.nachname,
          email: request.mieter.email,
          phone: request.mieter.telefon
        }
      }),
      ...(request.vermieter && {
        landlord: {
          id: request.vermieter.id,
          username: request.vermieter.benutzername,
          first_name: request.vermieter.vorname,
          last_name: request.vermieter.nachname,
          email: request.vermieter.email,
          phone: request.vermieter.telefon
        }
      }),
      
      // Backward compatibility fields
      requester_id: request.mieter_id,
      landlord_id: request.vermieter_id,
      requested_date: request.gewuenschter_termin,
      requested_time: request.gewuenschte_uhrzeit,
  message: request.nachricht,
  payment_status: paymentStatus,
  viewing_fee: request.besichtigungsgebuehr,
  viewing_type: legacyViewingType,
      special_requests: request.besondere_wuensche,
      confirmed_date: confirmedDate,
      cancellation_reason: cancellationReason,
      cancelled_at: cancelledAt,
      cancelled_by: cancelledBy,
      notes,
      status,
  email: request.email || request.kontakt_email || null,
  requester_email: request.email || request.kontakt_email || null,
  payment_id: request.payment_transaction_id || request.payment_id || null,
  phone: request.telefon || request.phone || null,
      requester_name: request.mieter
        ? [request.mieter.vorname, request.mieter.nachname].filter(Boolean).join(' ').trim() || request.mieter.benutzername || null
        : null,
      
      // German display formatting
      status_display: this.getGermanStatusDisplay(status),
      payment_display: this.getGermanPaymentDisplay(paymentStatus),
      viewing_fee_display: `€${request.besichtigungsgebuehr || 25}`,
      date_display: request.gewuenschter_termin ? 
        new Date(request.gewuenschter_termin).toLocaleDateString('de-DE') : null
    };
    
    return response;
  }

  /**
   * Get German status display text
   */
  static getGermanStatusDisplay(status) {
    const statusMap = {
      'pending': 'Ausstehend',
      'ausstehend': 'Ausstehend',
      'approved': 'Bestätigt',
      'confirmed': 'Bestätigt',
      'bestaetigt': 'Bestätigt',
      'completed': 'Abgeschlossen',
      'abgeschlossen': 'Abgeschlossen',
      'cancelled': 'Storniert',
      'storniert': 'Storniert',
      'rejected': 'Abgelehnt',
      'abgelehnt': 'Abgelehnt',
      'payment_required': 'Zahlung erforderlich',
      'zahlung_erforderlich': 'Zahlung erforderlich'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Get German payment status display text
   */
  static getGermanPaymentDisplay(paymentStatus) {
    const paymentMap = {
      'pending': 'Ausstehend',
      'ausstehend': 'Ausstehend',
      'paid': 'Bezahlt',
      'bezahlt': 'Bezahlt',
      'failed': 'Fehlgeschlagen',
      'fehlgeschlagen': 'Fehlgeschlagen',
      'refunded': 'Erstattet',
      'rueckerstattet': 'Erstattet',
      'erstattet': 'Erstattet'
    };
    
    return paymentMap[paymentStatus] || paymentStatus;
  }
}

module.exports = ViewingRequestService;