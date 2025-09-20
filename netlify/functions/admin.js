const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

// Helper function to check admin permissions
const isAdmin = (user) => {
  return user && (user.role === 'admin' || user.role === 'super_admin');
};

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    const { httpMethod, body, headers, queryStringParameters } = event;
    const authHeader = headers.authorization || headers.Authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Authentication required for all admin operations
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        }),
      };
    }

    const user = verifyToken(token);
    if (!user || !isAdmin(user)) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          message: 'Admin access required'
        }),
      };
    }

    // Handle GET requests - Admin dashboard data
    if (httpMethod === 'GET') {
      const { action } = queryStringParameters || {};

      if (action === 'dashboard') {
        // Get dashboard statistics
        const [
          usersResult,
          apartmentsResult,
          viewingRequestsResult,
          recentUsersResult,
          recentApartmentsResult,
          pendingRequestsResult
        ] = await Promise.all([
          supabase.from('users').select('id, role, created_at', { count: 'exact' }),
          supabase.from('apartments').select('id, available, created_at', { count: 'exact' }),
          supabase.from('viewing_requests').select('id, status, created_at', { count: 'exact' }),
          supabase.from('users').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('apartments').select('*, users:landlord_id(full_name)').order('created_at', { ascending: false }).limit(5),
          supabase.from('viewing_requests').select('*, apartments(title), users:tenant_id(full_name)').eq('status', 'pending').limit(10)
        ]);

        // Calculate statistics
        const totalUsers = usersResult.count || 0;
        const totalApartments = apartmentsResult.count || 0;
        const totalViewingRequests = viewingRequestsResult.count || 0;

        const usersByRole = usersResult.data?.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {}) || {};

        const apartmentsByAvailability = apartmentsResult.data?.reduce((acc, apt) => {
          const key = apt.available ? 'available' : 'unavailable';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}) || {};

        const requestsByStatus = viewingRequestsResult.data?.reduce((acc, req) => {
          acc[req.status] = (acc[req.status] || 0) + 1;
          return acc;
        }, {}) || {};

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            dashboard: {
              statistics: {
                total_users: totalUsers,
                total_apartments: totalApartments,
                total_viewing_requests: totalViewingRequests,
                users_by_role: usersByRole,
                apartments_by_availability: apartmentsByAvailability,
                requests_by_status: requestsByStatus
              },
              recent_activity: {
                recent_users: recentUsersResult.data || [],
                recent_apartments: recentApartmentsResult.data || [],
                pending_requests: pendingRequestsResult.data || []
              },
              last_updated: new Date().toISOString()
            }
          }),
        };
      }

      if (action === 'users') {
        // Get all users with pagination
        const { page = 1, limit = 20, role, search } = queryStringParameters || {};
        
        let query = supabase
          .from('users')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });

        if (role) {
          query = query.eq('role', role);
        }

        if (search) {
          query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: users, error, count } = await query;

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            users: users || [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: count || 0,
              total_pages: Math.ceil((count || 0) / parseInt(limit))
            }
          }),
        };
      }

      // Default: return available actions
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          available_actions: [
            'dashboard - Get admin dashboard statistics',
            'users - Get users list with pagination'
          ]
        }),
      };
    }

    // Handle PUT requests - Update user status/role
    if (httpMethod === 'PUT') {
      const { action, user_id } = queryStringParameters || {};
      
      if (action === 'user-role' && user_id) {
        const { role } = JSON.parse(body);
        
        if (!role || !['tenant', 'landlord', 'admin'].includes(role)) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: false,
              message: 'Invalid role. Must be: tenant, landlord, or admin'
            }),
          };
        }

        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ 
            role: role,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            message: 'User role updated successfully',
            user: updatedUser
          }),
        };
      }

      if (action === 'user-status' && user_id) {
        const { active } = JSON.parse(body);
        
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ 
            active: active,
            updated_at: new Date().toISOString()
          })
          .eq('id', user_id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            message: 'User status updated successfully',
            user: updatedUser
          }),
        };
      }
    }

    // Handle DELETE requests - Delete resources
    if (httpMethod === 'DELETE') {
      const { action, resource_id } = queryStringParameters || {};
      
      if (action === 'apartment' && resource_id) {
        // Delete apartment and related viewing requests
        await supabase.from('viewing_requests').delete().eq('apartment_id', resource_id);
        
        const { error } = await supabase
          .from('apartments')
          .delete()
          .eq('id', resource_id);

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            message: 'Apartment deleted successfully'
          }),
        };
      }

      if (action === 'user' && resource_id) {
        // Delete user and related data
        await Promise.all([
          supabase.from('viewing_requests').delete().eq('tenant_id', resource_id),
          supabase.from('apartments').delete().eq('landlord_id', resource_id)
        ]);
        
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', resource_id);

        if (error) {
          throw error;
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: true,
            message: 'User deleted successfully'
          }),
        };
      }
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      }),
    };

  } catch (error) {
    console.error('Admin API error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
    };
  }
};