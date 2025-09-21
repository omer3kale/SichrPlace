import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
  console.error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to extract user from JWT token
const getUserFromToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    return jwt.verify(token, jwtSecret);
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const {
      query = '',
      location = '',
      minPrice = '',
      maxPrice = '',
      bedrooms = '',
      bathrooms = '',
      propertyType = '',
      amenities = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = '1',
      limit = '20'
    } = queryParams;

    // Build the search query
    let searchQuery = supabase
      .from('apartments')
      .select(`
        *,
        landlord:users!apartments_landlord_id_fkey(username, full_name, phone),
        images:apartment_images(url, is_main),
        reviews:apartment_reviews(rating, comment, created_at)
      `)
      .eq('status', 'active');

    // Text search in title and description
    if (query) {
      searchQuery = searchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Location search
    if (location) {
      searchQuery = searchQuery.or(`address.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
    }

    // Price range
    if (minPrice) {
      searchQuery = searchQuery.gte('price', parseInt(minPrice));
    }
    if (maxPrice) {
      searchQuery = searchQuery.lte('price', parseInt(maxPrice));
    }

    // Bedrooms
    if (bedrooms) {
      if (bedrooms === '5+') {
        searchQuery = searchQuery.gte('bedrooms', 5);
      } else {
        searchQuery = searchQuery.eq('bedrooms', parseInt(bedrooms));
      }
    }

    // Bathrooms
    if (bathrooms) {
      if (bathrooms === '3+') {
        searchQuery = searchQuery.gte('bathrooms', 3);
      } else {
        searchQuery = searchQuery.eq('bathrooms', parseInt(bathrooms));
      }
    }

    // Property type
    if (propertyType) {
      searchQuery = searchQuery.eq('property_type', propertyType);
    }

    // Amenities search
    if (amenities) {
      const amenityList = amenities.split(',');
      for (const amenity of amenityList) {
        searchQuery = searchQuery.contains('amenities', [amenity.trim()]);
      }
    }

    // Sorting
    const validSortFields = ['created_at', 'price', 'bedrooms', 'bathrooms', 'title'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
    
    searchQuery = searchQuery.order(sortField, { ascending: sortDirection === 'asc' });

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    searchQuery = searchQuery.range(offset, offset + limitNum - 1);

    // Execute search
    const { data: apartments, error, count } = await searchQuery;

    if (error) {
      console.error('Search error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Search failed' })
      };
    }

    // Log search activity if user is authenticated
    const user = getUserFromToken(event.headers.authorization);
    if (user) {
      await supabase.from('search_logs').insert({
        user_id: user.userId,
        query: query,
        location: location,
        filters: {
          minPrice, maxPrice, bedrooms, bathrooms, propertyType, amenities
        },
        results_count: apartments.length,
        created_at: new Date().toISOString()
      });
    }

    // Calculate aggregations for filters
    const { data: priceRange } = await supabase
      .from('apartments')
      .select('price')
      .eq('status', 'active')
      .order('price', { ascending: true });

    const minAvailablePrice = priceRange?.length ? priceRange[0].price : 0;
    const maxAvailablePrice = priceRange?.length ? priceRange[priceRange.length - 1].price : 10000;

    // Get available property types
    const { data: propertyTypes } = await supabase
      .from('apartments')
      .select('property_type')
      .eq('status', 'active')
      .neq('property_type', null);

    const uniquePropertyTypes = [...new Set(propertyTypes?.map(p => p.property_type) || [])];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: apartments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: apartments.length,
          hasMore: apartments.length === limitNum
        },
        filters: {
          priceRange: {
            min: minAvailablePrice,
            max: maxAvailablePrice
          },
          propertyTypes: uniquePropertyTypes
        },
        searchParams: {
          query, location, minPrice, maxPrice, bedrooms, bathrooms, 
          propertyType, amenities, sortBy, sortOrder
        }
      })
    };

  } catch (error) {
    console.error('Advanced search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};