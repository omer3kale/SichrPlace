// Environment validation
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  console.error('GOOGLE_MAPS_API_KEY environment variable is not set');
}

// Helper function to build standardized headers
const buildHeaders = (additionalHeaders = {}) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Access-Control-Request-Headers',
  ...additionalHeaders
});

// Helper function to create standardized responses
const respond = (data, additionalHeaders = {}) => ({
  statusCode: 200,
  headers: buildHeaders(additionalHeaders),
  body: JSON.stringify(data)
});

// Helper function to parse request body safely
const parseRequestBody = (body) => {
  if (!body) throw new Error('Request body is required');
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
};

// Helper function to sanitize string inputs
const sanitizeString = (value, maxLength = 200) => {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
};

// Helper function to clamp numeric values
const clampNumber = (value, min, max) => {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};

// Helper function to create HTTP errors
const httpError = (statusCode, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

export const handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: buildHeaders(), body: '' };
    }

    if (event.httpMethod !== 'POST') {
      throw httpError(405, 'Method not allowed');
    }

    // Validate environment
    if (!googleMapsApiKey) {
      throw httpError(500, 'Google Maps API key not configured');
    }

    // Parse and validate input
    const requestData = parseRequestBody(event.body);
    
    const { 
      lat, 
      lng, 
      radius = 1000, 
      types = [], 
      keyword = '',
      minRating = 0, 
      openNow = false,
      language = 'en' 
    } = requestData;

    // Validate required coordinates
    if (!lat || !lng) {
      throw httpError(400, 'Latitude and longitude are required');
    }

    // Sanitize and validate inputs
    const sanitizedLat = clampNumber(lat, -90, 90);
    const sanitizedLng = clampNumber(lng, -180, 180);
    const sanitizedRadius = clampNumber(radius, 1, 50000); // Max 50km radius
    const sanitizedKeyword = sanitizeString(keyword, 100);
    const sanitizedLanguage = sanitizeString(language, 10) || 'en';
    const sanitizedMinRating = clampNumber(minRating, 0, 5);
    const sanitizedTypes = Array.isArray(types) ? types.filter(type => 
      typeof type === 'string' && type.trim().length > 0
    ).slice(0, 10) : []; // Limit to 10 types
    
    if (sanitizedLat !== parseFloat(lat) || sanitizedLng !== parseFloat(lng)) {
      throw httpError(400, 'Invalid latitude or longitude values');
    }

    // Build Places API URL with sanitized inputs
    let placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${sanitizedLat},${sanitizedLng}&radius=${sanitizedRadius}&key=${googleMapsApiKey}&language=${sanitizedLanguage}`;
    
    // Add type filter if specified
    if (sanitizedTypes.length > 0) {
      placesUrl += `&type=${sanitizedTypes.join('|')}`;
    }

    // Add keyword filter if specified
    if (sanitizedKeyword) {
      placesUrl += `&keyword=${encodeURIComponent(sanitizedKeyword)}`;
    }

    // Add open now filter
    if (openNow === true) {
      placesUrl += `&opennow=true`;
    }

    const response = await fetch(placesUrl);
    
    if (!response.ok) {
      throw httpError(502, 'Google Places API request failed', { 
        status: response.status, 
        statusText: response.statusText 
      });
    }
    
    const data = await response.json();

    if (data.status === 'OK') {
      // Process and filter results
      let places = data.results.map(place => ({
        place_id: place.place_id,
        name: place.name,
        rating: place.rating || null,
        price_level: place.price_level || null,
        types: place.types || [],
        vicinity: place.vicinity || null,
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        opening_hours: place.opening_hours ? {
          open_now: place.opening_hours.open_now || false
        } : null,
        photos: place.photos ? place.photos.slice(0, 3).map(photo => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height,
          html_attributions: photo.html_attributions
        })) : [],
        user_ratings_total: place.user_ratings_total || 0,
        permanently_closed: place.permanently_closed || false
      }));

      // Apply additional filters
      if (sanitizedMinRating > 0) {
        places = places.filter(place => place.rating && place.rating >= sanitizedMinRating);
      }

      // Calculate distances from the search point
      places = places.map(place => {
        const distance = calculateDistance(
          sanitizedLat, sanitizedLng,
          place.location.lat, place.location.lng
        );
        return {
          ...place,
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      });

      // Sort by distance
      places.sort((a, b) => a.distance - b.distance);

      return respond({
        success: true,
        data: {
          places: places,
          search_params: {
            location: { lat: sanitizedLat, lng: sanitizedLng },
            radius: sanitizedRadius,
            types: sanitizedTypes,
            keyword: sanitizedKeyword,
            min_rating: sanitizedMinRating,
            open_now: openNow
          },
          next_page_token: data.next_page_token || null
        }
      });
    }

    if (data.status === 'ZERO_RESULTS') {
      return respond({
        success: true,
        data: {
          places: [],
          message: 'No places found in the specified area'
        }
      });
    }

    // Handle other API errors
    throw httpError(400, `Places search failed: ${data.status}`, {
      apiError: data.error_message || 'Unknown error',
      status: data.status
    });

  } catch (error) {
    console.error('Nearby places search error:', error);
    
    // Handle HTTP errors (from httpError helper)
    if (error.statusCode) {
      return {
        statusCode: error.statusCode,
        headers: buildHeaders(),
        body: JSON.stringify({
          success: false,
          message: error.message,
          ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details })
        })
      };
    }
    
    // Handle unexpected errors
    return {
      statusCode: 500,
      headers: buildHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Nearby places search failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI/180);
}