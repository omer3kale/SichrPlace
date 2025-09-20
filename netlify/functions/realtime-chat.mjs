import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !jwtSecret) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to authenticate token
const authenticateToken = async (headers) => {
  const authHeader = headers.authorization;
  if (!authHeader) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new Error('Malformed token');
  }

  const decoded = jwt.verify(token, jwtSecret);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    throw new Error(`User not found: ${error?.message}`);
  }

  return user;
};

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const user = await authenticateToken(event.headers);
    
    switch (event.httpMethod) {
      case 'GET':
        return await getConversations(user, event.queryStringParameters, headers);
      case 'POST':
        return await handleChatAction(user, event.body, event.path, headers);
      case 'PUT':
        return await updateMessage(user, event.path, event.body, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Realtime chat function error:', error);
    return {
      statusCode: error.message.includes('token') || error.message.includes('User not found') ? 401 : 500,
      headers,
      body: JSON.stringify({ 
        error: error.message.includes('token') || error.message.includes('User not found') 
          ? 'Authentication failed' 
          : 'Internal server error',
        details: error.message 
      })
    };
  }
};

// GET conversations and messages
const getConversations = async (user, queryParams, headers) => {
  try {
    const { conversationId, limit = '50', offset = '0' } = queryParams || {};
    
    if (conversationId) {
      // Get messages for specific conversation
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
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: messages || [],
          conversationId
        })
      };
    } else {
      // Get user's conversations
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          tenant_id,
          landlord_id,
          apartment_id,
          status,
          created_at,
          updated_at,
          tenant:tenant_id (
            id,
            email,
            name
          ),
          landlord:landlord_id (
            id,
            email,
            name
          ),
          apartment:apartment_id (
            id,
            title,
            images
          ),
          last_message:messages(
            id,
            content,
            created_at,
            sender_id
          )
        `)
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: conversations || []
        })
      };
    }
  } catch (error) {
    throw error;
  }
};

// POST handle chat actions (send message, create conversation)
const handleChatAction = async (user, body, path, headers) => {
  try {
    const data = JSON.parse(body || '{}');
    
    // Check if this is a message send action
    if (path.includes('/send') || data.action === 'send_message') {
      return await sendMessage(user, data, headers);
    }
    
    // Check if this is a conversation creation
    if (data.action === 'create_conversation') {
      return await createConversation(user, data, headers);
    }

    // Default to sending message
    return await sendMessage(user, data, headers);
  } catch (error) {
    throw error;
  }
};

// Send message
const sendMessage = async (user, data, headers) => {
  try {
    const { conversationId, content, messageType = 'text', apartmentId, recipientId } = data;
    
    if (!content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message content is required' })
      };
    }

    let finalConversationId = conversationId;

    // If no conversation ID, create new conversation
    if (!finalConversationId && apartmentId && recipientId) {
      const newConversation = await createConversationInternal(user.id, recipientId, apartmentId);
      finalConversationId = newConversation.id;
    }

    if (!finalConversationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Conversation ID or apartment/recipient info required' })
      };
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: finalConversationId,
        sender_id: user.id,
        content,
        message_type: messageType
      }])
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
      `);

    if (error) throw new Error(`Failed to send message: ${error.message}`);

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date() })
      .eq('id', finalConversationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message sent successfully',
        data: message[0]
      })
    };
  } catch (error) {
    throw error;
  }
};

// Create conversation
const createConversation = async (user, data, headers) => {
  try {
    const { apartmentId, recipientId } = data;
    
    if (!apartmentId || !recipientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Apartment ID and recipient ID are required' })
      };
    }

    const conversation = await createConversationInternal(user.id, recipientId, apartmentId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Conversation created successfully',
        data: conversation
      })
    };
  } catch (error) {
    throw error;
  }
};

// Internal function to create conversation
const createConversationInternal = async (userId, recipientId, apartmentId) => {
  // Check if conversation already exists
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('apartment_id', apartmentId)
    .or(`and(tenant_id.eq.${userId},landlord_id.eq.${recipientId}),and(tenant_id.eq.${recipientId},landlord_id.eq.${userId})`)
    .single();

  if (existing) {
    return existing;
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      tenant_id: userId,
      landlord_id: recipientId,
      apartment_id: apartmentId,
      status: 'active'
    }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);

  return data;
};

// PUT update message (mark as read)
const updateMessage = async (user, path, body, headers) => {
  try {
    const pathParts = path.split('/');
    const messageId = pathParts[pathParts.length - 1];
    
    if (!messageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message ID is required' })
      };
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ 
        read_at: new Date(),
        read_by: user.id
      })
      .eq('id', messageId)
      .select();

    if (error) throw new Error(`Failed to update message: ${error.message}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message marked as read',
        data: data[0]
      })
    };
  } catch (error) {
    throw error;
  }
};