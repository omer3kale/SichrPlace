import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required environment variables for booking-requests function');
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
  Vary: 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
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

const httpError = (status, message, details) => {
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
  if (rawPath.includes('booking-requests')) {
    const segments = rawPath.split('booking-requests');
    return segments[segments.length - 1] || '';
  }

  try {
    const url = new URL(event.rawUrl);
    const pathname = url.pathname || '';
    if (pathname.includes('/api/booking-requests')) {
      return pathname.replace('/api/booking-requests', '');
    }
    if (pathname.includes('/.netlify/functions/booking-requests')) {
      return pathname.replace('/.netlify/functions/booking-requests', '');
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

const parseDateTime = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
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

const clampGuests = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(12, parsed));
};

const getAuthenticatedUser = async (headers) => {
  const token = extractBearerToken(headers || {});
  if (!token) {
    throw httpError(401, 'Authorization token is required.');
  }

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw httpError(401, 'Invalid or expired token.');
  }

  return { token, authUser: data.user };
};

const fetchUserProfile = async (userId) => {
  const { data, error } = await adminClient
    .from('users')
    .select(
      `
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
      `,
    )
    .eq('id', userId)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      throw httpError(403, 'User profile not found.');
    }
    throw httpError(500, 'Failed to load user profile.', error?.message);
  }

  if (data.is_blocked || ['suspended', 'deleted'].includes(data.account_status)) {
    throw httpError(403, 'User account is not permitted to manage booking requests.');
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
  const location = [apartment.address, apartment.house_number, apartment.postal_code, apartment.city]
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
    location: location || null,
    price: apartment.price ?? null,
    total_rent: apartment.total_rent ?? null,
  };
};

const sanitizeBooking = (record, { perspective, apartmentMap, requesterMap }) => {
  if (!record) return null;

  const apartment = buildApartmentSummary(apartmentMap.get(record.apartment_id));
  const requester = requesterMap?.get(record.requester_id);

  const base = {
    id: record.id,
    apartment_id: record.apartment_id,
    requester_id: record.requester_id,
    landlord_id: record.landlord_id,
    start_date: record.start_date,
    end_date: record.end_date,
    guests: record.guests,
    message: record.message || null,
    status: record.status,
    request_date: record.request_date,
    response_date: record.response_date || null,
    landlord_response: perspective === 'requester' ? record.landlord_response || null : null,
    created_at: record.created_at,
    updated_at: record.updated_at,
    apartment,
    apartment_title: apartment?.title || null,
    apartment_location: apartment?.location || null,
  };

  if (perspective === 'landlord') {
    const requesterName =
      requester && (requester.first_name || requester.last_name)
        ? [requester.first_name, requester.last_name].filter(Boolean).join(' ')
        : null;

    return {
      ...base,
      requester_email: requester?.email || null,
      requester_phone: requester?.phone || null,
      requester_name: requesterName,
      message: record.message || null,
    };
  }

  if (perspective === 'admin') {
    return {
      ...base,
      requester_email: requester?.email || null,
      requester_phone: requester?.phone || null,
      landlord_response: record.landlord_response || null,
    };
  }

  return base;
};

const ensureLandlordAccess = (booking, profile) => {
  if (!booking || !profile) return false;
  if (booking.landlord_id === profile.id) return true;
  if (profile.role && ['admin', 'support'].includes(profile.role)) return true;
  return false;
};

const ensureRequesterAccess = (booking, profile) => {
  if (!booking || !profile) return false;
  if (booking.requester_id === profile.id) return true;
  if (profile.role && ['admin', 'support'].includes(profile.role)) return true;
  return false;
};

const loadBookings = async (filter) => {
  const query = adminClient
    .from('booking_requests')
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        start_date,
        end_date,
        guests,
        message,
        status,
        request_date,
        response_date,
        landlord_response,
        created_at,
        updated_at
      `,
    )
    .order('request_date', { ascending: false });

  if (filter) {
    Object.entries(filter).forEach(([column, value]) => {
      query.eq(column, value);
    });
  }

  const { data, error } = await query;
  
  if (error) {
    if (error?.code === 'PGRST116') {
      return [];
    }
    throw httpError(500, 'Failed to load booking requests.', error.message);
  }
  
  return data || [];
};

const hydrateBookings = async (records, { includeRequester } = {}) => {
  const apartmentIds = records.map((item) => item.apartment_id).filter(Boolean);
  const requesterIds = includeRequester ? records.map((item) => item.requester_id).filter(Boolean) : [];

  const [apartmentsMap, requesterMap] = await Promise.all([
    fetchApartmentsByIds(apartmentIds),
    includeRequester ? fetchUsersByIds(requesterIds) : Promise.resolve(new Map()),
  ]);

  return { apartmentsMap, requesterMap };
};

const buildMetaFromBookings = (bookings) => {
  const counts = bookings.reduce(
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

const hasDateOverlap = (startA, endA, startB, endB) => {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  if (Number.isNaN(aStart) || Number.isNaN(aEnd) || Number.isNaN(bStart) || Number.isNaN(bEnd)) {
    return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
};

const ensureDateRangeValid = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { ok: false, message: 'Start and end dates are required.' };
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: 'Start and end dates must be valid ISO strings.' };
  }
  if (start >= end) {
    return { ok: false, message: 'End date must be after start date.' };
  }

  const now = Date.now();
  if (start.getTime() < now - 24 * 60 * 60 * 1000) {
    return { ok: false, message: 'Start date cannot be in the past.' };
  }

  return { ok: true };
};

const checkOverlappingBookings = async (apartmentId, startDate, endDate) => {
  const { data, error } = await adminClient
    .from('booking_requests')
    .select('id, start_date, end_date, status')
    .eq('apartment_id', apartmentId)
    .in('status', ['pending', 'approved', 'completed']);

  if (error) {
    throw httpError(500, 'Failed to verify booking availability.', error.message);
  }

  return (data || []).some((booking) => hasDateOverlap(startDate, endDate, booking.start_date, booking.end_date));
};

const handleGetMyBookings = async (profile) => {
  const records = await loadBookings({ requester_id: profile.id });
  const { apartmentsMap } = await hydrateBookings(records, { includeRequester: false });
  const sanitized = records.map((record) =>
    sanitizeBooking(record, { perspective: 'requester', apartmentMap: apartmentsMap }),
  );

  return { sanitized, meta: buildMetaFromBookings(sanitized) };
};

const handleGetPropertyBookings = async (profile) => {
  const records = await loadBookings({ landlord_id: profile.id });
  const { apartmentsMap, requesterMap } = await hydrateBookings(records, { includeRequester: true });
  const sanitized = records.map((record) =>
    sanitizeBooking(record, {
      perspective: 'landlord',
      apartmentMap: apartmentsMap,
      requesterMap,
    }),
  );

  return { sanitized, meta: buildMetaFromBookings(sanitized) };
};

const handleCreateBooking = async (payload, profile) => {
  const apartmentId = sanitizeString(payload.apartment_id ?? payload.apartmentId, { maxLength: 64 });
  if (!apartmentId) {
    throw httpError(400, 'apartment_id is required.');
  }

  if (apartmentId.length === 36 && !isUuid(apartmentId)) {
    throw httpError(400, 'apartment_id must be a valid UUID.');
  }

  const startDate = parseDateTime(payload.start_date ?? payload.startDate);
  const endDate = parseDateTime(payload.end_date ?? payload.endDate);
  const guestsSource = payload.guests ?? payload.num_guests ?? payload.numberOfGuests;
  const guests = clampGuests(guestsSource, 1);
  const message = sanitizeString(payload.message, { maxLength: 1000, allowEmpty: true });

  const { ok, message: dateError } = ensureDateRangeValid(startDate, endDate);
  if (!ok) {
    throw httpError(400, dateError);
  }

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
    throw httpError(400, 'You cannot book your own apartment.');
  }

  const hasOverlap = await checkOverlappingBookings(apartmentId, startDate, endDate);
  if (hasOverlap) {
    throw httpError(409, 'The selected dates overlap with an existing booking.');
  }

  const normalizedMessage = message === '' ? null : message;
  const nowIso = new Date().toISOString();

  const insertPayload = {
    apartment_id: apartmentId,
    landlord_id: apartment.landlord_id,
    requester_id: profile.id,
    start_date: startDate,
    end_date: endDate,
    guests,
    message: normalizedMessage,
    status: 'pending',
    request_date: nowIso,
    response_date: null,
    landlord_response: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await adminClient
    .from('booking_requests')
    .insert(insertPayload)
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        start_date,
        end_date,
        guests,
        message,
        status,
        request_date,
        response_date,
        landlord_response,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error || !data) {
    throw httpError(500, 'Failed to create booking request.', error?.message);
  }

  const { apartmentsMap } = await hydrateBookings([data], { includeRequester: false });
  return sanitizeBooking(data, {
    perspective: 'requester',
    apartmentMap: apartmentsMap,
  });
};

const fetchBookingById = async (bookingId) => {
  const { data, error } = await adminClient
    .from('booking_requests')
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        start_date,
        end_date,
        guests,
        message,
        status,
        request_date,
        response_date,
        landlord_response,
        created_at,
        updated_at
      `,
    )
    .eq('id', bookingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw httpError(500, 'Failed to load booking request.', error.message);
  }

  return data;
};

const updateBookingById = async (bookingId, changes) => {
  const { data, error } = await adminClient
    .from('booking_requests')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select(
      `
        id,
        apartment_id,
        requester_id,
        landlord_id,
        start_date,
        end_date,
        guests,
        message,
        status,
        request_date,
        response_date,
        landlord_response,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error || !data) {
    throw httpError(500, 'Failed to update booking request.', error?.message);
  }

  return data;
};

const handlerApproveBooking = async (bookingId, payload, profile) => {
  const booking = await fetchBookingById(bookingId);
  if (!booking) {
    throw httpError(404, 'Booking request not found.');
  }

  if (!ensureLandlordAccess(booking, profile)) {
    throw httpError(403, 'You are not authorized to approve this booking.');
  }

  if (!['pending', 'approved'].includes(booking.status)) {
    throw httpError(400, 'Only pending bookings can be approved.');
  }

  const landlordResponse = sanitizeString(payload?.response, { maxLength: 1000, allowEmpty: true });
  const updated = await updateBookingById(bookingId, {
    status: 'approved',
    response_date: new Date().toISOString(),
    landlord_response: landlordResponse === '' ? null : landlordResponse,
  });

  const { apartmentsMap, requesterMap } = await hydrateBookings([updated], { includeRequester: true });
  return sanitizeBooking(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerRejectBooking = async (bookingId, payload, profile) => {
  const booking = await fetchBookingById(bookingId);
  if (!booking) {
    throw httpError(404, 'Booking request not found.');
  }

  if (!ensureLandlordAccess(booking, profile)) {
    throw httpError(403, 'You are not authorized to reject this booking.');
  }

  if (!['pending', 'approved'].includes(booking.status)) {
    throw httpError(400, 'Only pending or approved bookings can be rejected.');
  }

  const landlordResponse = sanitizeString(payload?.response, { maxLength: 1000, allowEmpty: true });
  const normalizedResponse = landlordResponse && landlordResponse.length > 0 ? landlordResponse : 'Request rejected by landlord.';

  const updated = await updateBookingById(bookingId, {
    status: 'rejected',
    response_date: new Date().toISOString(),
    landlord_response: normalizedResponse,
  });

  const { apartmentsMap, requesterMap } = await hydrateBookings([updated], { includeRequester: true });
  return sanitizeBooking(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerCompleteBooking = async (bookingId, profile) => {
  const booking = await fetchBookingById(bookingId);
  if (!booking) {
    throw httpError(404, 'Booking request not found.');
  }

  if (!ensureLandlordAccess(booking, profile)) {
    throw httpError(403, 'You are not authorized to complete this booking.');
  }

  if (booking.status !== 'approved') {
    throw httpError(400, 'Only approved bookings can be marked completed.');
  }

  const updated = await updateBookingById(bookingId, {
    status: 'completed',
  });

  const { apartmentsMap, requesterMap } = await hydrateBookings([updated], { includeRequester: true });
  return sanitizeBooking(updated, {
    perspective: 'landlord',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

const handlerCancelBooking = async (bookingId, profile) => {
  const booking = await fetchBookingById(bookingId);
  if (!booking) {
    throw httpError(404, 'Booking request not found.');
  }

  const requesterAllowed = ensureRequesterAccess(booking, profile);
  const landlordAllowed = ensureLandlordAccess(booking, profile);
  if (!requesterAllowed && !landlordAllowed) {
    throw httpError(403, 'You are not authorized to cancel this booking.');
  }

  if (booking.status === 'completed') {
    throw httpError(400, 'Completed bookings cannot be cancelled.');
  }

  const updated = await updateBookingById(bookingId, {
    status: 'cancelled',
    landlord_response: requesterAllowed ? 'Cancelled by requester.' : 'Cancelled by landlord.',
    response_date: new Date().toISOString(),
  });

  const includeRequester = landlordAllowed;
  const { apartmentsMap, requesterMap } = await hydrateBookings([updated], {
    includeRequester,
  });

  return sanitizeBooking(updated, {
    perspective: landlordAllowed ? 'landlord' : 'requester',
    apartmentMap: apartmentsMap,
    requesterMap,
  });
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { authUser } = await getAuthenticatedUser(event.headers || {});
    const profile = await fetchUserProfile(authUser.id);

    const pathname = normalizePathname(event);
    const segments = splitSubPath(pathname);

    switch (event.httpMethod) {
      case 'GET': {
        if (segments.length === 0) {
          throw httpError(400, 'Specify a resource path (e.g., /my-requests or /my-properties).');
        }

        const resource = segments[0];
        if (resource === 'my-requests') {
          const { sanitized, meta } = await handleGetMyBookings(profile);
          return respond(200, headers, { success: true, data: sanitized, meta });
        }

        if (resource === 'my-properties') {
          const { sanitized, meta } = await handleGetPropertyBookings(profile);
          return respond(200, headers, { success: true, data: sanitized, meta });
        }

        throw httpError(404, 'Endpoint not found.');
      }

      case 'POST': {
        if (segments.length > 0) {
          throw httpError(404, 'Endpoint not found.');
        }

        const payload = parseRequestBody(event.body);
        const sanitized = await handleCreateBooking(payload, profile);
        return respond(201, headers, { success: true, data: sanitized });
      }

      case 'PATCH': {
        if (segments.length < 2) {
          throw httpError(400, 'Invalid path. Expected /:id/<action>.');
        }

        const [bookingId, rawAction] = segments;
        if (!isUuid(bookingId)) {
          throw httpError(400, 'Invalid booking id.');
        }

        const action = rawAction.toLowerCase();
        const payload = parseRequestBody(event.body, { fallback: {} });

        if (action === 'approve') {
          const sanitized = await handlerApproveBooking(bookingId, payload, profile);
          return respond(200, headers, { success: true, data: sanitized });
        }

        if (action === 'reject') {
          const sanitized = await handlerRejectBooking(bookingId, payload, profile);
          return respond(200, headers, { success: true, data: sanitized });
        }

        if (action === 'complete') {
          const sanitized = await handlerCompleteBooking(bookingId, profile);
          return respond(200, headers, { success: true, data: sanitized });
        }

        throw httpError(404, 'Unknown action.');
      }

      case 'DELETE': {
        if (segments.length === 0) {
          throw httpError(400, 'Booking id is required.');
        }

        const [bookingId] = segments;
        if (!isUuid(bookingId)) {
          throw httpError(400, 'Invalid booking id.');
        }

        const sanitized = await handlerCancelBooking(bookingId, profile);
        return respond(200, headers, { success: true, data: sanitized });
      }

      default: {
        const error = httpError(405, 'Method not allowed.', {
          allowed_methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        });
        error.allow = 'GET, POST, PATCH, DELETE, OPTIONS';
        throw error;
      }
    }
  } catch (error) {
    console.error('booking-requests error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    
    const payload = {
      success: false,
      error: status === 500 ? 'Booking request operation failed.' : error.message,
    };

    if (error.details && status !== 500) {
      payload.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      payload.details = error.details || error.message;
    }

    return respond(status, responseHeaders, payload);
  }
};