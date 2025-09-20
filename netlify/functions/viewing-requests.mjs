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
    const { httpMethod, body, headers, queryStringParameters, pathParameters } = event;
    const authHeader = headers.authorization || headers.Authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Authentication required for all viewing requests operations
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        }),
      };
    }

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
          message: 'Invalid token'
        }),
      };
    }

    // Handle GET requests - List viewing requests
    if (httpMethod === 'GET') {
      const { status, apartment_id } = queryStringParameters || {};
      
      let query = supabase
        .from('viewing_requests')
        .select(`
          *,
          apartments (
            title,
            address,
            city,
            monthly_rent
          ),
          users:tenant_id (
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by user role
      if (user.role === 'tenant') {
        query = query.eq('tenant_id', user.userId);
      } else if (user.role === 'landlord') {
        // Get viewing requests for landlord's apartments
        const { data: landlordApartments } = await supabase
          .from('apartments')
          .select('id')
          .eq('landlord_id', user.userId);
        
        const apartmentIds = landlordApartments?.map(apt => apt.id) || [];
        if (apartmentIds.length > 0) {
          query = query.in('apartment_id', apartmentIds);
        } else {
          // No apartments, return empty result
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: true,
              viewingRequests: []
            }),
          };
        }
      }

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      
      if (apartment_id) {
        query = query.eq('apartment_id', apartment_id);
      }

      const { data: viewingRequests, error } = await query;

      if (error) {
        throw error;
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          viewingRequests: viewingRequests || []
        }),
      };
    }

    // Handle POST requests - Create viewing request
    if (httpMethod === 'POST') {
      const requestData = JSON.parse(body);
      
      // Validate required fields
      const requiredFields = ['apartment_id', 'requested_date', 'requested_time'];
      const missingFields = requiredFields.filter(field => !requestData[field]);
      
      if (missingFields.length > 0) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`
          }),
        };
      }

      // Check if apartment exists and is available
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .select('id, available, landlord_id')
        .eq('id', requestData.apartment_id)
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
            message: 'Apartment not found'
          }),
        };
      }

      if (!apartment.available) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Apartment is not available for viewing'
          }),
        };
      }

      // Check for duplicate requests
      const { data: existingRequest } = await supabase
        .from('viewing_requests')
        .select('id')
        .eq('tenant_id', user.userId)
        .eq('apartment_id', requestData.apartment_id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'You already have a pending viewing request for this apartment'
          }),
        };
      }

      // Create viewing request
      const { data: viewingRequest, error } = await supabase
        .from('viewing_requests')
        .insert([
          {
            apartment_id: requestData.apartment_id,
            tenant_id: user.userId,
            requested_date: requestData.requested_date,
            requested_time: requestData.requested_time,
            message: requestData.message || '',
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select(`
          *,
          apartments (
            title,
            address,
            city
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return {
        statusCode: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          message: 'Viewing request created successfully',
          viewingRequest: viewingRequest
        }),
      };
    }

    // Handle PUT requests - Update viewing request status
    if (httpMethod === 'PUT') {
      const path = event.path || '';
      const requestId = path.split('/').pop();
      
      if (!requestId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Request ID is required'
          }),
        };
      }

      const updateData = JSON.parse(body);
      const { status, landlord_message } = updateData;

      // Validate status
      const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
      if (status && !validStatuses.includes(status)) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
          }),
        };
      }

      // Get viewing request to check permissions
      const { data: viewingRequest, error: fetchError } = await supabase
        .from('viewing_requests')
        .select(`
          *,
          apartments (
            landlord_id
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !viewingRequest) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Viewing request not found'
          }),
        };
      }

      // Check permissions
      const isLandlord = user.role === 'landlord' && user.userId === viewingRequest.apartments.landlord_id;
      const isTenant = user.role === 'tenant' && user.userId === viewingRequest.tenant_id;
      
      if (!isLandlord && !isTenant) {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            message: 'Unauthorized to update this viewing request'
          }),
        };
      }

      // Prepare update data
      const updateFields = {
        updated_at: new Date().toISOString()
      };

      if (status) {
        updateFields.status = status;
        updateFields.response_date = new Date().toISOString();
      }

      if (landlord_message && isLandlord) {
        updateFields.landlord_message = landlord_message;
      }

      // Update viewing request
      const { data: updatedRequest, error: updateError } = await supabase
        .from('viewing_requests')
        .update(updateFields)
        .eq('id', requestId)
        .select(`
          *,
          apartments (
            title,
            address,
            city
          ),
          users:tenant_id (
            full_name,
            email
          )
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          message: 'Viewing request updated successfully',
          viewingRequest: updatedRequest
        }),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('Viewing requests API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};