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
    const { 
      origin, 
      destination, 
      mode = 'driving', 
      language = 'en',
      units = 'metric',
      avoid = [],
      departure_time = null,
      arrival_time = null
    } = JSON.parse(event.body);

    if (!origin || !destination) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Origin and destination are required'
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

    // Convert locations to proper format
    const originStr = typeof origin === 'object' ? `${origin.lat},${origin.lng}` : origin;
    const destinationStr = typeof destination === 'object' ? `${destination.lat},${destination.lng}` : destination;

    // Build Directions API URL
    let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}&mode=${mode}&units=${units}&language=${language}&key=${googleMapsApiKey}`;
    
    // Add avoid parameters
    if (avoid.length > 0) {
      directionsUrl += `&avoid=${avoid.join('|')}`;
    }

    // Add departure time for transit/driving
    if (departure_time && (mode === 'transit' || mode === 'driving')) {
      directionsUrl += `&departure_time=${departure_time}`;
    }

    // Add arrival time for transit
    if (arrival_time && mode === 'transit') {
      directionsUrl += `&arrival_time=${arrival_time}`;
    }

    // Add alternatives
    directionsUrl += '&alternatives=true';

    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (data.status === 'OK') {
      const routes = data.routes.map((route, index) => {
        const leg = route.legs[0]; // For simplicity, take the first leg
        
        return {
          route_index: index,
          summary: route.summary,
          distance: {
            text: leg.distance.text,
            value: leg.distance.value // in meters
          },
          duration: {
            text: leg.duration.text,
            value: leg.duration.value // in seconds
          },
          duration_in_traffic: leg.duration_in_traffic ? {
            text: leg.duration_in_traffic.text,
            value: leg.duration_in_traffic.value
          } : null,
          start_address: leg.start_address,
          end_address: leg.end_address,
          start_location: leg.start_location,
          end_location: leg.end_location,
          steps: leg.steps.map(step => ({
            distance: step.distance,
            duration: step.duration,
            instructions: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML
            travel_mode: step.travel_mode,
            start_location: step.start_location,
            end_location: step.end_location,
            polyline: step.polyline
          })),
          overview_polyline: route.overview_polyline,
          warnings: route.warnings || [],
          waypoint_order: route.waypoint_order || []
        };
      });

      // Also get distance matrix for additional info
      const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originStr)}&destinations=${encodeURIComponent(destinationStr)}&mode=${mode}&units=${units}&key=${googleMapsApiKey}`;
      
      const distanceResponse = await fetch(distanceMatrixUrl);
      const distanceData = await distanceResponse.json();

      let distanceMatrix = null;
      if (distanceData.status === 'OK' && distanceData.rows[0].elements[0].status === 'OK') {
        const element = distanceData.rows[0].elements[0];
        distanceMatrix = {
          distance: element.distance,
          duration: element.duration,
          duration_in_traffic: element.duration_in_traffic || null
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            routes: routes,
            distance_matrix: distanceMatrix,
            search_params: {
              origin: originStr,
              destination: destinationStr,
              mode: mode,
              units: units,
              avoid: avoid
            },
            status: data.status
          }
        })
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'No route found between the specified locations'
        })
      };
    }

    // Handle other API errors
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: `Directions request failed: ${data.status}`,
        error: data.error_message || 'Unknown error'
      })
    };

  } catch (error) {
    console.error('Distance calculation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Distance calculation failed',
        error: error.message
      })
    };
  }
};