import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: [
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
            'reply_to_message'
          ]
        })
      };
    }

    // Get authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
      
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid authentication token'
          })
        };
      }
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        })
      };
    }

    switch (action) {
      case 'get_messages':
        return await getMessages(user.id, event.queryStringParameters, headers);
      
      case 'send_message':
        return await sendMessage(user.id, event.body, headers);
      
      case 'update_message':
        return await updateMessage(user.id, event.body, headers);
      
      case 'delete_message':
        return await deleteMessage(user.id, event.body, headers);
      
      case 'mark_as_read':
        return await markAsRead(user.id, event.body, headers);
      
      case 'get_message_details':
        return await getMessageDetails(user.id, event.queryStringParameters, headers);
      
      case 'upload_attachment':
        return await uploadAttachment(user.id, event.body, headers);
      
      case 'get_attachments':
        return await getAttachments(user.id, event.queryStringParameters, headers);
      
      case 'search_messages':
        return await searchMessages(user.id, event.queryStringParameters, headers);
      
      case 'get_message_history':
        return await getMessageHistory(user.id, event.queryStringParameters, headers);
      
      case 'react_to_message':
        return await reactToMessage(user.id, event.body, headers);
      
      case 'get_message_reactions':
        return await getMessageReactions(user.id, event.queryStringParameters, headers);
      
      case 'forward_message':
        return await forwardMessage(user.id, event.body, headers);
      
      case 'reply_to_message':
        return await replyToMessage(user.id, event.body, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified'
          })
        };
    }

  } catch (error) {
    console.error('Messages error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Message operation failed',
        error: error.message
      })
    };
  }
};

// Get messages from a conversation
async function getMessages(userId, queryParams, headers) {
  try {
    const {
      conversation_id,
      limit = '50',
      offset = '0',
      before_message_id,
      after_message_id,
      message_type = 'all'
    } = queryParams || {};

    if (!conversation_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID is required'
        })
      };
    }

    // Verify user is participant in conversation
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id, last_read_at')
      .eq('conversation_id', conversation_id)
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
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (message_type !== 'all') {
      query = query.eq('message_type', message_type);
    }

    if (before_message_id) {
      // Get messages before a specific message (pagination)
      const { data: beforeMessage, error: beforeError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', before_message_id)
        .single();

      if (!beforeError && beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at);
      }
    }

    if (after_message_id) {
      // Get messages after a specific message
      const { data: afterMessage, error: afterError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', after_message_id)
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
            offset: parseInt(offset),
            limit: parseInt(limit),
            has_more: messagesWithReadStatus.length === parseInt(limit)
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
    } = JSON.parse(requestBody);

    if (!conversation_id || (!content && attachments.length === 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID and content (or attachments) are required'
        })
      };
    }

    // Verify user is participant in conversation
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('id, role, is_muted')
      .eq('conversation_id', conversation_id)
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
      .eq('id', conversation_id)
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
        .eq('conversation_id', conversation_id)
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
      conversation_id,
      sender_id: userId,
      parent_message_id: parent_message_id || null,
      content: content || '',
      message_type,
      status: 'sent',
      metadata,
      created_at: new Date().toISOString()
    };

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
    if (attachments.length > 0) {
      for (const attachment of attachments) {
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

        if (!attachmentError) {
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
      .eq('id', conversation_id);

    // Update sender's last read timestamp
    await supabase
      .from('conversation_participants')
      .update({
        last_read_at: message.created_at,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversation_id)
      .eq('user_id', userId);

    // Log activity
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'message_sent',
        details: `Sent message in conversation ${conversation_id}`,
        metadata: { conversation_id, message_id: message.id },
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
    const {
      message_id,
      content
    } = JSON.parse(requestBody);

    if (!message_id || !content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID and content are required'
        })
      };
    }

    // Verify user owns the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    // Check if message can be edited (e.g., within time limit)
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours

    if (messageAge > editTimeLimit) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message is too old to edit'
        })
      };
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        content,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', message_id)
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
        data: updatedMessage
      })
    };

  } catch (error) {
    console.error('Update message error:', error);
    throw error;
  }
}

// Delete message
async function deleteMessage(userId, requestBody, headers) {
  try {
    const {
      message_id,
      delete_for_everyone = false
    } = JSON.parse(requestBody);

    if (!message_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID is required'
        })
      };
    }

    // Verify user owns the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    if (delete_for_everyone) {
      // Hard delete the message
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', message_id);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Soft delete - mark as deleted
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'deleted',
          content: '[Message deleted]',
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', message_id);

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
          message_id,
          deleted_for_everyone: delete_for_everyone,
          deleted_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Delete message error:', error);
    throw error;
  }
}

// Mark messages as read
async function markAsRead(userId, requestBody, headers) {
  try {
    const {
      conversation_id,
      message_id
    } = JSON.parse(requestBody);

    if (!conversation_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID is required'
        })
      };
    }

    let readTimestamp = new Date().toISOString();

    // If specific message ID provided, use its timestamp
    if (message_id) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', message_id)
        .eq('conversation_id', conversation_id)
        .single();

      if (!messageError && message) {
        readTimestamp = message.created_at;
      }
    }

    // Update user's last read timestamp
    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        last_read_at: readTimestamp,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversation_id)
      .eq('user_id', userId)
      .select()
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
          conversation_id,
          last_read_at: readTimestamp
        }
      })
    };

  } catch (error) {
    console.error('Mark as read error:', error);
    throw error;
  }
}

// Get detailed message information
async function getMessageDetails(userId, queryParams, headers) {
  try {
    const { message_id } = queryParams || {};

    if (!message_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID is required'
        })
      };
    }

    // Get message with full details
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
      .eq('id', message_id)
      .single();

    if (messageError) {
      throw messageError;
    }

    // Verify user has access to this message
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
          message: 'Access denied'
        })
      };
    }

    // Get replies to this message
    const { data: replies, error: repliesError } = await supabase
      .from('messages')
      .select(`
        id, content, created_at,
        sender:users!sender_id(username, profile_image)
      `)
      .eq('parent_message_id', message_id)
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
      thumbnail_url
    } = JSON.parse(requestBody);

    if (!message_id || !file_url || !file_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID, file URL and file name are required'
        })
      };
    }

    // Verify user owns the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id, conversation_id')
      .eq('id', message_id)
      .eq('sender_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    // Create attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('message_attachments')
      .insert({
        message_id,
        file_url,
        file_name,
        file_type: file_type || 'unknown',
        file_size: file_size || 0,
        thumbnail_url: thumbnail_url || null,
        created_at: new Date().toISOString()
      })
      .select()
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
        data: attachment
      })
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
      offset = '0'
    } = queryParams || {};

    if (!conversation_id && !message_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID or Message ID is required'
        })
      };
    }

    // Verify user has access
    if (conversation_id) {
      const { data: participation, error: participationError } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('user_id', userId)
        .single();

      if (participationError || !participation) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Access denied'
          })
        };
      }
    }

    // Build query for attachments
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
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (conversation_id) {
      query = query.eq('message.conversation_id', conversation_id);
    }

    if (message_id) {
      query = query.eq('message_id', message_id);
    }

    if (file_type) {
      query = query.eq('file_type', file_type);
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
          total_fetched: attachments?.length || 0
        }
      })
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
      offset = '0'
    } = queryParams || {};

    if (!searchQuery.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Search query is required'
        })
      };
    }

    // Build search query
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
      .ilike('content', `%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id);
    }

    if (sender_id) {
      query = query.eq('sender_id', sender_id);
    }

    if (message_type) {
      query = query.eq('message_type', message_type);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
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
          search_query: searchQuery,
          total_results: messages?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Search messages error:', error);
    throw error;
  }
}

// Get message edit/delete history
async function getMessageHistory(userId, queryParams, headers) {
  try {
    const { message_id } = queryParams || {};

    if (!message_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID is required'
        })
      };
    }

    // Get message and verify access
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        *,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', message_id)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    // Get message history/audit logs
    const { data: history, error: historyError } = await supabase
      .from('message_audit_log')
      .select('*')
      .eq('message_id', message_id)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('Error fetching message history:', historyError);
    }

    const messageHistory = {
      message,
      history: history || [],
      has_been_edited: !!message.edited_at,
      edit_count: history?.filter(h => h.action === 'edit').length || 0
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: messageHistory
      })
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
      action = 'add' // 'add' or 'remove'
    } = JSON.parse(requestBody);

    if (!message_id || !emoji) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID and emoji are required'
        })
      };
    }

    // Verify user has access to the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        conversation_id,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', message_id)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    if (action === 'add') {
      // Add reaction (or update if exists)
      const { data: reaction, error: reactionError } = await supabase
        .from('message_reactions')
        .upsert({
          message_id,
          user_id: userId,
          emoji,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'message_id,user_id,emoji'
        })
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
          data: reaction
        })
      };

    } else if (action === 'remove') {
      // Remove reaction
      const { error: removeError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', message_id)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      if (removeError) {
        throw removeError;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Reaction removed successfully'
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid action. Use "add" or "remove"'
      })
    };

  } catch (error) {
    console.error('React to message error:', error);
    throw error;
  }
}

// Get message reactions
async function getMessageReactions(userId, queryParams, headers) {
  try {
    const { message_id } = queryParams || {};

    if (!message_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID is required'
        })
      };
    }

    // Verify user has access to the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        conversation_id,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', message_id)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (messageError || !message) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message not found or access denied'
        })
      };
    }

    // Get all reactions for the message
    const { data: reactions, error: reactionsError } = await supabase
      .from('message_reactions')
      .select(`
        *,
        user:users!user_id(
          id, username, full_name, profile_image
        )
      `)
      .eq('message_id', message_id)
      .order('created_at', { ascending: true });

    if (reactionsError) {
      throw reactionsError;
    }

    // Group reactions by emoji
    const reactionsByEmoji = {};
    reactions?.forEach(reaction => {
      if (!reactionsByEmoji[reaction.emoji]) {
        reactionsByEmoji[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
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
          total_reactions: reactions?.length || 0
        }
      })
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
      additional_message
    } = JSON.parse(requestBody);

    if (!message_id || !target_conversation_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Message ID and target conversation ID are required'
        })
      };
    }

    // Verify user has access to both conversations
    const [sourceAccess, targetAccess] = await Promise.all([
      supabase
        .from('messages')
        .select(`
          *,
          conversation:conversations!inner(
            conversation_participants!inner(user_id)
          )
        `)
        .eq('id', message_id)
        .eq('conversation.conversation_participants.user_id', userId)
        .single(),
      
      supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', target_conversation_id)
        .eq('user_id', userId)
        .single()
    ]);

    if (sourceAccess.error || !sourceAccess.data || targetAccess.error || !targetAccess.data) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Access denied to source or target conversation'
        })
      };
    }

    const originalMessage = sourceAccess.data;

    // Create forwarded message
    const forwardedContent = `[Forwarded message]\n${originalMessage.content}`;
    
    const { data: forwardedMessage, error: forwardError } = await supabase
      .from('messages')
      .insert({
        conversation_id: target_conversation_id,
        sender_id: userId,
        content: forwardedContent,
        message_type: 'forwarded',
        metadata: {
          original_message_id: message_id,
          original_sender_id: originalMessage.sender_id,
          forwarded_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        sender:users!sender_id(username, profile_image)
      `)
      .single();

    if (forwardError) {
      throw forwardError;
    }

    // Send additional message if provided
    if (additional_message) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: target_conversation_id,
          sender_id: userId,
          content: additional_message,
          message_type: 'text',
          created_at: new Date().toISOString()
        });
    }

    // Update target conversation timestamp
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', target_conversation_id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message forwarded successfully',
        data: forwardedMessage
      })
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
      message_type = 'text'
    } = JSON.parse(requestBody);

    if (!parent_message_id || !content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Parent message ID and content are required'
        })
      };
    }

    // Get parent message and verify access
    const { data: parentMessage, error: parentError } = await supabase
      .from('messages')
      .select(`
        *,
        conversation:conversations!inner(
          conversation_participants!inner(user_id)
        )
      `)
      .eq('id', parent_message_id)
      .eq('conversation.conversation_participants.user_id', userId)
      .single();

    if (parentError || !parentMessage) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Parent message not found or access denied'
        })
      };
    }

    // Create reply message
    const { data: replyMessage, error: replyError } = await supabase
      .from('messages')
      .insert({
        conversation_id: parentMessage.conversation_id,
        sender_id: userId,
        parent_message_id: parent_message_id,
        content,
        message_type,
        created_at: new Date().toISOString()
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

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', parentMessage.conversation_id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Reply sent successfully',
        data: replyMessage
      })
    };

  } catch (error) {
    console.error('Reply to message error:', error);
    throw error;
  }
}