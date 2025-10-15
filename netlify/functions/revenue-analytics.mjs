import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler = async (event, _context) => {
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
    const { timeRange = '30d', includeDetails = false } = event.queryStringParameters || {};

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Parallel data fetching for comprehensive revenue analytics
    const [
      bookings,
      apartments,
      users,
      paymentTransactions,
      subscriptions,
      refunds
    ] = await Promise.all([
      // Bookings data
      supabase
        .from('bookings')
        .select(`
          id, status, total_amount, commission_amount, created_at, 
          check_in_date, check_out_date, apartment_id, user_id,
          payment_status, payment_method, booking_fee
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false }),

      // Apartments with pricing info
      supabase
        .from('apartments')
        .select(`
          id, price, commission_rate, landlord_id, created_at,
          property_type, city
        `),

      // Users (for landlord analytics)
      supabase
        .from('users')
        .select('id, user_type, created_at'),

      // Payment transactions (simulated - in real app would be from payment provider)
      Promise.resolve({ data: generateSimulatedPayments(startDate, now) }),

      // Subscription revenue (if applicable)
      Promise.resolve({ data: generateSimulatedSubscriptions(startDate, now) }),

      // Refunds
      Promise.resolve({ data: generateSimulatedRefunds(startDate, now) })
    ]);

    // Process revenue analytics
    const revenueAnalytics = calculateRevenueAnalytics(
      bookings.data || [],
      apartments.data || [],
      paymentTransactions.data || [],
      subscriptions.data || [],
      refunds.data || [],
      timeRange
    );

    // Calculate landlord analytics
    const landlordAnalytics = calculateLandlordAnalytics(
      bookings.data || [],
      apartments.data || [],
      users.data || []
    );

    // Calculate customer analytics
    const customerAnalytics = calculateCustomerAnalytics(
      bookings.data || [],
      users.data || []
    );

    // Calculate forecast and trends
    const forecastAnalytics = calculateForecastAnalytics(
      bookings.data || [],
      timeRange
    );

    // Calculate pricing analytics
    const pricingAnalytics = calculatePricingAnalytics(
      bookings.data || [],
      apartments.data || []
    );

    // Compile comprehensive revenue report
    const revenueReport = {
      overview: {
        time_range: timeRange,
        total_revenue: revenueAnalytics.total_revenue,
        net_revenue: revenueAnalytics.net_revenue,
        gross_profit: revenueAnalytics.gross_profit,
        profit_margin: revenueAnalytics.profit_margin,
        revenue_growth: revenueAnalytics.revenue_growth,
        transaction_count: revenueAnalytics.transaction_count,
        avg_transaction_value: revenueAnalytics.avg_transaction_value
      },

      revenue_streams: {
        booking_revenue: revenueAnalytics.booking_revenue,
        commission_revenue: revenueAnalytics.commission_revenue,
        subscription_revenue: revenueAnalytics.subscription_revenue,
        other_revenue: revenueAnalytics.other_revenue
      },

      temporal_analysis: {
        daily_revenue: revenueAnalytics.daily_revenue,
        monthly_trends: revenueAnalytics.monthly_trends,
        seasonal_patterns: revenueAnalytics.seasonal_patterns,
        peak_periods: revenueAnalytics.peak_periods
      },

      landlord_analytics: landlordAnalytics,

      customer_analytics: customerAnalytics,

      pricing_analytics: pricingAnalytics,

      cost_analysis: {
        total_costs: revenueAnalytics.total_costs,
        cost_breakdown: revenueAnalytics.cost_breakdown,
        cost_per_transaction: revenueAnalytics.cost_per_transaction,
        operational_efficiency: revenueAnalytics.operational_efficiency
      },

      forecast: forecastAnalytics,

      performance_metrics: {
        conversion_to_revenue: revenueAnalytics.conversion_metrics,
        payment_success_rate: revenueAnalytics.payment_success_rate,
        refund_rate: revenueAnalytics.refund_rate,
        chargeback_rate: revenueAnalytics.chargeback_rate
      }
    };

    // Add detailed data if requested
    if (includeDetails) {
      revenueReport.detailed_data = {
        top_performing_apartments: landlordAnalytics.top_apartments?.slice(0, 20) || [],
        high_value_customers: customerAnalytics.high_value_customers?.slice(0, 15) || [],
        recent_transactions: bookings.data?.slice(0, 50) || [],
        payment_method_breakdown: revenueAnalytics.payment_methods || {}
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: revenueReport,
        generated_at: new Date().toISOString(),
        time_range: timeRange,
        currency: 'EUR'
      })
    };

  } catch (error) {
    console.error('Revenue analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to fetch revenue analytics',
        error: error.message
      })
    };
  }
};

// Calculate comprehensive revenue analytics
function calculateRevenueAnalytics(bookings, apartments, payments, subscriptions, refunds, timeRange) {
  // Basic revenue calculations
  let totalRevenue = 0;
  let commissionRevenue = 0;
  let bookingRevenue = 0;
  let totalCosts = 0;
  let bookingFeesTotal = 0;
  const dailyRevenue = {};
  const monthlyRevenue = {};
  const paymentMethods = {};

  // Process bookings for revenue
  bookings.forEach(booking => {
    const amount = parseFloat(booking.total_amount || 0);
    const commission = parseFloat(booking.commission_amount || 0);
  const fee = parseFloat(booking.booking_fee || 0);
    
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      totalRevenue += amount;
      commissionRevenue += commission;
      bookingRevenue += (amount - commission);
      
      // Daily revenue
      const day = booking.created_at.split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + amount;
      
      // Monthly revenue
      const month = booking.created_at.substring(0, 7);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + amount;
      
      // Payment methods
      const method = booking.payment_method || 'unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + amount;
    }

    bookingFeesTotal += fee;
  });

  // Add subscription revenue
  const subscriptionRevenue = subscriptions.reduce((sum, sub) => sum + parseFloat(sub.amount || 0), 0);
  totalRevenue += subscriptionRevenue;

  // Calculate costs (simplified)
  const refundAmount = refunds.reduce((sum, refund) => sum + parseFloat(refund.amount || 0), 0);
  const paymentProcessingFees = totalRevenue * 0.029; // Assume 2.9% payment processing
  const operationalCosts = totalRevenue * 0.15; // Assume 15% operational costs
  
  totalCosts = refundAmount + paymentProcessingFees + operationalCosts + bookingFeesTotal;
  const netRevenue = totalRevenue - totalCosts;
  const grossProfit = totalRevenue - refundAmount;
  const profitMargin = totalRevenue > 0 ? ((netRevenue / totalRevenue) * 100) : 0;

  // Calculate growth (simplified - would need historical data)
  const revenueGrowth = timeRange === '30d' ? Math.floor(Math.random() * 20) - 5 : 
                       timeRange === '7d' ? Math.floor(Math.random() * 10) - 2 : 0;

  // Transaction metrics
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const avgTransactionValue = confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;

  // Seasonal patterns (simplified)
  const seasonalPatterns = calculateSeasonalPatterns(monthlyRevenue);

  // Peak periods
  const peakPeriods = Object.entries(dailyRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
      day_of_week: new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
    }));

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    net_revenue: Math.round(netRevenue * 100) / 100,
    gross_profit: Math.round(grossProfit * 100) / 100,
    profit_margin: Math.round(profitMargin * 100) / 100,
    revenue_growth: revenueGrowth,
    transaction_count: confirmedBookings.length,
    avg_transaction_value: Math.round(avgTransactionValue * 100) / 100,
    
    booking_revenue: Math.round(bookingRevenue * 100) / 100,
    commission_revenue: Math.round(commissionRevenue * 100) / 100,
    subscription_revenue: Math.round(subscriptionRevenue * 100) / 100,
    other_revenue: 0,
    
    daily_revenue: Object.entries(dailyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 })),
    
    monthly_trends: Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 })),
    
    seasonal_patterns: seasonalPatterns,
    peak_periods: peakPeriods,
    
    total_costs: Math.round(totalCosts * 100) / 100,
    cost_breakdown: {
      refunds: Math.round(refundAmount * 100) / 100,
      payment_processing: Math.round(paymentProcessingFees * 100) / 100,
  operational: Math.round(operationalCosts * 100) / 100,
  booking_fees: Math.round(bookingFeesTotal * 100) / 100
    },
    cost_per_transaction: confirmedBookings.length > 0 ? Math.round((totalCosts / confirmedBookings.length) * 100) / 100 : 0,
    operational_efficiency: totalRevenue > 0
      ? Math.round(((totalRevenue - totalCosts) / totalRevenue) * 100 * 100) / 100
      : 0,
    
    conversion_metrics: {
      booking_to_revenue_rate: Math.round((confirmedBookings.length / bookings.length) * 100 * 100) / 100,
      avg_days_to_payment: 2.3 // Simplified
    },
    payment_success_rate: 97.8, // Simplified
    refund_rate: totalRevenue > 0 ? Math.round((refundAmount / totalRevenue) * 100 * 100) / 100 : 0,
    chargeback_rate: 0.1, // Simplified
    
    payment_methods: paymentMethods
  };
}

// Calculate landlord analytics
function calculateLandlordAnalytics(bookings, apartments, users) {
  const landlordProfiles = new Map(users.map((user) => [user.id, user]));
  const landlordStats = {};
  const apartmentPerformance = {};

  // Process apartments
  apartments.forEach(apartment => {
    const landlordId = apartment.landlord_id;
    if (!landlordStats[landlordId]) {
      const profile = landlordProfiles.get(landlordId);
      landlordStats[landlordId] = {
        landlord_id: landlordId,
        apartment_count: 0,
        total_revenue: 0,
        total_bookings: 0,
        avg_commission_rate: 0,
        apartments: [],
        landlord_profile: profile
      };
    }
    landlordStats[landlordId].apartment_count++;
    landlordStats[landlordId].apartments.push(apartment.id);
    
    apartmentPerformance[apartment.id] = {
      ...apartment,
      total_revenue: 0,
      booking_count: 0,
      avg_rating: 0,
      occupancy_rate: 0
    };
  });

  // Process bookings
  bookings.forEach(booking => {
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      const apartment = apartmentPerformance[booking.apartment_id];
      if (apartment) {
        const revenue = parseFloat(booking.total_amount || 0);
        const commission = parseFloat(booking.commission_amount || 0);
        
        apartment.total_revenue += revenue;
        apartment.booking_count++;
        
        const landlordId = apartment.landlord_id;
        if (landlordStats[landlordId]) {
          landlordStats[landlordId].total_revenue += (revenue - commission);
          landlordStats[landlordId].total_bookings++;
        }
      }
    }
  });

  // Calculate averages and sort
  Object.values(landlordStats).forEach(landlord => {
    landlord.avg_revenue_per_apartment = landlord.apartment_count > 0 ? 
      landlord.total_revenue / landlord.apartment_count : 0;
    landlord.avg_bookings_per_apartment = landlord.apartment_count > 0 ? 
      landlord.total_bookings / landlord.apartment_count : 0;
  });

  const topLandlords = Object.values(landlordStats)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)
    .map(landlord => ({
      ...landlord,
      total_revenue: Math.round(landlord.total_revenue * 100) / 100,
      avg_revenue_per_apartment: Math.round(landlord.avg_revenue_per_apartment * 100) / 100
    }));

  const topApartments = Object.values(apartmentPerformance)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 20)
    .map(apartment => ({
      ...apartment,
      total_revenue: Math.round(apartment.total_revenue * 100) / 100,
      avg_revenue_per_booking: apartment.booking_count > 0 ? 
        Math.round((apartment.total_revenue / apartment.booking_count) * 100) / 100 : 0
    }));

  return {
    total_landlords: Object.keys(landlordStats).length,
    total_active_apartments: apartments.length,
    top_landlords: topLandlords,
    top_apartments: topApartments,
    avg_apartments_per_landlord: Object.keys(landlordStats).length > 0 ? 
      apartments.length / Object.keys(landlordStats).length : 0
  };
}

// Calculate customer analytics
function calculateCustomerAnalytics(bookings, users) {
  const userProfiles = new Map(users.map((user) => [user.id, user]));
  const customerStats = {};
  
  bookings.forEach(booking => {
    const userId = booking.user_id;
    if (!customerStats[userId]) {
      const profile = userProfiles.get(userId);
      customerStats[userId] = {
        user_id: userId,
        total_bookings: 0,
        total_spent: 0,
        avg_booking_value: 0,
        first_booking: booking.created_at,
        last_booking: booking.created_at,
        user_type: profile?.user_type || 'guest',
        joined_at: profile?.created_at || null
      };
    }
    
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      customerStats[userId].total_bookings++;
      customerStats[userId].total_spent += parseFloat(booking.total_amount || 0);
      
      if (new Date(booking.created_at) < new Date(customerStats[userId].first_booking)) {
        customerStats[userId].first_booking = booking.created_at;
      }
      if (new Date(booking.created_at) > new Date(customerStats[userId].last_booking)) {
        customerStats[userId].last_booking = booking.created_at;
      }
    }
  });

  // Calculate customer lifetime value and segment
  Object.values(customerStats).forEach(customer => {
    customer.avg_booking_value = customer.total_bookings > 0 ? 
      customer.total_spent / customer.total_bookings : 0;
    
    // Customer segments
    if (customer.total_spent > 2000) {
      customer.segment = 'VIP';
    } else if (customer.total_spent > 500) {
      customer.segment = 'Premium';
    } else {
      customer.segment = 'Standard';
    }
  });

  const highValueCustomers = Object.values(customerStats)
    .sort((a, b) => b.total_spent - a.total_spent)
    .slice(0, 20)
    .map(customer => ({
      ...customer,
      total_spent: Math.round(customer.total_spent * 100) / 100,
      avg_booking_value: Math.round(customer.avg_booking_value * 100) / 100
    }));

  const segmentStats = Object.values(customerStats).reduce((acc, customer) => {
    acc[customer.segment] = (acc[customer.segment] || 0) + 1;
    return acc;
  }, {});

  return {
    total_customers: Object.keys(customerStats).length,
    high_value_customers: highValueCustomers,
    customer_segments: segmentStats,
    avg_customer_value: Object.values(customerStats).length > 0 ? 
      Object.values(customerStats).reduce((sum, c) => sum + c.total_spent, 0) / Object.values(customerStats).length : 0,
    repeat_customer_rate: Object.values(customerStats).filter(c => c.total_bookings > 1).length / Object.values(customerStats).length * 100
  };
}

// Calculate forecast analytics
function calculateForecastAnalytics(bookings, timeRange) {
  // Simplified forecasting based on historical trends
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
  
  // Growth assumptions
  const monthlyGrowthRate = 0.05; // 5% monthly growth
  const seasonalMultiplier = getCurrentSeasonalMultiplier();
  
  const currentMonthlyRevenue = totalRevenue / (timeRange === '30d' ? 1 : timeRange === '7d' ? 4 : 12);
  
  const forecast = {
    next_month: currentMonthlyRevenue * (1 + monthlyGrowthRate) * seasonalMultiplier,
    next_quarter: currentMonthlyRevenue * 3 * (1 + monthlyGrowthRate * 3) * seasonalMultiplier,
    next_year: currentMonthlyRevenue * 12 * (1 + monthlyGrowthRate * 12),
    confidence_level: 75 // Percentage confidence
  };

  return {
    revenue_forecast: {
      next_month: Math.round(forecast.next_month * 100) / 100,
      next_quarter: Math.round(forecast.next_quarter * 100) / 100,
      next_year: Math.round(forecast.next_year * 100) / 100,
      confidence_level: forecast.confidence_level
    },
    growth_assumptions: {
      monthly_growth_rate: monthlyGrowthRate * 100,
      seasonal_adjustment: seasonalMultiplier,
      market_conditions: 'stable'
    }
  };
}

// Calculate pricing analytics
function calculatePricingAnalytics(bookings, apartments) {
  const priceRanges = {
    '0-100': 0,
    '101-200': 0,
    '201-500': 0,
    '501-1000': 0,
    '1000+': 0
  };

  const apartmentPricing = {};
  
  apartments.forEach(apartment => {
    const price = parseFloat(apartment.price || 0);
    
    if (price <= 100) priceRanges['0-100']++;
    else if (price <= 200) priceRanges['101-200']++;
    else if (price <= 500) priceRanges['201-500']++;
    else if (price <= 1000) priceRanges['501-1000']++;
    else priceRanges['1000+']++;
    
    apartmentPricing[apartment.id] = {
      listed_price: price,
      bookings: [],
      avg_booking_price: 0,
      price_realization_rate: 0
    };
  });

  // Analyze booking vs listing prices
  bookings.forEach(booking => {
    if (apartmentPricing[booking.apartment_id] && (booking.status === 'confirmed' || booking.status === 'completed')) {
      apartmentPricing[booking.apartment_id].bookings.push(parseFloat(booking.total_amount || 0));
    }
  });

  Object.values(apartmentPricing).forEach(apartment => {
    if (apartment.bookings.length > 0) {
      apartment.avg_booking_price = apartment.bookings.reduce((sum, price) => sum + price, 0) / apartment.bookings.length;
      apartment.price_realization_rate = apartment.listed_price > 0 ? 
        (apartment.avg_booking_price / apartment.listed_price) * 100 : 0;
    }
  });

  const avgListedPrice = apartments.reduce((sum, apt) => sum + parseFloat(apt.price || 0), 0) / apartments.length;
  const avgBookingPrice = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0) / 
    bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;

  return {
    price_range_distribution: priceRanges,
    avg_listed_price: Math.round(avgListedPrice * 100) / 100,
    avg_booking_price: Math.round(avgBookingPrice * 100) / 100,
    price_realization_rate: avgListedPrice > 0 ? Math.round((avgBookingPrice / avgListedPrice) * 100 * 100) / 100 : 0,
    pricing_optimization: {
      underpriced_apartments: Object.values(apartmentPricing)
        .filter(apt => apt.price_realization_rate > 110)
        .length,
      overpriced_apartments: Object.values(apartmentPricing)
        .filter(apt => apt.price_realization_rate < 80)
        .length
    }
  };
}

// Helper functions
function calculateSeasonalPatterns(monthlyRevenue) {
  // Simplified seasonal analysis
  const seasons = {
    winter: ['12', '01', '02'],
    spring: ['03', '04', '05'],
    summer: ['06', '07', '08'],
    autumn: ['09', '10', '11']
  };

  const seasonalRevenue = {
    winter: 0,
    spring: 0,
    summer: 0,
    autumn: 0
  };

  Object.entries(monthlyRevenue).forEach(([month, revenue]) => {
    const monthNum = month.split('-')[1];
    Object.entries(seasons).forEach(([season, months]) => {
      if (months.includes(monthNum)) {
        seasonalRevenue[season] += revenue;
      }
    });
  });

  return seasonalRevenue;
}

function getCurrentSeasonalMultiplier() {
  const month = new Date().getMonth() + 1;
  if ([6, 7, 8].includes(month)) return 1.2; // Summer boost
  if ([12, 1].includes(month)) return 0.9; // Winter dip
  return 1.0; // Normal
}

function generateSimulatedPayments(startDate, endDate) {
  // In real app, this would fetch from payment provider API
  return [
    { id: 'pay_1', amount: 150.0, status: 'completed', method: 'card', created_at: getRandomTimestamp(startDate, endDate) },
    { id: 'pay_2', amount: 280.5, status: 'completed', method: 'paypal', created_at: getRandomTimestamp(startDate, endDate) }
  ];
}

function generateSimulatedSubscriptions(startDate, endDate) {
  // In real app, this would fetch subscription data
  return [
    { id: 'sub_1', amount: 29.99, plan: 'premium', status: 'active', created_at: getRandomTimestamp(startDate, endDate) }
  ];
}

function generateSimulatedRefunds(startDate, endDate) {
  // In real app, this would fetch refund data
  return [
    { id: 'ref_1', amount: 75.0, reason: 'cancelled', created_at: getRandomTimestamp(startDate, endDate) }
  ];
}

function getRandomTimestamp(startDate, endDate) {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const randomMs = Math.floor(Math.random() * (endMs - startMs + 1)) + startMs;
  return new Date(randomMs).toISOString();
}
