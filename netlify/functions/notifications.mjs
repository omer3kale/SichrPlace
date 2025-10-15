import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const webPushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (webPushConfigured) {
	webpush.setVapidDetails(
		'mailto:support@sichrplace.com',
		VAPID_PUBLIC_KEY,
		VAPID_PRIVATE_KEY,
	);
}

export const NOTIFICATION_TYPES = {
	VIEWING_REQUEST: 'viewing_request',
	VIEWING_APPROVED: 'viewing_approved',
	VIEWING_REJECTED: 'viewing_rejected',
	NEW_MESSAGE: 'new_message',
	FAVORITE_APARTMENT_UPDATED: 'favorite_apartment_updated',
	REVIEW_SUBMITTED: 'review_submitted',
	REVIEW_MODERATED: 'review_moderated',
	SAVED_SEARCH_ALERT: 'saved_search_alert',
	SYSTEM_ANNOUNCEMENT: 'system_announcement',
	BOOKING_CONFIRMED: 'booking_confirmed',
	BOOKING_CANCELLED: 'booking_cancelled',
	PAYMENT_SUCCESS: 'payment_success',
	PAYMENT_FAILED: 'payment_failed',
	APARTMENT_APPROVED: 'apartment_approved',
	APARTMENT_REJECTED: 'apartment_rejected',
	GDPR_REQUEST_COMPLETED: 'gdpr_request_completed',
};

// Utility functions
const parseJsonBody = (body) => {
	if (!body) return {};
	
	try {
		return JSON.parse(body);
	} catch (error) {
		throw httpError(400, 'Invalid JSON in request body');
	}
};

const NOTIFICATION_TYPE_VALUES = new Set(Object.values(NOTIFICATION_TYPES));
const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

const buildHeaders = () => ({
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Secret, X-Sichr-Internal-Secret',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Content-Type': 'application/json',
	'Vary': 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, body) => ({
	statusCode,
	headers: buildHeaders(),
	body: typeof body === 'string' ? body : JSON.stringify(body),
});

const getHeader = (headers = {}, name) => {
	if (!headers) return null;
	const target = name.toLowerCase();
	const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
	return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
	const candidate = getHeader(headers, 'authorization');
	if (!candidate) return null;
	const parts = candidate.trim().split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
	return parts[1];
};

const normalizePathname = (event) => {
	const rawPath = event.path || '';
	if (rawPath.includes('notifications')) {
		const segments = rawPath.split('notifications');
		return segments[segments.length - 1] || '';
	}

	try {
		const url = new URL(event.rawUrl);
		const pathname = url.pathname || '';
		if (pathname.includes('/api/notifications')) {
			return pathname.replace('/api/notifications', '');
		}
		if (pathname.includes('/.netlify/functions/notifications')) {
			return pathname.replace('/.netlify/functions/notifications', '');
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
	typeof value === 'string' &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clampNumber = (value, { min, max, fallback }) => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(min, Math.min(max, parsed));
};

const sanitizeText = (value, { maxLength, allowEmpty = false } = {}) => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!allowEmpty && trimmed.length === 0) return null;
	if (maxLength && trimmed.length > maxLength) {
		return trimmed.slice(0, maxLength);
	}
	return trimmed;
};

const sanitizeUrl = (value) => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith('/')) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return null;
};

const sanitizeMetadata = (value) => {
	if (!value) return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value;
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return parsed;
		}
	} catch (error) {
		// Fall through to default
	}
	return {};
};

const normalizeNotificationType = (type) => {
	if (typeof type !== 'string') return null;
	const normalized = type.trim().toLowerCase();
	if (NOTIFICATION_TYPE_VALUES.has(normalized)) return normalized;

	const matchingKey = Object.keys(NOTIFICATION_TYPES).find(
		(key) => NOTIFICATION_TYPES[key].toLowerCase() === normalized,
	);

	return matchingKey ? NOTIFICATION_TYPES[matchingKey] : null;
};

const normalizePriority = (priority) => {
	if (!priority) return 'normal';
	const normalized = priority.toString().trim().toLowerCase();
	return VALID_PRIORITIES.has(normalized) ? normalized : 'normal';
};

const httpError = (status, message, details = null) => {
	const error = { error: { message, status } };
	if (details && process.env.NODE_ENV !== 'production') {
		error.error.details = details;
	}
	return { status, ...error };
};

// Supabase error checking
const isMissingTableError = (error) => {
	return error?.code === 'PGRST116' || error?.message?.includes('relation') && error?.message?.includes('does not exist');
};

// Authentication helper
const getAuthContext = async (event) => {
	const token = extractBearerToken(event.headers);
	if (!token) {
		throw httpError(401, 'Authorization token required');
	}

	try {
		const { data: authData, error: authError } = await supabase.auth.getUser(token);
		
		if (authError || !authData?.user?.id) {
			throw httpError(401, 'Invalid or expired token');
		}

		const { data: profile, error: profileError } = await supabase
			.from('users')
			.select('id, email, role, status, account_status, is_blocked, notification_preferences')
			.eq('id', authData.user.id)
			.single();

		if (profileError) {
			if (isMissingTableError(profileError)) {
				throw httpError(503, 'User profile service unavailable');
			}
			throw httpError(403, 'User profile not found');
		}

		if (!profile) {
			throw httpError(403, 'User profile not found');
		}

		if (profile.is_blocked || 
				profile.status === 'suspended' || 
				['suspended', 'deleted'].includes(profile.account_status)) {
			throw httpError(403, 'Account access restricted');
		}

		return {
			userId: authData.user.id,
			profile,
			isAdmin: ['admin', 'super_admin'].includes(profile.role),
			isStaff: ['admin', 'super_admin', 'staff'].includes(profile.role)
		};
	} catch (error) {
		if (error.status) throw error;
		console.error('Authentication error:', error);
		throw httpError(401, 'Authentication failed');
	}
};

// Safe database operations
const safeSelect = async (query) => {
	try {
		const { data, error } = await query;
		if (error) {
			if (isMissingTableError(error)) {
				return { data: [], error: null };
			}
			throw error;
		}
		return { data, error: null };
	} catch (error) {
		console.error('Database query error:', error);
		throw error;
	}
};

const safeInsert = async (table, data) => {
	try {
		const { data: result, error } = await supabase
			.from(table)
			.insert(data)
			.select()
			.single();

		if (error) {
			if (isMissingTableError(error)) {
				throw httpError(503, `Notification service unavailable`);
			}
			throw error;
		}

		return result;
	} catch (error) {
		if (error.status) throw error;
		console.error(`Database insert error for ${table}:`, error);
		throw httpError(500, 'Database operation failed', error.message);
	}
};

const safeUpdate = async (table, data, conditions) => {
	try {
		let query = supabase.from(table).update(data);
		
		// Apply conditions
		for (const [key, value] of Object.entries(conditions)) {
			query = query.eq(key, value);
		}
		
		const { data: result, error } = await query.select().single();

		if (error) {
			if (isMissingTableError(error)) {
				throw httpError(503, `Notification service unavailable`);
			}
			throw error;
		}

		return result;
	} catch (error) {
		if (error.status) throw error;
		console.error(`Database update error for ${table}:`, error);
		throw httpError(500, 'Database operation failed', error.message);
	}
};

// Notification preference helpers
const shouldSkipNotificationForPreferences = (preferences, type) => {
	const prefs = preferences && typeof preferences === 'object' ? preferences : {};
	if (prefs.push_enabled === false || prefs.notifications_enabled === false) {
		return true;
	}

	const normalizedType = type || '';
	if (Array.isArray(prefs.mutedTypes)) {
		const muted = prefs.mutedTypes.map((item) => item && item.toString().toLowerCase());
		if (muted.includes(normalizedType)) {
			return true;
		}
	}

	const typeMappings = {
		viewing_request: ['viewing_requests'],
		viewing_approved: ['viewing_requests'],
		viewing_rejected: ['viewing_requests'],
		booking_confirmed: ['viewing_requests'],
		booking_cancelled: ['viewing_requests'],
		new_message: ['new_messages'],
		favorite_apartment_updated: ['new_apartments', 'favorite_updates'],
		saved_search_alert: ['new_apartments'],
		review_submitted: ['system_updates'],
		review_moderated: ['system_updates'],
		system_announcement: ['system_updates'],
		payment_success: ['payments'],
		payment_failed: ['payments'],
		apartment_approved: ['system_updates'],
		apartment_rejected: ['system_updates'],
		gdpr_request_completed: ['system_updates'],
	};

	const preferenceKeys = typeMappings[normalizedType];
	if (!preferenceKeys || preferenceKeys.length === 0) {
		return false;
	}

	return preferenceKeys.some((key) => prefs[key] === false);
};

const mapNotificationRecord = (record) => ({
	id: record.id,
	type: record.type,
	title: record.title,
	message: record.message,
	data: sanitizeMetadata(record.data),
	actionUrl: record.action_url || null,
	priority: record.priority || 'normal',
	isRead: Boolean(record.is_read),
	createdAt: record.created_at || null,
	readAt: record.read_at || null,
});

const insertNotificationRecord = async (payload) => {
	const { data, error } = await safeInsert(
		supabase
			.from('notifications')
			.insert(payload)
			.select('*')
			.single(),
		'notifications',
		'Failed to create notification'
	);

	if (error) {
		throw error;
	}

	return data;
};

const maybeSendPushNotification = async (record) => {
	if (!webPushConfigured) return;
	if (!record?.recipient_id) return;

	try {
		const { data: subscriptions, error } = await safeSelect(
			supabase
				.from('push_subscriptions')
				.select('id, endpoint, p256dh_key, auth_key')
				.eq('user_id', record.recipient_id)
				.limit(25),
			'push_subscriptions',
			'Failed to fetch push subscriptions'
		);

		if (error || !subscriptions || subscriptions.length === 0) {
			return;
		}

		const payload = JSON.stringify({
			title: record.title,
			body: record.message,
			data: {
				notificationId: record.id,
				type: record.type,
				actionUrl: record.action_url,
				metadata: record.data,
			},
		});

		await Promise.allSettled(
			subscriptions.map(async (subscription) => {
				try {
					await webpush.sendNotification(
						{
							endpoint: subscription.endpoint,
							keys: {
								p256dh: subscription.p256dh_key,
								auth: subscription.auth_key,
							},
						},
						payload,
					);
				} catch (error) {
					if (error?.statusCode === 404 || error?.statusCode === 410) {
						await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
					} else {
						console.warn('Push notification delivery failed:', error?.message);
					}
				}
			}),
		);
	} catch (error) {
		console.warn('Unexpected push notification error:', error?.message);
	}
};

const handleListNotifications = async ({ profile, queryParams }) => {
	const limit = clampNumber(queryParams.limit, { min: 1, max: 100, fallback: 20 });
	const offset = clampNumber(queryParams.offset, { min: 0, max: 1000, fallback: 0 });
	const unreadOnly = queryParams.unread_only === 'true';

	let query = supabase
		.from('notifications')
		.select('*')
		.eq('recipient_id', profile.id)
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (unreadOnly) {
		query = query.is('read_at', null);
	}

	const { data: records, error } = await safeSelect(
		query,
		'notifications',
		'Failed to fetch notifications'
	);

	if (error) {
		throw error;
	}

	const formattedNotifications = records.map(mapNotificationRecord);

	return respond(200, {
		success: true,
		data: formattedNotifications,
		pagination: {
			limit,
			offset,
			count: formattedNotifications.length
		}
	});
};

const handleGetNotification = async ({ profile, notificationId }) => {
	if (!isUuid(notificationId)) {
		throw httpError(400, 'Invalid notification identifier.');
	}

	const { data: record, error } = await safeSelect(
		supabase
			.from('notifications')
			.select('*')
			.eq('id', notificationId)
			.eq('recipient_id', profile.id)
			.single(),
		'notifications',
		'Failed to fetch notification'
	);

	if (error) {
		if (error.status === 404) {
			throw httpError(404, 'Notification not found');
		}
		throw error;
	}

	return respond(200, {
		success: true,
		data: mapNotificationRecord(record)
	});
};

const handleMarkNotificationRead = async ({ profile, notificationId }) => {
	if (!isUuid(notificationId)) {
		throw httpError(400, 'Invalid notification identifier.');
	}

	const { data: record, error } = await safeUpdate(
		supabase
			.from('notifications')
			.update({ read_at: new Date().toISOString() })
			.eq('id', notificationId)
			.eq('recipient_id', profile.id)
			.select('*')
			.single(),
		'notifications',
		'Failed to mark notification as read'
	);

	if (error) {
		if (error.status === 404) {
			throw httpError(404, 'Notification not found');
		}
		throw error;
	}

	return respond(200, {
		success: true,
		message: 'Notification marked as read.',
		data: mapNotificationRecord(record)
	});
};

const handleMarkAllRead = async ({ profile }) => {
	const { data: records, error } = await safeUpdate(
		supabase
			.from('notifications')
			.update({ read_at: new Date().toISOString() })
			.eq('recipient_id', profile.id)
			.is('read_at', null)
			.select('*'),
		'notifications',
		'Failed to mark all notifications as read'
	);

	if (error) {
		throw error;
	}

	return respond(200, {
		success: true,
		message: `Marked ${records.length} notifications as read.`,
		data: { updatedCount: records.length }
	});
};

const handleDeleteNotification = async ({ profile, notificationId }) => {
	if (!isUuid(notificationId)) {
		throw httpError(400, 'Invalid notification identifier.');
	}

	const { error } = await safeDelete(
		supabase
			.from('notifications')
			.delete()
			.eq('id', notificationId)
			.eq('recipient_id', profile.id)
			.select('*')
			.single(),
		'notifications',
		'Failed to delete notification'
	);

	if (error) {
		if (error.status === 404) {
			throw httpError(404, 'Notification not found');
		}
		throw error;
	}

	return respond(200, {
		success: true,
		message: 'Notification deleted successfully.'
	});
};

const handleCreateNotification = async ({ event }) => {
	const payload = parseJsonBody(event.body);

	// Check authorization for creating notifications
	await getAuthContext(event, { requireAdmin: true });

	if (!payload.recipient_id || !payload.type) {
		throw httpError(400, 'Recipient ID and type are required.');
	}

	const actionUrl = sanitizeUrl(payload.action_url ?? payload.actionUrl);
	const priority = normalizePriority(payload.priority);

	// Validate recipient exists and get preferences
	const { data: recipient } = await safeSelect(
		supabase
			.from('profiles')
			.select('id, notification_preferences')
			.eq('id', payload.recipient_id)
			.single(),
		'profiles',
		'Failed to verify recipient'
	);

	if (!recipient) {
		throw httpError(404, 'Recipient not found.');
	}

	// Skip notification based on user preferences
	const shouldSkip = shouldSkipNotificationForPreferences(
		recipient.notification_preferences,
		payload.type
	);

	if (shouldSkip) {
		return respond(200, {
			success: true,
			message: 'Notification skipped due to user preferences.',
			data: null
		});
	}

	const { data: record, error } = await safeInsert(
		supabase
			.from('notifications')
			.insert({
				recipient_id: payload.recipient_id,
				type: normalizeNotificationType(payload.type),
				title: payload.title,
				message: payload.message,
				data: payload.data || null,
				action_url: actionUrl,
				priority,
				created_at: new Date().toISOString()
			})
			.select('*')
			.single(),
		'notifications',
		'Failed to create notification'
	);

	if (error) {
		throw error;
	}

	return respond(201, {
		success: true,
		message: 'Notification created.',
		data: mapNotificationRecord(record),
	});
};

export const handler = async (event) => {
	console.log('Notifications handler called:', {
		method: event.httpMethod,
		path: event.path
	});

	// Handle OPTIONS preflight
	if (event.httpMethod === 'OPTIONS') {
		return respond(200, '');
	}

	const method = (event.httpMethod || 'GET').toUpperCase();
	const pathname = normalizePathname(event);
	const segments = splitSubPath(pathname);
	const queryParams = event.queryStringParameters || {};

	try {
		if (method === 'GET' && segments.length === 0) {
			const { profile } = await getAuthContext(event);
			return await handleListNotifications({ profile, queryParams });
		}

		if (method === 'GET' && segments.length === 1 && isUuid(segments[0])) {
			const { profile } = await getAuthContext(event);
			return await handleGetNotification({ profile, notificationId: segments[0] });
		}

		if (method === 'POST' && segments.length === 0) {
			return await handleCreateNotification({ event });
		}

		if (method === 'PUT' && segments.length === 2 && segments[1] === 'read' && isUuid(segments[0])) {
			const { profile } = await getAuthContext(event);
			return await handleMarkNotificationRead({ profile, notificationId: segments[0] });
		}

		if (method === 'PUT' && segments.length === 1 && segments[0] === 'read-all') {
			const { profile } = await getAuthContext(event);
			return await handleMarkAllRead({ profile });
		}

		if (method === 'DELETE' && segments.length === 1 && isUuid(segments[0])) {
			const { profile } = await getAuthContext(event);
			return await handleDeleteNotification({ profile, notificationId: segments[0] });
		}

		throw httpError(404, 'Endpoint not found');

	} catch (error) {
		console.error('Notifications handler error:', error);

		const status = error.status || 500;
		const message = status === 500 ? 'Notification operation failed' : error.message;
		
		const errorResponse = httpError(status, message, error.details);
		return respond(status, errorResponse);
	}
};

const createSystemNotification = async (payload) => {
	const type = normalizeNotificationType(payload?.type);
	if (!type) {
		throw httpError(400, 'Invalid notification type.');
	}

	const title = sanitizeText(payload?.title, { maxLength: 120 });
	const message = sanitizeText(payload?.message, { maxLength: 500 });
	if (!title || !message) {
		throw httpError(400, 'Notification title and message are required.');
	}

	if (!payload?.userId || !isUuid(payload.userId)) {
		throw httpError(400, 'A valid userId is required.');
	}

	const { data: user, error } = await safeSelect(
		supabase
			.from('profiles')
			.select('id, notification_preferences')
			.eq('id', payload.userId)
			.single(),
		'profiles',
		'Failed to verify target user'
	);

	if (error) {
		if (error.status === 404) {
			throw httpError(404, 'Target user not found.');
		}
		throw error;
	}

	if (shouldSkipNotificationForPreferences(user.notification_preferences, type)) {
		return { skipped: true, reason: 'Notification suppressed by user preferences.' };
	}

	const sanitizedActionUrl = sanitizeUrl(payload.actionUrl);
	const normalizedPriority = normalizePriority(payload.priority);

	const record = await insertNotificationRecord({
		recipient_id: payload.userId,
		type,
		title,
		message,
		data: payload.data || null,
		action_url: sanitizedActionUrl,
		priority: normalizedPriority,
		created_at: new Date().toISOString()
	});

	await maybeSendPushNotification(record);

	return { skipped: false, record: mapNotificationRecord(record) };
};

export const createViewingRequestNotification = async (landlordId, apartmentTitle, tenantName) =>
	createSystemNotification({
		userId: landlordId,
		type: NOTIFICATION_TYPES.VIEWING_REQUEST,
		title: 'New Viewing Request',
		message: `${tenantName} has requested to view your apartment "${apartmentTitle}"`,
		data: { apartmentTitle, tenantName },
		priority: 'high',
		actionUrl: '/viewing-requests-dashboard.html',
	});

export const createViewingApprovalNotification = async (tenantId, apartmentTitle, viewingDate) =>
	createSystemNotification({
		userId: tenantId,
		type: NOTIFICATION_TYPES.VIEWING_APPROVED,
		title: 'Viewing Request Approved',
		message: `Your viewing request for "${apartmentTitle}" has been approved for ${viewingDate}.`,
		data: { apartmentTitle, viewingDate },
		priority: 'high',
		actionUrl: '/viewing-requests-dashboard.html',
	});

export const createFavoriteApartmentUpdateNotification = async (userId, apartmentTitle, updateType) =>
	createSystemNotification({
		userId,
		type: NOTIFICATION_TYPES.FAVORITE_APARTMENT_UPDATED,
		title: 'Favorite Apartment Updated',
		message: `Your favorite apartment "${apartmentTitle}" has been ${updateType}.`,
		data: { apartmentTitle, updateType },
		actionUrl: '/apartments-listing.html',
	});

export const createSavedSearchAlertNotification = async (userId, searchCriteria, newApartmentCount) =>
	createSystemNotification({
		userId,
		type: NOTIFICATION_TYPES.SAVED_SEARCH_ALERT,
		title: 'New Properties Match Your Search',
		message: `${newApartmentCount} new properties match your saved search criteria.`,
		data: { searchCriteria, newApartmentCount },
		actionUrl: '/apartments-listing.html',
	});

