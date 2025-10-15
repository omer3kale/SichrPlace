import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for messages function');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const AVAILABLE_ACTIONS = [
  'get_messages',
  'send_message',
  'update_message',
  'delete_message',
  'mark_as_read',
  'get_message_details',
  'upload_attachment',
  'get_attachments',
  'search_messages',
  'get_message_history',
  'react_to_message',
  'get_message_reactions',
  'forward_message',
  'reply_to_message',
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

// Authentication functions removed - using getAuthContext instead

const buildActionDetails = () => ({ available_actions: AVAILABLE_ACTIONS });

const ACTION_HANDLERS = {
  get_messages: ({ userId, event }) =>
    getMessages(userId, event.queryStringParameters),
  send_message: ({ userId, event }) => sendMessage(userId, event.body),
  update_message: ({ userId, event }) => updateMessage(userId, event.body),
  delete_message: ({ userId, event }) => deleteMessage(userId, event.body),
  mark_as_read: ({ userId, event }) => markAsRead(userId, event.body),
  get_message_details: ({ userId, event }) =>
    getMessageDetails(userId, event.queryStringParameters),
  upload_attachment: ({ userId, event }) => uploadAttachment(userId, event.body),
  get_attachments: ({ userId, event }) =>
    getAttachments(userId, event.queryStringParameters),
  search_messages: ({ userId, event }) =>
    searchMessages(userId, event.queryStringParameters),
  get_message_history: ({ userId, event }) =>
    getMessageHistory(userId, event.queryStringParameters),
  react_to_message: ({ userId, event }) => reactToMessage(userId, event.body),
  get_message_reactions: ({ userId, event }) =>
    getMessageReactions(userId, event.queryStringParameters),
  forward_message: ({ userId, event }) => forwardMessage(userId, event.body),
  reply_to_message: ({ userId, event }) => replyToMessage(userId, event.body),
};

export const handler = async (event) => {
  console.log('Messages handler called:', {
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
    console.error('Messages handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Message operation failed' : error.message;
    
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

// Get messages from a conversation
async function getMessages(userId, queryParams) {
  try {
    const {
      conversation_id,
      limit = '50',
      offset = '0',
      before_message_id,
      after_message_id,
      message_type = 'all'
    } = queryParams || {};

    const conversationId = sanitizeString(conversation_id, { maxLength: 36 });
    if (!conversationId || !isUuid(conversationId)) {
      throw httpError(400, 'Valid conversation ID is required');
    }

    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });
    const normalizedMessageType = sanitizeString(message_type, { maxLength: 30, allowEmpty: true }) || 'all';

    // Verify user is participant in conversation
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id, last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied or conversation not found'
        })
      };
    }

    // Build messages query
    let query = supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        parent_message_id,
        content,
        message_type,
        status,
        created_at,
        updated_at,
        edited_at,
        sender:users!sender_id(
          id, username, full_name, profile_image
        ),
        parent_message:messages!parent_message_id(
          id, content, sender_id,
          sender:users!sender_id(username, profile_image)
        ),
        message_attachments(
          id, file_url, file_name, file_type, file_size, thumbnail_url
        ),
        message_reactions(
          id, emoji, user_id,
          user:users!user_id(username, profile_image)
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)
      .range(safeOffset, safeOffset + safeLimit - 1);

    // Apply filters
    if (normalizedMessageType !== 'all') {
      query = query.eq('message_type', normalizedMessageType);
    }

    if (before_message_id) {
      const beforeId = sanitizeString(before_message_id, { maxLength: 36 });
      if (!isUuid(beforeId)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid before_message_id provided'
          })
        };
      }
      // Get messages before a specific message (pagination)
      const { data: beforeMessage, error: beforeError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', beforeId)
        .single();

      if (!beforeError && beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at);
      }
    }

    if (after_message_id) {
      const afterId = sanitizeString(after_message_id, { maxLength: 36 });
      if (!isUuid(afterId)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid after_message_id provided'
          })
        };
      }
      // Get messages after a specific message
      const { data: afterMessage, error: afterError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', afterId)
        .single();

      if (!afterError && afterMessage) {
        query = query.gt('created_at', afterMessage.created_at);
      }
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      throw messagesError;
    }

    // Mark messages as read up to the latest message
    if (messages && messages.length > 0) {
      const latestMessage = messages[0]; // First message (most recent due to DESC order)
      await supabase
        .from('conversation_participants')
        .update({
          last_read_at: latestMessage.created_at,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversation_id)
        .eq('user_id', userId);
    }

    // Add read status for each message
    const messagesWithReadStatus = messages.map(message => ({
      ...message,
      is_read_by_user: new Date(message.created_at) <= new Date(participation.last_read_at),
      is_own_message: message.sender_id === userId
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          messages: messagesWithReadStatus,
          total_fetched: messagesWithReadStatus.length,
          pagination: {
            offset: safeOffset,
            limit: safeLimit,
            has_more: messagesWithReadStatus.length === safeLimit
          }
        }
      })
    };

  } catch (error) {
    console.error('Get messages error:', error);
    throw error;
  }
}

// Send a new message
async function sendMessage(userId, requestBody, headers) {
  try {
    const {
      conversation_id,
      content,
      message_type = 'text',
      parent_message_id,
      attachments = [],
      metadata = {}
    } = parseRequestBody(requestBody);

    const conversationId = sanitizeString(conversation_id, { maxLength: 36 });
    if (!conversationId || !isUuid(conversationId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid conversation ID is required'
        })
      };
    }

    const normalizedMessageType = (sanitizeString(message_type, { maxLength: 30, allowEmpty: true }) || 'text').toLowerCase();
    const allowedMessageTypes = new Set([
      'text',
      'image',
      'file',
      'system',
      'video',
      'audio',
      'location',
      'gif',
      'voice',
      'sticker',
    ]);
    const safeMessageType = allowedMessageTypes.has(normalizedMessageType)
      ? normalizedMessageType
      : 'text';

    const hasAttachmentArray = Array.isArray(attachments);
    const safeContent = sanitizeString(content, {
      maxLength: 5000,
      allowEmpty: hasAttachmentArray && attachments.length > 0,
    });

    const safeAttachments = hasAttachmentArray
      ? attachments
          .slice(0, 10)
          .map((item) => {
            const fileUrl = sanitizeString(item?.file_url, { maxLength: 2048 });
            const fileName = sanitizeString(item?.file_name, { maxLength: 255 });
            const fileType = sanitizeString(item?.file_type, { maxLength: 120, allowEmpty: true }) || null;
            const thumbnailUrl = sanitizeString(item?.thumbnail_url, { maxLength: 2048, allowEmpty: true });
            const fileSizeNumber = Number.parseInt(item?.file_size, 10);
            const fileSize = Number.isFinite(fileSizeNumber) && fileSizeNumber >= 0 ? fileSizeNumber : null;

            return fileUrl && fileName
              ? {
                  file_url: fileUrl,
                  file_name: fileName,
                  file_type: fileType,
                  file_size: fileSize,
                  thumbnail_url: thumbnailUrl,
                }
              : null;
          })
          .filter(Boolean)
      : [];

    const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};

    if (!safeContent && safeAttachments.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message content or attachments are required',
        }),
      };
    }

    // Verify user is participant in conversation
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id, role, is_muted')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied or conversation not found'
        })
      };
    }

    // Check if conversation is active
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation || conversation.status !== 'active') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cannot send message to inactive conversation'
        })
      };
    }

    // Validate parent message if replying
    if (parent_message_id) {
      const { data: parentMessage, error: parentError } = await supabase
        .from('messages')
        .select('id, conversation_id')
        .eq('id', parent_message_id)
        .eq('conversation_id', conversationId)
        .single();

      if (parentError || !parentMessage) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Parent message not found in this conversation'
          })
        };
      }
    }

    // Create message
    const messageData = {
      conversation_id: conversationId,
      sender_id: userId,
      parent_message_id: parent_message_id || null,
      message_type: safeMessageType,
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    messageData.content = safeContent || '';

    if (Object.keys(safeMetadata).length > 0) {
      messageData.metadata = safeMetadata;
    }
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select(`
        *,
        sender:users!sender_id(
          id, username, full_name, profile_image
        ),
        parent_message:messages!parent_message_id(
          id, content, sender_id,
          sender:users!sender_id(username, profile_image)
        )
      `)
      .single();

    if (messageError) {
      throw messageError;
    }

    // Handle attachments if provided
    const messageAttachments = [];
    if (safeAttachments.length > 0) {
      for (const attachment of safeAttachments) {
        const { data: attachmentRecord, error: attachmentError } = await supabase
          .from('message_attachments')
          .insert({
            message_id: message.id,
            file_url: attachment.file_url,
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            file_size: attachment.file_size,
            thumbnail_url: attachment.thumbnail_url || null,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!attachmentError && attachmentRecord) {
          messageAttachments.push(attachmentRecord);
        }
      }
    }

    // Update conversation's last message timestamp
    await supabase
      .from('conversations')
      .update({
        last_message_at: message.created_at,
        updated_at: new Date().toISOString()
      })
  .eq('id', conversationId);

    // Update sender's last read timestamp
    await supabase
      .from('conversation_participants')
      .update({
        last_read_at: message.created_at,
        updated_at: new Date().toISOString()
      })
  .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    // Log activity
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'message_sent',
        details: `Sent message in conversation ${conversationId}`,
        metadata: { conversation_id: conversationId, message_id: message.id },
        created_at: new Date().toISOString()
      });

    const messageResponse = {
      ...message,
      message_attachments: messageAttachments
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message sent successfully',
        data: messageResponse
      })
    };

  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

// Update message content
async function updateMessage(userId, requestBody, headers) {
  try {
    const { message_id, content } = parseRequestBody(requestBody);
    const messageId = sanitizeString(message_id, { maxLength: 36 });
    const sanitizedContent = sanitizeString(content, { maxLength: 5000 });

    if (!messageId || !isUuid(messageId) || !sanitizedContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID and non-empty content are required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const editTimeLimitMs = 24 * 60 * 60 * 1000;
    if (messageAge > editTimeLimitMs) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message is too old to edit',
        }),
      };
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        content: sanitizedContent,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'edited',
      })
      .eq('id', messageId)
      .select(`
        *,
        sender:users!sender_id(
          id, username, full_name, profile_image
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message updated successfully',
        data: updatedMessage,
      }),
    };

  } catch (error) {
    console.error('Update message error:', error);
    throw error;
  }
}

// Delete message
async function deleteMessage(userId, requestBody, headers) {
  try {
    const { message_id, delete_for_everyone } = parseRequestBody(requestBody);
    const messageId = sanitizeString(message_id, { maxLength: 36 });
    const deleteForEveryone = typeof delete_for_everyone === 'string'
      ? delete_for_everyone.toLowerCase() === 'true'
      : Boolean(delete_for_everyone);

    if (!messageId || !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID is required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, status, created_at')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    if (deleteForEveryone) {
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'deleted',
          content: '[Message deleted]',
          deleted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', messageId);

      if (updateError) {
        throw updateError;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message deleted successfully',
        data: {
          message_id: messageId,
          deleted_for_everyone: deleteForEveryone,
          deleted_at: new Date().toISOString(),
        },
      }),
    };

  } catch (error) {
    console.error('Delete message error:', error);
    throw error;
  }
}

// Mark messages as read
async function markAsRead(userId, requestBody, headers) {
  try {
    const { conversation_id, message_id } = parseRequestBody(requestBody);
    const conversationId = sanitizeString(conversation_id, { maxLength: 36 });
    const messageId = sanitizeString(message_id, { maxLength: 36, allowEmpty: true });

    if (!conversationId || !isUuid(conversationId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid conversation ID is required',
        }),
      };
    }

    if (messageId && !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid message ID provided',
        }),
      };
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied or conversation not found',
        }),
      };
    }

    let readTimestamp = new Date().toISOString();

    if (messageId) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', messageId)
        .eq('conversation_id', conversationId)
        .single();

      if (messageError && messageError.code !== 'PGRST116') {
        throw messageError;
      }

      if (message) {
        readTimestamp = message.created_at;
      }
    }

    const nowIso = new Date().toISOString();
    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        last_read_at: readTimestamp,
        updated_at: nowIso,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .select('conversation_id, user_id, last_read_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Messages marked as read',
        data: {
          conversation_id: conversationId,
          last_read_at: updatedParticipation?.last_read_at || readTimestamp,
        },
      }),
    };

  } catch (error) {
    console.error('Mark as read error:', error);
    throw error;
  }
}

// Get detailed message information
async function getMessageDetails(userId, queryParams, headers) {
  try {
    const rawMessageId = queryParams?.message_id;
    const messageId = sanitizeString(rawMessageId, { maxLength: 36 });

    if (!messageId || !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID is required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!sender_id(
          id, username, full_name, profile_image
        ),
        parent_message:messages!parent_message_id(
          id, content, sender_id,
          sender:users!sender_id(username, profile_image)
        ),
        message_attachments(*),
        message_reactions(
          id, emoji, user_id, created_at,
          user:users!user_id(username, profile_image)
        ),
        conversation:conversations(
          id, title, type, status
        )
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      if (messageError?.code === 'PGRST116') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Message not found',
          }),
        };
      }
      throw messageError || new Error('Message not found');
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', message.conversation_id)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied',
        }),
      };
    }

    // Get replies to this message
    const { data: replies, error: repliesError } = await supabase
      .from('messages')
      .select(`
        id, content, created_at,
        sender:users!sender_id(username, profile_image)
      `)
      .eq('parent_message_id', messageId)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('Error fetching replies:', repliesError);
    }

    const messageDetails = {
      ...message,
      replies: replies || [],
      reply_count: replies?.length || 0,
      is_own_message: message.sender_id === userId
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: messageDetails
      })
    };

  } catch (error) {
    console.error('Get message details error:', error);
    throw error;
  }
}

// Upload attachment for message
async function uploadAttachment(userId, requestBody, headers) {
  try {
    const {
      message_id,
      file_url,
      file_name,
      file_type,
      file_size,
      thumbnail_url,
    } = parseRequestBody(requestBody);

    const messageId = sanitizeString(message_id, { maxLength: 36 });
    const fileUrl = sanitizeString(file_url, { maxLength: 2048 });
    const fileName = sanitizeString(file_name, { maxLength: 255 });
    const fileType = sanitizeString(file_type, { maxLength: 120, allowEmpty: true }) || 'unknown';
    const thumbnailUrl = sanitizeString(thumbnail_url, { maxLength: 2048, allowEmpty: true });
    const fileSizeNumber = Number.parseInt(file_size, 10);
    const safeFileSize = Number.isFinite(fileSizeNumber) && fileSizeNumber >= 0 ? fileSizeNumber : 0;

    if (!messageId || !isUuid(messageId) || !fileUrl || !fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID, file URL, and file name are required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    const nowIso = new Date().toISOString();
    const { data: attachment, error: attachmentError } = await supabase
      .from('message_attachments')
      .insert({
        message_id: messageId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: safeFileSize,
        thumbnail_url: thumbnailUrl || null,
        created_at: nowIso,
      })
      .select('*')
      .single();

    if (attachmentError) {
      throw attachmentError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Attachment uploaded successfully',
        data: attachment,
      }),
    };

  } catch (error) {
    console.error('Upload attachment error:', error);
    throw error;
  }
}

// Get message attachments
async function getAttachments(userId, queryParams, headers) {
  try {
    const {
      conversation_id,
      message_id,
      file_type,
      limit = '50',
      offset = '0',
    } = queryParams || {};

    const conversationId = sanitizeString(conversation_id, { maxLength: 36, allowEmpty: true });
    const messageId = sanitizeString(message_id, { maxLength: 36, allowEmpty: true });
    const fileTypeFilter = sanitizeString(file_type, { maxLength: 120, allowEmpty: true });
    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });

    if (!conversationId && !messageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID or Message ID is required',
        }),
      };
    }

    if (conversationId && !isUuid(conversationId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid conversation ID provided',
        }),
      };
    }

    if (messageId && !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid message ID provided',
        }),
      };
    }

    if (conversationId) {
      const { data: participation, error: participationError } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (participationError || !participation) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Access denied',
          }),
        };
      }
    }

    if (messageId && !conversationId) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();

      if (messageError || !message) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Message not found',
          }),
        };
      }

      const { data: participation, error: participationError } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', message.conversation_id)
        .eq('user_id', userId)
        .single();

      if (participationError || !participation) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Access denied',
          }),
        };
      }
    }

    let query = supabase
      .from('message_attachments')
      .select(`
        *,
        message:messages!inner(
          id, conversation_id, sender_id, created_at,
          sender:users!sender_id(username, profile_image)
        )
      `)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (conversationId) {
      query = query.eq('message.conversation_id', conversationId);
    }

    if (messageId) {
      query = query.eq('message_id', messageId);
    }

    if (fileTypeFilter) {
      query = query.eq('file_type', fileTypeFilter);
    }

    const { data: attachments, error: attachmentsError } = await query;

    if (attachmentsError) {
      throw attachmentsError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          attachments: attachments || [],
          total_fetched: attachments?.length || 0,
        },
      }),
    };

  } catch (error) {
    console.error('Get attachments error:', error);
    throw error;
  }
}

// Search messages
async function searchMessages(userId, queryParams, headers) {
  try {
    const {
      query: searchQuery = '',
      conversation_id,
      sender_id,
      message_type,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
    } = queryParams || {};

    const sanitizedQuery = sanitizeString(searchQuery, { maxLength: 500 });
    const conversationId = sanitizeString(conversation_id, { maxLength: 36, allowEmpty: true });
    const senderId = sanitizeString(sender_id, { maxLength: 36, allowEmpty: true });
    const messageTypeFilter = sanitizeString(message_type, { maxLength: 30, allowEmpty: true });
    const safeLimit = clampNumber(limit, { min: 1, max: 100, fallback: 50 });
    const safeOffset = clampNumber(offset, { min: 0, max: 5000, fallback: 0 });
    const startDateSanitized = sanitizeString(start_date, { maxLength: 30, allowEmpty: true });
    const endDateSanitized = sanitizeString(end_date, { maxLength: 30, allowEmpty: true });

    if (!sanitizedQuery) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Search query is required',
        }),
      };
    }

    if (conversationId && !isUuid(conversationId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid conversation ID provided',
        }),
      };
    }

    if (senderId && !isUuid(senderId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid sender ID provided',
        }),
      };
    }

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!sender_id(
          id, username, full_name, profile_image
        ),
        conversation:conversations!inner(
          id, title, type,
          conversation_participants!inner(user_id)
        )
      `)
      .eq('conversation.conversation_participants.user_id', userId)
      .ilike('content', `%${sanitizedQuery}%`)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    if (senderId) {
      query = query.eq('sender_id', senderId);
    }

    if (messageTypeFilter) {
      query = query.eq('message_type', messageTypeFilter);
    }

    if (startDateSanitized) {
      query = query.gte('created_at', startDateSanitized);
    }

    if (endDateSanitized) {
      query = query.lte('created_at', endDateSanitized);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      throw messagesError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          messages: messages || [],
          search_query: sanitizedQuery,
          total_results: messages?.length || 0,
        },
      }),
    };

  } catch (error) {
    console.error('Search messages error:', error);
    throw error;
  }
}

// Get message edit/delete history
async function getMessageHistory(userId, queryParams, headers) {
  try {
    const rawMessageId = queryParams?.message_id;
    const messageId = sanitizeString(rawMessageId, { maxLength: 36 });

    if (!messageId || !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID is required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        *,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', messageId)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    const { data: history, error: historyError } = await supabase
      .from('message_audit_log')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('Error fetching message history:', historyError);
    }

    const messageHistory = {
      message,
      history: history || [],
      has_been_edited: !!message.edited_at,
      edit_count: history?.filter((h) => h.action === 'edit').length || 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: messageHistory,
      }),
    };

  } catch (error) {
    console.error('Get message history error:', error);
    throw error;
  }
}

// React to message (emoji reactions)
async function reactToMessage(userId, requestBody, headers) {
  try {
    const {
      message_id,
      emoji,
      action = 'add',
    } = parseRequestBody(requestBody);

    const messageId = sanitizeString(message_id, { maxLength: 36 });
    const sanitizedEmoji = sanitizeString(emoji, { maxLength: 16 });
    const normalizedAction = sanitizeString(action, { maxLength: 10, allowEmpty: true })?.toLowerCase() || 'add';

    if (!messageId || !isUuid(messageId) || !sanitizedEmoji) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID and emoji are required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        conversation_id,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', messageId)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    if (normalizedAction === 'add') {
      const nowIso = new Date().toISOString();
      const { data: reaction, error: reactionError } = await supabase
        .from('message_reactions')
        .upsert(
          {
            message_id: messageId,
            user_id: userId,
            emoji: sanitizedEmoji,
            created_at: nowIso,
          },
          {
            onConflict: 'message_id,user_id,emoji',
          }
        )
        .select(`
          *,
          user:users!user_id(username, profile_image)
        `)
        .single();

      if (reactionError) {
        throw reactionError;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Reaction added successfully',
          data: reaction,
        }),
      };
    }

    if (normalizedAction === 'remove') {
      const { error: removeError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', sanitizedEmoji);

      if (removeError) {
        throw removeError;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Reaction removed successfully',
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid action. Use "add" or "remove"',
      }),
    };

  } catch (error) {
    console.error('React to message error:', error);
    throw error;
  }
}

// Get message reactions
async function getMessageReactions(userId, queryParams, headers) {
  try {
    const rawMessageId = queryParams?.message_id;
    const messageId = sanitizeString(rawMessageId, { maxLength: 36 });

    if (!messageId || !isUuid(messageId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID is required',
        }),
      };
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        conversation_id,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', messageId)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied',
        }),
      };
    }

    const { data: reactions, error: reactionsError } = await supabase
      .from('message_reactions')
      .select(`
        *,
        user:users!user_id(
          id, username, full_name, profile_image
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (reactionsError) {
      throw reactionsError;
    }

    const reactionsByEmoji = {};
    reactions?.forEach((reaction) => {
      if (!reactionsByEmoji[reaction.emoji]) {
        reactionsByEmoji[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
        };
      }
      reactionsByEmoji[reaction.emoji].count++;
      reactionsByEmoji[reaction.emoji].users.push(reaction.user);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          reactions: reactions || [],
          reactions_by_emoji: reactionsByEmoji,
          total_reactions: reactions?.length || 0,
        },
      }),
    };

  } catch (error) {
    console.error('Get message reactions error:', error);
    throw error;
  }
}

// Forward message to another conversation
async function forwardMessage(userId, requestBody, headers) {
  try {
    const {
      message_id,
      target_conversation_id,
      additional_message,
    } = parseRequestBody(requestBody);

    const messageId = sanitizeString(message_id, { maxLength: 36 });
    const targetConversationId = sanitizeString(target_conversation_id, { maxLength: 36 });
    const additionalMessage = sanitizeString(additional_message, { maxLength: 5000, allowEmpty: true });

    if (!messageId || !isUuid(messageId) || !targetConversationId || !isUuid(targetConversationId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid message ID and target conversation ID are required',
        }),
      };
    }

    const [sourceAccess, targetAccess] = await Promise.all([
      supabase
        .from('messages')
        .select(`
          *,
          conversation:conversations!inner(
            conversation_participants!inner(user_id)
          )
        `)
        .eq('id', messageId)
        .eq('conversation.conversation_participants.user_id', userId)
        .single(),
      supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', targetConversationId)
        .eq('user_id', userId)
        .single(),
    ]);

    if (sourceAccess.error || !sourceAccess.data || targetAccess.error || !targetAccess.data) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied to source or target conversation',
        }),
      };
    }

    const originalMessage = sourceAccess.data;
    const forwardedContent = `[Forwarded message]\n${originalMessage.content || ''}`.trim();
    const nowIso = new Date().toISOString();

    const { data: forwardedMessage, error: forwardError } = await supabase
      .from('messages')
      .insert({
        conversation_id: targetConversationId,
        sender_id: userId,
        content: forwardedContent,
        message_type: 'forwarded',
        metadata: {
          original_message_id: messageId,
          original_sender_id: originalMessage.sender_id,
          forwarded_at: nowIso,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(`
        *,
        sender:users!sender_id(username, profile_image)
      `)
      .single();

    if (forwardError) {
      throw forwardError;
    }

    if (additionalMessage) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: targetConversationId,
          sender_id: userId,
          content: additionalMessage,
          message_type: 'text',
          created_at: nowIso,
          updated_at: nowIso,
        });
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', targetConversationId);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message forwarded successfully',
        data: forwardedMessage,
      }),
    };

  } catch (error) {
    console.error('Forward message error:', error);
    throw error;
  }
}

// Reply to a specific message
async function replyToMessage(userId, requestBody, headers) {
  try {
    const {
      parent_message_id,
      content,
      message_type = 'text',
    } = parseRequestBody(requestBody);

    const parentMessageId = sanitizeString(parent_message_id, { maxLength: 36 });
    const safeContent = sanitizeString(content, { maxLength: 5000 });
    const normalizedMessageType = sanitizeString(message_type, { maxLength: 30, allowEmpty: true }) || 'text';
    const allowedReplyTypes = new Set(['text', 'image', 'file', 'gif', 'sticker', 'voice', 'audio']);
    const safeMessageType = allowedReplyTypes.has(normalizedMessageType.toLowerCase())
      ? normalizedMessageType.toLowerCase()
      : 'text';

    if (!parentMessageId || !isUuid(parentMessageId) || !safeContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Valid parent message ID and content are required',
        }),
      };
    }

    const { data: parentMessage, error: parentError } = await supabase
      .from('messages')
      .select(`
        *,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', parentMessageId)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (parentError || !parentMessage) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Parent message not found or access denied',
        }),
      };
    }

    const nowIso = new Date().toISOString();
    const { data: replyMessage, error: replyError } = await supabase
      .from('messages')
      .insert({
        conversation_id: parentMessage.conversation_id,
        sender_id: userId,
        parent_message_id: parentMessageId,
        content: safeContent,
        message_type: safeMessageType,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(`
        *,
        sender:users!sender_id(username, profile_image),
        parent_message:messages!parent_message_id(
          id, content, sender_id,
          sender:users!sender_id(username, profile_image)
        )
      `)
      .single();

    if (replyError) {
      throw replyError;
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', parentMessage.conversation_id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Reply sent successfully',
        data: replyMessage,
      }),
    };

  } catch (error) {
    console.error('Reply to message error:', error);
    throw error;
  }
}