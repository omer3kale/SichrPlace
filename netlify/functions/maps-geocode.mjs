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
    const { address } = JSON.parse(event.body);

    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Address is required'
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

    // Call Google Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
    
    const response = await fetch(geocodeUrl);
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: geocodeResult
        })
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Address not found'
        })
      };
    }

    // Handle other API errors
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: `Geocoding failed: ${data.status}`,
        error: data.error_message || 'Unknown error'
      })
    };

  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Geocoding failed',
        error: error.message
      })
    };
  }
};