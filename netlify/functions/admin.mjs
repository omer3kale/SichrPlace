import { createClient } from '@supabase/supabase-js';
import { mapApartmentToFrontend, mapUserToFrontend, mapArrayToFrontend } from './utils/field-mapper.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables for admin function');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const buildHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin, Authorization, Content-Type',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

const httpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const getHeader = (headers = {}, name) => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry ? entry[1] : null;
};

const extractBearerToken = (headers) => {
  const value = getHeader(headers, 'authorization');
  if (!value) return null;
  const parts = value.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

const sanitizeString = (value, { maxLength, allowEmpty = false } = {}) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return null;
  return maxLength && trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const clampNumber = (value, { min = 0, max = Infinity, fallback = 0 } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const isMissingTableError = (error) => error?.code === 'PGRST116';

const safeSelect = async (table, columns, modify) => {
  let query = supabase.from(table).select(columns);
  if (modify) {
    query = modify(query) || query;
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw httpError(500, `Failed to load ${table}`, error.message);
  }
  return data || [];
};

const safeCount = async (table, modify) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (modify) {
    query = modify(query) || query;
  }
  const { count, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return 0;
    }
    throw httpError(500, `Failed to count ${table}`, error.message);
  }
  return count || 0;
};

const safeUpdate = async (table, data, condition) => {
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .match(condition)
    .select()
    .single();
  
  if (error) {
    throw httpError(500, `Failed to update ${table}`, error.message);
  }
  return result;
};

const safeDelete = async (table, condition) => {
  const { error } = await supabase
    .from(table)
    .delete()
    .match(condition);
  
  if (error) {
    throw httpError(500, `Failed to delete from ${table}`, error.message);
  }
};

const getAuthContext = async (headers) => {
  const token = extractBearerToken(headers || {});
  if (!token) {
    throw httpError(401, 'Authentication required');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      throw httpError(401, 'Invalid or expired token');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, status, account_status, is_blocked')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw httpError(401, 'User profile not found');
    }

    if (
      profile.is_blocked ||
      ['suspended', 'deleted'].includes(profile.account_status) ||
      profile.status === 'suspended'
    ) {
      throw httpError(403, 'Account suspended or blocked');
    }

    return { user: data.user, profile };
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'Authentication failed');
  }
};

const requireAdminRole = (profile) => {
  if (!['admin', 'super_admin'].includes(profile.role)) {
    throw httpError(403, 'Admin access required', {
      required_roles: ['admin', 'super_admin'],
      user_role: profile.role,
    });
  }
};

export const handler = async (event) => {
  const headers = buildHeaders();

  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const query = event.queryStringParameters || {};
    const { user, profile } = await getAuthContext(event.headers || {});
    
    requireAdminRole(profile);

    if (method === 'GET') {
      const { action } = query;

      if (action === 'dashboard') {
        // Get dashboard statistics with safe queries
        const [
          usersWithRoles,
          apartmentsWithStatus,
          viewingRequestsWithStatus,
          recentUsers,
          recentApartments,
          pendingRequests
        ] = await Promise.all([
          safeSelect('users', 'id, role, created_at'),
          safeSelect('apartments', 'id, status, created_at'),
          safeSelect('viewing_requests', 'id, status, created_at'),
          safeSelect('users', '*', (q) => q.order('created_at', { ascending: false }).limit(5)),
          safeSelect('apartments', '*, users:landlord_id(first_name, last_name)', (q) => q.order('created_at', { ascending: false }).limit(5)),
          safeSelect('viewing_requests', '*, apartments(title), users:requester_id(first_name, last_name)', (q) => q.eq('status', 'pending').limit(10))
        ]);

        // Calculate statistics
        const totalUsers = usersWithRoles.length;
        const totalApartments = apartmentsWithStatus.length;
        const totalViewingRequests = viewingRequestsWithStatus.length;

        const usersByRole = usersWithRoles.reduce((acc, user) => {
          const role = user.role || 'unknown';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {});

        const apartmentsByAvailability = apartmentsWithStatus.reduce((acc, apt) => {
          const key = apt.status === 'verfuegbar' ? 'available' : 'unavailable';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, { available: 0, unavailable: 0 });

        const requestsByStatus = viewingRequestsWithStatus.reduce((acc, req) => {
          const status = req.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        return respond(200, headers, {
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
              recent_users: mapArrayToFrontend(recentUsers, mapUserToFrontend),
              recent_apartments: mapArrayToFrontend(recentApartments, mapApartmentToFrontend),
              pending_requests: pendingRequests.map(req => ({
                ...req,
                apartments: req.apartments ? mapApartmentToFrontend(req.apartments) : null
              }))
            },
            last_updated: new Date().toISOString()
          }
        });
      }

      if (action === 'users') {
        const page = clampNumber(query.page, { min: 1, max: 1000, fallback: 1 });
        const limit = clampNumber(query.limit, { min: 1, max: 100, fallback: 20 });
        const roleFilter = sanitizeString(query.role, { maxLength: 50 });
        const searchFilter = sanitizeString(query.search, { maxLength: 100 });
        
        const offset = (page - 1) * limit;
        
        const users = await safeSelect(
          'users',
          '*',
          (queryBuilder) => {
            let q = queryBuilder.order('created_at', { ascending: false });
            
            if (roleFilter) {
              q = q.eq('role', roleFilter);
            }
            
            if (searchFilter) {
              q = q.or(`first_name.ilike.%${searchFilter}%,last_name.ilike.%${searchFilter}%,email.ilike.%${searchFilter}%`);
            }
            
            q = q.range(offset, offset + limit - 1);
            return q;
          }
        );
        
        // Get total count for pagination
        const totalCount = await safeCount(
          'users',
          (queryBuilder) => {
            let q = queryBuilder;
            
            if (roleFilter) {
              q = q.eq('role', roleFilter);
            }
            
            if (searchFilter) {
              q = q.or(`first_name.ilike.%${searchFilter}%,last_name.ilike.%${searchFilter}%,email.ilike.%${searchFilter}%`);
            }
            
            return q;
          }
        );

        return respond(200, headers, {
          success: true,
          users: users || [],
          pagination: {
            page,
            limit,
            total: totalCount,
            total_pages: Math.ceil(totalCount / limit)
          }
        });
      }

      // Default: return available actions
      return respond(200, headers, {
        success: true,
        available_actions: [
          'dashboard - Get admin dashboard statistics',
          'users - Get users list with pagination'
        ]
      });
    }

    if (method === 'PUT') {
      const { action, user_id } = query;
      const body = event.body ? JSON.parse(event.body) : {};
      
      if (action === 'user-role' && user_id) {
        const { role } = body;
        const validRoles = ['applicant', 'landlord', 'admin', 'super_admin'];
        
        if (!role || !validRoles.includes(role)) {
          throw httpError(400, 'Invalid role', {
            valid_roles: validRoles,
            received: role
          });
        }

        const updatedUser = await safeUpdate(
          'users',
          { 
            role: role,
            updated_at: new Date().toISOString()
          },
          { id: sanitizeString(user_id, { maxLength: 50 }) }
        );

        return respond(200, headers, {
          success: true,
          message: 'User role updated successfully',
          user: updatedUser
        });
      }

      if (action === 'user-status' && user_id) {
        const { active, status, account_status, is_blocked } = body;
        
        const updateData = {
          updated_at: new Date().toISOString()
        };
        
        if (typeof active === 'boolean') updateData.active = active;
        if (status) updateData.status = sanitizeString(status, { maxLength: 50 });
        if (account_status) updateData.account_status = sanitizeString(account_status, { maxLength: 50 });
        if (typeof is_blocked === 'boolean') updateData.is_blocked = is_blocked;

        const updatedUser = await safeUpdate(
          'users',
          updateData,
          { id: sanitizeString(user_id, { maxLength: 50 }) }
        );

        return respond(200, headers, {
          success: true,
          message: 'User status updated successfully',
          user: updatedUser
        });
      }
      
      throw httpError(400, 'Invalid action or missing parameters', {
        valid_actions: ['user-role', 'user-status'],
        received_action: action,
        user_id_provided: !!user_id
      });
    }

    if (method === 'DELETE') {
      const { action, resource_id } = query;
      const resourceId = sanitizeString(resource_id, { maxLength: 50 });
      
      if (!resourceId) {
        throw httpError(400, 'Resource ID is required');
      }
      
      if (action === 'apartment') {
        // Delete apartment and related viewing requests (cascade)
        await safeDelete('viewing_requests', { apartment_id: resourceId });
        await safeDelete('apartments', { id: resourceId });

        return respond(200, headers, {
          success: true,
          message: 'Apartment deleted successfully',
          deleted_resource_id: resourceId
        });
      }

      if (action === 'user') {
        // Delete user and related data (cascade)
        await Promise.all([
          safeDelete('viewing_requests', { requester_id: resourceId }),
          safeDelete('apartments', { landlord_id: resourceId }),
          safeDelete('reviews', { reviewer_id: resourceId }),
          safeDelete('favorites', { user_id: resourceId })
        ]);
        
        await safeDelete('users', { id: resourceId });

        return respond(200, headers, {
          success: true,
          message: 'User and related data deleted successfully',
          deleted_resource_id: resourceId
        });
      }
      
      throw httpError(400, 'Invalid delete action', {
        valid_actions: ['apartment', 'user'],
        received_action: action
      });
    }

    const error = httpError(405, 'Method not allowed', {
      allowed_methods: ['GET', 'PUT', 'DELETE'],
    });
    error.allow = 'GET, PUT, DELETE, OPTIONS';
    throw error;
  } catch (error) {
    console.error('admin error:', error);
    const status = error.status || 500;
    const responseHeaders = { ...headers };
    if (status === 405 && error.allow) {
      responseHeaders.Allow = error.allow;
    }
    return respond(status, responseHeaders, {
      success: false,
      error: status === 500 ? 'Internal server error' : error.message,
      ...(error.details && status !== 500 ? { details: error.details } : {}),
      ...(status === 500 && process.env.NODE_ENV === 'development'
        ? { details: error.details || error.message }
        : {}),
    });
  }
};