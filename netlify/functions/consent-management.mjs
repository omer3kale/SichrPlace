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
          available_actions: [
            'grant_consent', 
            'withdraw_consent', 
            'get_consent_status',
            'update_consent_preferences',
            'get_consent_history',
            'get_consent_requirements',
            'bulk_consent_update',
            'validate_consent'
          ]
        })
      };
    }

    switch (action) {
      case 'grant_consent':
        return await grantConsent(event.body, headers);
      
      case 'withdraw_consent':
        return await withdrawConsent(event.body, headers);
      
      case 'get_consent_status':
        return await getConsentStatus(event.queryStringParameters, headers);
      
      case 'update_consent_preferences':
        return await updateConsentPreferences(event.body, headers);
      
      case 'get_consent_history':
        return await getConsentHistory(event.queryStringParameters, headers);
      
      case 'get_consent_requirements':
        return await getConsentRequirements(headers);
      
      case 'bulk_consent_update':
        return await bulkConsentUpdate(event.body, headers);
      
      case 'validate_consent':
        return await validateConsent(event.queryStringParameters, headers);
      
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
    console.error('Consent management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Consent management operation failed',
        error: error.message
      })
    };
  }
};

// Grant consent for specific purpose
async function grantConsent(requestBody, headers) {
  try {
    const {
      user_id,
      consent_type,
      purpose,
      legal_basis = 'consent',
      retention_period,
      consent_source = 'user_interface',
      metadata = {}
    } = JSON.parse(requestBody);

    if (!user_id || !consent_type || !purpose) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID, consent type, and purpose are required'
        })
      };
    }

    // Validate consent type
    const validConsentTypes = [
      'marketing',
      'analytics',
      'location',
      'cookies',
      'data_sharing',
      'profiling',
      'third_party_services',
      'newsletters',
      'promotional_emails',
      'behavioral_tracking'
    ];

    if (!validConsentTypes.includes(consent_type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid consent type',
          valid_types: validConsentTypes
        })
      };
    }

    // Check if consent already exists
    const { data: existingConsent, error: checkError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .eq('consent_type', consent_type)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }

    const now = new Date().toISOString();
    const consentData = {
      user_id: user_id,
      consent_type: consent_type,
      status: 'granted',
      purpose: purpose,
      legal_basis: legal_basis,
      retention_period: retention_period,
      consent_source: consent_source,
      granted_at: now,
      withdrawn_at: null,
      updated_at: now,
      metadata: {
        ...metadata,
        granted_via: consent_source,
        ip_address: event.headers['x-forwarded-for'] || 'unknown',
        user_agent: event.headers['user-agent'] || 'unknown'
      }
    };

    // Upsert consent record
    const { data: consentRecord, error: upsertError } = await supabase
      .from('user_consents')
      .upsert([consentData], {
        onConflict: 'user_id,consent_type',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    // Log consent grant event
    await supabase.from('consent_audit_log').insert([{
      user_id: user_id,
      consent_id: consentRecord.id,
      action: 'granted',
      consent_type: consent_type,
      previous_status: existingConsent?.status || 'none',
      new_status: 'granted',
      ip_address: event.headers['x-forwarded-for'] || 'unknown',
      user_agent: event.headers['user-agent'] || 'unknown',
      created_at: now
    }]);

    // Update user preferences based on consent
    await updateUserPreferencesFromConsent(user_id, consent_type, 'granted');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Consent granted successfully',
        data: {
          consent_id: consentRecord.id,
          consent_type: consent_type,
          status: 'granted',
          granted_at: now,
          purpose: purpose,
          legal_basis: legal_basis
        }
      })
    };

  } catch (error) {
    console.error('Grant consent error:', error);
    throw error;
  }
}

// Withdraw consent
async function withdrawConsent(requestBody, headers) {
  try {
    const {
      user_id,
      consent_type,
      withdrawal_reason = 'user_request',
      metadata = {}
    } = JSON.parse(requestBody);

    if (!user_id || !consent_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID and consent type are required'
        })
      };
    }

    // Get existing consent
    const { data: existingConsent, error: getError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .eq('consent_type', consent_type)
      .single();

    if (getError) {
      if (getError.code === 'PGRST116') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Consent record not found'
          })
        };
      }
      throw getError;
    }

    if (existingConsent.status === 'withdrawn') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Consent already withdrawn',
          data: existingConsent
        })
      };
    }

    const now = new Date().toISOString();

    // Update consent to withdrawn
    const { data: updatedConsent, error: updateError } = await supabase
      .from('user_consents')
      .update({
        status: 'withdrawn',
        withdrawn_at: now,
        updated_at: now,
        withdrawal_reason: withdrawal_reason,
        metadata: {
          ...existingConsent.metadata,
          ...metadata,
          withdrawn_via: 'user_interface',
          withdrawal_ip: event.headers['x-forwarded-for'] || 'unknown'
        }
      })
      .eq('user_id', user_id)
      .eq('consent_type', consent_type)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log consent withdrawal
    await supabase.from('consent_audit_log').insert([{
      user_id: user_id,
      consent_id: updatedConsent.id,
      action: 'withdrawn',
      consent_type: consent_type,
      previous_status: existingConsent.status,
      new_status: 'withdrawn',
      withdrawal_reason: withdrawal_reason,
      ip_address: event.headers['x-forwarded-for'] || 'unknown',
      user_agent: event.headers['user-agent'] || 'unknown',
      created_at: now
    }]);

    // Update user preferences and stop processing
    await updateUserPreferencesFromConsent(user_id, consent_type, 'withdrawn');
    await stopDataProcessingForWithdrawnConsent(user_id, consent_type);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Consent withdrawn successfully',
        data: {
          consent_id: updatedConsent.id,
          consent_type: consent_type,
          status: 'withdrawn',
          withdrawn_at: now,
          withdrawal_reason: withdrawal_reason
        }
      })
    };

  } catch (error) {
    console.error('Withdraw consent error:', error);
    throw error;
  }
}

// Get consent status for user
async function getConsentStatus(queryParams, headers) {
  try {
    const { user_id, consent_type } = queryParams || {};
    
    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    let query = supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false });

    if (consent_type) {
      query = query.eq('consent_type', consent_type);
    }

    const { data: consents, error } = await query;

    if (error) {
      throw error;
    }

    // Get consent requirements to check what's missing
    const { data: requirements } = await getConsentRequirements(headers);
    const requiredConsents = requirements?.data?.required_consents || [];

    const consentStatus = {
      user_id: user_id,
      consents: consents || [],
      summary: {
        total_consents: consents?.length || 0,
        granted_consents: consents?.filter(c => c.status === 'granted').length || 0,
        withdrawn_consents: consents?.filter(c => c.status === 'withdrawn').length || 0,
        pending_consents: consents?.filter(c => c.status === 'pending').length || 0
      },
      compliance_status: {
        has_required_consents: checkRequiredConsents(consents, requiredConsents),
        missing_consents: findMissingConsents(consents, requiredConsents),
        last_updated: consents?.[0]?.updated_at || null
      }
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
    console.error('Get consent status error:', error);
    throw error;
  }
}

// Update consent preferences (batch update)
async function updateConsentPreferences(requestBody, headers) {
  try {
    const {
      user_id,
      consent_preferences,
      update_reason = 'user_preference_change'
    } = JSON.parse(requestBody);

    if (!user_id || !consent_preferences || !Array.isArray(consent_preferences)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID and consent preferences array are required'
        })
      };
    }

    const now = new Date().toISOString();
    const updatedConsents = [];
    const auditLogs = [];

    for (const preference of consent_preferences) {
      const { consent_type, status, purpose, retention_period } = preference;

      if (!consent_type || !status || !purpose) {
        continue; // Skip invalid preferences
      }

      // Get existing consent
      const { data: existingConsent } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user_id)
        .eq('consent_type', consent_type)
        .single();

      const consentData = {
        user_id: user_id,
        consent_type: consent_type,
        status: status,
        purpose: purpose,
        retention_period: retention_period,
        granted_at: status === 'granted' ? now : existingConsent?.granted_at,
        withdrawn_at: status === 'withdrawn' ? now : null,
        updated_at: now,
        metadata: {
          update_reason: update_reason,
          batch_update: true,
          previous_status: existingConsent?.status || 'none'
        }
      };

      // Upsert consent
      const { data: updatedConsent, error } = await supabase
        .from('user_consents')
        .upsert([consentData], {
          onConflict: 'user_id,consent_type',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (!error) {
        updatedConsents.push(updatedConsent);
        
        // Prepare audit log
        auditLogs.push({
          user_id: user_id,
          consent_id: updatedConsent.id,
          action: status === 'granted' ? 'granted' : 'withdrawn',
          consent_type: consent_type,
          previous_status: existingConsent?.status || 'none',
          new_status: status,
          ip_address: event.headers['x-forwarded-for'] || 'unknown',
          user_agent: event.headers['user-agent'] || 'unknown',
          created_at: now
        });

        // Update user preferences
        await updateUserPreferencesFromConsent(user_id, consent_type, status);
      }
    }

    // Batch insert audit logs
    if (auditLogs.length > 0) {
      await supabase.from('consent_audit_log').insert(auditLogs);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Consent preferences updated successfully',
        data: {
          updated_count: updatedConsents.length,
          consents: updatedConsents
        }
      })
    };

  } catch (error) {
    console.error('Update consent preferences error:', error);
    throw error;
  }
}

// Get consent history with audit trail
async function getConsentHistory(queryParams, headers) {
  try {
    const { user_id, limit = '50', consent_type } = queryParams || {};
    
    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID is required'
        })
      };
    }

    // Get consent records
    let consentQuery = supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })
      .limit(parseInt(limit));

    if (consent_type) {
      consentQuery = consentQuery.eq('consent_type', consent_type);
    }

    const { data: consents, error: consentError } = await consentQuery;

    if (consentError) {
      throw consentError;
    }

    // Get audit log
    let auditQuery = supabase
      .from('consent_audit_log')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (consent_type) {
      auditQuery = auditQuery.eq('consent_type', consent_type);
    }

    const { data: auditLog, error: auditError } = await auditQuery;

    if (auditError) {
      throw auditError;
    }

    const history = {
      user_id: user_id,
      consent_records: consents || [],
      audit_trail: auditLog || [],
      summary: {
        total_records: consents?.length || 0,
        total_actions: auditLog?.length || 0,
        first_consent: auditLog?.[auditLog.length - 1]?.created_at || null,
        last_update: auditLog?.[0]?.created_at || null
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: history
      })
    };

  } catch (error) {
    console.error('Get consent history error:', error);
    throw error;
  }
}

// Get consent requirements
async function getConsentRequirements(headers) {
  try {
    const consentRequirements = {
      required_consents: [
        {
          type: 'cookies',
          purpose: 'Essential cookies for website functionality',
          legal_basis: 'legitimate_interest',
          required: true,
          can_withdraw: false
        },
        {
          type: 'analytics',
          purpose: 'Website analytics and performance monitoring',
          legal_basis: 'consent',
          required: false,
          can_withdraw: true
        },
        {
          type: 'marketing',
          purpose: 'Marketing communications and promotional emails',
          legal_basis: 'consent',
          required: false,
          can_withdraw: true
        }
      ],
      optional_consents: [
        {
          type: 'location',
          purpose: 'Location-based recommendations and search',
          legal_basis: 'consent',
          required: false,
          can_withdraw: true
        },
        {
          type: 'profiling',
          purpose: 'Personalized content and recommendations',
          legal_basis: 'consent',
          required: false,
          can_withdraw: true
        },
        {
          type: 'data_sharing',
          purpose: 'Sharing data with trusted partners',
          legal_basis: 'consent',
          required: false,
          can_withdraw: true
        }
      ],
      compliance_info: {
        gdpr_applicable: true,
        data_controller: 'SichrPlace GmbH',
        contact_email: 'privacy@sichrplace.com',
        retention_periods: {
          marketing: '2 years from last interaction',
          analytics: '2 years from collection',
          location: '1 year from last use',
          profiling: '1 year from last activity'
        }
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: consentRequirements
      })
    };

  } catch (error) {
    console.error('Get consent requirements error:', error);
    throw error;
  }
}

// Bulk consent update for multiple users
async function bulkConsentUpdate(requestBody, headers) {
  try {
    const {
      user_ids,
      consent_updates,
      reason = 'bulk_policy_update'
    } = JSON.parse(requestBody);

    if (!user_ids || !Array.isArray(user_ids) || !consent_updates) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User IDs array and consent updates are required'
        })
      };
    }

    const results = [];
    const now = new Date().toISOString();

    for (const user_id of user_ids) {
      try {
        for (const update of consent_updates) {
          const { consent_type, status, purpose } = update;

          if (!consent_type || !status || !purpose) {
            continue;
          }

          const consentData = {
            user_id: user_id,
            consent_type: consent_type,
            status: status,
            purpose: purpose,
            granted_at: status === 'granted' ? now : null,
            withdrawn_at: status === 'withdrawn' ? now : null,
            updated_at: now,
            metadata: {
              bulk_update: true,
              update_reason: reason
            }
          };

          await supabase
            .from('user_consents')
            .upsert([consentData], {
              onConflict: 'user_id,consent_type',
              ignoreDuplicates: false
            });

          // Update user preferences
          await updateUserPreferencesFromConsent(user_id, consent_type, status);
        }

        results.push({ user_id: user_id, status: 'success' });

      } catch (userError) {
        console.error(`Bulk update failed for user ${user_id}:`, userError);
        results.push({ user_id: user_id, status: 'failed', error: userError.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Bulk consent update completed',
        data: {
          total_users: user_ids.length,
          successful_updates: successCount,
          failed_updates: user_ids.length - successCount,
          results: results
        }
      })
    };

  } catch (error) {
    console.error('Bulk consent update error:', error);
    throw error;
  }
}

// Validate consent status
async function validateConsent(queryParams, headers) {
  try {
    const { user_id, consent_type, required_status = 'granted' } = queryParams || {};
    
    if (!user_id || !consent_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID and consent type are required'
        })
      };
    }

    const { data: consent, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .eq('consent_type', consent_type)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const isValid = consent && consent.status === required_status;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          user_id: user_id,
          consent_type: consent_type,
          is_valid: isValid,
          current_status: consent?.status || 'not_set',
          required_status: required_status,
          granted_at: consent?.granted_at || null,
          withdrawn_at: consent?.withdrawn_at || null,
          last_updated: consent?.updated_at || null
        }
      })
    };

  } catch (error) {
    console.error('Validate consent error:', error);
    throw error;
  }
}

// Helper functions
async function updateUserPreferencesFromConsent(userId, consentType, status) {
  try {
    const { data: user, error: getUserError } = await supabase
      .from('users')
      .select('notification_settings, privacy_settings')
      .eq('id', userId)
      .single();

    if (getUserError) {
      return; // Fail silently for preference updates
    }

    const notificationSettings = user.notification_settings || {};
    const privacySettings = user.privacy_settings || {};

    // Update settings based on consent type
    switch (consentType) {
      case 'marketing':
        notificationSettings.marketing = status === 'granted';
        notificationSettings.promotional = status === 'granted';
        break;
      case 'analytics':
        privacySettings.behavioral_analytics = status === 'granted';
        privacySettings.data_processing_analytics = status === 'granted';
        break;
      case 'location':
        privacySettings.location_tracking = status === 'granted';
        break;
      case 'newsletters':
        notificationSettings.newsletters = status === 'granted';
        break;
    }

    await supabase
      .from('users')
      .update({
        notification_settings: notificationSettings,
        privacy_settings: privacySettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

  } catch (error) {
    console.error('Update user preferences error:', error);
  }
}

async function stopDataProcessingForWithdrawnConsent(userId, consentType) {
  try {
    // Stop relevant data processing activities
    await supabase
      .from('data_processing_activities')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
        stop_reason: `Consent withdrawn for ${consentType}`
      })
      .eq('user_id', userId)
      .eq('legal_basis', 'consent')
      .contains('data_categories', [consentType]);

  } catch (error) {
    console.error('Stop data processing error:', error);
  }
}

function checkRequiredConsents(userConsents, requiredConsents) {
  const requiredTypes = requiredConsents
    .filter(req => req.required)
    .map(req => req.type);
  
  const grantedTypes = userConsents
    .filter(consent => consent.status === 'granted')
    .map(consent => consent.consent_type);
  
  return requiredTypes.every(type => grantedTypes.includes(type));
}

function findMissingConsents(userConsents, requiredConsents) {
  const requiredTypes = requiredConsents
    .filter(req => req.required)
    .map(req => req.type);
  
  const grantedTypes = userConsents
    .filter(consent => consent.status === 'granted')
    .map(consent => consent.consent_type);
  
  return requiredTypes.filter(type => !grantedTypes.includes(type));
}