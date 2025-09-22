export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const marketplaceData = {
      timestamp: new Date().toISOString(),
      marketplace_status: 'active',
      vendor_management: {
        total_vendors: 145,
        active_vendors: 132,
        pending_approval: 8,
        vendor_rating_avg: 4.6
      },
      service_categories: [
        { category: 'cleaning', vendors: 45, avg_rating: 4.7 },
        { category: 'maintenance', vendors: 32, avg_rating: 4.5 },
        { category: 'landscaping', vendors: 28, avg_rating: 4.6 },
        { category: 'security', vendors: 18, avg_rating: 4.8 },
        { category: 'interior_design', vendors: 22, avg_rating: 4.4 }
      ],
      booking_stats: {
        total_bookings: 2450,
        completed_services: 2380,
        cancelled_bookings: 45,
        average_service_cost: 125,
        customer_satisfaction: 4.6
      },
      commission_structure: {
        standard_rate: '15%',
        premium_vendors: '12%',
        volume_discounts: 'available',
        payment_terms: 'net_7'
      }
    };

    if (event.httpMethod === 'POST') {
      const { action, marketplace_config } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'register_vendor':
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              vendor_id: `vendor_${Date.now()}`,
              application_id: `app_${Date.now()}`,
              status: 'pending_verification',
              verification_steps: ['documents', 'background_check', 'insurance_verification']
            })
          };
          
        case 'book_service':
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              booking_id: `booking_${Date.now()}`,
              vendor_id: marketplace_config.vendor_id,
              service_date: marketplace_config.service_date,
              estimated_cost: marketplace_config.estimated_cost,
              status: 'confirmed'
            })
          };
          
        case 'rate_service':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              review_id: `review_${Date.now()}`,
              booking_id: marketplace_config.booking_id,
              rating: marketplace_config.rating,
              review_status: 'published'
            })
          };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: marketplaceData,
        message: 'Service marketplace data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Service marketplace failed',
        message: error.message
      })
    };
  }
};