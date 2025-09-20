import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

export const handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Authorization header required'
        }),
      };
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
        }),
      };
    }

    if (event.httpMethod === 'GET') {
      const { chatId } = event.queryStringParameters || {};

      if (chatId) {
        // Get specific chat messages
        const { data: messages, error: fetchError } = await supabase
          .from('chat_messages')
          .select(`
            *,
            sender:users!sender_id (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq('chat_id', chatId)
          .order('sent_at', { ascending: true });

        if (fetchError) {
          console.error('Error fetching chat messages:', fetchError);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: false,
              error: 'Failed to fetch chat messages'
            }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            data: messages
          }),
        };
      } else {
        // Get user's chat conversations
        const { data: chats, error: fetchError } = await supabase
          .from('chats')
          .select(`
            *,
            participant1:users!participant1_id (
              id,
              first_name,
              last_name,
              email
            ),
            participant2:users!participant2_id (
              id,
              first_name,
              last_name,
              email
            ),
            apartment:apartments (
              id,
              title,
              address
            ),
            last_message:chat_messages (
              message,
              sent_at
            )
          `)
          .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
          .order('updated_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching chats:', fetchError);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: false,
              error: 'Failed to fetch chats'
            }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            data: chats
          }),
        };
      }
    }

    if (event.httpMethod === 'POST') {
      const { apartmentId, message } = JSON.parse(event.body);
      let { receiverId } = JSON.parse(event.body);

      if (!message || (!apartmentId && !receiverId)) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Message and either apartment ID or receiver ID are required'
          }),
        };
      }

      let chatId;

      if (apartmentId) {
        // Get apartment owner to start conversation
        const { data: apartment, error: apartmentError } = await supabase
          .from('apartments')
          .select('landlord_id')
          .eq('id', apartmentId)
          .single();

        if (apartmentError || !apartment) {
          return {
            statusCode: 404,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: false,
              error: 'Apartment not found'
            }),
          };
        }

        receiverId = apartment.landlord_id;
      }

      // Check if chat already exists
      const { data: existingChat, error: chatFetchError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${receiverId}),and(participant1_id.eq.${receiverId},participant2_id.eq.${user.id})`)
        .maybeSingle();

      if (chatFetchError) {
        console.error('Error checking existing chat:', chatFetchError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to check existing chat'
          }),
        };
      }

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        // Create new chat
        const { data: newChat, error: chatCreateError } = await supabase
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
          .single();

        if (chatCreateError) {
          console.error('Error creating chat:', chatCreateError);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: false,
              error: 'Failed to create chat'
            }),
          };
        }

        chatId = newChat.id;
      }

      // Send message
      const { data: newMessage, error: messageError } = await supabase
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
          sender:users!sender_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .single();

      if (messageError) {
        console.error('Error sending message:', messageError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to send message'
          }),
        };
      }

      // Update chat's updated_at timestamp
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

      return {
        statusCode: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: {
            chatId,
            message: newMessage
          }
        }),
      };
    }

    if (event.httpMethod === 'PUT') {
      // Mark messages as read
      const { chatId } = JSON.parse(event.body);

      if (!chatId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Chat ID is required'
          }),
        };
      }

      // Mark all unread messages in this chat as read for this user
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (updateError) {
        console.error('Error marking messages as read:', updateError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to mark messages as read'
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          message: 'Messages marked as read'
        }),
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    };
  }
};