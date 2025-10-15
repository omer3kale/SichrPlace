import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required environment variables for viewing-requests function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

const getHeader = (headers = {}, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
  const authHeader = getHeader(headers, 'authorization');
  if (!authHeader) return null;
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const parseRequestBody = (body, { fallback = {} } = {}) => {
  if (!body) return fallback;
  if (typeof body === 'object') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON.');
  }
};

const normalizePathname = (event) => {
  const rawPath = event.path || '';
  if (rawPath.includes('viewing-requests')) {
    const segments = rawPath.split('viewing-requests');
    return segments[segments.length - 1] || '';
  }

  try {
    const url = new URL(event.rawUrl);
    const pathname = url.pathname || '';
    if (pathname.includes('/api/viewing-requests')) {
      return pathname.replace('/api/viewing-requests', '');
    }
    if (pathname.includes('/.netlify/functions/viewing-requests')) {
      return pathname.replace('/.netlify/functions/viewing-requests', '');
    }
    return pathname;
  } catch (error) {
    return rawPath;
  }
};

const splitSubPath = (pathname) =>
  pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

const isUuid = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const parseDateInput = (input) => {
  if (!input || typeof input !== 'string') return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed.length === 0 ? (allowEmpty ? '' : null) : trimmed;
};

const clampCurrency = (value, fallback = 0) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.max(0, Math.min(1000, numeric));
  return Number(normalized.toFixed(2));
};

// Standardized helper functions
const isMissingTableError = (error) => {
  return error && error.code === 'PGRST116';
};

const safeSelect = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Query failed`, error.message);
  }
};

const safeInsert = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Table not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Insert failed`, error.message);
  }
};

const safeUpdate = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Update failed`, error.message);
  }
};

const safeDelete = async (query, tableName, context) => {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) {
        throw httpError(404, `${context}: Record not found`);
      }
      throw httpError(500, `${context}: Database error`, result.error.message);
    }
    return result;
  } catch (error) {
    if (error.status) throw error;
    throw httpError(500, `${context}: Delete failed`, error.message);
  }
};

const getAuthContext = async (event, options = {}) => {
  const token = extractBearerToken(event.headers || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'Invalid or expired token');
  }

  const { data: profile, error: profileError } = await safeSelect(
    supabase
      .from('profiles')
      .select('id, email, role, status, account_status, is_blocked, is_admin, is_staff')
      .eq('id', data.user.id)
      .single(),
    'profiles',
    'Failed to fetch user profile'
  );

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw httpError(403, 'User profile not found');
  }

  // Check if account is blocked or suspended
  if (profile.is_blocked || ['suspended', 'deleted'].includes(profile.account_status) || profile.status === 'suspended') {
    throw httpError(403, 'Account access restricted');
  }

  // Check role requirements
  if (options.requireAdmin && !profile.is_admin) {
    throw httpError(403, 'Admin access required');
  }

  return { user: data.user, profile, token };
};

const fetchUserProfile = async (userId) => {
  const { data, error } = await safeSelect(
    supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        user_type,
        status,
        account_status,
        is_blocked
      `)
      .eq('id', userId)
      .single(),
    'profiles',
    'Failed to load user profile'
  );

  if (error) {
    throw error;
  }

  if (data.is_blocked || ['suspended', 'deleted'].includes(data.account_status)) {
    throw httpError(403, 'User account is not permitted to access viewing requests.');
  }

  return data;
};

const fetchApartmentsByIds = async (ids) => {
  if (!ids || ids.length === 0) return new Map();

  const uniqueIds = Array.from(new Set(ids));
  const { data, error } = await adminClient
    .from('apartments')
    .select(
      `
        id,
        title,
        description,
        address,
        house_number,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        price,
        total_rent,
        landlord_id
      `,
    )
    .in('id', uniqueIds);

  if (error) {
    throw httpError(500, 'Failed to load apartments.', error.message);
  }

  const map = new Map();
  data.forEach((apartment) => {
    map.set(apartment.id, mapApartmentToFrontend(apartment, { keepLegacy: true }));
  });
  return map;
};

const fetchUsersByIds = async (ids) => {
  if (!ids || ids.length === 0) return new Map();

  const uniqueIds = Array.from(new Set(ids));
  const { data, error } = await adminClient
    .from('users')
    .select(
      `
        id,
        email,
        first_name,
        last_name,
        phone
      `,
    )
    .in('id', uniqueIds);

  if (error) {
    throw httpError(500, 'Failed to load requester profiles.', error.message);
  }

  const map = new Map();
  data.forEach((user) => {
    map.set(user.id, user);
  });
  return map;
};

const buildApartmentSummary = (apartment) => {
  if (!apartment) return null;
  const locationParts = [apartment.address, apartment.house_number, apartment.postal_code, apartment.city]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    id: apartment.id,
    title: apartment.title || null,
    address: apartment.address || null,
    house_number: apartment.house_number || null,
    postal_code: apartment.postal_code || null,
    city: apartment.city || null,
    state: apartment.state || null,
    location: locationParts || null,
    price: apartment.price ?? null,
    total_rent: apartment.total_rent ?? null,
  };
};

const sanitizeViewingRequest = (record, { perspective, apartmentMap, requesterMap }) => {
  if (!record) return null;

  const apartmentSummary = buildApartmentSummary(apartmentMap.get(record.apartment_id));
  const requester = requesterMap?.get(record.requester_id);

  const base = {
    id: record.id,
    apartment_id: record.apartment_id,
    requester_id: record.requester_id,
    landlord_id: record.landlord_id,
    requested_date: record.requested_date,
    alternative_date_1: record.alternative_date_1,
    alternative_date_2: record.alternative_date_2,
    confirmed_date: record.confirmed_date,
    status: record.status,
    message: record.message || null,
    notes: record.notes || null,
    booking_fee: record.booking_fee ?? null,
    payment_status: record.payment_status || null,
    payment_amount: record.payment_amount ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
    cancellation_reason: record.cancellation_reason || null,
    cancelled_at: record.cancelled_at || null,
    cancelled_by: record.cancelled_by || null,
    apartment: apartmentSummary,
    apartment_title: apartmentSummary?.title || null,
    apartment_location: apartmentSummary?.location || null,
  };

  if (perspective === 'landlord') {
    const requesterName =
      requester && (requester.first_name || requester.last_name)
        ? [requester.first_name, requester.last_name].filter(Boolean).join(' ')
        : null;

    return {
      ...base,
      requester_email: requester?.email || record.email || null,
      requester_phone: record.phone || requester?.phone || null,
      requester_name: requesterName,
    };
  }

  if (perspective === 'admin') {
    return {
      ...base,
      requester_email: requester?.email || record.email || null,
      requester_phone: record.phone || requester?.phone || null,
    };
  }

  return {
    ...base,
    phone: record.phone || null,
    email: record.email || null,
  };
};

const buildMetaFromRequests = (requests) => {
  const counts = requests.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status && acc.byStatus[item.status] !== undefined) {
        acc.byStatus[item.status] += 1;
      }
      return acc;
    },
    {
      total: 0,
      byStatus: {
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        cancelled: 0,
      },
    },
  );

  return counts;
};

const loadRequests = async (filter) => {
  const query = adminClient
    .from('viewing_requests')
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        requested_date,
        alternative_date_1,
        alternative_date_2,
        confirmed_date,
        status,
        message,
        notes,
        booking_fee,
        payment_status,
        payment_amount,
        phone,
        email,
        cancellation_reason,
        cancelled_at,
        cancelled_by,
        created_at,
        updated_at
      `,
    )
    .order('created_at', { ascending: false });

  if (filter) {
    Object.entries(filter).forEach(([column, value]) => {
      query.eq(column, value);
    });
  }

  const { data, error } = await query;
  if (error) {
    throw httpError(500, 'Failed to load viewing requests.', error.message);
  }
  return data;
};

const hydrateRequests = async (records, { includeRequester } = {}) => {
  const apartmentIds = records.map((item) => item.apartment_id).filter(Boolean);
  const requesterIds = includeRequester ? records.map((item) => item.requester_id).filter(Boolean) : [];

  const [apartmentsMap, requesterMap] = await Promise.all([
    fetchApartmentsByIds(apartmentIds),
    includeRequester ? fetchUsersByIds(requesterIds) : Promise.resolve(new Map()),
  ]);

  return { apartmentsMap, requesterMap };
};

// Authentication function removed - using getAuthContext instead

const ensureLandlordAccess = (request, profile) => {
  if (!request) return false;
  if (!profile) return false;
  if (request.landlord_id === profile.id) return true;
  if (profile.role && ['admin', 'support'].includes(profile.role)) return true;
  return false;
};

const ensureRequesterAccess = (request, profile) => {
  if (!request || !profile) return false;
  if (request.requester_id === profile.id) return true;
  if (profile.role && ['admin', 'support'].includes(profile.role)) return true;
  return false;
};

const handleGetMyRequests = async (profile) => {
  const records = await loadRequests({ requester_id: profile.id });
  const { apartmentsMap } = await hydrateRequests(records, { includeRequester: false });
  const sanitized = records.map((record) =>
    sanitizeViewingRequest(record, { perspective: 'requester', apartmentMap: apartmentsMap }),
  );

  return { sanitized, meta: buildMetaFromRequests(sanitized) };
};

const handleGetMyProperties = async (profile) => {
  const records = await loadRequests({ landlord_id: profile.id });
  const { apartmentsMap, requesterMap } = await hydrateRequests(records, { includeRequester: true });
  const sanitized = records.map((record) =>
    sanitizeViewingRequest(record, {
      perspective: 'landlord',
      apartmentMap: apartmentsMap,
      requesterMap,
    }),
  );

  return { sanitized, meta: buildMetaFromRequests(sanitized) };
};

const handleCreateRequest = async (payload, authUser, profile) => {
  const apartmentIdRaw = payload.apartment_id ?? payload.apartmentId;
  const requestedDateRaw = payload.requested_date ?? payload.requestedDate;
  const alternate1Raw = payload.alternative_date_1 ?? payload.alternativeDate1;
  const alternate2Raw = payload.alternative_date_2 ?? payload.alternativeDate2;
  const paymentAmountRaw = payload.payment_amount ?? payload.paymentAmount;
  const bookingFeeRaw = payload.booking_fee ?? payload.bookingFee;

  const apartmentId = sanitizeString(apartmentIdRaw, { maxLength: 64 });
  if (!apartmentId) {
    throw httpError(400, 'apartment_id is required.');
  }

  if (apartmentId.length === 36 && !isUuid(apartmentId)) {
    throw httpError(400, 'apartment_id must be a valid UUID.');
  }

  const requestedDate = parseDateInput(requestedDateRaw);
  if (!requestedDate) {
    throw httpError(400, 'requested_date must be a valid ISO date.');
  }

  const alternativeDate1 = parseDateInput(alternate1Raw);
  const alternativeDate2 = parseDateInput(alternate2Raw);
  const message = sanitizeString(payload.message, { maxLength: 1000, allowEmpty: true });
  const phone = sanitizeString(payload.phone ?? payload.contact_phone, { maxLength: 40, allowEmpty: true });
  const bookingFee = clampCurrency(bookingFeeRaw, 10);
  const paymentAmount = clampCurrency(paymentAmountRaw, 0);

  const { data: apartment, error: apartmentError } = await adminClient
    .from('apartments')
    .select('id, landlord_id')
    .eq('id', apartmentId)
    .single();

  if (apartmentError) {
    if (apartmentError.code === 'PGRST116') {
      throw httpError(404, 'Apartment not found.');
    }
    throw httpError(500, 'Failed to load apartment.', apartmentError.message);
  }

  if (!apartment || !apartment.landlord_id) {
    throw httpError(400, 'Apartment is missing landlord information.');
  }

  if (apartment.landlord_id === profile.id) {
    throw httpError(400, 'You cannot request a viewing for your own apartment.');
  }

  const normalizedMessage = message === '' ? null : message;
  const normalizedPhone = phone === '' ? null : phone;
  const nowIso = new Date().toISOString();

  const insertPayload = {
    apartment_id: apartmentId,
    requester_id: profile.id,
    landlord_id: apartment.landlord_id,
    requested_date: requestedDate,
    alternative_date_1: alternativeDate1,
    alternative_date_2: alternativeDate2,
    message: normalizedMessage,
    phone: normalizedPhone ?? profile.phone ?? null,
    email: profile.email || authUser.email || null,
    status: 'pending',
    booking_fee: bookingFee,
    payment_status: 'pending',
    payment_amount: paymentAmount,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await adminClient
    .from('viewing_requests')
    .insert(insertPayload)
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        requested_date,
        alternative_date_1,
        alternative_date_2,
        confirmed_date,
        status,
        message,
        notes,
        booking_fee,
        payment_status,
        payment_amount,
        phone,
        email,
        cancellation_reason,
        cancelled_at,
        cancelled_by,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error || !data) {
    throw httpError(500, 'Failed to create viewing request.', error?.message);
  }

  const { apartmentsMap } = await hydrateRequests([data], { includeRequester: false });
  return sanitizeViewingRequest(data, {
    perspective: 'requester',
    apartmentMap: apartmentsMap,
  });
};

const fetchViewingRequestById = async (requestId) => {
  const { data, error } = await adminClient
    .from('viewing_requests')
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        requested_date,
        alternative_date_1,
        alternative_date_2,
        confirmed_date,
        status,
        message,
        notes,
        booking_fee,
        payment_status,
        payment_amount,
        phone,
        email,
        cancellation_reason,
        cancelled_at,
        cancelled_by,
        created_at,
        updated_at
      `,
    )
    .eq('id', requestId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw httpError(500, 'Failed to load viewing request.', error.message);
  }

  return data;
};

const updateViewingRequest = async (requestId, changes) => {
  const { data, error } = await adminClient
    .from('viewing_requests')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        requested_date,
        alternative_date_1,
        alternative_date_2,
        confirmed_date,
        status,
        message,
        notes,
        booking_fee,
        payment_status,
        payment_amount,
        phone,
        email,
        cancellation_reason,
        cancelled_at,
        cancelled_by,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error || !data) {
    throw httpError(500, 'Failed to update viewing request.', error?.message);
  }

  return data;
};

const handlerApproveRequest = async (requestId, payload, profile) => {
  const confirmedDateRaw = payload?.confirmed_date ?? payload?.confirmedDate;
  const confirmedDate = parseDateInput(confirmedDateRaw);
  if (!confirmedDate) {
    throw httpError(400, 'confirmed_date must be a valid ISO date.');
  }

  const request = await fetchViewingRequestById(requestId);
  if (!request) {
    throw httpError(404, 'Viewing request not found.');
  }

  if (!ensureLandlordAccess(request, profile)) {
    throw httpError(403, 'You are not authorized to approve this request.');
  }

  if (!['pending', 'approved'].includes(request.status)) {
    throw httpError(400, 'Only pending requests can be approved.');
  }

  const updated = await updateViewingRequest(requestId, {
    status: 'approved',
    confirmed_date: confirmedDate,
    cancellation_reason: null,
    cancelled_at: null,
    cancelled_by: null,
  });

  const { apartmentsMap, requesterMap } = await hydrateRequests([updated], { includeRequester: true });
  return sanitizeViewingRequest(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerRejectRequest = async (requestId, payload, profile) => {
  const reasonRaw = payload?.reason ?? payload?.rejection_reason;
  const reason = sanitizeString(reasonRaw, { maxLength: 500, allowEmpty: true });

  const request = await fetchViewingRequestById(requestId);
  if (!request) {
    throw httpError(404, 'Viewing request not found.');
  }

  if (!ensureLandlordAccess(request, profile)) {
    throw httpError(403, 'You are not authorized to reject this request.');
  }

  if (!['pending', 'approved'].includes(request.status)) {
    throw httpError(400, 'Only pending or approved requests can be rejected.');
  }

  const nowIso = new Date().toISOString();
  const updated = await updateViewingRequest(requestId, {
    status: 'rejected',
    cancellation_reason: reason && reason.length > 0 ? reason : 'Rejected by landlord',
    cancelled_at: nowIso,
    cancelled_by: profile.id,
    confirmed_date: null,
  });

  const { apartmentsMap, requesterMap } = await hydrateRequests([updated], { includeRequester: true });
  return sanitizeViewingRequest(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerCompleteRequest = async (requestId, profile) => {
  const request = await fetchViewingRequestById(requestId);
  if (!request) {
    throw httpError(404, 'Viewing request not found.');
  }

  if (!ensureLandlordAccess(request, profile)) {
    throw httpError(403, 'You are not authorized to complete this request.');
  }

  if (!['approved', 'pending'].includes(request.status)) {
    throw httpError(400, 'Only approved requests can be marked completed.');
  }

  const updated = await updateViewingRequest(requestId, {
    status: 'completed',
  });

  const { apartmentsMap, requesterMap } = await hydrateRequests([updated], { includeRequester: true });
  return sanitizeViewingRequest(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerCancelRequest = async (requestId, profile) => {
  const request = await fetchViewingRequestById(requestId);
  if (!request) {
    throw httpError(404, 'Viewing request not found.');
  }

  const requesterAllowed = ensureRequesterAccess(request, profile);
  const landlordAllowed = ensureLandlordAccess(request, profile);
  if (!requesterAllowed && !landlordAllowed) {
    throw httpError(403, 'You are not authorized to cancel this request.');
  }

  if (request.status === 'completed') {
    throw httpError(400, 'Completed requests cannot be cancelled.');
  }

  const cancelReason = requesterAllowed ? 'Cancelled by requester' : 'Cancelled by landlord';
  const updates = {
    status: 'cancelled',
    cancellation_reason: cancelReason,
    cancelled_at: new Date().toISOString(),
    cancelled_by: profile.id,
  };

  if ((request.payment_status || '').toLowerCase() === 'paid') {
    updates.payment_status = 'refunded';
  }

  const updated = await updateViewingRequest(requestId, updates);
  const includeRequester = landlordAllowed;
  const { apartmentsMap, requesterMap } = await hydrateRequests([updated], {
    includeRequester,
  });

  return sanitizeViewingRequest(updated, {
    perspective: landlordAllowed ? 'landlord' : 'requester',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

export const handler = async (event) => {
  console.log('Viewing requests handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const { profile } = await getAuthContext(event);

    const pathname = normalizePathname(event);
    const segments = splitSubPath(pathname);

    switch (event.httpMethod) {
      case 'GET': {
        if (segments.length === 0) {
          throw httpError(400, 'Specify a resource path (e.g., /my-requests or /my-properties).');
        }

        const resource = segments[0];
        if (resource === 'my-requests') {
          const { sanitized, meta } = await handleGetMyRequests(profile);
          return respond(200, { success: true, data: sanitized, meta });
        }

        if (resource === 'my-properties') {
          const { sanitized, meta } = await handleGetMyProperties(profile);
          return respond(200, { success: true, data: sanitized, meta });
        }

        throw httpError(404, 'Endpoint not found.');
      }

      case 'POST': {
        if (segments.length > 0) {
          throw httpError(404, 'Endpoint not found.');
        }

        const payload = parseRequestBody(event.body);
        const sanitized = await handleCreateRequest(payload, authUser, profile);
        return respond(201, { success: true, data: sanitized });
      }

      case 'PATCH': {
        if (segments.length < 2) {
          throw httpError(400, 'Invalid path. Expected /:id/<action>.');
        }

        const [requestId, rawAction] = segments;
        if (!isUuid(requestId)) {
          throw httpError(400, 'Invalid viewing request id.');
        }

        const action = rawAction.toLowerCase();
        const payload = parseRequestBody(event.body, { fallback: {} });

        if (action === 'approve') {
          const sanitized = await handlerApproveRequest(requestId, payload, profile);
          return respond(200, { success: true, data: sanitized });
        }

        if (action === 'reject') {
          const sanitized = await handlerRejectRequest(requestId, payload, profile);
          return respond(200, { success: true, data: sanitized });
        }

        if (action === 'complete') {
          const sanitized = await handlerCompleteRequest(requestId, profile);
          return respond(200, { success: true, data: sanitized });
        }

        throw httpError(404, 'Unknown action.');
      }

      case 'DELETE': {
        if (segments.length === 0) {
          throw httpError(400, 'Viewing request id is required.');
        }

        const [requestId] = segments;
        if (!isUuid(requestId)) {
          throw httpError(400, 'Invalid viewing request id.');
        }

        const sanitized = await handlerCancelRequest(requestId, profile);
        return respond(200, { success: true, data: sanitized });
      }

      default:
        throw httpError(405, 'Method not allowed.');
    }
  } catch (error) {
    console.error('Viewing requests handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Viewing request operation failed' : error.message;
    
    const errorResponse = {
      success: false,
      error: message
    };

    if (error.details && status !== 500) {
      errorResponse.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details || error.message;
    }

    return respond(status, errorResponse);
  }
};