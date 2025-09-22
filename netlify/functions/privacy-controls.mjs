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
            'get_settings', 
            'update_settings', 
            'get_consent_history',
            'update_consent',
            'get_data_categories',
            'request_data_processing',
            'get_privacy_policy',
            'log_privacy_event'
          ]
        })
      };
    }

    switch (action) {
      case 'get_settings':
        return await getPrivacySettings(event.queryStringParameters, headers);
      
      case 'update_settings':
        return await updatePrivacySettings(event.body, headers);
      
      case 'get_consent_history':
        return await getConsentHistory(event.queryStringParameters, headers);
      
      case 'update_consent':
        return await updateConsent(event.body, headers);
      
      case 'get_data_categories':
        return await getDataCategories(headers);
      
      case 'request_data_processing':
        return await requestDataProcessing(event.body, headers);
      
      case 'get_privacy_policy':
        return await getPrivacyPolicy(headers);
      
      case 'log_privacy_event':
        return await logPrivacyEvent(event.body, headers);
      
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
    console.error('Privacy controls error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Privacy controls operation failed',
        error: error.message
      })
    };
  }
};

// Get user privacy settings
async function getPrivacySettings(queryParams, headers) {
  try {
    const { user_id } = queryParams || {};
    
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

    // Get user's current privacy settings
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, privacy_settings, notification_settings, data_processing_consent')
      .eq('id', user_id)
      .single();

    if (userError) {
      throw userError;
    }

    // Get user's consent records
    const { data: consents, error: consentError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false });

    if (consentError) {
      throw consentError;
    }

    // Get data processing activities
    const { data: processing, error: processingError } = await supabase
      .from('data_processing_activities')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const privacySettings = {
      user_id: user_id,
      privacy_settings: user.privacy_settings || getDefaultPrivacySettings(),
      notification_settings: user.notification_settings || getDefaultNotificationSettings(),
      data_processing_consent: user.data_processing_consent || {},
      consent_history: consents || [],
      recent_processing_activities: processing || [],
      data_categories: getAvailableDataCategories(),
      privacy_controls: {
        data_export_available: true,
        data_deletion_available: true,
        data_portability_available: true,
        consent_withdrawal_available: true,
        data_processing_objection_available: true
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: privacySettings
      })
    };

  } catch (error) {
    console.error('Get privacy settings error:', error);
    throw error;
  }
}

// Update user privacy settings
async function updatePrivacySettings(requestBody, headers) {
  try {
    const {
      user_id,
      privacy_settings,
      notification_settings,
      data_processing_consent,
      change_reason
    } = JSON.parse(requestBody);

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

    // Validate privacy settings
    const validatedPrivacySettings = validatePrivacySettings(privacy_settings);
    const validatedNotificationSettings = validateNotificationSettings(notification_settings);

    // Update user record
    const updateData = {};
    if (validatedPrivacySettings) {
      updateData.privacy_settings = validatedPrivacySettings;
    }
    if (validatedNotificationSettings) {
      updateData.notification_settings = validatedNotificationSettings;
    }
    if (data_processing_consent) {
      updateData.data_processing_consent = data_processing_consent;
    }
    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log privacy settings change
    await supabase.from('privacy_events').insert([{
      user_id: user_id,
      event_type: 'settings_updated',
      description: 'User updated privacy settings',
      metadata: {
        changed_settings: Object.keys(updateData),
        change_reason: change_reason || 'User preference',
        previous_settings: privacy_settings,
        new_settings: validatedPrivacySettings
      },
      created_at: new Date().toISOString()
    }]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Privacy settings updated successfully',
        data: {
          user_id: user_id,
          updated_settings: updateData,
          effective_from: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Update privacy settings error:', error);
    throw error;
  }
}

// Get consent history
async function getConsentHistory(queryParams, headers) {
  try {
    const { user_id, limit = '50' } = queryParams || {};
    
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

    const { data: consentHistory, error } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      throw error;
    }

    // Get privacy events related to consent
    const { data: privacyEvents, error: eventsError } = await supabase
      .from('privacy_events')
      .select('*')
      .eq('user_id', user_id)
      .in('event_type', ['consent_granted', 'consent_withdrawn', 'consent_updated'])
      .order('created_at', { ascending: false })
      .limit(20);

    const history = {
      user_id: user_id,
      consent_records: consentHistory || [],
      privacy_events: privacyEvents || [],
      summary: {
        total_consents: consentHistory?.length || 0,
        active_consents: consentHistory?.filter(c => c.status === 'granted').length || 0,
        withdrawn_consents: consentHistory?.filter(c => c.status === 'withdrawn').length || 0,
        last_updated: consentHistory?.[0]?.updated_at || null
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

// Update specific consent
async function updateConsent(requestBody, headers) {
  try {
    const {
      user_id,
      consent_type,
      status,
      purpose,
      legal_basis,
      retention_period,
      change_reason
    } = JSON.parse(requestBody);

    if (!user_id || !consent_type || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID, consent type, and status are required'
        })
      };
    }

    if (!['granted', 'withdrawn', 'pending'].includes(status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid consent status. Must be: granted, withdrawn, or pending'
        })
      };
    }

    // Update or insert consent record
    const consentData = {
      user_id: user_id,
      consent_type: consent_type,
      status: status,
      purpose: purpose || '',
      legal_basis: legal_basis || 'consent',
      retention_period: retention_period || null,
      granted_at: status === 'granted' ? new Date().toISOString() : null,
      withdrawn_at: status === 'withdrawn' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedConsent, error } = await supabase
      .from('user_consents')
      .upsert([consentData], {
        onConflict: 'user_id,consent_type',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log consent change as privacy event
    await supabase.from('privacy_events').insert([{
      user_id: user_id,
      event_type: `consent_${status}`,
      description: `User ${status} consent for ${consent_type}`,
      metadata: {
        consent_type: consent_type,
        previous_status: 'unknown', // We could track this better
        new_status: status,
        change_reason: change_reason || 'User action',
        legal_basis: legal_basis
      },
      created_at: new Date().toISOString()
    }]);

    // If consent is withdrawn, check if we need to stop processing
    if (status === 'withdrawn') {
      await handleConsentWithdrawal(user_id, consent_type);
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
    console.error('Update consent error:', error);
    throw error;
  }
}

// Get available data categories
async function getDataCategories(headers) {
  try {
    const dataCategories = {
      personal_data: {
        category: 'Personal Data',
        description: 'Information that can identify you personally',
        data_types: [
          'Full name',
          'Email address',
          'Phone number',
          'Profile picture',
          'Date of birth',
          'Address information'
        ],
        legal_basis: 'Contract performance, Legitimate interest',
        retention_period: '7 years after account closure'
      },
      behavioral_data: {
        category: 'Behavioral Data',
        description: 'Information about how you use our platform',
        data_types: [
          'Page visits',
          'Search queries',
          'Click patterns',
          'Time spent on pages',
          'Device information',
          'Browser information'
        ],
        legal_basis: 'Legitimate interest, Consent',
        retention_period: '2 years from collection'
      },
      transactional_data: {
        category: 'Transactional Data',
        description: 'Information about your bookings and payments',
        data_types: [
          'Booking history',
          'Payment records',
          'Invoice information',
          'Refund requests',
          'Transaction amounts',
          'Payment methods'
        ],
        legal_basis: 'Contract performance, Legal obligation',
        retention_period: '10 years for tax purposes'
      },
      communication_data: {
        category: 'Communication Data',
        description: 'Messages and interactions with other users',
        data_types: [
          'Messages sent/received',
          'Reviews and ratings',
          'Support tickets',
          'Email communications',
          'Notification preferences'
        ],
        legal_basis: 'Contract performance, Legitimate interest',
        retention_period: '3 years after last communication'
      },
      location_data: {
        category: 'Location Data',
        description: 'Information about your location preferences',
        data_types: [
          'Search locations',
          'Saved locations',
          'Approximate location (city)',
          'Location-based recommendations'
        ],
        legal_basis: 'Consent, Legitimate interest',
        retention_period: '1 year from last use'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          categories: dataCategories,
          last_updated: '2024-01-15T00:00:00Z',
          gdpr_compliant: true
        }
      })
    };

  } catch (error) {
    console.error('Get data categories error:', error);
    throw error;
  }
}

// Request data processing
async function requestDataProcessing(requestBody, headers) {
  try {
    const {
      user_id,
      processing_type,
      data_categories,
      purpose,
      legal_basis,
      retention_period
    } = JSON.parse(requestBody);

    if (!user_id || !processing_type || !data_categories || !purpose || !legal_basis) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields for data processing request'
        })
      };
    }

    // Create data processing record
    const { data: processingRecord, error } = await supabase
      .from('data_processing_activities')
      .insert([{
        user_id: user_id,
        processing_type: processing_type,
        data_categories: data_categories,
        purpose: purpose,
        legal_basis: legal_basis,
        retention_period: retention_period,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log privacy event
    await supabase.from('privacy_events').insert([{
      user_id: user_id,
      event_type: 'data_processing_requested',
      description: `Data processing requested: ${processing_type}`,
      metadata: {
        processing_type: processing_type,
        data_categories: data_categories,
        purpose: purpose,
        legal_basis: legal_basis,
        processing_id: processingRecord.id
      },
      created_at: new Date().toISOString()
    }]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data processing request created successfully',
        data: processingRecord
      })
    };

  } catch (error) {
    console.error('Request data processing error:', error);
    throw error;
  }
}

// Get privacy policy information
async function getPrivacyPolicy(headers) {
  try {
    const privacyPolicy = {
      version: '2.0',
      effective_date: '2024-01-01T00:00:00Z',
      last_updated: '2024-01-15T00:00:00Z',
      
      data_controller: {
        name: 'SichrPlace GmbH',
        address: 'Musterstraße 123, 12345 Berlin, Germany',
        email: 'privacy@sichrplace.com',
        phone: '+49 30 12345678'
      },
      
      data_protection_officer: {
        name: 'Data Protection Officer',
        email: 'dpo@sichrplace.com'
      },
      
      data_collection: {
        what_we_collect: [
          'Personal identification information',
          'Usage and behavioral data',
          'Transactional information',
          'Communication data',
          'Location preferences'
        ],
        how_we_collect: [
          'Information you provide directly',
          'Automatic data collection through cookies',
          'Third-party integrations',
          'Analytics and tracking tools'
        ]
      },
      
      legal_basis: {
        contract_performance: 'To provide our apartment booking services',
        legitimate_interest: 'To improve our platform and user experience',
        consent: 'For marketing communications and optional features',
        legal_obligation: 'To comply with tax and regulatory requirements'
      },
      
      data_sharing: {
        with_whom: [
          'Property owners/landlords (for bookings)',
          'Payment processors (for transactions)',
          'Analytics providers (anonymized data)',
          'Legal authorities (when required)'
        ],
        safeguards: [
          'Data processing agreements',
          'Encryption in transit and at rest',
          'Regular security audits',
          'Limited access controls'
        ]
      },
      
      your_rights: {
        access: 'Request access to your personal data',
        rectification: 'Correct inaccurate or incomplete data',
        erasure: 'Request deletion of your data',
        portability: 'Export your data in a structured format',
        restriction: 'Limit how we process your data',
        objection: 'Object to certain types of processing',
        withdraw_consent: 'Withdraw consent for processing based on consent'
      },
      
      data_retention: {
        account_data: '7 years after account closure',
        transaction_data: '10 years for legal compliance',
        communication_data: '3 years after last interaction',
        behavioral_data: '2 years from collection',
        location_data: '1 year from last use'
      },
      
      security_measures: [
        'End-to-end encryption',
        'Regular security audits',
        'Access controls and authentication',
        'Data backup and recovery procedures',
        'Employee training on data protection'
      ],
      
      contact_info: {
        privacy_questions: 'privacy@sichrplace.com',
        data_requests: 'data-requests@sichrplace.com',
        general_support: 'support@sichrplace.com'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: privacyPolicy
      })
    };

  } catch (error) {
    console.error('Get privacy policy error:', error);
    throw error;
  }
}

// Log privacy event
async function logPrivacyEvent(requestBody, headers) {
  try {
    const {
      user_id,
      event_type,
      description,
      metadata = {}
    } = JSON.parse(requestBody);

    if (!user_id || !event_type || !description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'User ID, event type, and description are required'
        })
      };
    }

    const { data: privacyEvent, error } = await supabase
      .from('privacy_events')
      .insert([{
        user_id: user_id,
        event_type: event_type,
        description: description,
        metadata: metadata,
        created_at: new Date().toISOString()
      }])
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
        message: 'Privacy event logged successfully',
        data: privacyEvent
      })
    };

  } catch (error) {
    console.error('Log privacy event error:', error);
    throw error;
  }
}

// Helper functions
function getDefaultPrivacySettings() {
  return {
    profile_visibility: 'public',
    show_email: false,
    show_phone: false,
    data_processing_analytics: true,
    data_processing_marketing: false,
    data_sharing_partners: false,
    location_tracking: true,
    behavioral_analytics: true
  };
}

function getDefaultNotificationSettings() {
  return {
    email: true,
    sms: false,
    push: true,
    marketing: false,
    booking_updates: true,
    messages: true,
    reviews: true,
    promotional: false,
    system_alerts: true
  };
}

function validatePrivacySettings(settings) {
  if (!settings) return null;
  
  const allowedKeys = [
    'profile_visibility',
    'show_email',
    'show_phone',
    'data_processing_analytics',
    'data_processing_marketing',
    'data_sharing_partners',
    'location_tracking',
    'behavioral_analytics'
  ];
  
  const validatedSettings = {};
  for (const key of allowedKeys) {
    if (settings.hasOwnProperty(key)) {
      validatedSettings[key] = Boolean(settings[key]);
    }
  }
  
  return Object.keys(validatedSettings).length > 0 ? validatedSettings : null;
}

function validateNotificationSettings(settings) {
  if (!settings) return null;
  
  const allowedKeys = [
    'email',
    'sms',
    'push',
    'marketing',
    'booking_updates',
    'messages',
    'reviews',
    'promotional',
    'system_alerts'
  ];
  
  const validatedSettings = {};
  for (const key of allowedKeys) {
    if (settings.hasOwnProperty(key)) {
      validatedSettings[key] = Boolean(settings[key]);
    }
  }
  
  return Object.keys(validatedSettings).length > 0 ? validatedSettings : null;
}

function getAvailableDataCategories() {
  return [
    'personal_data',
    'behavioral_data',
    'transactional_data',
    'communication_data',
    'location_data'
  ];
}

async function handleConsentWithdrawal(userId, consentType) {
  try {
    // Different actions based on consent type
    switch (consentType) {
      case 'marketing':
        // Stop all marketing communications
        await supabase
          .from('users')
          .update({
            notification_settings: {
              marketing: false,
              promotional: false
            }
          })
          .eq('id', userId);
        break;
        
      case 'analytics':
        // Stop behavioral analytics
        await supabase
          .from('users')
          .update({
            privacy_settings: {
              behavioral_analytics: false,
              data_processing_analytics: false
            }
          })
          .eq('id', userId);
        break;
        
      case 'location':
        // Clear location preferences
        await supabase
          .from('users')
          .update({
            privacy_settings: {
              location_tracking: false
            }
          })
          .eq('id', userId);
        break;
    }

    // Log the withdrawal action
    await supabase.from('privacy_events').insert([{
      user_id: userId,
      event_type: 'consent_withdrawal_processed',
      description: `Processing stopped for ${consentType} due to consent withdrawal`,
      metadata: {
        consent_type: consentType,
        action_taken: 'processing_stopped',
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    }]);

  } catch (error) {
    console.error('Handle consent withdrawal error:', error);
    // Log error but don't throw - this is a background process
  }
}