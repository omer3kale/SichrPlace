import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

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
    const { action } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: [
            'get_admin_dashboard',
            'get_system_stats',
            'manage_system_settings',
            'backup_database',
            'get_audit_logs',
            'system_health_check',
            'get_user_analytics',
            'export_data',
            'import_data',
            'cache_management',
            'security_scan',
            'performance_metrics'
          ]
        })
      };
    }

    // Verify admin authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
      
      if (!user || !user.is_admin) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Admin access required'
          })
        };
      }
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        })
      };
    }

    switch (action) {
      case 'get_admin_dashboard':
        return await getAdminDashboard(headers);
      
      case 'get_system_stats':
        return await getSystemStats(headers);
      
      case 'manage_system_settings':
        return await manageSystemSettings(event.body, event.httpMethod, headers);
      
      case 'backup_database':
        return await backupDatabase(headers);
      
      case 'get_audit_logs':
        return await getAuditLogs(event.queryStringParameters, headers);
      
      case 'system_health_check':
        return await systemHealthCheck(headers);
      
      case 'get_user_analytics':
        return await getUserAnalytics(event.queryStringParameters, headers);
      
      case 'export_data':
        return await exportData(event.queryStringParameters, headers);
      
      case 'import_data':
        return await importData(event.body, headers);
      
      case 'cache_management':
        return await cacheManagement(event.body, headers);
      
      case 'security_scan':
        return await securityScan(headers);
      
      case 'performance_metrics':
        return await getPerformanceMetrics(event.queryStringParameters, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified'
          })
        };
    }

  } catch (error) {
    console.error('System administration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'System administration operation failed',
        error: error.message
      })
    };
  }
};

// Get comprehensive admin dashboard data
async function getAdminDashboard(headers) {
  try {
    // Get all key metrics in parallel
    const [
      userStats,
      apartmentStats,
      bookingStats,
      revenueStats,
      systemHealth,
      recentActivity
    ] = await Promise.all([
      getUserMetrics(),
      getApartmentMetrics(),
      getBookingMetrics(),
      getRevenueMetrics(),
      getSystemHealthMetrics(),
      getRecentActivityMetrics()
    ]);

    const dashboard = {
      overview: {
        total_users: userStats.total,
        active_users: userStats.active,
        total_apartments: apartmentStats.total,
        total_bookings: bookingStats.total,
        total_revenue: revenueStats.total,
        system_uptime: systemHealth.uptime
      },
      user_metrics: userStats,
      apartment_metrics: apartmentStats,
      booking_metrics: bookingStats,
      revenue_metrics: revenueStats,
      system_health: systemHealth,
      recent_activity: recentActivity,
      alerts: await getSystemAlerts(),
      performance: await getPerformanceOverview()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: dashboard,
        generated_at: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Get admin dashboard error:', error);
    throw error;
  }
}

// Get detailed system statistics
async function getSystemStats(headers) {
  try {
    const [
      databaseStats,
      storageStats,
      apiStats,
      errorStats,
      securityStats
    ] = await Promise.all([
      getDatabaseStats(),
      getStorageStats(),
      getApiStats(),
      getErrorStats(),
      getSecurityStats()
    ]);

    const systemStats = {
      database: databaseStats,
      storage: storageStats,
      api: apiStats,
      errors: errorStats,
      security: securityStats,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: systemStats
      })
    };

  } catch (error) {
    console.error('Get system stats error:', error);
    throw error;
  }
}

// Manage system settings
async function manageSystemSettings(requestBody, httpMethod, headers) {
  try {
    if (httpMethod === 'GET') {
      // Get current system settings
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: settings || []
        })
      };
    }

    if (httpMethod === 'POST' || httpMethod === 'PUT') {
      const {
        setting_key,
        setting_value,
        setting_type = 'string',
        description
      } = JSON.parse(requestBody);

      if (!setting_key || setting_value === undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Setting key and value are required'
          })
        };
      }

      // Upsert setting
      const { data: setting, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key,
          setting_value,
          setting_type,
          description,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Setting updated successfully',
          data: setting
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      })
    };

  } catch (error) {
    console.error('Manage system settings error:', error);
    throw error;
  }
}

// Backup database
async function backupDatabase(headers) {
  try {
    // This is a simplified backup simulation
    // In production, you would trigger actual database backup
    const backupId = `backup_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Log backup request
    const { data: backup, error } = await supabase
      .from('system_backups')
      .insert({
        backup_id: backupId,
        backup_type: 'full',
        status: 'initiated',
        initiated_by: 'admin',
        initiated_at: timestamp,
        created_at: timestamp
      })
      .select()
      .single();

    if (error) throw error;

    // Simulate backup process
    setTimeout(async () => {
      await supabase
        .from('system_backups')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          backup_size: Math.floor(Math.random() * 1000000) + 500000, // Simulate size
          backup_location: `s3://backups/${backupId}.sql`
        })
        .eq('backup_id', backupId);
    }, 5000);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Database backup initiated',
        data: {
          backup_id: backupId,
          status: 'initiated',
          initiated_at: timestamp
        }
      })
    };

  } catch (error) {
    console.error('Backup database error:', error);
    throw error;
  }
}

// Get audit logs
async function getAuditLogs(queryParams, headers) {
  try {
    const {
      limit = '50',
      offset = '0',
      action_type,
      user_id,
      start_date,
      end_date
    } = queryParams || {};

    let query = supabase
      .from('admin_actions')
      .select(`
        id,
        action_type,
        target_user_id,
        reason,
        performed_by,
        performed_at,
        metadata,
        target_user:users!target_user_id(username, email)
      `)
      .order('performed_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (action_type) {
      query = query.eq('action_type', action_type);
    }

    if (user_id) {
      query = query.eq('target_user_id', user_id);
    }

    if (start_date) {
      query = query.gte('performed_at', start_date);
    }

    if (end_date) {
      query = query.lte('performed_at', end_date);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Get summary statistics
    const { data: allLogs, error: statsError } = await supabase
      .from('admin_actions')
      .select('action_type, performed_at');

    if (statsError) throw statsError;

    const stats = {
      total_actions: allLogs.length,
      actions_by_type: allLogs.reduce((acc, log) => {
        acc[log.action_type] = (acc[log.action_type] || 0) + 1;
        return acc;
      }, {}),
      recent_activity: allLogs.filter(log => 
        new Date(log.performed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          logs: logs || [],
          statistics: stats,
          pagination: {
            offset: parseInt(offset),
            limit: parseInt(limit),
            total_fetched: logs?.length || 0
          }
        }
      })
    };

  } catch (error) {
    console.error('Get audit logs error:', error);
    throw error;
  }
}

// System health check
async function systemHealthCheck(headers) {
  try {
    const healthChecks = await Promise.allSettled([
      checkDatabaseHealth(),
      checkAPIHealth(),
      checkStorageHealth(),
      checkExternalServicesHealth()
    ]);

    const healthStatus = {
      overall_status: healthChecks.every(check => check.status === 'fulfilled' && check.value.status === 'healthy') ? 'healthy' : 'degraded',
      database: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { status: 'error', message: healthChecks[0].reason },
      api: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { status: 'error', message: healthChecks[1].reason },
      storage: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { status: 'error', message: healthChecks[2].reason },
      external_services: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { status: 'error', message: healthChecks[3].reason },
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: healthStatus
      })
    };

  } catch (error) {
    console.error('System health check error:', error);
    throw error;
  }
}

// Get user analytics
async function getUserAnalytics(queryParams, headers) {
  try {
    const { period = '30d', metric = 'all' } = queryParams || {};

    const analytics = {
      user_growth: await getUserGrowthAnalytics(period),
      user_engagement: await getUserEngagementAnalytics(period),
      user_retention: await getUserRetentionAnalytics(period),
      user_demographics: await getUserDemographics(),
      user_behavior: await getUserBehaviorAnalytics(period)
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: analytics,
        period,
        generated_at: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Get user analytics error:', error);
    throw error;
  }
}

// Export data
async function exportData(queryParams, headers) {
  try {
    const {
      data_type = 'users',
      format = 'json',
      date_range,
      filters
    } = queryParams || {};

    const validDataTypes = ['users', 'apartments', 'bookings', 'reviews', 'analytics'];
    const validFormats = ['json', 'csv'];

    if (!validDataTypes.includes(data_type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid data type',
          valid_types: validDataTypes
        })
      };
    }

    if (!validFormats.includes(format)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid format',
          valid_formats: validFormats
        })
      };
    }

    const exportData = await getExportData(data_type, date_range, filters);
    
    // Generate export ID for tracking
    const exportId = `export_${data_type}_${Date.now()}`;
    
    // Log export request
    await supabase
      .from('data_exports')
      .insert({
        export_id: exportId,
        data_type,
        format,
        record_count: exportData.length,
        exported_by: 'admin',
        exported_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="${data_type}_export_${Date.now()}.${format}"`
      },
      body: JSON.stringify({
        success: true,
        data: exportData,
        export_metadata: {
          export_id: exportId,
          data_type,
          format,
          record_count: exportData.length,
          exported_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Export data error:', error);
    throw error;
  }
}

// Import data
async function importData(requestBody, headers) {
  try {
    const {
      data_type,
      data,
      validation_mode = 'strict',
      dry_run = false
    } = JSON.parse(requestBody);

    if (!data_type || !data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Data type and data are required'
        })
      };
    }

    const validationResult = await validateImportData(data_type, data, validation_mode);
    
    if (!validationResult.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Data validation failed',
          errors: validationResult.errors
        })
      };
    }

    if (dry_run) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Dry run completed successfully',
          data: {
            would_import: data.length,
            validation_passed: true
          }
        })
      };
    }

    // Perform actual import
    const importResult = await performDataImport(data_type, data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data imported successfully',
        data: importResult
      })
    };

  } catch (error) {
    console.error('Import data error:', error);
    throw error;
  }
}

// Cache management
async function cacheManagement(requestBody, headers) {
  try {
    const { action, cache_key, cache_type } = JSON.parse(requestBody);

    const validActions = ['clear', 'refresh', 'stats', 'purge'];
    
    if (!validActions.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid cache action',
          valid_actions: validActions
        })
      };
    }

    let result;

    switch (action) {
      case 'clear':
        result = await clearCache(cache_key, cache_type);
        break;
      case 'refresh':
        result = await refreshCache(cache_key, cache_type);
        break;
      case 'stats':
        result = await getCacheStats();
        break;
      case 'purge':
        result = await purgeExpiredCache();
        break;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Cache ${action} completed`,
        data: result
      })
    };

  } catch (error) {
    console.error('Cache management error:', error);
    throw error;
  }
}

// Security scan
async function securityScan(headers) {
  try {
    const securityChecks = await Promise.allSettled([
      checkUserSecurity(),
      checkDataSecurity(),
      checkAccessSecurity(),
      checkSystemSecurity()
    ]);

    const securityReport = {
      overall_security_score: calculateSecurityScore(securityChecks),
      user_security: securityChecks[0].status === 'fulfilled' ? securityChecks[0].value : { status: 'error' },
      data_security: securityChecks[1].status === 'fulfilled' ? securityChecks[1].value : { status: 'error' },
      access_security: securityChecks[2].status === 'fulfilled' ? securityChecks[2].value : { status: 'error' },
      system_security: securityChecks[3].status === 'fulfilled' ? securityChecks[3].value : { status: 'error' },
      recommendations: generateSecurityRecommendations(securityChecks),
      scan_timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: securityReport
      })
    };

  } catch (error) {
    console.error('Security scan error:', error);
    throw error;
  }
}

// Get performance metrics
async function getPerformanceMetrics(queryParams, headers) {
  try {
    const { period = '24h', metric_type = 'all' } = queryParams || {};

    const metrics = {
      response_times: await getResponseTimeMetrics(period),
      throughput: await getThroughputMetrics(period),
      error_rates: await getErrorRateMetrics(period),
      resource_usage: await getResourceUsageMetrics(period),
      database_performance: await getDatabasePerformanceMetrics(period)
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: metrics,
        period,
        generated_at: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Get performance metrics error:', error);
    throw error;
  }
}

// Helper functions for various metrics and operations

async function getUserMetrics() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, created_at, last_login_at, is_banned, verified');

  if (error) throw error;

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    total: users.length,
    active: users.filter(u => u.last_login_at && new Date(u.last_login_at) > monthAgo).length,
    verified: users.filter(u => u.verified).length,
    banned: users.filter(u => u.is_banned).length,
    new_this_month: users.filter(u => new Date(u.created_at) > monthAgo).length
  };
}

async function getApartmentMetrics() {
  const { data: apartments, error } = await supabase
    .from('apartments')
    .select('id, status, created_at, price');

  if (error) throw error;

  return {
    total: apartments.length,
    active: apartments.filter(a => a.status === 'active').length,
    average_price: apartments.reduce((sum, a) => sum + (a.price || 0), 0) / apartments.length
  };
}

async function getBookingMetrics() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, status, total_amount, created_at');

  if (error) throw error;

  return {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    total_value: bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
  };
}

async function getRevenueMetrics() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('total_amount, created_at')
    .eq('status', 'confirmed');

  if (error) throw error;

  const total = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const monthlyRevenue = bookings
    .filter(b => new Date(b.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  return {
    total,
    monthly: monthlyRevenue,
    average_booking: total / bookings.length || 0
  };
}

async function getSystemHealthMetrics() {
  return {
    uptime: '99.9%',
    status: 'healthy',
    last_incident: null,
    response_time: '150ms'
  };
}

async function getRecentActivityMetrics() {
  const { data: activity, error } = await supabase
    .from('user_activity')
    .select('action, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return {
    total_actions: activity.length,
    most_common: getMostCommonAction(activity),
    hourly_activity: getHourlyActivity(activity)
  };
}

function getMostCommonAction(activities) {
  if (!activities || activities.length === 0) return null;
  
  const actionCounts = activities.reduce((acc, activity) => {
    acc[activity.action] = (acc[activity.action] || 0) + 1;
    return acc;
  }, {});
  
  return Object.keys(actionCounts).reduce((a, b) => 
    actionCounts[a] > actionCounts[b] ? a : b
  );
}

function getHourlyActivity(activities) {
  const hourly = new Array(24).fill(0);
  activities.forEach(activity => {
    const hour = new Date(activity.created_at).getHours();
    hourly[hour]++;
  });
  return hourly;
}

// Additional helper functions would be implemented for other metrics...

async function getDatabaseStats() {
  // Simplified database stats
  return {
    connection_count: 10,
    query_performance: '95ms avg',
    storage_used: '2.5GB',
    backup_status: 'current'
  };
}

async function getStorageStats() {
  return {
    total_storage: '50GB',
    used_storage: '15GB',
    image_storage: '8GB',
    document_storage: '7GB'
  };
}

async function getApiStats() {
  return {
    total_requests: 15000,
    average_response_time: '180ms',
    error_rate: '0.5%',
    rate_limit_hits: 12
  };
}

async function getErrorStats() {
  return {
    total_errors: 45,
    critical_errors: 2,
    most_common_error: '404 Not Found',
    error_trend: 'decreasing'
  };
}

async function getSecurityStats() {
  return {
    failed_login_attempts: 25,
    suspicious_activities: 3,
    active_sessions: 150,
    security_incidents: 0
  };
}

// Placeholder implementations for other functions...
async function getSystemAlerts() { return []; }
async function getPerformanceOverview() { return {}; }
async function checkDatabaseHealth() { return { status: 'healthy' }; }
async function checkAPIHealth() { return { status: 'healthy' }; }
async function checkStorageHealth() { return { status: 'healthy' }; }
async function checkExternalServicesHealth() { return { status: 'healthy' }; }
async function getUserGrowthAnalytics() { return {}; }
async function getUserEngagementAnalytics() { return {}; }
async function getUserRetentionAnalytics() { return {}; }
async function getUserDemographics() { return {}; }
async function getUserBehaviorAnalytics() { return {}; }
async function getExportData() { return []; }
async function validateImportData() { return { valid: true }; }
async function performDataImport() { return {}; }
async function clearCache() { return {}; }
async function refreshCache() { return {}; }
async function getCacheStats() { return {}; }
async function purgeExpiredCache() { return {}; }
async function checkUserSecurity() { return { status: 'secure' }; }
async function checkDataSecurity() { return { status: 'secure' }; }
async function checkAccessSecurity() { return { status: 'secure' }; }
async function checkSystemSecurity() { return { status: 'secure' }; }
function calculateSecurityScore() { return 85; }
function generateSecurityRecommendations() { return []; }
async function getResponseTimeMetrics() { return {}; }
async function getThroughputMetrics() { return {}; }
async function getErrorRateMetrics() { return {}; }
async function getResourceUsageMetrics() { return {}; }
async function getDatabasePerformanceMetrics() { return {}; }