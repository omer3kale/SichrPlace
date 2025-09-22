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
    const { action } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: ['export', 'delete', 'anonymize', 'consent_status', 'update_consent']
        })
      };
    }

    // Get authentication from header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required for GDPR operations'
        })
      };
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid authentication token'
        })
      };
    }

    const userId = user.id;

    switch (action) {
      case 'export':
        return await exportUserData(userId, headers);
      
      case 'delete':
        return await deleteUserData(userId, headers, event.body);
      
      case 'anonymize':
        return await anonymizeUserData(userId, headers);
      
      case 'consent_status':
        return await getConsentStatus(userId, headers);
      
      case 'update_consent':
        return await updateConsent(userId, headers, event.body);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified',
            available_actions: ['export', 'delete', 'anonymize', 'consent_status', 'update_consent']
          })
        };
    }

  } catch (error) {
    console.error('GDPR compliance error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'GDPR compliance operation failed',
        error: error.message
      })
    };
  }
};

// Export all user data (Right to Data Portability - GDPR Article 20)
async function exportUserData(userId, headers) {
  try {
    // Fetch all user-related data from multiple tables
    const [
      userProfile,
      userBookings,
      userReviews,
      userMessages,
      userActivity,
      userConsents,
      userApartments,
      userPayments
    ] = await Promise.all([
      // User profile data
      supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single(),

      // User bookings
      supabase
        .from('bookings')
        .select(`
          *, 
          apartment:apartments(title, location, price),
          landlord:users!bookings_landlord_id_fkey(username, email)
        `)
        .eq('user_id', userId),

      // User reviews
      supabase
        .from('apartment_reviews')
        .select(`
          *, 
          apartment:apartments(title, location)
        `)
        .eq('user_id', userId),

      // User messages
      supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),

      // User activity logs
      supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000), // Limit to last 1000 activities

      // User consents
      supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId),

      // Apartments owned by user (if landlord)
      supabase
        .from('apartments')
        .select('*')
        .eq('landlord_id', userId),

      // Payment records
      supabase
        .from('payment_records')
        .select('*')
        .eq('user_id', userId)
    ]);

    // Check for errors
    const errors = [
      userProfile.error,
      userBookings.error,
      userReviews.error,
      userMessages.error,
      userActivity.error,
      userConsents.error,
      userApartments.error,
      userPayments.error
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Data export errors:', errors);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Failed to export some user data',
          errors: errors.map(e => e.message)
        })
      };
    }

    // Compile comprehensive data export
    const exportData = {
      export_info: {
        user_id: userId,
        export_date: new Date().toISOString(),
        data_scope: 'complete_user_profile',
        format: 'JSON',
        gdpr_article: 'Article 20 - Right to data portability'
      },
      personal_data: {
        profile: sanitizePersonalData(userProfile.data),
        bookings: userBookings.data?.map(sanitizeBookingData) || [],
        reviews: userReviews.data?.map(sanitizeReviewData) || [],
        messages: userMessages.data?.map(sanitizeMessageData) || [],
        activity_logs: userActivity.data?.map(sanitizeActivityData) || [],
        consents: userConsents.data || [],
        owned_apartments: userApartments.data?.map(sanitizeApartmentData) || [],
        payment_history: userPayments.data?.map(sanitizePaymentData) || []
      },
      statistics: {
        total_bookings: userBookings.data?.length || 0,
        total_reviews: userReviews.data?.length || 0,
        total_messages: userMessages.data?.length || 0,
        total_apartments: userApartments.data?.length || 0,
        account_created: userProfile.data?.created_at,
        last_activity: userActivity.data?.[0]?.created_at
      },
      data_categories: {
        identity_data: ['username', 'email', 'full_name', 'phone'],
        behavioral_data: ['activity_logs', 'search_history'],
        transactional_data: ['bookings', 'payments'],
        communication_data: ['messages', 'reviews'],
        preference_data: ['consents', 'notification_settings']
      }
    };

    // Log the export request
    await supabase.from('gdpr_requests').insert([{
      user_id: userId,
      request_type: 'data_export',
      status: 'completed',
      requested_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      data_categories: Object.keys(exportData.data_categories),
      request_metadata: {
        export_size_kb: Math.round(JSON.stringify(exportData).length / 1024),
        records_exported: Object.values(exportData.personal_data).reduce((sum, arr) => 
          sum + (Array.isArray(arr) ? arr.length : 1), 0)
      }
    }]);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="sichrplace_data_export_${userId}_${new Date().toISOString().split('T')[0]}.json"`
      },
      body: JSON.stringify({
        success: true,
        message: 'Data export completed successfully',
        data: exportData
      })
    };

  } catch (error) {
    console.error('Data export error:', error);
    throw error;
  }
}

// Delete user data (Right to Erasure - GDPR Article 17)
async function deleteUserData(userId, headers, requestBody) {
  try {
    const { confirmation_text, deletion_reason } = requestBody ? JSON.parse(requestBody) : {};

    // Require explicit confirmation
    if (confirmation_text !== 'DELETE MY ACCOUNT PERMANENTLY') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Account deletion requires explicit confirmation',
          required_confirmation: 'DELETE MY ACCOUNT PERMANENTLY'
        })
      };
    }

    // Check for active bookings or obligations
    const { data: activeBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, check_in_date')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'active']);

    if (bookingError) {
      throw bookingError;
    }

    // Prevent deletion if there are active bookings
    const futureBookings = activeBookings?.filter(booking => 
      new Date(booking.check_in_date) > new Date()
    ) || [];

    if (futureBookings.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cannot delete account with active future bookings',
          active_bookings: futureBookings.length,
          action_required: 'Cancel all future bookings before account deletion'
        })
      };
    }

    // Begin deletion process - log the request first
    const { data: deletionRequest } = await supabase
      .from('gdpr_requests')
      .insert([{
        user_id: userId,
        request_type: 'data_deletion',
        status: 'processing',
        requested_at: new Date().toISOString(),
        deletion_reason: deletion_reason || 'User requested',
        request_metadata: {
          confirmation_provided: true,
          active_bookings_checked: true
        }
      }])
      .select('id')
      .single();

    // Anonymize instead of hard delete to maintain referential integrity
    const anonymizedData = {
      username: `deleted_user_${Date.now()}`,
      email: `deleted_${Date.now()}@anonymized.local`,
      full_name: '[DELETED USER]',
      phone: null,
      profile_picture: null,
      bio: null,
      preferences: null,
      notification_settings: null,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update user record with anonymized data
    const { error: updateError } = await supabase
      .from('users')
      .update(anonymizedData)
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Delete sensitive data from related tables
    await Promise.all([
      // Delete user activity logs
      supabase.from('user_activity').delete().eq('user_id', userId),
      
      // Delete user sessions
      supabase.from('user_sessions').delete().eq('user_id', userId),
      
      // Anonymize messages
      supabase
        .from('messages')
        .update({ 
          content: '[MESSAGE DELETED]',
          updated_at: new Date().toISOString()
        })
        .eq('sender_id', userId),
      
      // Remove personal data from reviews but keep review content for landlords
      supabase
        .from('apartment_reviews')
        .update({ 
          reviewer_name: '[DELETED USER]',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
    ]);

    // Update deletion request status
    await supabase
      .from('gdpr_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        request_metadata: {
          confirmation_provided: true,
          deletion_method: 'anonymization',
          records_affected: ['users', 'user_activity', 'user_sessions', 'messages', 'apartment_reviews']
        }
      })
      .eq('id', deletionRequest.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Account deletion completed successfully',
        data: {
          deletion_date: new Date().toISOString(),
          method: 'anonymization',
          retention_period: 'Legal obligations may require retaining some data for up to 7 years',
          affected_records: ['profile', 'activity_logs', 'sessions', 'messages', 'reviews']
        }
      })
    };

  } catch (error) {
    console.error('Data deletion error:', error);
    throw error;
  }
}

// Anonymize user data (partial anonymization)
async function anonymizeUserData(userId, headers) {
  try {
    const partialAnonymization = {
      email: `anon_${Date.now()}@anonymized.local`,
      phone: null,
      profile_picture: null,
      bio: null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('users')
      .update(partialAnonymization)
      .eq('id', userId);

    if (error) {
      throw error;
    }

    // Log anonymization request
    await supabase.from('gdpr_requests').insert([{
      user_id: userId,
      request_type: 'data_anonymization',
      status: 'completed',
      requested_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      request_metadata: {
        anonymization_level: 'partial',
        fields_anonymized: ['email', 'phone', 'profile_picture', 'bio']
      }
    }]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data anonymization completed successfully',
        data: {
          anonymization_date: new Date().toISOString(),
          level: 'partial',
          anonymized_fields: ['email', 'phone', 'profile_picture', 'bio']
        }
      })
    };

  } catch (error) {
    console.error('Data anonymization error:', error);
    throw error;
  }
}

// Get user consent status
async function getConsentStatus(userId, headers) {
  try {
    const { data: consents, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const consentStatus = {
      user_id: userId,
      consents: consents || [],
      summary: {
        total_consents: consents?.length || 0,
        active_consents: consents?.filter(c => c.status === 'granted').length || 0,
        withdrawn_consents: consents?.filter(c => c.status === 'withdrawn').length || 0
      },
      last_updated: consents?.[0]?.updated_at || null
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: consentStatus
      })
    };

  } catch (error) {
    console.error('Consent status error:', error);
    throw error;
  }
}

// Update user consent
async function updateConsent(userId, headers, requestBody) {
  try {
    const { consent_type, status, purpose } = JSON.parse(requestBody);

    if (!consent_type || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Consent type and status are required'
        })
      };
    }

    const { data: updatedConsent, error } = await supabase
      .from('user_consents')
      .upsert([{
        user_id: userId,
        consent_type: consent_type,
        status: status,
        purpose: purpose || '',
        granted_at: status === 'granted' ? new Date().toISOString() : null,
        withdrawn_at: status === 'withdrawn' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'user_id,consent_type',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Consent updated successfully',
        data: updatedConsent
      })
    };

  } catch (error) {
    console.error('Consent update error:', error);
    throw error;
  }
}

// Helper functions to sanitize data for export
function sanitizePersonalData(user) {
  if (!user) return null;
  const { password, auth_tokens, ...sanitizedUser } = user;
  return sanitizedUser;
}

function sanitizeBookingData(booking) {
  const { internal_notes, ...sanitizedBooking } = booking;
  return sanitizedBooking;
}

function sanitizeReviewData(review) {
  return review; // Reviews are generally safe to export as-is
}

function sanitizeMessageData(message) {
  const { deleted_at, ...sanitizedMessage } = message;
  return sanitizedMessage;
}

function sanitizeActivityData(activity) {
  return {
    action: activity.action,
    timestamp: activity.created_at,
    page: activity.page_url,
    metadata: activity.metadata
  };
}

function sanitizeApartmentData(apartment) {
  const { internal_notes, admin_notes, ...sanitizedApartment } = apartment;
  return sanitizedApartment;
}

function sanitizePaymentData(payment) {
  const { raw_payment_data, ...sanitizedPayment } = payment;
  return sanitizedPayment;
}