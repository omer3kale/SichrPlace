import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

if (!googleMapsApiKey) {
  console.error('GOOGLE_MAPS_API_KEY environment variable is not set');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      location, 
      radius = 5000, 
      priceRange = {}, 
      bedrooms = null,
      bathrooms = null,
      propertyType = null,
      amenities = [],
      furnished = null,
      sortBy = 'distance',
      limit = 20
    } = JSON.parse(event.body);

    if (!location || !location.lat || !location.lng) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Location with lat and lng is required'
        })
      };
    }

    // Build apartment search query
    let query = supabase
      .from('apartments')
      .select(`
        *,
        landlord:users!apartments_landlord_id_fkey(username, full_name, phone),
        images:apartment_images(url, is_main),
        reviews:apartment_reviews(rating, comment, created_at, user:users(username))
      `)
      .eq('status', 'active');

    // Apply filters
    if (priceRange.min) {
      query = query.gte('price', priceRange.min);
    }
    if (priceRange.max) {
      query = query.lte('price', priceRange.max);
    }
    if (bedrooms) {
      query = query.eq('bedrooms', bedrooms);
    }
    if (bathrooms) {
      query = query.gte('bathrooms', bathrooms);
    }
    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }
    if (furnished !== null) {
      query = query.eq('furnished', furnished);
    }

    // Execute query
    const { data: apartments, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Database query failed'
        })
      };
    }

    // Filter by location radius and calculate distances
    const apartmentsWithDistance = [];
    
    for (const apartment of apartments) {
      if (!apartment.latitude || !apartment.longitude) {
        continue; // Skip apartments without coordinates
      }

      // Calculate distance
      const distance = calculateDistance(
        location.lat,
        location.lng,
        apartment.latitude,
        apartment.longitude
      );

      // Check if within radius
      if (distance <= radius / 1000) { // Convert radius to km
        // Filter by amenities if specified
        if (amenities.length > 0) {
          const apartmentAmenities = apartment.amenities || [];
          const hasAllAmenities = amenities.every(amenity => 
            apartmentAmenities.some(aptAmenity => 
              aptAmenity.toLowerCase().includes(amenity.toLowerCase())
            )
          );
          if (!hasAllAmenities) {
            continue;
          }
        }

        apartmentsWithDistance.push({
          ...apartment,
          distance_km: Math.round(distance * 100) / 100,
          distance_text: distance < 1 
            ? `${Math.round(distance * 1000)}m` 
            : `${Math.round(distance * 10) / 10}km`
        });
      }
    }

    // Sort apartments
    if (sortBy === 'distance') {
      apartmentsWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    } else if (sortBy === 'price_low') {
      apartmentsWithDistance.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_high') {
      apartmentsWithDistance.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      apartmentsWithDistance.sort((a, b) => {
        const avgRatingA = calculateAverageRating(a.reviews);
        const avgRatingB = calculateAverageRating(b.reviews);
        return avgRatingB - avgRatingA;
      });
    }

    // Limit results
    const limitedResults = apartmentsWithDistance.slice(0, limit);

    // Enhance with Google Maps data if API key is available
    if (googleMapsApiKey && limitedResults.length > 0) {
      // Get nearby places for the search location
      const nearbyPlacesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=2000&type=establishment&key=${googleMapsApiKey}`;
      
      try {
        const placesResponse = await fetch(nearbyPlacesUrl);
        const placesData = await placesResponse.json();
        
        if (placesData.status === 'OK') {
          // Add nearby amenities info to the response
          const nearbyAmenities = placesData.results
            .filter(place => place.rating && place.rating >= 4.0)
            .slice(0, 10)
            .map(place => ({
              name: place.name,
              type: place.types[0],
              rating: place.rating,
              distance: calculateDistance(
                location.lat, location.lng,
                place.geometry.location.lat, place.geometry.location.lng
              )
            }));

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              data: {
                apartments: limitedResults,
                total_found: apartmentsWithDistance.length,
                search_center: location,
                radius_km: radius / 1000,
                nearby_amenities: nearbyAmenities,
                search_params: {
                  location,
                  radius,
                  priceRange,
                  bedrooms,
                  bathrooms,
                  propertyType,
                  amenities,
                  furnished,
                  sortBy
                }
              }
            })
          };
        }
      } catch (placesError) {
        console.warn('Could not fetch nearby places:', placesError.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          apartments: limitedResults,
          total_found: apartmentsWithDistance.length,
          search_center: location,
          radius_km: radius / 1000,
          search_params: {
            location,
            radius,
            priceRange,
            bedrooms,
            bathrooms,
            propertyType,
            amenities,
            furnished,
            sortBy
          }
        }
      })
    };

  } catch (error) {
    console.error('Location-based search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Location-based search failed',
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

function calculateAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + (review.rating || 0), 0);
  return sum / reviews.length;
}