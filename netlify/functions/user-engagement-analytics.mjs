import { handler as userActivityHandler } from './user-activity-tracking.mjs';

export const handler = async (event) => userActivityHandler(event);

/* Legacy implementation retained for reference
  }

    // Categorize features
    const featureCategories = {
      search: ['search', 'filter_search', 'save_search'],
      apartment: ['view_apartment', 'favorite_apartment', 'contact_landlord'],
      profile: ['update_profile', 'change_password', 'upload_avatar'],
      messaging: ['send_message', 'read_message', 'create_conversation'],
      booking: ['start_booking', 'complete_booking', 'cancel_booking'],
      reviews: ['write_review', 'edit_review', 'delete_review']
    };

    const usage = {};
    const userEngagement = {};

    activity?.forEach(action => {
      // Count overall usage
      usage[action.action] = (usage[action.action] || 0) + 1;

      // Track unique users per feature
      if (!userEngagement[action.action]) {
        userEngagement[action.action] = new Set();
      }
      if (action.user_id) {
        userEngagement[action.action].add(action.user_id);
      }
    });

    // Convert sets to counts
    Object.keys(userEngagement).forEach(action => {
      userEngagement[action] = userEngagement[action].size;
    });

    // Group by categories
    const categoryUsage = {};
    Object.entries(featureCategories).forEach(([category, actions]) => {
      categoryUsage[category] = {
        total_usage: actions.reduce((sum, action) => sum + (usage[action] || 0), 0),
        unique_users: actions.reduce((sum, action) => sum + (userEngagement[action] || 0), 0),
        features: actions.map(action => ({
          action,
          usage: usage[action] || 0,
          unique_users: userEngagement[action] || 0
        }))
      };
    });

    // Most popular features
    const popularFeatures = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({
        action,
        usage_count: count,
        unique_users: userEngagement[action] || 0
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          feature_usage: usage,
          user_engagement: userEngagement,
          category_breakdown: categoryUsage,
          popular_features: popularFeatures,
          total_actions: activity?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get feature usage error:', error);
    throw error;
  }
}

// Get retention and churn analysis
async function getRetentionChurn(queryParams, headers) {
  try {
    const {
      cohort_period = '30',
      start_date,
      end_date
    } = queryParams || {};

    const cohortDays = parseInt(cohort_period);
    
    // Get users with their registration dates
    let userQuery = supabase
      .from('users')
      .select('id, created_at');

    if (start_date) {
      userQuery = userQuery.gte('created_at', start_date);
    }

    if (end_date) {
      userQuery = userQuery.lte('created_at', end_date);
    }

    const { data: users, error: usersError } = await userQuery;

    if (usersError) {
      throw usersError;
    }

    const retentionData = {
      total_users: users?.length || 0,
      retained_users: 0,
      churned_users: 0,
      retention_rate: 0,
      churn_rate: 0,
      cohort_analysis: {}
    };

    // For each user, check if they have activity after the cohort period
    let retainedCount = 0;
    const now = new Date();

    for (const user of users || []) {
      const registrationDate = new Date(user.created_at);
      const cohortEndDate = new Date(registrationDate.getTime() + cohortDays * 24 * 60 * 60 * 1000);

      // Only analyze users who have passed the cohort period
      if (cohortEndDate <= now) {
        const { data: activity, error: activityError } = await supabase
          .from('user_activity')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', cohortEndDate.toISOString())
          .limit(1);

        if (!activityError && activity && activity.length > 0) {
          retainedCount++;
        }
      }
    }

    const eligibleUsers = users?.filter(user => {
      const registrationDate = new Date(user.created_at);
      const cohortEndDate = new Date(registrationDate.getTime() + cohortDays * 24 * 60 * 60 * 1000);
      return cohortEndDate <= now;
    }) || [];

    retentionData.retained_users = retainedCount;
    retentionData.churned_users = eligibleUsers.length - retainedCount;
    retentionData.retention_rate = eligibleUsers.length > 0 ? 
      Math.round((retainedCount / eligibleUsers.length) * 100 * 100) / 100 : 0;
    retentionData.churn_rate = 100 - retentionData.retention_rate;

    // Monthly cohort analysis
    const monthlyCohortsData = {};
    eligibleUsers.forEach(user => {
      const month = user.created_at.slice(0, 7); // YYYY-MM
      if (!monthlyCohortsData[month]) {
        monthlyCohortsData[month] = { total: 0, retained: 0 };
      }
      monthlyCohortsData[month].total++;
    });

    // Calculate retention for each monthly cohort
    for (const [month, cohort] of Object.entries(monthlyCohortsData)) {
      const monthUsers = eligibleUsers.filter(u => u.created_at.startsWith(month));
      let monthRetained = 0;

      for (const user of monthUsers) {
        const registrationDate = new Date(user.created_at);
        const cohortEndDate = new Date(registrationDate.getTime() + cohortDays * 24 * 60 * 60 * 1000);

        const { data: activity } = await supabase
          .from('user_activity')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', cohortEndDate.toISOString())
          .limit(1);

        if (activity && activity.length > 0) {
          monthRetained++;
        }
      }

      cohort.retained = monthRetained;
      cohort.retention_rate = cohort.total > 0 ? 
        Math.round((monthRetained / cohort.total) * 100 * 100) / 100 : 0;
    }

    retentionData.cohort_analysis = monthlyCohortsData;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: retentionData,
        analysis_period: `${cohortDays} days`,
        eligible_users_analyzed: eligibleUsers.length
      })
    };

  } catch (error) {
    console.error('Get retention churn error:', error);
    throw error;
  }
}

// Continue with additional analytics functions...
// (I'll implement the remaining functions in the next part)

// Get funnel analysis
async function getFunnelAnalysis(queryParams, headers) {
  try {
    const funnelSteps = [
      { name: 'Registration', action: 'user_registered' },
      { name: 'Profile Complete', action: 'profile_completed' },
      { name: 'First Search', action: 'search' },
      { name: 'Apartment View', action: 'view_apartment' },
      { name: 'Contact Landlord', action: 'contact_landlord' },
      { name: 'Booking Started', action: 'start_booking' },
      { name: 'Booking Completed', action: 'complete_booking' }
    ];

    const funnelData = [];
    let previousStepUsers = null;

    for (const step of funnelSteps) {
      const { data: stepActivity, error } = await supabase
        .from('user_activity')
        .select('user_id')
        .eq('action', step.action);

      if (error) {
        console.error(`Error fetching ${step.name} data:`, error);
        continue;
      }

      const uniqueUsers = new Set(stepActivity?.map(a => a.user_id).filter(Boolean) || []);
      const userCount = uniqueUsers.size;

      const stepData = {
        step: step.name,
        action: step.action,
        users: userCount,
        percentage: previousStepUsers ? 
          (previousStepUsers > 0 ? Math.round((userCount / previousStepUsers) * 100 * 100) / 100 : 0) : 100,
        drop_off: previousStepUsers ? 
          (previousStepUsers - userCount) : 0,
        drop_off_rate: previousStepUsers && previousStepUsers > 0 ? 
          Math.round(((previousStepUsers - userCount) / previousStepUsers) * 100 * 100) / 100 : 0
      };

      funnelData.push(stepData);
      previousStepUsers = userCount;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          funnel_steps: funnelData,
          overall_conversion: funnelData.length > 0 && funnelData[0].users > 0 ? 
            Math.round((funnelData[funnelData.length - 1].users / funnelData[0].users) * 100 * 100) / 100 : 0
        }
      })
    };

  } catch (error) {
    console.error('Get funnel analysis error:', error);
    throw error;
  }
}

// Get active users (DAU/WAU/MAU)
async function getActiveUsers(queryParams, headers) {
  try {
    const { period = 'day' } = queryParams || {};

    let timeFrame;
    const now = new Date();

    switch (period) {
      case 'hour':
        timeFrame = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        timeFrame = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        timeFrame = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        timeFrame = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFrame = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const { data: activity, error: activityError } = await supabase
      .from('user_activity')
      .select('user_id, created_at')
      .gte('created_at', timeFrame.toISOString());

    if (activityError) {
      throw activityError;
    }

    const uniqueUsers = new Set(activity?.map(a => a.user_id).filter(Boolean) || []);

    // Also get user sessions for more accurate tracking
    const { data: sessions, error: sessionsError } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('created_at', timeFrame.toISOString());

    if (!sessionsError && sessions) {
      sessions.forEach(session => {
        if (session.user_id) {
          uniqueUsers.add(session.user_id);
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          period,
          active_users: uniqueUsers.size,
          time_frame: {
            start: timeFrame.toISOString(),
            end: now.toISOString()
          },
          total_activities: activity?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get active users error:', error);
    throw error;
  }
}

// Placeholder implementations for remaining functions
async function getSessionStats(queryParams, headers) {
  try {
    const { data: sessions } = await supabase.from('user_sessions').select('*');
    const avgDuration = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) / (sessions?.length || 1);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          total_sessions: sessions?.length || 0,
          avg_duration_minutes: Math.round(avgDuration * 100) / 100
        }
      })
    };
  } catch (error) {
    throw error;
  }
}

async function getConversionRates(queryParams, headers) {
  try {
    const { data: visitors } = await supabase.from('user_activity').select('user_id').eq('action', 'page_view');
    const { data: converters } = await supabase.from('user_activity').select('user_id').eq('action', 'complete_booking');
    
    const uniqueVisitors = new Set(visitors?.map(v => v.user_id).filter(Boolean) || []);
    const uniqueConverters = new Set(converters?.map(c => c.user_id).filter(Boolean) || []);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          conversion_rate: uniqueVisitors.size > 0 ? 
            Math.round((uniqueConverters.size / uniqueVisitors.size) * 100 * 100) / 100 : 0,
          total_visitors: uniqueVisitors.size,
          total_converters: uniqueConverters.size
        }
      })
    };
  } catch (error) {
    throw error;
  }
}

async function getCohortAnalysis(queryParams, headers) {
  // Implementation for cohort analysis
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getCustomEventStats(queryParams, headers) {
  // Implementation for custom event stats
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getHeatmapData(queryParams, headers) {
  // Implementation for heatmap data
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getTimeOnPlatform(userId, queryParams, headers) {
  // Implementation for time on platform
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getUserGrowth(queryParams, headers) {
  // Implementation for user growth
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getEngagementTrends(queryParams, headers) {
  // Implementation for engagement trends
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getTopUsers(queryParams, headers) {
  // Implementation for top users
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getUserJourney(userId, queryParams, headers) {
  // Implementation for user journey
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getFeedbackStats(queryParams, headers) {
  // Implementation for feedback stats
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getNotificationStats(queryParams, headers) {
  // Implementation for notification stats
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
}

async function getSearchAnalytics(queryParams, headers) {
  // Implementation for search analytics
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: {} }) };
  }

  */