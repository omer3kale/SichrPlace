const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  throw new Error('GOOGLE_MAPS_API_KEY environment variable is required for maps-distance function');
}

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Authorization',
});

const respond = (statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(),
  body: JSON.stringify(payload),
});

const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    if (typeof body === 'object') {
      return body;
    }
    return JSON.parse(body);
  } catch (error) {
    throw httpError(400, 'Request body must be valid JSON');
  }
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const httpError = (status, message, details = null) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

export const handler = async (event, context) => {
  console.log('Maps distance handler called:', {
    method: event.httpMethod,
    path: event.path
  });

  if (event.httpMethod === 'OPTIONS') {
    return respond(200, '');
  }

  if (event.httpMethod !== 'POST') {
    throw httpError(405, 'Method not allowed');
  }

  try {
    const payload = parseRequestBody(event.body);
    const { 
      origin, 
      destination, 
      mode = 'driving', 
      language = 'en',
      units = 'metric',
      avoid = [],
      departure_time = null,
      arrival_time = null
    } = payload;

    // Validate required fields
    const sanitizedOrigin = sanitizeString(origin, { maxLength: 500, allowEmpty: false });
    const sanitizedDestination = sanitizeString(destination, { maxLength: 500, allowEmpty: false });

    if (!sanitizedOrigin || !sanitizedDestination) {
      throw httpError(400, 'Origin and destination are required');
    }

    // Validate travel mode
    const allowedModes = ['driving', 'walking', 'bicycling', 'transit'];
    const sanitizedMode = allowedModes.includes(mode) ? mode : 'driving';
    
    // Validate units
    const allowedUnits = ['metric', 'imperial'];
    const sanitizedUnits = allowedUnits.includes(units) ? units : 'metric';
    
    // Validate language
    const sanitizedLanguage = sanitizeString(language, { maxLength: 10, allowEmpty: false }) || 'en';
    
    // Validate avoid array
    const allowedAvoid = ['tolls', 'highways', 'ferries', 'indoor'];
    const sanitizedAvoid = Array.isArray(avoid) ? avoid.filter(item => allowedAvoid.includes(item)) : [];

    // Convert locations to proper format
    const originStr = typeof sanitizedOrigin === 'object' ? `${sanitizedOrigin.lat},${sanitizedOrigin.lng}` : sanitizedOrigin;
    const destinationStr = typeof sanitizedDestination === 'object' ? `${sanitizedDestination.lat},${sanitizedDestination.lng}` : sanitizedDestination;

    // Build Directions API URL
    let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}&mode=${sanitizedMode}&units=${sanitizedUnits}&language=${sanitizedLanguage}&key=${googleMapsApiKey}`;
    
    // Add avoid parameters
    if (sanitizedAvoid.length > 0) {
      directionsUrl += `&avoid=${sanitizedAvoid.join('|')}`;
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

      return respond(200, {
        success: true,
        data: {
          routes: routes,
          distance_matrix: distanceMatrix,
          search_params: {
            origin: originStr,
            destination: destinationStr,
            mode: sanitizedMode,
            units: sanitizedUnits,
            avoid: sanitizedAvoid
          },
          status: data.status
        }
      });
    }

    if (data.status === 'ZERO_RESULTS') {
      throw httpError(404, 'No route found between the specified locations');
    }

    // Handle other API errors
    throw httpError(400, `Directions request failed: ${data.status}`, {
      google_maps_error: data.error_message || 'Unknown Google Maps API error',
      status: data.status
    });

  } catch (error) {
    console.error('Maps distance handler error:', error);

    const status = error.status || 500;
    const message = status === 500 ? 'Distance calculation failed' : error.message;
    
    const errorResponse = {
      success: false,
      error: message
    };

    if (error.details && status !== 500) {
      errorResponse.details = error.details;
    }

    if (status === 500 && process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details || error.message;
    }

    return respond(status, errorResponse);
  }
};