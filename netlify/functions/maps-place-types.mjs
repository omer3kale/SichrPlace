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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
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

    // Get supported place types with descriptions
    const placeTypes = [
      // Accommodation
      { 
        type: 'lodging', 
        category: 'Accommodation',
        description: 'Hotels, motels, hostels, and other lodging establishments',
        icon: '🏨'
      },
      
      // Food & Dining
      { 
        type: 'restaurant', 
        category: 'Food & Dining',
        description: 'Restaurants and eateries',
        icon: '🍽️'
      },
      { 
        type: 'meal_takeaway', 
        category: 'Food & Dining',
        description: 'Takeaway and delivery food establishments',
        icon: '🥡'
      },
      { 
        type: 'cafe', 
        category: 'Food & Dining',
        description: 'Coffee shops and cafes',
        icon: '☕'
      },
      { 
        type: 'bar', 
        category: 'Food & Dining',
        description: 'Bars and pubs',
        icon: '🍺'
      },
      { 
        type: 'bakery', 
        category: 'Food & Dining',
        description: 'Bakeries and pastry shops',
        icon: '🥖'
      },

      // Shopping
      { 
        type: 'shopping_mall', 
        category: 'Shopping',
        description: 'Shopping centers and malls',
        icon: '🛍️'
      },
      { 
        type: 'supermarket', 
        category: 'Shopping',
        description: 'Supermarkets and grocery stores',
        icon: '🛒'
      },
      { 
        type: 'convenience_store', 
        category: 'Shopping',
        description: 'Convenience stores',
        icon: '🏪'
      },
      { 
        type: 'clothing_store', 
        category: 'Shopping',
        description: 'Clothing and fashion stores',
        icon: '👗'
      },
      { 
        type: 'pharmacy', 
        category: 'Shopping',
        description: 'Pharmacies and drugstores',
        icon: '💊'
      },

      // Transportation
      { 
        type: 'gas_station', 
        category: 'Transportation',
        description: 'Gas stations and fuel stops',
        icon: '⛽'
      },
      { 
        type: 'subway_station', 
        category: 'Transportation',
        description: 'Subway and metro stations',
        icon: '🚇'
      },
      { 
        type: 'bus_station', 
        category: 'Transportation',
        description: 'Bus stations and stops',
        icon: '🚌'
      },
      { 
        type: 'train_station', 
        category: 'Transportation',
        description: 'Train stations',
        icon: '🚂'
      },
      { 
        type: 'airport', 
        category: 'Transportation',
        description: 'Airports',
        icon: '✈️'
      },
      { 
        type: 'taxi_stand', 
        category: 'Transportation',
        description: 'Taxi stands',
        icon: '🚕'
      },

      // Health & Medical
      { 
        type: 'hospital', 
        category: 'Health & Medical',
        description: 'Hospitals and medical centers',
        icon: '🏥'
      },
      { 
        type: 'doctor', 
        category: 'Health & Medical',
        description: 'Doctors and medical practitioners',
        icon: '👨‍⚕️'
      },
      { 
        type: 'dentist', 
        category: 'Health & Medical',
        description: 'Dental clinics and dentists',
        icon: '🦷'
      },
      { 
        type: 'veterinary_care', 
        category: 'Health & Medical',
        description: 'Veterinary clinics and animal hospitals',
        icon: '🐕‍🦺'
      },

      // Education
      { 
        type: 'school', 
        category: 'Education',
        description: 'Primary and secondary schools',
        icon: '🏫'
      },
      { 
        type: 'university', 
        category: 'Education',
        description: 'Universities and colleges',
        icon: '🎓'
      },
      { 
        type: 'library', 
        category: 'Education',
        description: 'Libraries',
        icon: '📚'
      },

      // Finance
      { 
        type: 'bank', 
        category: 'Finance',
        description: 'Banks and financial institutions',
        icon: '🏦'
      },
      { 
        type: 'atm', 
        category: 'Finance',
        description: 'ATM machines',
        icon: '🏧'
      },

      // Entertainment & Recreation
      { 
        type: 'amusement_park', 
        category: 'Entertainment & Recreation',
        description: 'Amusement parks and theme parks',
        icon: '🎢'
      },
      { 
        type: 'movie_theater', 
        category: 'Entertainment & Recreation',
        description: 'Cinemas and movie theaters',
        icon: '🎬'
      },
      { 
        type: 'gym', 
        category: 'Entertainment & Recreation',
        description: 'Gyms and fitness centers',
        icon: '💪'
      },
      { 
        type: 'park', 
        category: 'Entertainment & Recreation',
        description: 'Parks and recreational areas',
        icon: '🌳'
      },
      { 
        type: 'zoo', 
        category: 'Entertainment & Recreation',
        description: 'Zoos and wildlife parks',
        icon: '🦁'
      },
      { 
        type: 'spa', 
        category: 'Entertainment & Recreation',
        description: 'Spas and wellness centers',
        icon: '💆'
      },

      // Tourism & Culture
      { 
        type: 'tourist_attraction', 
        category: 'Tourism & Culture',
        description: 'Tourist attractions and landmarks',
        icon: '🏛️'
      },
      { 
        type: 'museum', 
        category: 'Tourism & Culture',
        description: 'Museums and galleries',
        icon: '🖼️'
      },
      { 
        type: 'church', 
        category: 'Tourism & Culture',
        description: 'Churches and religious sites',
        icon: '⛪'
      },

      // Services
      { 
        type: 'post_office', 
        category: 'Services',
        description: 'Post offices and postal services',
        icon: '📮'
      },
      { 
        type: 'police', 
        category: 'Services',
        description: 'Police stations',
        icon: '👮'
      },
      { 
        type: 'fire_station', 
        category: 'Services',
        description: 'Fire stations',
        icon: '🚒'
      },
      { 
        type: 'laundry', 
        category: 'Services',
        description: 'Laundromats and dry cleaners',
        icon: '🧺'
      },
      { 
        type: 'beauty_salon', 
        category: 'Services',
        description: 'Beauty salons and barbershops',
        icon: '💇'
      },
      { 
        type: 'car_repair', 
        category: 'Services',
        description: 'Auto repair shops',
        icon: '🔧'
      },

      // General
      { 
        type: 'establishment', 
        category: 'General',
        description: 'General establishments and businesses',
        icon: '🏢'
      },
      { 
        type: 'point_of_interest', 
        category: 'General',
        description: 'Points of interest',
        icon: '📍'
      }
    ];

    // Group by category
    const groupedPlaceTypes = placeTypes.reduce((acc, place) => {
      if (!acc[place.category]) {
        acc[place.category] = [];
      }
      acc[place.category].push({
        type: place.type,
        description: place.description,
        icon: place.icon
      });
      return acc;
    }, {});

    // Add usage examples and tips
    const usageExamples = [
      {
        example: "Search for restaurants within 1km",
        request: {
          type: "restaurant",
          radius: 1000,
          location: { lat: 52.5200, lng: 13.4050 }
        }
      },
      {
        example: "Find nearby supermarkets and convenience stores",
        request: {
          type: "supermarket|convenience_store",
          radius: 2000,
          location: { lat: 52.5200, lng: 13.4050 }
        }
      },
      {
        example: "Search for highly rated cafes",
        request: {
          type: "cafe",
          radius: 1500,
          minRating: 4.0,
          location: { lat: 52.5200, lng: 13.4050 }
        }
      }
    ];

    const tips = [
      "Use multiple types by separating them with | (pipe) character",
      "Specify minRating parameter to filter by rating (1.0 to 5.0)",
      "Radius is in meters (max 50,000m for most types)",
      "Some types may have limited results depending on location",
      "Combine with rankby=distance for closest results first",
      "Use keyword parameter for additional filtering by name or description"
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          place_types: groupedPlaceTypes,
          total_types: placeTypes.length,
          usage_examples: usageExamples,
          tips: tips,
          api_info: {
            max_radius: 50000,
            supported_regions: "Worldwide",
            rate_limits: "Standard Google Maps API limits apply",
            required_params: ["location", "type"],
            optional_params: ["radius", "minRating", "keyword", "rankby", "opennow"]
          }
        }
      })
    };

  } catch (error) {
    console.error('Place types retrieval error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to retrieve place types',
        error: error.message
      })
    };
  }
};