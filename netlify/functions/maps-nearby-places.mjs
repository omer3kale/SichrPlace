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
      lat, 
      lng, 
      radius = 1000, 
      types = [], 
      keyword = '',
      minRating = 0, 
      openNow = false,
      language = 'en' 
    } = JSON.parse(event.body);

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

    // Build Places API URL
    let placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${googleMapsApiKey}&language=${language}`;
    
    // Add type filter if specified
    if (types.length > 0) {
      placesUrl += `&type=${types.join('|')}`;
    }

    // Add keyword filter if specified
    if (keyword) {
      placesUrl += `&keyword=${encodeURIComponent(keyword)}`;
    }

    // Add minimum rating filter
    if (minRating > 0) {
      placesUrl += `&minprice=${minRating}`;
    }

    // Add open now filter
    if (openNow) {
      placesUrl += `&opennow=true`;
    }

    const response = await fetch(placesUrl);
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
      if (minRating > 0) {
        places = places.filter(place => place.rating && place.rating >= minRating);
      }

      // Calculate distances from the search point
      places = places.map(place => {
        const distance = calculateDistance(
          lat, lng,
          place.location.lat, place.location.lng
        );
        return {
          ...place,
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      });

      // Sort by distance
      places.sort((a, b) => a.distance - b.distance);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            places: places,
            search_params: {
              location: { lat: parseFloat(lat), lng: parseFloat(lng) },
              radius: parseInt(radius),
              types: types,
              keyword: keyword,
              min_rating: minRating,
              open_now: openNow
            },
            next_page_token: data.next_page_token || null
          }
        })
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            places: [],
            message: 'No places found in the specified area'
          }
        })
      };
    }

    // Handle other API errors
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: `Places search failed: ${data.status}`,
        error: data.error_message || 'Unknown error'
      })
    };

  } catch (error) {
    console.error('Nearby places search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Nearby places search failed',
        error: error.message
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