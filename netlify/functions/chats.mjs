import { createClient } from '@supabase/supabase-js';
import { mapArrayToFrontend } from '../utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for chats function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Utility functions
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

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

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

export const handler = async (event) => {
  console.log('Chats handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  try {
  const { user } = await getAuthContext(event);

    if (event.httpMethod === 'GET') {
      const { chatId } = event.queryStringParameters || {};

      if (chatId) {
        // Get specific chat messages
        const { data: messages, error } = await safeSelect(
          supabase
            .from('chat_messages')
            .select(`
              *,
              sender:profiles!sender_id (
                id,
                first_name,
                last_name,
                email
              )
            `)
            .eq('chat_id', chatId)
            .order('sent_at', { ascending: true }),
          'chat_messages',
          'Failed to fetch chat messages'
        );

        if (error) {
          throw error;
        }

        return respond(200, {
          success: true,
          data: mapArrayToFrontend(messages)
        });
      } else {
        // Get user's chat conversations
        const { data: chats, error } = await safeSelect(
          supabase
            .from('chats')
            .select(`
              *,
              participant1:profiles!participant1_id (
                id,
                first_name,
                last_name,
                email
              ),
              participant2:profiles!participant2_id (
                id,
                first_name,
                last_name,
                email
              ),
              apartment:apartments (
                id,
                title,
                adresse
              ),
              last_message:chat_messages (
                message,
                sent_at
              )
            `)
            .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
            .order('updated_at', { ascending: false }),
          'chats',
          'Failed to fetch chats'
        );

        if (error) {
          throw error;
        }

        return respond(200, {
          success: true,
          data: mapArrayToFrontend(chats)
        });
      }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { apartmentId, message } = body;
      let { receiverId } = body;

      if (!message || (!apartmentId && !receiverId)) {
        throw httpError(400, 'Message and either apartmentId or receiverId are required');
      }

      let chatId;

      if (apartmentId) {
        // Get apartment owner to start conversation
        const { data: apartment, error } = await safeSelect(
          supabase
            .from('apartments')
            .select('landlord_id')
            .eq('id', apartmentId)
            .single(),
          'apartments',
          'Failed to fetch apartment'
        );

        if (error) {
          throw error;
        }

        if (!apartment) {
          throw httpError(404, 'Apartment not found');
        }

        receiverId = apartment.landlord_id;
      }

      // Check if chat already exists
      const { data: existingChat, error: chatFetchError } = await safeSelect(
        supabase
          .from('chats')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${receiverId}),and(participant1_id.eq.${receiverId},participant2_id.eq.${user.id})`)
          .maybeSingle(),
        'chats',
        'Failed to check existing chat'
      );

      if (chatFetchError) {
        throw chatFetchError;
      }

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        // Create new chat
        const { data: newChat, error: chatCreateError } = await safeInsert(
          supabase
            .from('chats')
            .insert([
              {
                participant1_id: user.id,
                participant2_id: receiverId,
                apartment_id: apartmentId || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ])
            .select()
            .single(),
          'chats',
          'Failed to create chat'
        );

        if (chatCreateError) {
          throw chatCreateError;
        }

        chatId = newChat.id;
      }

      // Send message
      const { data: newMessage, error: messageError } = await safeInsert(
        supabase
          .from('chat_messages')
          .insert([
            {
              chat_id: chatId,
              sender_id: user.id,
              message: message,
              sent_at: new Date().toISOString()
            }
          ])
          .select(`
            *,
            sender:profiles!sender_id (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .single(),
        'chat_messages',
        'Failed to send message'
      );

      if (messageError) {
        throw messageError;
      }

      // Update chat's updated_at timestamp
      const { error: updateError } = await safeUpdate(
        supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId),
        'chats',
        'Failed to update chat timestamp'
      );

      if (updateError) {
        throw updateError;
      }

      return respond(201, {
        success: true,
        data: {
          chatId,
          message: mapArrayToFrontend([newMessage])[0]
        }
      });
    }

    if (event.httpMethod === 'PUT') {
      // Mark messages as read
      const { chatId } = JSON.parse(event.body);

      if (!chatId) {
        throw httpError(400, 'Chat ID is required');
      }

      // Mark all unread messages in this chat as read for this user
      const { error: updateError } = await safeUpdate(
        supabase
          .from('chat_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('chat_id', chatId)
          .neq('sender_id', user.id)
          .is('read_at', null),
        'chat_messages',
        'Failed to mark messages as read'
      );

      if (updateError) {
        throw updateError;
      }

      return respond(200, {
        success: true,
        message: 'Messages marked as read'
      });
    }

    throw httpError(405, 'Method not allowed');

  } catch (error) {
    console.error('Chats handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Chat operation failed' : error.message;
    
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