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

    if (event.httpMethod === 'POST') {
      // Create new booking request
      const { apartmentId, startDate, endDate, guests, message } = JSON.parse(event.body);

      if (!apartmentId || !startDate || !endDate) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Apartment ID, start date, and end date are required'
          }),
        };
      }

      // Insert booking request
      const { data: bookingRequest, error: insertError } = await supabase
        .from('booking_requests')
        .insert([
          {
            tenant_id: user.id,
            apartment_id: apartmentId,
            start_date: startDate,
            end_date: endDate,
            guests: guests || 1,
            message: message || '',
            status: 'pending',
            request_date: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating booking request:', insertError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to create booking request'
          }),
        };
      }

      return {
        statusCode: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: bookingRequest
        }),
      };
    }

    if (event.httpMethod === 'GET') {
      // Get booking requests for user
      const { data: bookingRequests, error: fetchError } = await supabase
        .from('booking_requests')
        .select(`
          *,
          apartments (
            id,
            title,
            address,
            rent_amount,
            images
          )
        `)
        .eq('tenant_id', user.id)
        .order('request_date', { ascending: false });

      if (fetchError) {
        console.error('Error fetching booking requests:', fetchError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to fetch booking requests'
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
          data: bookingRequests
        }),
      };
    }

    if (event.httpMethod === 'PUT') {
      // Update booking request status (landlord response)
      const { requestId, status, response } = JSON.parse(event.body);

      if (!requestId || !status) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request ID and status are required'
          }),
        };
      }

      // Verify user owns the apartment for this booking request
      const { data: bookingRequest, error: fetchError } = await supabase
        .from('booking_requests')
        .select(`
          *,
          apartments!inner (
            landlord_id
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !bookingRequest) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Booking request not found'
          }),
        };
      }

      if (bookingRequest.apartments.landlord_id !== user.id) {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Not authorized to update this booking request'
          }),
        };
      }

      // Update booking request
      const { data: updatedRequest, error: updateError } = await supabase
        .from('booking_requests')
        .update({
          status,
          landlord_response: response || '',
          response_date: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating booking request:', updateError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to update booking request'
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
          data: updatedRequest
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
    console.error('Booking request function error:', error);
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