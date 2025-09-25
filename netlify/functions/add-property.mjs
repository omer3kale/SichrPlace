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
      // Add new property
      const {
        title,
        description,
        address,
        city,
        postal_code,
        rent_amount,
        deposit_amount,
        size_sqm,
        rooms,
        bathrooms,
        furnished,
        pets_allowed,
        smoking_allowed,
        available_from,
        lease_duration,
        utilities_included,
        images,
        amenities,
        nearby_transport,
        house_rules,
        property_type,
        floor,
        balcony,
        parking,
        heating_type,
        internet_included,
        washing_machine,
        dishwasher,
        microwave,
        elevator,
        rent_type
      } = JSON.parse(event.body);

      // Validate required fields
      if (!title || !description || !address || !city || !rent_amount || !rooms || !rent_type) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Title, description, address, city, rent amount, rooms, and rent type are required'
          }),
        };
      }

      // Ensure user has landlord role or higher
      if (user.role !== 'landlord' && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Only landlords can add properties'
          }),
        };
      }

      // Insert new property
      const { data: newProperty, error: insertError } = await supabase
        .from('apartments')
        .insert([
          {
            landlord_id: user.id,
            title,
            description,
            address,
            city,
            postal_code,
            rent_amount: parseFloat(rent_amount),
            deposit_amount: deposit_amount ? parseFloat(deposit_amount) : null,
            size_sqm: size_sqm ? parseInt(size_sqm) : null,
            rooms: parseInt(rooms),
            bathrooms: bathrooms ? parseInt(bathrooms) : 1,
            furnished: furnished === true,
            pets_allowed: pets_allowed === true,
            smoking_allowed: smoking_allowed === true,
            available_from: available_from || new Date().toISOString().split('T')[0],
            lease_duration: lease_duration || 'flexible',
            utilities_included: utilities_included === true,
            images: images || [],
            amenities: amenities || [],
            nearby_transport: nearby_transport || [],
            house_rules: house_rules || '',
            property_type: property_type || 'apartment',
            floor: floor ? parseInt(floor) : null,
            balcony: balcony === true,
            parking: parking === true,
            heating_type: heating_type || 'central',
            internet_included: internet_included === true,
            washing_machine: washing_machine === true,
            dishwasher: dishwasher === true,
            microwave: microwave === true,
            elevator: elevator === true,
            rent_type: rent_type || 'kalt', // Default to kalt if not specified
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Error creating property:', insertError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to create property'
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
          data: newProperty,
          message: 'Property created successfully'
        }),
      };
    }

    if (event.httpMethod === 'GET') {
      // Get properties for the current landlord
      const { data: properties, error: fetchError } = await supabase
        .from('apartments')
        .select(`
          *,
          landlord:users!landlord_id (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching properties:', fetchError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to fetch properties'
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
          data: properties
        }),
      };
    }

    if (event.httpMethod === 'PUT') {
      // Update existing property
      const { propertyId, ...updates } = JSON.parse(event.body);

      if (!propertyId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Property ID is required'
          }),
        };
      }

      // Verify ownership
      const { data: existingProperty, error: fetchError } = await supabase
        .from('apartments')
        .select('landlord_id')
        .eq('id', propertyId)
        .single();

      if (fetchError || !existingProperty) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Property not found'
          }),
        };
      }

      if (existingProperty.landlord_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Not authorized to update this property'
          }),
        };
      }

      // Clean and prepare updates
      const allowedFields = [
        'title', 'description', 'address', 'city', 'postal_code',
        'rent_amount', 'deposit_amount', 'size_sqm', 'rooms', 'bathrooms',
        'furnished', 'pets_allowed', 'smoking_allowed', 'available_from',
        'lease_duration', 'utilities_included', 'images', 'amenities',
        'nearby_transport', 'house_rules', 'property_type', 'floor',
        'balcony', 'parking', 'heating_type', 'internet_included',
        'washing_machine', 'dishwasher', 'microwave', 'elevator', 'status'
      ];

      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      // Convert numeric fields
      if (filteredUpdates.rent_amount) filteredUpdates.rent_amount = parseFloat(filteredUpdates.rent_amount);
      if (filteredUpdates.deposit_amount) filteredUpdates.deposit_amount = parseFloat(filteredUpdates.deposit_amount);
      if (filteredUpdates.size_sqm) filteredUpdates.size_sqm = parseInt(filteredUpdates.size_sqm);
      if (filteredUpdates.rooms) filteredUpdates.rooms = parseInt(filteredUpdates.rooms);
      if (filteredUpdates.bathrooms) filteredUpdates.bathrooms = parseInt(filteredUpdates.bathrooms);
      if (filteredUpdates.floor) filteredUpdates.floor = parseInt(filteredUpdates.floor);

      filteredUpdates.updated_at = new Date().toISOString();

      // Update property
      const { data: updatedProperty, error: updateError } = await supabase
        .from('apartments')
        .update(filteredUpdates)
        .eq('id', propertyId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating property:', updateError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to update property'
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
          data: updatedProperty,
          message: 'Property updated successfully'
        }),
      };
    }

    if (event.httpMethod === 'DELETE') {
      // Delete property
      const { propertyId } = event.queryStringParameters || {};

      if (!propertyId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Property ID is required'
          }),
        };
      }

      // Verify ownership
      const { data: existingProperty, error: fetchError } = await supabase
        .from('apartments')
        .select('landlord_id, title')
        .eq('id', propertyId)
        .single();

      if (fetchError || !existingProperty) {
        return {
          statusCode: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Property not found'
          }),
        };
      }

      if (existingProperty.landlord_id !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Not authorized to delete this property'
          }),
        };
      }

      // Soft delete by updating status
      const { error: deleteError } = await supabase
        .from('apartments')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId);

      if (deleteError) {
        console.error('Error deleting property:', deleteError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Failed to delete property'
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
          message: `Property "${existingProperty.title}" deleted successfully`
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
    console.error('Add property function error:', error);
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