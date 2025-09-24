import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY1
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
    const { httpMethod, body, headers, queryStringParameters } = event;
    
    // Handle GET requests - List apartments
    if (httpMethod === 'GET') {
      const { 
        page = 1, 
        limit = 12, 
        city, 
        minPrice, 
        maxPrice, 
        bedrooms, 
        bathrooms,
        furnished,
        available 
      } = queryStringParameters || {};

      let query = supabase
        .from('apartments')
        .select(`
          *,
          users:owner_id (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (city) {
        query = query.ilike('city', `%${city}%`);
      }
      
      if (minPrice) {
        query = query.gte('price', parseInt(minPrice));
      }
      
      if (maxPrice) {
        query = query.lte('price', parseInt(maxPrice));
      }
      
      if (bedrooms) {
        query = query.eq('rooms', parseInt(bedrooms));
      }
      
      if (bathrooms) {
        query = query.eq('bathrooms', parseInt(bathrooms));
      }
      
      if (furnished !== undefined) {
        query = query.eq('furnished', furnished === 'true');
      }
      
      if (available !== undefined) {
        query = query.eq('status', available === 'true' ? 'available' : 'rented');
      } else {
        // Default to available apartments only
        query = query.eq('status', 'available');
      }

      // Pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: apartments, error, count } = await query;

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
          apartments: apartments || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || apartments?.length || 0
          }
        }),
      };
    }

    // Handle POST requests - Create apartment (requires authentication)
    if (httpMethod === 'POST') {
      const authHeader = headers.authorization || headers.Authorization;
      const token = authHeader?.replace('Bearer ', '');
      
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

      const apartmentData = JSON.parse(body);
      
      // Validate required fields
      const requiredFields = ['title', 'description', 'price', 'city', 'location'];
      const missingFields = requiredFields.filter(field => !apartmentData[field]);
      
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

      // Create apartment
      const { data: apartment, error } = await supabase
        .from('apartments')
        .insert([
          {
            ...apartmentData,
            owner_id: user.userId,
            status: 'available',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
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
          message: 'Apartment created successfully',
          apartment: apartment
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
    console.error('Apartments API error:', error);
    
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