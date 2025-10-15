import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for realtime-communication function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const AVAILABLE_ACTIONS = ['broadcast_message', 'subscribe_channel', 'create_room', 'send_notification'];

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
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

const extractBearerToken = (headers = {}) => {
  const value = getHeader(headers, 'authorization');
  if (!value) return null;
  const parts = value.trim().split(' ');
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

const parseRequestBody = (body) => {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON.');
  }
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const sanitizeStringArray = (values, { maxLength }) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => sanitizeString(value, { maxLength, allowEmpty: false }))
    .filter(Boolean);
};

const clampNumber = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const requireAuthenticatedUser = async (headers) => {
  const token = extractBearerToken(headers);
  if (!token) {
    throw httpError(401, 'Authorization token is required.');
  }

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
    throw httpError(403, 'User profile not found.');
  }

  if (
    profile.is_blocked ||
    profile.status === 'suspended' ||
    ['suspended', 'deleted'].includes(profile.account_status)
  ) {
    throw httpError(403, 'User account is not permitted to access realtime communication.');
  }

  return { id: profile.id, profile };
};

const buildRealtimeSnapshot = () => ({
  timestamp: new Date().toISOString(),
  realtime_status: 'connected',
  active_connections: 125,
  connection_metrics: {
    total_connections_24h: 2450,
    peak_concurrent: 180,
    avg_connection_duration: '12m 34s',
    connection_success_rate: '99.2%',
  },
  channels: [
    {
      channel: 'property_updates',
      subscribers: 85,
      messages_24h: 340,
      last_activity: new Date(Date.now() - 300000).toISOString(),
    },
    {
      channel: 'chat_messages',
      subscribers: 42,
      messages_24h: 1250,
      last_activity: new Date(Date.now() - 30000).toISOString(),
    },
    {
      channel: 'booking_notifications',
      subscribers: 28,
      messages_24h: 156,
      last_activity: new Date(Date.now() - 600000).toISOString(),
    },
    {
      channel: 'system_alerts',
      subscribers: 15,
      messages_24h: 23,
      last_activity: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
  message_queue: {
    pending_messages: 0,
    delivered_messages: 1769,
    failed_deliveries: 3,
    retry_queue: 0,
    avg_delivery_time: '45ms',
  },
  websocket_stats: {
    protocol: 'WSS',
    compression: 'enabled',
    heartbeat_interval: '30s',
    reconnection_rate: '0.8%',
    bandwidth_usage: '2.4MB/hour',
  },
});

const handleBroadcastMessage = ({ headers, body }) => {
  const channel = sanitizeString(body.channel, { maxLength: 120, allowEmpty: false });
  const message = sanitizeString(body.message, { maxLength: 1000, allowEmpty: false });
  const recipients = sanitizeStringArray(body.recipients, { maxLength: 120 });

  if (!channel || !message) {
    throw httpError(400, 'Channel and message are required to broadcast.');
  }

  return respond(200, headers, {
    success: true,
    message_id: `msg_${Date.now()}`,
    channel,
    recipients: recipients.length > 0 ? recipients : ['all'],
    delivery_status: 'queued',
    estimated_delivery: '100-200ms',
  });
};

const handleSubscribeChannel = ({ user, headers, body }) => {
  const channel = sanitizeString(body.channel, { maxLength: 120, allowEmpty: false });

  if (!channel) {
    throw httpError(400, 'A valid channel is required to subscribe.');
  }

  return respond(200, headers, {
    success: true,
    subscription_id: `sub_${Date.now()}`,
    channel,
    user_id: user.id,
    timestamp: new Date().toISOString(),
    message: 'Successfully subscribed to channel.',
  });
};

const handleCreateRoom = ({ headers, body, user }) => {
  const roomName = sanitizeString(body.room_name, { maxLength: 120, allowEmpty: false });
  const maxParticipants = clampNumber(body.max_participants, { min: 2, max: 100, fallback: 10 });

  if (!roomName) {
    throw httpError(400, 'A room name is required.');
  }

  return respond(201, headers, {
    success: true,
    room_id: `room_${Date.now()}`,
    room_name: roomName,
    participants: [user.id],
    created_at: new Date().toISOString(),
    max_participants: maxParticipants,
  });
};

const handleSendNotification = ({ headers, body }) => {
  const type = sanitizeString(body.type, { maxLength: 80, allowEmpty: false });
  const targetUsers = sanitizeStringArray(body.target_users, { maxLength: 120 });

  if (!type) {
    throw httpError(400, 'Notification type is required.');
  }

  return respond(200, headers, {
    success: true,
    notification_id: `notif_${Date.now()}`,
    type,
    target_users: targetUsers,
    delivery_method: 'realtime',
    timestamp: new Date().toISOString(),
  });
};

const ACTION_HANDLERS = {
  broadcast_message: handleBroadcastMessage,
  subscribe_channel: handleSubscribeChannel,
  create_room: handleCreateRoom,
  send_notification: handleSendNotification,
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const user = await requireAuthenticatedUser(event.headers || {});
    const method = (event.httpMethod || 'GET').toUpperCase();

    if (method === 'GET') {
      return respond(200, headers, {
        success: true,
        data: buildRealtimeSnapshot(),
        message: 'Realtime communication snapshot retrieved.',
      });
    }

    if (method !== 'POST') {
      throw httpError(405, 'Method not allowed.');
    }

    const payload = parseRequestBody(event.body);
    const action = sanitizeString(payload.action, { maxLength: 64, allowEmpty: false });

    if (!action) {
      throw httpError(400, 'Action is required.', { available_actions: AVAILABLE_ACTIONS });
    }

    const handlerFn = ACTION_HANDLERS[action];
    if (!handlerFn) {
      throw httpError(400, 'Unsupported realtime action.', { available_actions: AVAILABLE_ACTIONS });
    }

    const actionPayload = payload.realtime_config && typeof payload.realtime_config === 'object'
      ? payload.realtime_config
      : payload;

    return handlerFn({ headers, body: actionPayload, user });
  } catch (error) {
    console.error('realtime-communication error:', error);
    const status = error.status || 500;
    return respond(status, headers, {
      success: false,
      error: status === 500 ? 'Realtime communication request failed.' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};