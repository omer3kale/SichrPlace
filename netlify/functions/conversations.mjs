import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for conversations function');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const AVAILABLE_ACTIONS = [
  'get_conversations',
  'create_conversation',
  'get_conversation_details',
  'update_conversation',
  'delete_conversation',
  'archive_conversation',
  'mark_as_read',
  'search_conversations',
  'get_conversation_participants',
  'add_participant',
  'remove_participant',
  'get_conversation_stats',
];

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
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
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

const sanitizeMetadata = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return defaultValue;
};

const uniqueUuidArray = (values = []) => {
  if (!Array.isArray(values)) return [];
  const sanitized = values
    .map((value) => sanitizeString(value, { maxLength: 36 }))
    .filter((value) => value && isUuid(value));
  return Array.from(new Set(sanitized));
};

const getAuthenticatedUser = async (headers) => {
  const token = extractBearerToken(headers);
  if (!token) {
    return { error: httpError(401, 'Authorization token is required') };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { error: httpError(401, 'Invalid or expired token') };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, role, status, account_status, is_blocked')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return { error: httpError(403, 'User profile not found') };
  }

  if (
    profile.is_blocked ||
    profile.status === 'suspended' ||
    ['suspended', 'deleted'].includes(profile.account_status)
  ) {
    return { error: httpError(403, 'User account is not permitted to access conversations') };
  }

  return { token, authUser: data.user, profile };
};



const buildActionDetails = () => ({ available_actions: AVAILABLE_ACTIONS });

const ACTION_HANDLERS = {
  get_conversations: ({ userId, event }) =>
    getConversations(userId, event.queryStringParameters),
  create_conversation: ({ userId, event }) => createConversation(userId, event.body),
  get_conversation_details: ({ userId, event }) =>
    getConversationDetails(userId, event.queryStringParameters),
  update_conversation: ({ userId, event }) => updateConversation(userId, event.body),
  delete_conversation: ({ userId, event }) => deleteConversation(userId, event.body),
  archive_conversation: ({ userId, event }) => archiveConversation(userId, event.body),
  mark_as_read: ({ userId, event }) => markAsRead(userId, event.body),
  search_conversations: ({ userId, event }) =>
    searchConversations(userId, event.queryStringParameters),
  get_conversation_participants: ({ userId, event }) =>
    getConversationParticipants(userId, event.queryStringParameters),
  add_participant: ({ userId, event }) => addParticipant(userId, event.body),
  remove_participant: ({ userId, event }) => removeParticipant(userId, event.body),
  get_conversation_stats: ({ userId, event }) => getConversationStats(userId),
};

export const handler = async (event) => {
  console.log('Conversations handler called:', {
    method: event.httpMethod,
    path: event.path,
    action: event.queryStringParameters?.action
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
    const action = sanitizeString(event.queryStringParameters?.action, {
      maxLength: 64,
      allowEmpty: false,
    });

    if (!action) {
      throw httpError(400, 'Action parameter is required', buildActionDetails());
    }

    const handlerFn = ACTION_HANDLERS[action];
    if (!handlerFn) {
      throw httpError(400, 'Invalid action specified', buildActionDetails());
    }

    const { profile } = await getAuthContext(event);

    return await handlerFn({ userId: profile.id, event });
  } catch (error) {
    console.error('Conversations handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Conversation operation failed' : error.message;
    
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

// Get user's conversations
async function getConversations(userId, queryParams) {
  try {
    const {
      limit = '20',
      offset = '0',
      status = 'active',
      type = 'all',
      include_archived = 'false',
    } = queryParams || {};

    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 20 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });
    const safeStatus = sanitizeString(status, { maxLength: 20, allowEmpty: true }) || 'active';
    const safeType = sanitizeString(type, { maxLength: 20, allowEmpty: true }) || 'all';
    const includeArchived = parseBoolean(include_archived, false);

    let query = supabase
      .from('conversations')
      .select(`
        id,
        title,
        type,
        status,
        is_archived,
        created_at,
        updated_at,
        last_message_at,
        participant_count,
        creator_id,
        metadata,
        conversation_participants!inner(
          user_id,
          role,
          joined_at,
          last_read_at,
          is_muted,
          is_archived,
          archived_at
        ),
        last_message:messages(
          id,
          content,
          created_at,
          sender:profiles!sender_id(username, profile_image)
        )
      `)
      .eq('conversation_participants.user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (safeStatus !== 'all') {
      query = query.eq('status', safeStatus);
    }

    if (safeType !== 'all') {
      query = query.eq('type', safeType);
    }

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data: conversations, error } = await safeSelect(
      query,
      'conversations',
      'Failed to fetch conversations'
    );

    if (error) {
      throw error;
    }

    const conversationsWithUnread = await Promise.all(
      (conversations || []).map(async (conversation) => {
        const participant =
          conversation.conversation_participants?.find((p) => p.user_id === userId) || null;
        const lastReadAt = participant?.last_read_at || null;
        let unreadCount = 0;

        if (conversation.id) {
          const { count, error: unreadError } = await safeSelect(
            supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', conversation.id)
              .gt('created_at', lastReadAt || '1970-01-01'),
            'messages',
            'Failed to count unread messages'
          );

          if (unreadError) {
            console.error('Unread count error:', unreadError);
          } else if (typeof count === 'number') {
            unreadCount = count;
          }
        }

        return {
          ...conversation,
          unread_count: unreadCount,
          current_user_participant: participant,
        };
      })
    );

    return respond(200, headers, {
      success: true,
      data: {
        conversations: conversationsWithUnread,
        total_fetched: conversationsWithUnread.length,
        pagination: {
          offset: safeOffset,
          limit: safeLimit,
        },
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    throw error;
  }
}

// Create new conversation
async function createConversation(userId, requestBody) {
  try {
    const payload = parseRequestBody(requestBody);

    const rawTitle = sanitizeString(payload.title, { maxLength: 120, allowEmpty: true });
    const normalizedType = sanitizeString(payload.type, { maxLength: 20, allowEmpty: true }) || 'direct';
    const allowedTypes = new Set(['direct', 'group', 'support', 'team', 'system']);
    const safeType = allowedTypes.has(normalizedType.toLowerCase())
      ? normalizedType.toLowerCase()
      : 'direct';

    const participantIds = uniqueUuidArray(payload.participant_ids || [])
      .filter((id) => id !== userId)
      .slice(0, 50);

    const safeMetadata = sanitizeMetadata(payload.metadata);
    const apartmentId = sanitizeString(payload.apartment_id, { maxLength: 36, allowEmpty: true });
    const bookingId = sanitizeString(payload.booking_id, { maxLength: 36, allowEmpty: true });
    const initialMessage = sanitizeString(payload.initial_message, { maxLength: 5000, allowEmpty: true });

    if (safeType === 'group' && !rawTitle) {
      throw httpError(400, 'Title is required for group conversations');
    }

    if (safeType === 'direct') {
      if (participantIds.length !== 1) {
        throw httpError(400, 'Direct conversations require exactly one other participant');
      }
      if (participantIds[0] === userId) {
        throw httpError(400, 'Cannot create a direct conversation with yourself');
      }
    } else if (participantIds.length === 0) {
      return respond(400, headers, {
        success: false,
        message: 'At least one additional participant is required',
      });
    }

    if (safeType === 'direct') {
      const targetUserId = participantIds[0];
      const { data: existingParticipations, error: existingError } = await safeSelect(
        supabase
          .from('conversation_participants')
          .select(`
            conversation_id,
            conversation:conversations!inner(
              id,
              type,
              status,
              participant_count
            )
          `)
          .eq('user_id', userId)
          .eq('conversation.type', 'direct')
          .eq('conversation.status', 'active'),
        'conversation_participants',
        'Failed to check existing conversations'
      );

      if (!existingError && existingParticipations?.length) {
        for (const record of existingParticipations) {
          const { data: participants, error: participantsError } = await safeSelect(
            supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', record.conversation_id),
            'conversation_participants',
            'Failed to fetch conversation participants'
          );

          if (!participantsError && participants) {
            const participantSet = new Set(participants.map((entry) => entry.user_id));
            if (participantSet.has(userId) && participantSet.has(targetUserId) && participantSet.size === 2) {
              return respond(200, {
                success: true,
                message: 'Conversation already exists',
                data: {
                  conversation_id: record.conversation_id,
                  existing: true,
                },
              });
            }
          }
        }
      } else if (existingError) {
        throw existingError;
      }
    }

    const nowIso = new Date().toISOString();
    const conversationData = {
      title: rawTitle || (safeType === 'group' ? 'New Group Chat' : null),
      type: safeType,
      status: 'active',
      creator_id: userId,
      participant_count: participantIds.length + 1,
      apartment_id: apartmentId || null,
      booking_id: bookingId || null,
      metadata: safeMetadata,
      created_at: nowIso,
      updated_at: nowIso,
      last_message_at: nowIso,
    };

    const { data: conversationArray, error: conversationError } = await safeInsert(
      supabase
        .from('conversations')
        .insert(conversationData)
        .select('*'),
      'conversations',
      'Failed to create conversation'
    );

    if (conversationError) {
      throw conversationError;
    }

    const conversation = conversationArray?.[0];
    if (!conversation) {
      throw httpError(500, 'Failed to retrieve created conversation');
    }

    const participantRecords = [
      {
        conversation_id: conversation.id,
        user_id: userId,
        role: 'admin',
        joined_at: nowIso,
        last_read_at: nowIso,
      },
      ...participantIds.map((participantId) => ({
        conversation_id: conversation.id,
        user_id: participantId,
        role: 'member',
        joined_at: nowIso,
        last_read_at: nowIso,
      })),
    ];

    const { error: participantsError } = await safeInsert(
      supabase
        .from('conversation_participants')
        .insert(participantRecords)
        .select('id'),
      'conversation_participants',
      'Failed to add conversation participants'
    );

    if (participantsError) {
      await safeDelete(
        supabase.from('conversations').delete().eq('id', conversation.id),
        'conversations',
        'Failed to cleanup conversation after participant error'
      );
      throw participantsError;
    }

    if (initialMessage) {
      const { error: messageError } = await safeInsert(
        supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            sender_id: userId,
            content: initialMessage,
            message_type: 'text',
            created_at: nowIso,
            updated_at: nowIso,
          }),
        'messages',
        'Failed to send initial message'
      );

      if (messageError) {
        console.error('Error sending initial message:', messageError);
      }
    }

    const { error: activityError } = await safeInsert(
      supabase
        .from('user_activity')
        .insert({
          user_id: userId,
          action: 'conversation_created',
          details: `Created ${safeType} conversation: ${conversation.title || conversation.id}`,
          metadata: {
            conversation_id: conversation.id,
            participant_count: participantRecords.length,
          },
          created_at: nowIso,
        }),
      'user_activity',
      'Failed to log user activity'
    );

    if (activityError) {
      console.error('Failed to log conversation creation activity:', activityError);
    }

    return respond(201, {
      success: true,
      message: 'Conversation created successfully',
      data: {
        conversation_id: conversation.id,
        title: conversation.title,
        type: conversation.type,
        participant_count: participantRecords.length,
        created_at: conversation.created_at,
      },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    throw error;
  }
}

// Get detailed conversation information
async function getConversationDetails(userId, queryParams) {
  try {
    const { conversation_id, include_messages = 'false', message_limit = '50' } = queryParams || {};

    const conversationId = sanitizeString(conversation_id, { maxLength: 36 });
    const includeMessages = parseBoolean(include_messages, false);
    const safeMessageLimit = clampNumber(message_limit, { min: 1, max: 200, fallback: 50 });

    if (!conversationId || !isUuid(conversationId)) {
      throw httpError(400, 'Valid conversation ID is required');
    }

    const { data: participation, error: participationError } = await safeSelect(
      supabase
        .from('conversation_participants')
        .select('id, role, last_read_at, joined_at, is_archived, archived_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single(),
      'conversation_participants',
      'Failed to check conversation participation'
    );

    if (participationError || !participation) {
      throw httpError(403, 'Access denied or conversation not found');
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        *,
        creator:users!creator_id(
          id, username, full_name, profile_image
        ),
        apartment:apartments(
          id, title, address
        ),
        booking:bookings(
          id, start_date, end_date, status
        )
      `)
      .eq('id', conversationId)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return respond(404, headers, {
        success: false,
        message: 'Conversation not found',
      });
    }

    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select(`
        *,
        user:users(
          id, username, full_name, profile_image, last_login_at, user_type, verified
        )
      `)
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      throw participantsError;
    }

    let messages = [];
    if (includeMessages) {
      const { data: messageData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(
            id, username, full_name, profile_image
          ),
          message_attachments(
            id, file_url, file_name, file_type, file_size, thumbnail_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(safeMessageLimit);

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      } else if (messageData) {
        messages = messageData;
      }
    }

    const [{ count: totalMessages, error: totalMessagesError }, { count: unreadMessages, error: unreadError }] =
      await Promise.all([
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)
          .gt('created_at', participation.last_read_at || '1970-01-01'),
      ]);

    if (totalMessagesError) {
      console.error('Error counting messages:', totalMessagesError);
    }

    if (unreadError) {
      console.error('Error counting unread messages:', unreadError);
    }

    const conversationDetails = {
      ...conversation,
      participants: participants || [],
      messages,
      statistics: {
        total_messages: totalMessages ?? 0,
        unread_messages: unreadMessages ?? 0,
        participant_count: participants?.length || 0,
      },
      current_user_participation: participation,
    };

    return respond(200, headers, {
      success: true,
      data: conversationDetails,
    });
  } catch (error) {
    console.error('Get conversation details error:', error);
    throw error;
  }
}

// Update conversation
async function updateConversation(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const titleProvided = Object.prototype.hasOwnProperty.call(payload, 'title');
    const metadataProvided = Object.prototype.hasOwnProperty.call(payload, 'metadata');
    const archiveProvided = Object.prototype.hasOwnProperty.call(payload, 'is_archived');

    if (!conversationId || !isUuid(conversationId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation ID is required',
      });
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('creator_id')
      .eq('id', conversationId)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return respond(404, headers, {
        success: false,
        message: 'Conversation not found',
      });
    }

    if (participation.role !== 'admin' && conversation.creator_id !== userId) {
      return respond(403, headers, {
        success: false,
        message: 'Insufficient permissions to update conversation',
      });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (titleProvided) {
      updateData.title = sanitizeString(payload.title, { maxLength: 120, allowEmpty: true });
    }

    if (metadataProvided) {
      updateData.metadata = sanitizeMetadata(payload.metadata);
    }

    if (archiveProvided) {
      updateData.is_archived = parseBoolean(payload.is_archived, false);
    }

    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return respond(200, headers, {
      success: true,
      message: 'Conversation updated successfully',
      data: updatedConversation,
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    throw error;
  }
}

// Delete conversation
async function deleteConversation(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const confirmDeletion = parseBoolean(payload.confirm_deletion, false);

    if (!conversationId || !isUuid(conversationId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation ID is required',
      });
    }

    if (!confirmDeletion) {
      return respond(400, headers, {
        success: false,
        message: 'Deletion confirmation required',
      });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('creator_id')
      .eq('id', conversationId)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return respond(404, headers, {
        success: false,
        message: 'Conversation not found',
      });
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    if (conversation.creator_id !== userId && participation.role !== 'admin') {
      return respond(403, headers, {
        success: false,
        message: 'Only the creator or an admin may delete this conversation',
      });
    }

    const timestamp = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('conversations')
      .update({
        status: 'deleted',
        deleted_at: timestamp,
        deleted_by: userId,
        updated_at: timestamp,
      })
      .eq('id', conversationId);

    if (deleteError) {
      throw deleteError;
    }

    return respond(200, headers, {
      success: true,
      message: 'Conversation deleted successfully',
      data: {
        conversation_id: conversationId,
        deleted_at: timestamp,
      },
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    throw error;
  }
}

// Archive conversation
async function archiveConversation(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const isArchived = parseBoolean(payload.is_archived, true);

    if (!conversationId || !isUuid(conversationId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation ID is required',
      });
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    const timestamp = new Date().toISOString();
    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        is_archived: isArchived,
        archived_at: isArchived ? timestamp : null,
        updated_at: timestamp,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select('conversation_id, is_archived, archived_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return respond(200, headers, {
      success: true,
      message: `Conversation ${isArchived ? 'archived' : 'unarchived'} successfully`,
      data: updatedParticipation,
    });
  } catch (error) {
    console.error('Archive conversation error:', error);
    throw error;
  }
}

// Mark conversation as read
async function markAsRead(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const messageId = sanitizeString(payload.message_id, { maxLength: 36 });

    if (!conversationId || !isUuid(conversationId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation ID is required',
      });
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id, last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    let lastReadAt = new Date().toISOString();

    if (messageId && isUuid(messageId)) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('id, conversation_id, created_at')
        .eq('id', messageId)
        .single();

      if (messageError) {
        console.error('Error fetching message for markAsRead:', messageError);
      } else if (message && message.conversation_id === conversationId) {
        lastReadAt = message.created_at;
      }
    }

    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        last_read_at: lastReadAt,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select('conversation_id, last_read_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return respond(200, headers, {
      success: true,
      message: 'Conversation marked as read',
      data: updatedParticipation,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    throw error;
  }
}

// Search conversations
async function searchConversations(userId, queryParams, headers) {
  try {
    const {
      query = '',
      limit = '20',
      offset = '0',
      search_type = 'all',
    } = queryParams || {};

    const safeQuery = sanitizeString(query, { maxLength: 200 });
    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 20 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });
    const searchType = (sanitizeString(search_type, { maxLength: 20, allowEmpty: true }) || 'all').toLowerCase();

    if (!safeQuery) {
      return respond(400, headers, {
        success: false,
        message: 'Search query is required',
      });
    }

    let conversationQuery = supabase
      .from('conversations')
      .select(`
        id,
        title,
        type,
        status,
        created_at,
        updated_at,
        last_message_at,
        participant_count,
        conversation_participants!inner(
          user_id,
          user:users(username, full_name)
        )
      `)
      .eq('conversation_participants.user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (searchType === 'title') {
      conversationQuery = conversationQuery.ilike('title', `%${safeQuery}%`);
    }

    const { data: conversationData, error: conversationError } = await conversationQuery;

    if (conversationError) {
      throw conversationError;
    }

    const queryLower = safeQuery.toLowerCase();

    const filteredConversations = (conversationData || []).filter((conversation) => {
      if (searchType === 'participants') {
        return (conversation.conversation_participants || []).some((participant) => {
          const username = participant?.user?.username || '';
          const fullName = participant?.user?.full_name || '';
          const haystack = `${username} ${fullName}`.toLowerCase();
          return haystack.includes(queryLower);
        });
      }

      if (searchType === 'all') {
        const titleLower = (conversation.title || '').toLowerCase();
        return (
          titleLower.includes(queryLower) ||
          (conversation.conversation_participants || []).some((participant) => {
            const username = participant?.user?.username || '';
            const fullName = participant?.user?.full_name || '';
            const haystack = `${username} ${fullName}`.toLowerCase();
            return haystack.includes(queryLower);
          })
        );
      }

      return true;
    });

    let messageMatches = [];
    if (searchType === 'messages' || searchType === 'all') {
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          content,
          created_at,
          conversation:conversations!inner(
            id,
            title,
            conversation_participants!inner(user_id)
          )
        `)
        .eq('conversation.conversation_participants.user_id', userId)
        .ilike('content', `%${safeQuery}%`)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

      if (messageError) {
        console.error('Error searching messages:', messageError);
      } else if (messages) {
        messageMatches = messages;
      }
    }

    return respond(200, headers, {
      success: true,
      data: {
        conversations: filteredConversations,
        message_matches: messageMatches,
        total_conversation_matches: filteredConversations.length,
        total_message_matches: messageMatches.length,
        pagination: {
          offset: safeOffset,
          limit: safeLimit,
        },
      },
      search_query: safeQuery,
      search_type: searchType,
    });
  } catch (error) {
    console.error('Search conversations error:', error);
    throw error;
  }
}

// Get conversation participants
async function getConversationParticipants(userId, queryParams, headers) {
  try {
    const conversationId = sanitizeString(queryParams?.conversation_id, { maxLength: 36 });

    if (!conversationId || !isUuid(conversationId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation ID is required',
      });
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    const { data: participants, error } = await supabase
      .from('conversation_participants')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        last_read_at,
        is_muted,
        is_archived,
        archived_at,
        updated_at,
        user:users(
          id, username, full_name, profile_image,
          last_login_at, user_type, verified
        )
      `)
      .eq('conversation_id', conversationId)
      .order('joined_at', { ascending: true });

    if (error) {
      throw error;
    }

    const participantList = participants || [];

    return respond(200, headers, {
      success: true,
      data: {
        participants: participantList,
        total_participants: participantList.length,
      },
    });
  } catch (error) {
    console.error('Get conversation participants error:', error);
    throw error;
  }
}

// Add participant to conversation
async function addParticipant(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const targetUserId = sanitizeString(payload.user_id_to_add, { maxLength: 36 });
    const requestedRole = sanitizeString(payload.role, { maxLength: 20, allowEmpty: true }) || 'member';

    if (!conversationId || !isUuid(conversationId) || !targetUserId || !isUuid(targetUserId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation and user IDs are required',
      });
    }

    if (targetUserId === userId) {
      return respond(400, headers, {
        success: false,
        message: 'Use conversation settings to manage your own participation',
      });
    }

    const allowedRoles = new Set(['member', 'admin', 'moderator']);
    const role = allowedRoles.has(requestedRole) ? requestedRole : 'member';

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    if (participation.role !== 'admin') {
      return respond(403, headers, {
        success: false,
        message: 'Admin permission required',
      });
    }

    const { data: existingParticipant, error: existingError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingParticipant) {
      return respond(409, headers, {
        success: false,
        message: 'User is already a participant',
      });
    }

    const timestamp = new Date().toISOString();

    const { data: newParticipant, error: addError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversationId,
        user_id: targetUserId,
        role,
        joined_at: timestamp,
        last_read_at: timestamp,
      })
      .select(`
        id,
        conversation_id,
        user_id,
        role,
        joined_at,
        user:users(username, full_name, profile_image)
      `)
      .single();

    if (addError) {
      throw addError;
    }

    const { count: participantCount, error: countError } = await supabase
      .from('conversation_participants')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (countError) {
      console.error('Error counting participants after add:', countError);
    } else if (typeof participantCount === 'number') {
      const { error: updateCountError } = await supabase
        .from('conversations')
        .update({ participant_count: participantCount, updated_at: timestamp })
        .eq('id', conversationId);

      if (updateCountError) {
        console.error('Error updating participant count:', updateCountError);
      }
    }

    return respond(200, headers, {
      success: true,
      message: 'Participant added successfully',
      data: newParticipant,
    });
  } catch (error) {
    console.error('Add participant error:', error);
    throw error;
  }
}

// Remove participant from conversation
async function removeParticipant(userId, requestBody, headers) {
  try {
    const payload = parseRequestBody(requestBody);

    const conversationId = sanitizeString(payload.conversation_id, { maxLength: 36 });
    const targetUserId = sanitizeString(payload.user_id_to_remove, { maxLength: 36 });

    if (!conversationId || !isUuid(conversationId) || !targetUserId || !isUuid(targetUserId)) {
      return respond(400, headers, {
        success: false,
        message: 'Valid conversation and user IDs are required',
      });
    }

    const { data: requesterParticipation, error: requesterError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (requesterError || !requesterParticipation) {
      return respond(403, headers, {
        success: false,
        message: 'Access denied',
      });
    }

    const { data: targetParticipation, error: targetError } = await supabase
      .from('conversation_participants')
      .select('role, user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId)
      .single();

    if (targetError) {
      if (targetError.code === 'PGRST116') {
        return respond(404, headers, {
          success: false,
          message: 'Participant not found',
        });
      }
      throw targetError;
    }

    if (!targetParticipation) {
      return respond(404, headers, {
        success: false,
        message: 'Participant not found',
      });
    }

    const canRemove = requesterParticipation.role === 'admin' || targetUserId === userId;

    if (!canRemove) {
      return respond(403, headers, {
        success: false,
        message: 'Insufficient permissions',
      });
    }

    const timestamp = new Date().toISOString();

    const { error: removeError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId);

    if (removeError) {
      throw removeError;
    }

    const { count: participantCount, error: countError } = await supabase
      .from('conversation_participants')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (countError) {
      console.error('Error counting participants after removal:', countError);
    } else if (typeof participantCount === 'number') {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ participant_count: participantCount, updated_at: timestamp })
        .eq('id', conversationId);

      if (updateError) {
        console.error('Error updating participant count after removal:', updateError);
      }
    }

    return respond(200, headers, {
      success: true,
      message: 'Participant removed successfully',
      data: {
        conversation_id: conversationId,
        removed_user_id: targetUserId,
      },
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    throw error;
  }
}

// Get conversation statistics for user
async function getConversationStats(userId, headers) {
  try {
    const { data: participationData, error: participationError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        is_archived,
        last_read_at,
        conversation:conversations(status)
      `)
      .eq('user_id', userId);

    if (participationError) {
      throw participationError;
    }

    const participations = participationData || [];
    const conversationIds = participations.map((entry) => entry.conversation_id);

    let unreadMessageCount = 0;

    for (const participation of participations) {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', participation.conversation_id)
        .gt('created_at', participation.last_read_at || '1970-01-01');

      if (error) {
        console.error('Unread count error during stats:', error);
        continue;
      }

      if (typeof count === 'number') {
        unreadMessageCount += count;
      }
    }

    let recentActivityData = [];
    if (conversationIds.length) {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMessages, error: recentError } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', conversationIds)
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(200);

      if (recentError) {
        console.error('Recent activity fetch error:', recentError);
      } else if (recentMessages) {
        recentActivityData = recentMessages;
      }
    }

    const stats = {
      total_conversations: participations.length,
      active_conversations: participations.filter((entry) => entry.conversation?.status === 'active').length,
      archived_conversations: participations.filter((entry) => entry.is_archived).length,
      unread_messages: unreadMessageCount,
      recent_activity: recentActivityData.length,
      activity_by_day: getActivityByDay(recentActivityData),
    };

    return respond(200, headers, {
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get conversation stats error:', error);
    throw error;
  }
}

// Helper function to group activity by day
function getActivityByDay(activities) {
  const activityByDay = {};
  
  activities.forEach(activity => {
    const day = new Date(activity.created_at).toDateString();
    activityByDay[day] = (activityByDay[day] || 0) + 1;
  });
  
  return activityByDay;
}