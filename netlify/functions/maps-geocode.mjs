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
const sanitizeString = (value, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
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
    const { address } = parseRequestBody(event.body);
    
    if (!address || typeof address !== 'string') {
      throw httpError(400, 'Address is required and must be a string');
    }

    const sanitizedAddress = sanitizeString(address, 500);
    if (!sanitizedAddress) {
      throw httpError(400, 'Valid address is required');
    }
    
    // Call Google Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(sanitizedAddress)}&key=${googleMapsApiKey}`;
    
    const response = await fetch(geocodeUrl);
    
    if (!response.ok) {
      throw httpError(502, 'Google Maps API request failed', { 
        status: response.status, 
        statusText: response.statusText 
      });
    }
    
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      
      // Extract address components
      const components = {};
      if (result.address_components) {
        result.address_components.forEach(component => {
          const types = component.types;
          
          if (types.includes('street_number')) {
            components.street_number = component.long_name;
          }
          if (types.includes('route')) {
            components.street_name = component.long_name;
          }
          if (types.includes('locality')) {
            components.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            components.state = component.long_name;
            components.state_code = component.short_name;
          }
          if (types.includes('country')) {
            components.country = component.long_name;
            components.country_code = component.short_name;
          }
          if (types.includes('postal_code')) {
            components.postal_code = component.long_name;
          }
          if (types.includes('sublocality')) {
            components.neighborhood = component.long_name;
          }
        });
      }

      const geocodeResult = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        types: result.types || [],
        components: components,
        viewport: result.geometry.viewport || null
      };

      return respond({
        success: true,
        data: geocodeResult
      });
    }

    if (data.status === 'ZERO_RESULTS') {
      throw httpError(404, 'Address not found');
    }

    // Handle other API errors
    throw httpError(400, `Geocoding failed: ${data.status}`, {
      apiError: data.error_message || 'Unknown error',
      status: data.status
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    
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
        message: 'Geocoding failed',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      })
    };
  }
};