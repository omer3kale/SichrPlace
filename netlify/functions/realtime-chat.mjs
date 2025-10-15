import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables for realtime-chat function');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

const getHeader = (headers = {}, name) => {
  if (!headers) return null;
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers = {}) => {
  const value = getHeader(headers, 'authorization');
  if (!value) return null;
  const parts = value.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    if (typeof body === 'object') {
      return body;
    }
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON');
  }
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clampNumber = (value, { min, max, fallback }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
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
      .select('id, email, role, status, account_status, is_blocked, is_admin, is_staff, notification_preferences')
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

  // Check account status
  if (profile.is_blocked) {
    throw httpError(403, 'Account is blocked');
  }

  if (profile.account_status === 'suspended') {
    throw httpError(403, 'Account is suspended');
  }

  // Check role requirements if specified
  if (options.requireAdmin && !profile.is_admin) {
    throw httpError(403, 'Admin access required');
  }

  if (options.requireAnalytics && !(profile.is_admin || profile.is_staff || profile.role === 'analytics')) {
    throw httpError(403, 'Analytics access required');
  }

  return {
    user: data.user,
    profile,
    isAdmin: profile.is_admin,
    isStaff: profile.is_staff
  };
};

const httpErrorOld = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};



export const handler = async (event) => {
  console.log('Realtime chat handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const { profile } = await getAuthContext(event);

    switch ((event.httpMethod || 'GET').toUpperCase()) {
      case 'GET':
        return await getConversations(profile, event.queryStringParameters);
      case 'POST':
        return await handleChatAction(profile, event.body, event.path || '');
      case 'PUT':
        return await updateMessage(profile, event.path || '', event.body);
      default:
        throw httpError(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('Realtime chat handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Realtime chat operation failed' : error.message;
    
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

// GET conversations and messages

const getConversations = async (user, queryParams, headers) => {
  try {
    const { conversationId, limit = '50', offset = '0' } = queryParams || {};

    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });
    const sanitizedConversationId = sanitizeString(conversationId, { maxLength: 36, allowEmpty: true });

    if (sanitizedConversationId) {
      if (!isUuid(sanitizedConversationId)) {
        throw httpError(400, 'conversationId must be a valid UUID');
      }

      const { data: conversationRecord, error: conversationError } = await supabase
        .from('conversations')
        .select('id, participant_1_id, participant_2_id')
        .eq('id', sanitizedConversationId)
        .maybeSingle();

      if (conversationError) {
        throw httpError(500, 'Failed to verify conversation access.', conversationError.message);
      }

      if (
        !conversationRecord ||
        (conversationRecord.participant_1_id !== user.id &&
          conversationRecord.participant_2_id !== user.id)
      ) {
        throw httpError(403, 'Access to this conversation is not permitted');
      }

      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          created_at,
          read_at,
          read_by,
          sender:sender_id (
            id,
            email,
            name
          )
        `)
        .eq('conversation_id', sanitizedConversationId)
        .order('created_at', { ascending: true })
        .range(safeOffset, safeOffset + safeLimit - 1);

      if (error) {
        throw httpError(500, 'Failed to fetch messages.', error.message);
      }

      return respond(200, headers, {
        success: true,
        data: messages || [],
        conversationId: sanitizedConversationId,
        pagination: {
          limit: safeLimit,
          offset: safeOffset,
        },
      });
    } else {
      // Get user's conversations
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          participant_1_id,
          participant_2_id,
          apartment_id,
          status,
          created_at,
          updated_at,
          participant_1:participant_1_id (
            id,
            email,
            full_name
          ),
          participant_2:participant_2_id (
            id,
            email,
            full_name
          ),
          apartment:apartment_id (
            id,
            title,
            image_urls
          ),
          messages(
            id,
            content,
            created_at,
            sender_id
          )
        `)
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
  .order('updated_at', { ascending: false })
  .range(safeOffset, safeOffset + safeLimit - 1);

      if (error) {
        throw httpError(500, 'Failed to fetch conversations.', error.message);
      }

      return respond(200, headers, {
        success: true,
        data: conversations || [],
        pagination: {
          limit: safeLimit,
          offset: safeOffset,
        },
      });
    }
  } catch (error) {
    if (error.status) {
      throw error;
    }
    throw httpError(500, 'Failed to fetch conversations.', error.message);
  }
};

// POST handle chat actions (send message, create conversation)
const handleChatAction = async (user, body, path, headers) => {
  const payload = parseRequestBody(body);
  const action = sanitizeString(payload.action, { maxLength: 64, allowEmpty: true });
  const normalizedPath = path || '';

  if (normalizedPath.includes('/send') || action === 'send_message' || !action) {
    return await sendMessage(user, payload, headers);
  }

  if (action === 'create_conversation') {
    return await createConversation(user, payload, headers);
  }

  throw httpError(400, 'Unsupported chat action requested.');
};

// Send message
const sendMessage = async (user, data, headers) => {
  const sanitizedContent = sanitizeString(data.content, { maxLength: 5000, allowEmpty: false });
  if (!sanitizedContent) {
    throw httpError(400, 'Message content is required.');
  }

  const sanitizedMessageType = sanitizeString(data.messageType, {
    maxLength: 32,
    allowEmpty: true,
  }) || 'text';

  const providedConversationId = sanitizeString(data.conversationId, {
    maxLength: 36,
    allowEmpty: true,
  });

  const sanitizedApartmentId = sanitizeString(data.apartmentId, {
    maxLength: 36,
    allowEmpty: true,
  });
  const sanitizedRecipientId = sanitizeString(data.recipientId, {
    maxLength: 36,
    allowEmpty: true,
  });

  let finalConversationId = null;

  if (providedConversationId) {
    if (!isUuid(providedConversationId)) {
      throw httpError(400, 'Conversation ID must be a valid UUID.');
    }
    finalConversationId = providedConversationId;
  }

  if (!finalConversationId && sanitizedApartmentId && sanitizedRecipientId) {
    if (!isUuid(sanitizedApartmentId) || !isUuid(sanitizedRecipientId)) {
      throw httpError(400, 'Apartment ID and recipient ID must be valid UUIDs.');
    }
    const newConversation = await createConversationInternal(user.id, sanitizedRecipientId, sanitizedApartmentId);
    finalConversationId = newConversation.id;
  }

  if (!finalConversationId) {
    throw httpError(400, 'Conversation ID or apartment/recipient information is required.');
  }

  const { data: conversationRecord, error: conversationError } = await supabase
    .from('conversations')
    .select('participant_1_id, participant_2_id')
    .eq('id', finalConversationId)
    .maybeSingle();

  if (conversationError) {
    throw httpError(500, 'Failed to verify conversation membership.', conversationError.message);
  }

  if (
    !conversationRecord ||
    (conversationRecord.participant_1_id !== user.id &&
      conversationRecord.participant_2_id !== user.id)
  ) {
    throw httpError(403, 'User is not a participant in this conversation.');
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: finalConversationId,
        sender_id: user.id,
        content: sanitizedContent,
        message_type: sanitizedMessageType,
      },
    ])
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      message_type,
      created_at,
      sender:sender_id (
        id,
        email,
        name
      )
    `)
    .single();

  if (error) {
    throw httpError(500, 'Failed to send message.', error.message);
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', finalConversationId);

  return respond(200, headers, {
    success: true,
    message: 'Message sent successfully.',
    data: message,
  });
};

// Create conversation
const createConversation = async (user, data, headers) => {
  const sanitizedApartmentId = sanitizeString(data.apartmentId, { maxLength: 36, allowEmpty: false });
  const sanitizedRecipientId = sanitizeString(data.recipientId, { maxLength: 36, allowEmpty: false });

  if (!sanitizedApartmentId || !sanitizedRecipientId || !isUuid(sanitizedApartmentId) || !isUuid(sanitizedRecipientId)) {
    throw httpError(400, 'Valid apartmentId and recipientId are required.');
  }

  const conversation = await createConversationInternal(user.id, sanitizedRecipientId, sanitizedApartmentId);

  return respond(200, headers, {
    success: true,
    message: 'Conversation created successfully.',
    data: conversation,
  });
};

// Internal function to create conversation
const createConversationInternal = async (userId, recipientId, apartmentId) => {
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('apartment_id', apartmentId)
    .or(
      `and(participant_1_id.eq.${userId},participant_2_id.eq.${recipientId}),and(participant_1_id.eq.${recipientId},participant_2_id.eq.${userId})`,
    )
    .maybeSingle();

  if (existingError) {
    throw httpError(500, 'Failed to verify existing conversation.', existingError.message);
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert([
      {
        participant_1_id: userId,
        participant_2_id: recipientId,
        apartment_id: apartmentId,
        status: 'active',
      },
    ])
    .select()
    .single();

  if (error) {
    throw httpError(500, 'Failed to create conversation.', error.message);
  }

  return data;
};

// PUT update message (mark as read)
const updateMessage = async (user, path, body, headers) => {
  const pathParts = (path || '').split('/').filter(Boolean);
  const messageId = pathParts[pathParts.length - 1] || null;

  if (!messageId || !isUuid(messageId)) {
    throw httpError(400, 'Message ID is required.');
  }

  const { data: messageRecord, error: messageError } = await supabase
    .from('messages')
    .select('id, conversation_id')
    .eq('id', messageId)
    .single();

  if (messageError || !messageRecord) {
    throw httpError(404, 'Message not found.');
  }

  const { data: conversationRecord, error: conversationError } = await supabase
    .from('conversations')
    .select('participant_1_id, participant_2_id')
    .eq('id', messageRecord.conversation_id)
    .maybeSingle();

  if (conversationError) {
    throw httpError(500, 'Failed to verify conversation membership.', conversationError.message);
  }

  if (
    !conversationRecord ||
    (conversationRecord.participant_1_id !== user.id &&
      conversationRecord.participant_2_id !== user.id)
  ) {
    throw httpError(403, 'User is not permitted to update this message.');
  }

  const { data, error } = await supabase
    .from('messages')
    .update({
      read_at: new Date().toISOString(),
      read_by: user.id,
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    throw httpError(500, 'Failed to update message.', error.message);
  }

  return respond(200, headers, {
    success: true,
    message: 'Message marked as read.',
    data,
  });
};