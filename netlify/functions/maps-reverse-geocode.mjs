const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  console.error('GOOGLE_MAPS_API_KEY environment variable is not set');
}

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { lat, lng } = JSON.parse(event.body);

    if (!lat || !lng) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Latitude and longitude are required'
        })
      };
    }

    if (!googleMapsApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Google Maps API key not configured'
        })
      };
    }

    // Call Google Reverse Geocoding API
    const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`;
    
    const response = await fetch(reverseGeocodeUrl);
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

      const reverseResult = {
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        types: result.types || [],
        components: components,
        location: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        }
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: reverseResult
        })
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'No address found for these coordinates'
        })
      };
    }

    // Handle other API errors
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: `Reverse geocoding failed: ${data.status}`,
        error: data.error_message || 'Unknown error'
      })
    };

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Reverse geocoding failed',
        error: error.message
      })
    };
  }
};