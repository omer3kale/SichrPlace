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
            'get_conversation_stats'
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
      case 'get_conversations':
        return await getConversations(user.id, event.queryStringParameters, headers);
      
      case 'create_conversation':
        return await createConversation(user.id, event.body, headers);
      
      case 'get_conversation_details':
        return await getConversationDetails(user.id, event.queryStringParameters, headers);
      
      case 'update_conversation':
        return await updateConversation(user.id, event.body, headers);
      
      case 'delete_conversation':
        return await deleteConversation(user.id, event.body, headers);
      
      case 'archive_conversation':
        return await archiveConversation(user.id, event.body, headers);
      
      case 'mark_as_read':
        return await markAsRead(user.id, event.body, headers);
      
      case 'search_conversations':
        return await searchConversations(user.id, event.queryStringParameters, headers);
      
      case 'get_conversation_participants':
        return await getConversationParticipants(user.id, event.queryStringParameters, headers);
      
      case 'add_participant':
        return await addParticipant(user.id, event.body, headers);
      
      case 'remove_participant':
        return await removeParticipant(user.id, event.body, headers);
      
      case 'get_conversation_stats':
        return await getConversationStats(user.id, headers);
      
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
    console.error('Conversations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Conversation operation failed',
        error: error.message
      })
    };
  }
};

// Get user's conversations
async function getConversations(userId, queryParams, headers) {
  try {
    const { 
      limit = '20', 
      offset = '0',
      status = 'active',
      type = 'all',
      include_archived = 'false'
    } = queryParams || {};

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
          is_muted
        ),
        last_message:messages(
          id,
          content,
          created_at,
          sender:users!sender_id(username, profile_image)
        )
      `)
      .eq('conversation_participants.user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (type !== 'all') {
      query = query.eq('type', type);
    }

    if (include_archived === 'false') {
      query = query.eq('is_archived', false);
    }

    const { data: conversations, error } = await query;

    if (error) {
      throw error;
    }

    // Get unread message counts for each conversation
    const conversationIds = conversations.map(c => c.id);
    const { data: unreadCounts, error: unreadError } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .gt('created_at', 
        supabase
          .from('conversation_participants')
          .select('last_read_at')
          .eq('user_id', userId)
          .eq('conversation_id', 'messages.conversation_id')
      );

    if (unreadError) {
      console.error('Error getting unread counts:', unreadError);
    }

    // Add unread counts to conversations
    const conversationsWithUnread = conversations.map(conversation => {
      const unreadCount = unreadCounts ? 
        unreadCounts.filter(m => m.conversation_id === conversation.id).length : 0;
      
      return {
        ...conversation,
        unread_count: unreadCount,
        current_user_participant: conversation.conversation_participants.find(p => p.user_id === userId)
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          conversations: conversationsWithUnread,
          total_fetched: conversationsWithUnread.length,
          pagination: {
            offset: parseInt(offset),
            limit: parseInt(limit)
          }
        }
      })
    };

  } catch (error) {
    console.error('Get conversations error:', error);
    throw error;
  }
}

// Create new conversation
async function createConversation(userId, requestBody, headers) {
  try {
    const {
      title,
      type = 'direct',
      participant_ids = [],
      initial_message,
      apartment_id,
      booking_id,
      metadata = {}
    } = JSON.parse(requestBody);

    if (!title && type === 'group') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Title is required for group conversations'
        })
      };
    }

    if (type === 'direct' && participant_ids.length !== 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Direct conversations require exactly one other participant'
        })
      };
    }

    // Check if direct conversation already exists
    if (type === 'direct') {
      const { data: existingConversation, error: existingError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversation:conversations!inner(
            id, type, status,
            participant_count
          )
        `)
        .eq('user_id', userId)
        .eq('conversation.type', 'direct')
        .eq('conversation.participant_count', 2);

      if (existingError) {
        console.error('Error checking existing conversation:', existingError);
      } else if (existingConversation && existingConversation.length > 0) {
        // Check if the other participant matches
        for (const conv of existingConversation) {
          const { data: otherParticipant, error: participantError } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .neq('user_id', userId)
            .single();

          if (!participantError && otherParticipant && 
              otherParticipant.user_id === participant_ids[0]) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                message: 'Conversation already exists',
                data: {
                  conversation_id: conv.conversation_id,
                  existing: true
                }
              })
            };
          }
        }
      }
    }

    // Create conversation
    const conversationData = {
      title: title || (type === 'direct' ? null : 'New Group Chat'),
      type,
      status: 'active',
      creator_id: userId,
      participant_count: participant_ids.length + 1, // Include creator
      apartment_id: apartment_id || null,
      booking_id: booking_id || null,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    };

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (conversationError) {
      throw conversationError;
    }

    // Add creator as participant
    const participants = [
      {
        conversation_id: conversation.id,
        user_id: userId,
        role: 'admin',
        joined_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      }
    ];

    // Add other participants
    for (const participantId of participant_ids) {
      participants.push({
        conversation_id: conversation.id,
        user_id: participantId,
        role: 'member',
        joined_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      });
    }

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participants);

    if (participantsError) {
      // Rollback conversation creation
      await supabase.from('conversations').delete().eq('id', conversation.id);
      throw participantsError;
    }

    // Send initial message if provided
    if (initial_message) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: userId,
          content: initial_message,
          message_type: 'text',
          created_at: new Date().toISOString()
        });

      if (messageError) {
        console.error('Error sending initial message:', messageError);
      }
    }

    // Log activity
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'conversation_created',
        details: `Created ${type} conversation: ${conversation.title || conversation.id}`,
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Conversation created successfully',
        data: {
          conversation_id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          participant_count: conversation.participant_count,
          created_at: conversation.created_at
        }
      })
    };

  } catch (error) {
    console.error('Create conversation error:', error);
    throw error;
  }
}

// Get detailed conversation information
async function getConversationDetails(userId, queryParams, headers) {
  try {
    const { conversation_id, include_messages = 'false', message_limit = '50' } = queryParams || {};

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

    // Verify user is participant
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('*')
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

    // Get conversation details
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
      .eq('id', conversation_id)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    // Get all participants
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select(`
        *,
        user:users(
          id, username, full_name, profile_image, last_login_at
        )
      `)
      .eq('conversation_id', conversation_id)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      throw participantsError;
    }

    let messages = [];
    if (include_messages === 'true') {
      const { data: messageData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(
            id, username, full_name, profile_image
          ),
          message_attachments(
            id, file_url, file_name, file_type, file_size
          )
        `)
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(parseInt(message_limit));

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      } else {
        messages = messageData || [];
      }
    }

    // Get conversation statistics
    const [messageCount, unreadCount] = await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('conversation_id', conversation_id),
      supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('conversation_id', conversation_id)
        .gt('created_at', participation.last_read_at || '1970-01-01')
    ]);

    const conversationDetails = {
      ...conversation,
      participants: participants || [],
      messages: messages,
      statistics: {
        total_messages: messageCount.count || 0,
        unread_messages: unreadCount.count || 0,
        participant_count: participants?.length || 0
      },
      current_user_participation: participation
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: conversationDetails
      })
    };

  } catch (error) {
    console.error('Get conversation details error:', error);
    throw error;
  }
}

// Update conversation
async function updateConversation(userId, requestBody, headers) {
  try {
    const {
      conversation_id,
      title,
      metadata,
      is_archived
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

    // Verify user has permission to update (admin or creator)
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
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

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('creator_id')
      .eq('id', conversation_id)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    if (participation.role !== 'admin' && conversation.creator_id !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Insufficient permissions to update conversation'
        })
      };
    }

    // Update conversation
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (is_archived !== undefined) updateData.is_archived = is_archived;

    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation_id)
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
        message: 'Conversation updated successfully',
        data: updatedConversation
      })
    };

  } catch (error) {
    console.error('Update conversation error:', error);
    throw error;
  }
}

// Delete conversation
async function deleteConversation(userId, requestBody, headers) {
  try {
    const { conversation_id, confirm_deletion = false } = JSON.parse(requestBody);

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

    if (!confirm_deletion) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Deletion confirmation required'
        })
      };
    }

    // Verify user is creator or admin
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('creator_id')
      .eq('id', conversation_id)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
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

    if (conversation.creator_id !== userId && participation.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Only conversation creator or admin can delete'
        })
      };
    }

    // Soft delete - mark as deleted instead of removing
    const { error: deleteError } = await supabase
      .from('conversations')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    if (deleteError) {
      throw deleteError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Conversation deleted successfully'
      })
    };

  } catch (error) {
    console.error('Delete conversation error:', error);
    throw error;
  }
}

// Archive conversation
async function archiveConversation(userId, requestBody, headers) {
  try {
    const { conversation_id, is_archived = true } = JSON.parse(requestBody);

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

    // Update user's participation record (personal archive)
    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        is_archived: is_archived,
        archived_at: is_archived ? new Date().toISOString() : null,
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
        message: `Conversation ${is_archived ? 'archived' : 'unarchived'} successfully`,
        data: {
          conversation_id,
          is_archived,
          archived_at: updatedParticipation.archived_at
        }
      })
    };

  } catch (error) {
    console.error('Archive conversation error:', error);
    throw error;
  }
}

// Mark conversation as read
async function markAsRead(userId, requestBody, headers) {
  try {
    const { conversation_id, message_id } = JSON.parse(requestBody);

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

    // Update last read timestamp
    const { data: updatedParticipation, error: updateError } = await supabase
      .from('conversation_participants')
      .update({
        last_read_at: new Date().toISOString(),
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
        message: 'Conversation marked as read',
        data: {
          conversation_id,
          last_read_at: updatedParticipation.last_read_at
        }
      })
    };

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
      search_type = 'all' // 'title', 'participants', 'messages', 'all'
    } = queryParams || {};

    if (!query.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Search query is required'
        })
      };
    }

    let searchQuery = supabase
      .from('conversations')
      .select(`
        id,
        title,
        type,
        status,
        created_at,
        updated_at,
        last_message_at,
        conversation_participants!inner(user_id)
      `)
      .eq('conversation_participants.user_id', userId)
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply search filters based on type
    if (search_type === 'title' || search_type === 'all') {
      searchQuery = searchQuery.ilike('title', `%${query}%`);
    }

    const { data: conversations, error } = await searchQuery;

    if (error) {
      throw error;
    }

    // If searching messages, do a separate query
    let messageMatches = [];
    if (search_type === 'messages' || search_type === 'all') {
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select(`
          conversation_id,
          content,
          created_at,
          conversation:conversations!inner(
            id, title, type,
            conversation_participants!inner(user_id)
          )
        `)
        .eq('conversation.conversation_participants.user_id', userId)
        .ilike('content', `%${query}%`)
        .limit(parseInt(limit));

      if (!messageError && messages) {
        messageMatches = messages;
      }
    }

    const results = {
      conversations: conversations || [],
      message_matches: messageMatches,
      total_conversation_matches: conversations?.length || 0,
      total_message_matches: messageMatches.length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: results,
        search_query: query,
        search_type
      })
    };

  } catch (error) {
    console.error('Search conversations error:', error);
    throw error;
  }
}

// Get conversation participants
async function getConversationParticipants(userId, queryParams, headers) {
  try {
    const { conversation_id } = queryParams || {};

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

    // Verify user is participant
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('*')
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

    // Get all participants
    const { data: participants, error } = await supabase
      .from('conversation_participants')
      .select(`
        *,
        user:users(
          id, username, full_name, profile_image, 
          last_login_at, user_type, verified
        )
      `)
      .eq('conversation_id', conversation_id)
      .order('joined_at', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          participants: participants || [],
          total_participants: participants?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get conversation participants error:', error);
    throw error;
  }
}

// Add participant to conversation
async function addParticipant(userId, requestBody, headers) {
  try {
    const {
      conversation_id,
      user_id_to_add,
      role = 'member'
    } = JSON.parse(requestBody);

    if (!conversation_id || !user_id_to_add) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID and user ID are required'
        })
      };
    }

    // Verify current user has permission (admin or creator)
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversation_id)
      .eq('user_id', userId)
      .single();

    if (participationError || !participation || participation.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Admin permission required'
        })
      };
    }

    // Check if user is already a participant
    const { data: existingParticipant, error: existingError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('user_id', user_id_to_add)
      .single();

    if (!existingError && existingParticipant) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User is already a participant'
        })
      };
    }

    // Add participant
    const { data: newParticipant, error: addError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id,
        user_id: user_id_to_add,
        role,
        joined_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      })
      .select(`
        *,
        user:users(username, full_name, profile_image)
      `)
      .single();

    if (addError) {
      throw addError;
    }

    // Update participant count
    await supabase
      .from('conversations')
      .update({
        participant_count: supabase.raw('participant_count + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Participant added successfully',
        data: newParticipant
      })
    };

  } catch (error) {
    console.error('Add participant error:', error);
    throw error;
  }
}

// Remove participant from conversation
async function removeParticipant(userId, requestBody, headers) {
  try {
    const {
      conversation_id,
      user_id_to_remove
    } = JSON.parse(requestBody);

    if (!conversation_id || !user_id_to_remove) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Conversation ID and user ID are required'
        })
      };
    }

    // Verify permission (admin, creator, or removing self)
    const { data: participation, error: participationError } = await supabase
      .from('conversation_participants')
      .select('role')
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

    const canRemove = participation.role === 'admin' || 
                     user_id_to_remove === userId;

    if (!canRemove) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Insufficient permissions'
        })
      };
    }

    // Remove participant
    const { error: removeError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversation_id)
      .eq('user_id', user_id_to_remove);

    if (removeError) {
      throw removeError;
    }

    // Update participant count
    await supabase
      .from('conversations')
      .update({
        participant_count: supabase.raw('participant_count - 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Participant removed successfully'
      })
    };

  } catch (error) {
    console.error('Remove participant error:', error);
    throw error;
  }
}

// Get conversation statistics for user
async function getConversationStats(userId, headers) {
  try {
    // Get various conversation statistics
    const [
      totalConversations,
      activeConversations,
      archivedConversations,
      unreadMessages,
      recentActivity
    ] = await Promise.all([
      supabase
        .from('conversation_participants')
        .select('conversation_id', { count: 'exact' })
        .eq('user_id', userId),
      
      supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversation:conversations!inner(status)
        `)
        .eq('user_id', userId)
        .eq('conversation.status', 'active'),
      
      supabase
        .from('conversation_participants')
        .select('conversation_id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_archived', true),
      
      supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          created_at,
          conversation_participants!inner(
            user_id, last_read_at
          )
        `)
        .eq('conversation_participants.user_id', userId)
        .gt('created_at', 'conversation_participants.last_read_at'),
      
      supabase
        .from('messages')
        .select(`
          conversation_id,
          created_at,
          conversation_participants!inner(user_id)
        `)
        .eq('conversation_participants.user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    const stats = {
      total_conversations: totalConversations.count || 0,
      active_conversations: activeConversations.data?.length || 0,
      archived_conversations: archivedConversations.count || 0,
      unread_messages: unreadMessages.data?.length || 0,
      recent_activity: recentActivity.data?.length || 0,
      activity_by_day: getActivityByDay(recentActivity.data || [])
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: stats
      })
    };

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