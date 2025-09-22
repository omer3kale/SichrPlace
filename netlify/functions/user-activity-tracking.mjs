import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
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

  try {
    const { action, timeRange = '24h' } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: ['track', 'get_stats', 'get_popular_pages', 'get_user_journey']
        })
      };
    }

    // Get authentication from header if available
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          userId = user.id;
        }
      } catch (authError) {
        console.warn('Auth token parsing failed:', authError.message);
      }
    }

    switch (action) {
      case 'track':
        return await trackUserActivity(event, headers, userId);
      
      case 'get_stats':
        return await getUserActivityStats(headers, timeRange);
      
      case 'get_popular_pages':
        return await getPopularPages(headers, timeRange);
      
      case 'get_user_journey':
        return await getUserJourney(headers, userId, timeRange);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified',
            available_actions: ['track', 'get_stats', 'get_popular_pages', 'get_user_journey']
          })
        };
    }

  } catch (error) {
    console.error('User activity tracking error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'User activity tracking failed',
        error: error.message
      })
    };
  }
};

// Track user activity
async function trackUserActivity(event, headers, userId) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'POST method required for tracking' })
    };
  }

  try {
    const {
      action,
      page_url,
      page_title,
      referrer,
      user_agent,
      session_id,
      metadata = {}
    } = JSON.parse(event.body);

    if (!action || !page_url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action and page_url are required for tracking'
        })
      };
    }

    // Extract IP address for location tracking
    const clientIP = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    event.requestContext?.identity?.sourceIp || 
                    'unknown';

    // Parse user agent for device info
    const deviceInfo = parseUserAgent(user_agent || '');

    // Prepare activity data
    const activityData = {
      user_id: userId,
      session_id: session_id || generateSessionId(),
      action: action,
      page_url: page_url,
      page_title: page_title || extractPageTitle(page_url),
      referrer: referrer || null,
      user_agent: user_agent || null,
      ip_address: clientIP,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      operating_system: deviceInfo.os,
      metadata: metadata,
      created_at: new Date().toISOString()
    };

    // Insert activity record
    const { data, error } = await supabase
      .from('user_activity')
      .insert([activityData])
      .select('id');

    if (error) {
      console.error('Failed to track activity:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Failed to track user activity',
          error: error.message
        })
      };
    }

    // Update session info if user is logged in
    if (userId) {
      await supabase
        .from('user_sessions')
        .upsert([{
          user_id: userId,
          session_id: activityData.session_id,
          last_activity: new Date().toISOString(),
          ip_address: clientIP,
          user_agent: user_agent,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'session_id',
          ignoreDuplicates: false
        });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Activity tracked successfully',
        activity_id: data[0]?.id,
        session_id: activityData.session_id
      })
    };

  } catch (parseError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid request body',
        error: parseError.message
      })
    };
  }
}

// Get user activity statistics
async function getUserActivityStats(headers, timeRange) {
  try {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '1h':
        startDate.setHours(now.getHours() - 1);
        break;
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setHours(now.getHours() - 24);
    }

    // Get activity statistics
    const { data: activities, error } = await supabase
      .from('user_activity')
      .select('action, page_url, device_type, browser, created_at, user_id, session_id')
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    // Process statistics
    const stats = {
      total_activities: activities.length,
      unique_users: new Set(activities.filter(a => a.user_id).map(a => a.user_id)).size,
      unique_sessions: new Set(activities.map(a => a.session_id)).size,
      time_range: timeRange,
      generated_at: new Date().toISOString()
    };

    // Activity breakdown
    const actionCounts = {};
    const deviceCounts = {};
    const browserCounts = {};
    const hourlyActivity = {};

    activities.forEach(activity => {
      // Actions
      actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
      
      // Devices
      deviceCounts[activity.device_type || 'unknown'] = 
        (deviceCounts[activity.device_type || 'unknown'] || 0) + 1;
      
      // Browsers
      browserCounts[activity.browser || 'unknown'] = 
        (browserCounts[activity.browser || 'unknown'] || 0) + 1;
      
      // Hourly breakdown
      const hour = new Date(activity.created_at).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    stats.breakdown = {
      by_action: actionCounts,
      by_device: deviceCounts,
      by_browser: browserCounts,
      by_hour: hourlyActivity
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: stats
      })
    };

  } catch (error) {
    throw error;
  }
}

// Get popular pages
async function getPopularPages(headers, timeRange) {
  try {
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
      default:
        startDate.setHours(now.getHours() - 24);
    }

    const { data: pageViews, error } = await supabase
      .from('user_activity')
      .select('page_url, page_title, created_at, user_id')
      .eq('action', 'page_view')
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    // Process page statistics
    const pageStats = {};
    
    pageViews.forEach(view => {
      const url = view.page_url;
      if (!pageStats[url]) {
        pageStats[url] = {
          url: url,
          title: view.page_title || extractPageTitle(url),
          total_views: 0,
          unique_visitors: new Set(),
          last_viewed: view.created_at
        };
      }
      
      pageStats[url].total_views++;
      if (view.user_id) {
        pageStats[url].unique_visitors.add(view.user_id);
      }
      
      if (new Date(view.created_at) > new Date(pageStats[url].last_viewed)) {
        pageStats[url].last_viewed = view.created_at;
      }
    });

    // Convert to array and sort by popularity
    const popularPages = Object.values(pageStats)
      .map(page => ({
        ...page,
        unique_visitors: page.unique_visitors.size
      }))
      .sort((a, b) => b.total_views - a.total_views)
      .slice(0, 20);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          popular_pages: popularPages,
          total_pages: Object.keys(pageStats).length,
          time_range: timeRange,
          generated_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    throw error;
  }
}

// Get user journey
async function getUserJourney(headers, userId, timeRange) {
  try {
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required for journey tracking'
        })
      };
    }

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
      default:
        startDate.setHours(now.getHours() - 24);
    }

    const { data: userActivities, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Group activities by session
    const sessions = {};
    userActivities.forEach(activity => {
      const sessionId = activity.session_id;
      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          session_id: sessionId,
          start_time: activity.created_at,
          end_time: activity.created_at,
          activities: [],
          pages_visited: new Set(),
          actions_performed: new Set()
        };
      }
      
      sessions[sessionId].activities.push(activity);
      sessions[sessionId].pages_visited.add(activity.page_url);
      sessions[sessionId].actions_performed.add(activity.action);
      
      if (new Date(activity.created_at) > new Date(sessions[sessionId].end_time)) {
        sessions[sessionId].end_time = activity.created_at;
      }
    });

    // Calculate session durations and convert sets to arrays
    const userJourney = Object.values(sessions).map(session => ({
      ...session,
      duration_minutes: Math.round(
        (new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)
      ),
      pages_visited: Array.from(session.pages_visited),
      actions_performed: Array.from(session.actions_performed),
      total_activities: session.activities.length
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          user_id: userId,
          sessions: userJourney,
          total_sessions: userJourney.length,
          total_activities: userActivities.length,
          time_range: timeRange,
          generated_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    throw error;
  }
}

// Helper functions
function parseUserAgent(userAgent) {
  const ua = userAgent.toLowerCase();
  
  let browser = 'unknown';
  let device_type = 'unknown';
  let os = 'unknown';
  
  // Browser detection
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Device type detection
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device_type = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'tablet';
  } else {
    device_type = 'desktop';
  }
  
  // OS detection
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  return { browser, device_type, os };
}

function extractPageTitle(url) {
  const path = new URL(url).pathname;
  return path.split('/').filter(Boolean).join(' > ') || 'Home';
}

function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}