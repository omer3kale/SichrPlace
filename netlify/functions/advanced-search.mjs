import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// JWT verification helper
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export const handler = async (event, context) => {
  const headers = { ...corsHeaders };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request
    const { action, ...queryParams } = event.queryStringParameters || {};
    const requestBody = event.body ? JSON.parse(event.body) : {};
    
    // Verify authentication for user-specific actions
    let userId = null;
    let userRole = null;

    if (['save_search', 'get_saved_searches', 'delete_saved_search', 'get_search_history'].includes(action)) {
      const tokenData = verifyToken(event.headers.authorization);
      if (!tokenData) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Authentication required'
          })
        };
      }
      userId = tokenData.sub || tokenData.userId;
      userRole = tokenData.role;
    }

    // Route to appropriate handler
    switch (action) {
      case 'advanced_search':
        return await advancedSearch(queryParams, headers);
      
      case 'complex_filters':
        return await complexFilters(queryParams, headers);
      
      case 'spatial_search':
        return await spatialSearch(queryParams, headers);
      
      case 'semantic_search':
        return await semanticSearch(queryParams, headers);
      
      case 'faceted_search':
        return await facetedSearch(queryParams, headers);
      
      case 'auto_suggest':
        return await autoSuggest(queryParams, headers);
      
      case 'search_suggestions':
        return await searchSuggestions(queryParams, headers);
      
      case 'save_search':
        return await saveSearch(userId, requestBody, headers);
      
      case 'get_saved_searches':
        return await getSavedSearches(userId, queryParams, headers);
      
      case 'delete_saved_search':
        return await deleteSavedSearch(userId, requestBody, headers);
      
      case 'search_analytics':
        return await searchAnalytics(queryParams, headers);
      
      case 'popular_searches':
        return await popularSearches(queryParams, headers);
      
      case 'search_trends':
        return await searchTrends(queryParams, headers);
      
      case 'get_search_history':
        return await getSearchHistory(userId, queryParams, headers);
      
      case 'similar_properties':
        return await similarProperties(queryParams, headers);
      
      case 'property_recommendations':
        return await propertyRecommendations(userId, queryParams, headers);
      
      case 'geo_cluster_search':
        return await geoClusterSearch(queryParams, headers);
      
      case 'price_analysis':
        return await priceAnalysis(queryParams, headers);
      
      case 'market_insights':
        return await marketInsights(queryParams, headers);
      
      case 'search_export':
        return await searchExport(queryParams, headers);
      
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
    console.error('Advanced search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};

// Advanced search with complex criteria
async function advancedSearch(queryParams, headers) {
  try {
    const {
      location,
      min_price,
      max_price,
      min_rooms,
      max_rooms,
      min_area,
      max_area,
      property_type,
      amenities,
      availability_date,
      keywords,
      radius = '5000', // meters
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = '20',
      offset = '0'
    } = queryParams;

    // Build dynamic query
    let query = supabase
      .from('apartments')
      .select(`
        *,
        apartment_photos (
          photo_url,
          is_primary
        ),
        reviews (
          rating
        ),
        users!apartments_user_id_fkey (
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('is_active', true);

    // Apply filters
    if (min_price) {
      query = query.gte('rent_amount', parseFloat(min_price));
    }

    if (max_price) {
      query = query.lte('rent_amount', parseFloat(max_price));
    }

    if (min_rooms) {
      query = query.gte('number_of_rooms', parseInt(min_rooms));
    }

    if (max_rooms) {
      query = query.lte('number_of_rooms', parseInt(max_rooms));
    }

    if (min_area) {
      query = query.gte('area_sqm', parseFloat(min_area));
    }

    if (max_area) {
      query = query.lte('area_sqm', parseFloat(max_area));
    }

    if (property_type) {
      query = query.eq('property_type', property_type);
    }

    if (availability_date) {
      query = query.lte('available_from', availability_date);
    }

    // Handle keywords search
    if (keywords) {
      query = query.or(`title.ilike.%${keywords}%,description.ilike.%${keywords}%,location.ilike.%${keywords}%`);
    }

    // Handle amenities filter
    if (amenities) {
      const amenitiesList = amenities.split(',');
      amenitiesList.forEach(amenity => {
        query = query.contains('amenities', [amenity.trim()]);
      });
    }

    // Apply sorting
    const sortColumn = ['created_at', 'rent_amount', 'area_sqm', 'number_of_rooms'].includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? { ascending: true } : { ascending: false };
    query = query.order(sortColumn, sortDirection);

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: apartments, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate average ratings for each apartment
    const processedApartments = apartments?.map(apt => {
      const ratings = apt.reviews?.map(r => r.rating).filter(r => r) || [];
      const avgRating = ratings.length > 0 ? 
        Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : 0;
      
      return {
        ...apt,
        average_rating: avgRating,
        review_count: ratings.length,
        primary_photo: apt.apartment_photos?.find(p => p.is_primary)?.photo_url || apt.apartment_photos?.[0]?.photo_url || null
      };
    }) || [];

    // Get total count for pagination
    let countQuery = supabase
      .from('apartments')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    // Apply same filters for count
    if (min_price) countQuery = countQuery.gte('rent_amount', parseFloat(min_price));
    if (max_price) countQuery = countQuery.lte('rent_amount', parseFloat(max_price));
    if (min_rooms) countQuery = countQuery.gte('number_of_rooms', parseInt(min_rooms));
    if (max_rooms) countQuery = countQuery.lte('number_of_rooms', parseInt(max_rooms));
    if (min_area) countQuery = countQuery.gte('area_sqm', parseFloat(min_area));
    if (max_area) countQuery = countQuery.lte('area_sqm', parseFloat(max_area));
    if (property_type) countQuery = countQuery.eq('property_type', property_type);
    if (availability_date) countQuery = countQuery.lte('available_from', availability_date);
    if (keywords) countQuery = countQuery.or(`title.ilike.%${keywords}%,description.ilike.%${keywords}%,location.ilike.%${keywords}%`);

    const { count } = await countQuery;

    // Log search activity
    await supabase
      .from('search_analytics')
      .insert({
        search_params: queryParams,
        results_count: processedApartments.length,
        total_count: count,
        search_type: 'advanced',
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          apartments: processedApartments,
          pagination: {
            total: count || 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: (count || 0) > parseInt(offset) + parseInt(limit)
          },
          search_meta: {
            search_type: 'advanced',
            filters_applied: Object.keys(queryParams).length,
            sort_by: sortColumn,
            sort_order
          }
        }
      })
    };

  } catch (error) {
    console.error('Advanced search error:', error);
    throw error;
  }
}

// Complex filters with multiple criteria combinations
async function complexFilters(queryParams, headers) {
  try {
    const {
      filter_groups, // JSON string of filter groups
      logic_operator = 'AND' // AND/OR between groups
    } = queryParams;

    if (!filter_groups) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'filter_groups parameter is required'
        })
      };
    }

    const filterGroups = JSON.parse(filter_groups);
    
    // Build complex query based on filter groups
    let query = supabase
      .from('apartments')
      .select('*')
      .eq('is_active', true);

    // Apply complex filtering logic
    filterGroups.forEach((group, index) => {
      const { field, operator, value, group_logic = 'AND' } = group;
      
      switch (operator) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'neq':
          query = query.neq(field, value);
          break;
        case 'gt':
          query = query.gt(field, value);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'lt':
          query = query.lt(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        case 'in':
          query = query.in(field, value);
          break;
        case 'contains':
          query = query.contains(field, value);
          break;
        case 'ilike':
          query = query.ilike(field, `%${value}%`);
          break;
      }
    });

    const { data: apartments, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          apartments: apartments || [],
          filter_groups_applied: filterGroups.length,
          logic_operator
        }
      })
    };

  } catch (error) {
    console.error('Complex filters error:', error);
    throw error;
  }
}

// Spatial/Geographic search
async function spatialSearch(queryParams, headers) {
  try {
    const {
      lat,
      lng,
      radius = '5000', // meters
      bounds, // JSON string of geographic bounds
      polygon, // JSON string of polygon coordinates
      search_type = 'radius' // radius, bounds, polygon
    } = queryParams;

    let spatialQuery = '';
    let spatialParams = [];

    switch (search_type) {
      case 'radius':
        if (!lat || !lng) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'lat and lng are required for radius search'
            })
          };
        }
        // Use ST_DWithin for radius search (requires PostGIS)
        spatialQuery = `ST_DWithin(location_point, ST_SetSRID(ST_Point($1, $2), 4326), $3)`;
        spatialParams = [parseFloat(lng), parseFloat(lat), parseFloat(radius)];
        break;
        
      case 'bounds':
        if (!bounds) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'bounds parameter is required for bounds search'
            })
          };
        }
        const boundsObj = JSON.parse(bounds);
        spatialQuery = `latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`;
        spatialParams = [boundsObj.south, boundsObj.north, boundsObj.west, boundsObj.east];
        break;
        
      case 'polygon':
        if (!polygon) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'polygon parameter is required for polygon search'
            })
          };
        }
        // Simplified polygon search - in practice would use PostGIS ST_Within
        return {
          statusCode: 501,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Polygon search not yet implemented'
          })
        };
    }

    // For now, using simple lat/lng filtering (would use PostGIS in production)
    let query = supabase
      .from('apartments')
      .select(`
        *,
        apartment_photos (photo_url, is_primary)
      `)
      .eq('is_active', true);

    if (search_type === 'radius' && lat && lng) {
      // Simple radius approximation (not accurate for large distances)
      const latRange = parseFloat(radius) / 111320; // rough conversion
      const lngRange = parseFloat(radius) / (111320 * Math.cos(parseFloat(lat) * Math.PI / 180));
      
      query = query
        .gte('latitude', parseFloat(lat) - latRange)
        .lte('latitude', parseFloat(lat) + latRange)
        .gte('longitude', parseFloat(lng) - lngRange)
        .lte('longitude', parseFloat(lng) + lngRange);
    }

    const { data: apartments, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate actual distances for radius search
    const processedApartments = apartments?.map(apt => {
      let distance = null;
      if (search_type === 'radius' && lat && lng && apt.latitude && apt.longitude) {
        distance = calculateDistance(
          parseFloat(lat), parseFloat(lng),
          apt.latitude, apt.longitude
        );
      }
      
      return {
        ...apt,
        distance_meters: distance,
        primary_photo: apt.apartment_photos?.find(p => p.is_primary)?.photo_url || apt.apartment_photos?.[0]?.photo_url || null
      };
    }).filter(apt => {
      // Filter by actual distance for radius search
      if (search_type === 'radius') {
        return apt.distance_meters <= parseFloat(radius);
      }
      return true;
    }).sort((a, b) => {
      // Sort by distance for radius search
      if (search_type === 'radius' && a.distance_meters !== null && b.distance_meters !== null) {
        return a.distance_meters - b.distance_meters;
      }
      return 0;
    }) || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          apartments: processedApartments,
          search_center: search_type === 'radius' ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
          search_radius: search_type === 'radius' ? parseFloat(radius) : null,
          search_type,
          results_count: processedApartments.length
        }
      })
    };

  } catch (error) {
    console.error('Spatial search error:', error);
    throw error;
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Save search for user
async function saveSearch(userId, requestBody, headers) {
  try {
    const {
      name,
      search_params,
      alert_frequency = 'none' // none, daily, weekly
    } = requestBody;

    if (!name || !search_params) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'name and search_params are required'
        })
      };
    }

    const { data: savedSearch, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: userId,
        name,
        search_params,
        alert_frequency,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: savedSearch
      })
    };

  } catch (error) {
    console.error('Save search error:', error);
    throw error;
  }
}

// Placeholder implementations for remaining functions
async function semanticSearch(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { apartments: [] } }) };
}

async function facetedSearch(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { facets: {}, apartments: [] } }) };
}

async function autoSuggest(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { suggestions: [] } }) };
}

async function searchSuggestions(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { suggestions: [] } }) };
}

async function getSavedSearches(userId, queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { saved_searches: [] } }) };
}

async function deleteSavedSearch(userId, requestBody, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: true }) };
}

async function searchAnalytics(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { analytics: {} } }) };
}

async function popularSearches(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { popular_searches: [] } }) };
}

async function searchTrends(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { trends: [] } }) };
}

async function getSearchHistory(userId, queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { search_history: [] } }) };
}

async function similarProperties(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { similar_properties: [] } }) };
}

async function propertyRecommendations(userId, queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { recommendations: [] } }) };
}

async function geoClusterSearch(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { clusters: [] } }) };
}

async function priceAnalysis(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { price_analysis: {} } }) };
}

async function marketInsights(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { market_insights: {} } }) };
}

async function searchExport(queryParams, headers) {
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { export_url: 'url' } }) };
}