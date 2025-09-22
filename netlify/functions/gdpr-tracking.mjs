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
            'log_tracking',
            'get_tracking_logs',
            'consent_management',
            'data_processing_log',
            'right_to_be_forgotten',
            'data_export',
            'privacy_audit',
            'cookie_tracking',
            'compliance_check',
            'data_retention_policy',
            'third_party_sharing_log',
            'breach_notification',
            'consent_withdrawal',
            'data_minimization_check',
            'privacy_impact_assessment'
          ]
        })
      };
    }

    // Get authentication for most actions
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
    }

    // Some actions require authentication
    const authRequiredActions = [
      'consent_management', 'right_to_be_forgotten', 'data_export',
      'consent_withdrawal', 'get_tracking_logs'
    ];

    if (authRequiredActions.includes(action) && !user) {
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
      case 'log_tracking':
        return await logTracking(event.body, headers, user?.id);
      
      case 'get_tracking_logs':
        return await getTrackingLogs(user.id, event.queryStringParameters, headers);
      
      case 'consent_management':
        return await consentManagement(user.id, event.body, headers);
      
      case 'data_processing_log':
        return await dataProcessingLog(event.body, headers, user?.id);
      
      case 'right_to_be_forgotten':
        return await rightToBeForgotten(user.id, event.body, headers);
      
      case 'data_export':
        return await dataExport(user.id, event.queryStringParameters, headers);
      
      case 'privacy_audit':
        return await privacyAudit(event.queryStringParameters, headers);
      
      case 'cookie_tracking':
        return await cookieTracking(event.body, headers, user?.id);
      
      case 'compliance_check':
        return await complianceCheck(event.queryStringParameters, headers);
      
      case 'data_retention_policy':
        return await dataRetentionPolicy(event.body, headers);
      
      case 'third_party_sharing_log':
        return await thirdPartySharingLog(event.body, headers, user?.id);
      
      case 'breach_notification':
        return await breachNotification(event.body, headers);
      
      case 'consent_withdrawal':
        return await consentWithdrawal(user.id, event.body, headers);
      
      case 'data_minimization_check':
        return await dataMinimizationCheck(event.queryStringParameters, headers);
      
      case 'privacy_impact_assessment':
        return await privacyImpactAssessment(event.body, headers);
      
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
    console.error('GDPR tracking error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'GDPR tracking operation failed',
        error: error.message
      })
    };
  }
};

// Log GDPR tracking event
async function logTracking(requestBody, headers, userId = null) {
  try {
    const {
      user_id,
      event_type,
      data_category,
      action_performed,
      legal_basis,
      purpose,
      data_source,
      data_destination,
      retention_period,
      consent_id,
      ip_address,
      user_agent,
      location,
      metadata = {},
      processing_details
    } = JSON.parse(requestBody || '{}');

    if (!event_type || !data_category || !action_performed) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Event type, data category, and action performed are required'
        })
      };
    }

    // Validate legal basis
    const validLegalBases = [
      'consent', 'contract', 'legal_obligation', 
      'vital_interests', 'public_task', 'legitimate_interests'
    ];

    if (legal_basis && !validLegalBases.includes(legal_basis)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid legal basis provided'
        })
      };
    }

    // Create tracking log entry
    const trackingData = {
      user_id: user_id || userId,
      event_type,
      data_category,
      action_performed,
      legal_basis: legal_basis || 'legitimate_interests',
      purpose: purpose || 'Platform functionality',
      data_source,
      data_destination,
      retention_period,
      consent_id,
      ip_address,
      user_agent,
      location,
      metadata,
      processing_details,
      logged_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: trackingLog, error: trackingError } = await supabase
      .from('gdpr_tracking_logs')
      .insert(trackingData)
      .select()
      .single();

    if (trackingError) {
      throw trackingError;
    }

    // Check if this is a high-risk processing activity
    const highRiskCategories = ['biometric', 'health', 'financial', 'location', 'behavior'];
    const isHighRisk = highRiskCategories.includes(data_category) || 
                      event_type === 'profiling' ||
                      event_type === 'automated_decision_making';

    if (isHighRisk) {
      // Create high-risk processing alert
      await supabase
        .from('gdpr_high_risk_activities')
        .insert({
          tracking_log_id: trackingLog.id,
          risk_level: 'high',
          alert_reason: `High-risk processing: ${data_category} data with ${event_type}`,
          requires_dpia: true,
          created_at: new Date().toISOString()
        });
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'GDPR tracking logged successfully',
        data: {
          tracking_id: trackingLog.id,
          is_high_risk: isHighRisk,
          logged_at: trackingLog.logged_at
        }
      })
    };

  } catch (error) {
    console.error('Log tracking error:', error);
    throw error;
  }
}

// Get tracking logs for user
async function getTrackingLogs(userId, queryParams, headers) {
  try {
    const {
      event_type,
      data_category,
      start_date,
      end_date,
      legal_basis,
      limit = '100',
      offset = '0'
    } = queryParams || {};

    let query = supabase
      .from('gdpr_tracking_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (event_type) {
      query = query.eq('event_type', event_type);
    }

    if (data_category) {
      query = query.eq('data_category', data_category);
    }

    if (legal_basis) {
      query = query.eq('legal_basis', legal_basis);
    }

    if (start_date) {
      query = query.gte('logged_at', start_date);
    }

    if (end_date) {
      query = query.lte('logged_at', end_date);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      throw logsError;
    }

    // Get summary statistics
    const { data: allLogs, error: statsError } = await supabase
      .from('gdpr_tracking_logs')
      .select('event_type, data_category, legal_basis')
      .eq('user_id', userId);

    const statistics = {
      total_events: allLogs?.length || 0,
      by_event_type: {},
      by_data_category: {},
      by_legal_basis: {}
    };

    allLogs?.forEach(log => {
      statistics.by_event_type[log.event_type] = 
        (statistics.by_event_type[log.event_type] || 0) + 1;
      statistics.by_data_category[log.data_category] = 
        (statistics.by_data_category[log.data_category] || 0) + 1;
      statistics.by_legal_basis[log.legal_basis] = 
        (statistics.by_legal_basis[log.legal_basis] || 0) + 1;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          logs: logs || [],
          statistics,
          total_fetched: logs?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get tracking logs error:', error);
    throw error;
  }
}

// Manage user consent
async function consentManagement(userId, requestBody, headers) {
  try {
    const {
      action,
      consent_type,
      purpose,
      is_granted,
      expiry_date,
      consent_text,
      version,
      withdrawal_reason
    } = JSON.parse(requestBody || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action is required (grant, withdraw, update, get)'
        })
      };
    }

    switch (action) {
      case 'grant':
        if (!consent_type || is_granted === undefined) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Consent type and is_granted are required'
            })
          };
        }

        const { data: consent, error: consentError } = await supabase
          .from('user_consents')
          .insert({
            user_id: userId,
            consent_type,
            purpose: purpose || 'Platform functionality',
            is_granted,
            consent_text,
            version: version || '1.0',
            granted_at: new Date().toISOString(),
            expires_at: expiry_date,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (consentError) {
          throw consentError;
        }

        // Log the consent action
        await logTracking(JSON.stringify({
          user_id: userId,
          event_type: 'consent_granted',
          data_category: 'consent',
          action_performed: `Granted consent for ${consent_type}`,
          legal_basis: 'consent',
          purpose: purpose || 'Platform functionality',
          consent_id: consent.id
        }), headers);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Consent recorded successfully',
            data: consent
          })
        };

      case 'withdraw':
        if (!consent_type) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Consent type is required for withdrawal'
            })
          };
        }

        const { data: updatedConsent, error: withdrawError } = await supabase
          .from('user_consents')
          .update({
            is_granted: false,
            withdrawn_at: new Date().toISOString(),
            withdrawal_reason: withdrawal_reason || 'User requested',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('consent_type', consent_type)
          .eq('is_granted', true)
          .select()
          .single();

        if (withdrawError) {
          throw withdrawError;
        }

        // Log the withdrawal
        await logTracking(JSON.stringify({
          user_id: userId,
          event_type: 'consent_withdrawn',
          data_category: 'consent',
          action_performed: `Withdrew consent for ${consent_type}`,
          legal_basis: 'consent',
          purpose: 'Consent withdrawal',
          consent_id: updatedConsent.id
        }), headers);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Consent withdrawn successfully',
            data: updatedConsent
          })
        };

      case 'get':
        const { data: userConsents, error: getError } = await supabase
          .from('user_consents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (getError) {
          throw getError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              consents: userConsents || [],
              active_consents: userConsents?.filter(c => c.is_granted) || []
            }
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action. Use grant, withdraw, update, or get'
          })
        };
    }

  } catch (error) {
    console.error('Consent management error:', error);
    throw error;
  }
}

// Log data processing activities
async function dataProcessingLog(requestBody, headers, userId = null) {
  try {
    const {
      processing_activity,
      data_categories,
      purposes,
      legal_basis,
      recipients,
      retention_period,
      security_measures,
      international_transfers,
      automated_processing,
      profiling_details,
      data_subject_rights,
      controller_details,
      processor_details
    } = JSON.parse(requestBody || '{}');

    if (!processing_activity || !data_categories || !purposes || !legal_basis) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Processing activity, data categories, purposes, and legal basis are required'
        })
      };
    }

    const { data: processingLog, error: processingError } = await supabase
      .from('data_processing_records')
      .insert({
        processing_activity,
        data_categories: Array.isArray(data_categories) ? data_categories : [data_categories],
        purposes: Array.isArray(purposes) ? purposes : [purposes],
        legal_basis,
        recipients: recipients || [],
        retention_period,
        security_measures: security_measures || [],
        international_transfers: international_transfers || [],
        automated_processing: automated_processing || false,
        profiling_details,
        data_subject_rights: data_subject_rights || [],
        controller_details,
        processor_details,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (processingError) {
      throw processingError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data processing activity logged successfully',
        data: processingLog
      })
    };

  } catch (error) {
    console.error('Data processing log error:', error);
    throw error;
  }
}

// Handle right to be forgotten request
async function rightToBeForgotten(userId, requestBody, headers) {
  try {
    const {
      reason,
      specific_data_categories,
      exceptions,
      confirmation_required = true
    } = JSON.parse(requestBody || '{}');

    if (!reason) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Reason for deletion request is required'
        })
      };
    }

    // Create deletion request record
    const { data: deletionRequest, error: deletionError } = await supabase
      .from('data_deletion_requests')
      .insert({
        user_id: userId,
        reason,
        specific_data_categories: specific_data_categories || [],
        exceptions: exceptions || [],
        status: confirmation_required ? 'pending_confirmation' : 'pending_processing',
        requested_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (deletionError) {
      throw deletionError;
    }

    // Log the deletion request
    await logTracking(JSON.stringify({
      user_id: userId,
      event_type: 'deletion_request',
      data_category: 'personal_data',
      action_performed: 'Right to be forgotten request submitted',
      legal_basis: 'data_subject_rights',
      purpose: 'GDPR Article 17 compliance',
      metadata: {
        deletion_request_id: deletionRequest.id,
        reason
      }
    }), headers);

    // If no confirmation required, start processing immediately
    if (!confirmation_required) {
      // In a real implementation, this would trigger a background job
      // to anonymize/delete user data according to retention policies
      await supabase
        .from('data_deletion_requests')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString()
        })
        .eq('id', deletionRequest.id);
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Right to be forgotten request submitted successfully',
        data: {
          request_id: deletionRequest.id,
          status: deletionRequest.status,
          estimated_completion: confirmation_required ? 
            'Pending confirmation' : 
            'Within 30 days',
          next_steps: confirmation_required ?
            'Please check your email for confirmation instructions' :
            'Your data deletion request is being processed'
        }
      })
    };

  } catch (error) {
    console.error('Right to be forgotten error:', error);
    throw error;
  }
}

// Export user data
async function dataExport(userId, queryParams, headers) {
  try {
    const {
      format = 'json',
      include_tracking_logs = 'true',
      include_consents = 'true',
      data_categories,
      date_range_start,
      date_range_end
    } = queryParams || {};

    // Get user profile data
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    const exportData = {
      export_metadata: {
        user_id: userId,
        export_date: new Date().toISOString(),
        format,
        includes: {
          tracking_logs: include_tracking_logs === 'true',
          consents: include_consents === 'true'
        }
      },
      personal_data: {
        profile: userProfile,
        apartments: [],
        reviews: [],
        favorites: [],
        messages: []
      }
    };

    // Get apartments data
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('*')
      .eq('owner_id', userId);

    if (!apartmentsError) {
      exportData.personal_data.apartments = apartments || [];
    }

    // Get reviews data
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId);

    if (!reviewsError) {
      exportData.personal_data.reviews = reviews || [];
    }

    // Get favorites
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId);

    if (!favoritesError) {
      exportData.personal_data.favorites = favorites || [];
    }

    // Include tracking logs if requested
    if (include_tracking_logs === 'true') {
      let logsQuery = supabase
        .from('gdpr_tracking_logs')
        .select('*')
        .eq('user_id', userId);

      if (date_range_start) {
        logsQuery = logsQuery.gte('logged_at', date_range_start);
      }

      if (date_range_end) {
        logsQuery = logsQuery.lte('logged_at', date_range_end);
      }

      const { data: trackingLogs, error: logsError } = await logsQuery;

      if (!logsError) {
        exportData.gdpr_data = {
          tracking_logs: trackingLogs || []
        };
      }
    }

    // Include consents if requested
    if (include_consents === 'true') {
      const { data: consents, error: consentsError } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId);

      if (!consentsError) {
        if (!exportData.gdpr_data) exportData.gdpr_data = {};
        exportData.gdpr_data.consents = consents || [];
      }
    }

    // Log the data export
    await logTracking(JSON.stringify({
      user_id: userId,
      event_type: 'data_export',
      data_category: 'personal_data',
      action_performed: 'User data export generated',
      legal_basis: 'data_subject_rights',
      purpose: 'GDPR Article 20 compliance',
      metadata: {
        export_format: format,
        includes_tracking: include_tracking_logs === 'true',
        includes_consents: include_consents === 'true'
      }
    }), headers);

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('data_exports')
      .insert({
        user_id: userId,
        export_format: format,
        data_categories: data_categories ? data_categories.split(',') : ['all'],
        status: 'completed',
        file_size: JSON.stringify(exportData).length,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data export completed successfully',
        data: {
          export_id: exportRecord?.id,
          export_data: exportData,
          download_info: {
            format,
            size_bytes: JSON.stringify(exportData).length,
            generated_at: new Date().toISOString()
          }
        }
      })
    };

  } catch (error) {
    console.error('Data export error:', error);
    throw error;
  }
}

// Conduct privacy audit
async function privacyAudit(queryParams, headers) {
  try {
    const {
      audit_type = 'general',
      start_date,
      end_date,
      user_id,
      data_category
    } = queryParams || {};

    const auditResults = {
      audit_metadata: {
        audit_type,
        conducted_at: new Date().toISOString(),
        period: {
          start: start_date || 'All time',
          end: end_date || 'Present'
        }
      },
      findings: []
    };

    // Base query for tracking logs
    let baseQuery = supabase.from('gdpr_tracking_logs').select('*');

    if (user_id) {
      baseQuery = baseQuery.eq('user_id', user_id);
    }

    if (data_category) {
      baseQuery = baseQuery.eq('data_category', data_category);
    }

    if (start_date) {
      baseQuery = baseQuery.gte('logged_at', start_date);
    }

    if (end_date) {
      baseQuery = baseQuery.lte('logged_at', end_date);
    }

    const { data: trackingLogs, error: logsError } = await baseQuery;

    if (logsError) {
      throw logsError;
    }

    // Audit checks
    const checks = {
      consent_compliance: 0,
      legal_basis_coverage: 0,
      data_minimization: 0,
      retention_compliance: 0,
      security_measures: 0
    };

    // Check consent compliance
    const consentBasedLogs = trackingLogs?.filter(log => log.legal_basis === 'consent') || [];
    checks.consent_compliance = consentBasedLogs.length;

    // Check legal basis coverage
    const uniqueLegalBases = new Set(trackingLogs?.map(log => log.legal_basis) || []);
    checks.legal_basis_coverage = uniqueLegalBases.size;

    // Check for high-risk activities
    const { data: highRiskActivities, error: riskError } = await supabase
      .from('gdpr_high_risk_activities')
      .select('*');

    if (!riskError && highRiskActivities) {
      auditResults.findings.push({
        category: 'High Risk Processing',
        severity: 'high',
        count: highRiskActivities.length,
        description: `${highRiskActivities.length} high-risk processing activities identified`
      });
    }

    // Check for missing DPIAs
    const highRiskWithoutDPIA = highRiskActivities?.filter(
      activity => activity.requires_dpia && !activity.dpia_completed
    ) || [];

    if (highRiskWithoutDPIA.length > 0) {
      auditResults.findings.push({
        category: 'DPIA Compliance',
        severity: 'high',
        count: highRiskWithoutDPIA.length,
        description: `${highRiskWithoutDPIA.length} high-risk activities require DPIA`
      });
    }

    // Check consent expiry
    const { data: expiredConsents, error: expiredError } = await supabase
      .from('user_consents')
      .select('*')
      .lt('expires_at', new Date().toISOString())
      .eq('is_granted', true);

    if (!expiredError && expiredConsents?.length > 0) {
      auditResults.findings.push({
        category: 'Consent Management',
        severity: 'medium',
        count: expiredConsents.length,
        description: `${expiredConsents.length} expired consents still marked as active`
      });
    }

    auditResults.summary = {
      total_tracking_events: trackingLogs?.length || 0,
      unique_users_tracked: new Set(trackingLogs?.map(log => log.user_id).filter(id => id)).size,
      compliance_checks: checks,
      findings_count: auditResults.findings.length,
      overall_score: calculateComplianceScore(auditResults.findings)
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: auditResults
      })
    };

  } catch (error) {
    console.error('Privacy audit error:', error);
    throw error;
  }
}

// Calculate compliance score based on findings
function calculateComplianceScore(findings) {
  if (findings.length === 0) return 100;
  
  let score = 100;
  findings.forEach(finding => {
    switch (finding.severity) {
      case 'high':
        score -= 20;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 5;
        break;
    }
  });
  
  return Math.max(0, score);
}

// Track cookie usage
async function cookieTracking(requestBody, headers, userId = null) {
  try {
    const {
      cookie_name,
      cookie_type,
      purpose,
      expiry,
      is_essential,
      consent_required,
      domain,
      user_consent_status
    } = JSON.parse(requestBody || '{}');

    if (!cookie_name || !cookie_type || !purpose) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cookie name, type, and purpose are required'
        })
      };
    }

    const { data: cookieLog, error: cookieError } = await supabase
      .from('cookie_tracking_logs')
      .insert({
        user_id: userId,
        cookie_name,
        cookie_type,
        purpose,
        expiry,
        is_essential: is_essential || false,
        consent_required: consent_required || !is_essential,
        domain,
        user_consent_status,
        logged_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (cookieError) {
      throw cookieError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Cookie usage tracked successfully',
        data: cookieLog
      })
    };

  } catch (error) {
    console.error('Cookie tracking error:', error);
    throw error;
  }
}

// Check overall compliance status
async function complianceCheck(queryParams, headers) {
  try {
    const {
      regulation = 'gdpr',
      detailed = 'false'
    } = queryParams || {};

    const complianceReport = {
      regulation: regulation.toUpperCase(),
      check_date: new Date().toISOString(),
      overall_status: 'unknown',
      compliance_score: 0,
      areas: {}
    };

    // Check different compliance areas
    const areas = [
      'consent_management',
      'data_processing_records',
      'privacy_notices',
      'data_subject_rights',
      'security_measures',
      'breach_procedures'
    ];

    for (const area of areas) {
      complianceReport.areas[area] = await checkComplianceArea(area);
    }

    // Calculate overall score
    const scores = Object.values(complianceReport.areas).map(area => area.score);
    complianceReport.compliance_score = Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );

    // Determine overall status
    if (complianceReport.compliance_score >= 90) {
      complianceReport.overall_status = 'compliant';
    } else if (complianceReport.compliance_score >= 70) {
      complianceReport.overall_status = 'mostly_compliant';
    } else if (complianceReport.compliance_score >= 50) {
      complianceReport.overall_status = 'partially_compliant';
    } else {
      complianceReport.overall_status = 'non_compliant';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: complianceReport
      })
    };

  } catch (error) {
    console.error('Compliance check error:', error);
    throw error;
  }
}

// Check specific compliance area
async function checkComplianceArea(area) {
  try {
    switch (area) {
      case 'consent_management':
        const { data: consents, error: consentError } = await supabase
          .from('user_consents')
          .select('*');
        
        return {
          score: consents?.length > 0 ? 85 : 20,
          status: consents?.length > 0 ? 'good' : 'needs_attention',
          details: `${consents?.length || 0} consent records found`
        };

      case 'data_processing_records':
        const { data: records, error: recordError } = await supabase
          .from('data_processing_records')
          .select('*');
        
        return {
          score: records?.length > 0 ? 80 : 30,
          status: records?.length > 0 ? 'good' : 'needs_attention',
          details: `${records?.length || 0} processing records maintained`
        };

      default:
        return {
          score: 50,
          status: 'unknown',
          details: 'Compliance check not implemented for this area'
        };
    }
  } catch (error) {
    return {
      score: 0,
      status: 'error',
      details: `Error checking ${area}: ${error.message}`
    };
  }
}

// Manage data retention policies
async function dataRetentionPolicy(requestBody, headers) {
  try {
    const {
      action,
      data_category,
      retention_period,
      legal_basis,
      auto_delete,
      exceptions
    } = JSON.parse(requestBody || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action is required (create, update, get, delete)'
        })
      };
    }

    switch (action) {
      case 'create':
        if (!data_category || !retention_period) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Data category and retention period are required'
            })
          };
        }

        const { data: policy, error: policyError } = await supabase
          .from('data_retention_policies')
          .insert({
            data_category,
            retention_period,
            legal_basis: legal_basis || 'legitimate_interests',
            auto_delete: auto_delete || false,
            exceptions: exceptions || [],
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (policyError) {
          throw policyError;
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Data retention policy created successfully',
            data: policy
          })
        };

      case 'get':
        const { data: policies, error: getPolicyError } = await supabase
          .from('data_retention_policies')
          .select('*')
          .order('created_at', { ascending: false });

        if (getPolicyError) {
          throw getPolicyError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              policies: policies || []
            }
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action'
          })
        };
    }

  } catch (error) {
    console.error('Data retention policy error:', error);
    throw error;
  }
}

// Log third-party data sharing
async function thirdPartySharingLog(requestBody, headers, userId = null) {
  try {
    const {
      third_party_name,
      third_party_type,
      data_categories,
      purpose,
      legal_basis,
      transfer_mechanism,
      recipient_country,
      data_retention_period,
      user_consent_id
    } = JSON.parse(requestBody || '{}');

    if (!third_party_name || !data_categories || !purpose) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Third party name, data categories, and purpose are required'
        })
      };
    }

    const { data: sharingLog, error: sharingError } = await supabase
      .from('third_party_sharing_logs')
      .insert({
        user_id: userId,
        third_party_name,
        third_party_type: third_party_type || 'processor',
        data_categories: Array.isArray(data_categories) ? data_categories : [data_categories],
        purpose,
        legal_basis: legal_basis || 'legitimate_interests',
        transfer_mechanism,
        recipient_country,
        data_retention_period,
        user_consent_id,
        shared_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sharingError) {
      throw sharingError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Third-party data sharing logged successfully',
        data: sharingLog
      })
    };

  } catch (error) {
    console.error('Third-party sharing log error:', error);
    throw error;
  }
}

// Handle data breach notifications
async function breachNotification(requestBody, headers) {
  try {
    const {
      breach_description,
      data_categories_affected,
      individuals_affected_count,
      breach_date,
      discovery_date,
      containment_measures,
      notification_required,
      supervisory_authority_notified,
      individuals_notified,
      risk_level
    } = JSON.parse(requestBody || '{}');

    if (!breach_description || !data_categories_affected) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Breach description and affected data categories are required'
        })
      };
    }

    const { data: breachRecord, error: breachError } = await supabase
      .from('data_breach_notifications')
      .insert({
        breach_description,
        data_categories_affected: Array.isArray(data_categories_affected) ? 
          data_categories_affected : [data_categories_affected],
        individuals_affected_count: individuals_affected_count || 0,
        breach_date: breach_date || new Date().toISOString(),
        discovery_date: discovery_date || new Date().toISOString(),
        containment_measures: containment_measures || [],
        notification_required: notification_required || false,
        supervisory_authority_notified: supervisory_authority_notified || false,
        individuals_notified: individuals_notified || false,
        risk_level: risk_level || 'medium',
        reported_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (breachError) {
      throw breachError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Data breach notification recorded successfully',
        data: {
          breach_id: breachRecord.id,
          notification_requirements: {
            supervisory_authority: notification_required ? 'Required within 72 hours' : 'Not required',
            individuals: individuals_affected_count > 0 ? 'May be required based on risk' : 'Not required'
          }
        }
      })
    };

  } catch (error) {
    console.error('Breach notification error:', error);
    throw error;
  }
}

// Handle consent withdrawal
async function consentWithdrawal(userId, requestBody, headers) {
  try {
    const {
      consent_type,
      withdrawal_reason,
      effective_date
    } = JSON.parse(requestBody || '{}');

    if (!consent_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Consent type is required'
        })
      };
    }

    // Find and withdraw the consent
    const { data: withdrawnConsent, error: withdrawError } = await supabase
      .from('user_consents')
      .update({
        is_granted: false,
        withdrawn_at: effective_date || new Date().toISOString(),
        withdrawal_reason: withdrawal_reason || 'User requested withdrawal',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('consent_type', consent_type)
      .eq('is_granted', true)
      .select()
      .single();

    if (withdrawError) {
      throw withdrawError;
    }

    // Log the withdrawal
    await logTracking(JSON.stringify({
      user_id: userId,
      event_type: 'consent_withdrawn',
      data_category: 'consent',
      action_performed: `Withdrawn consent for ${consent_type}`,
      legal_basis: 'data_subject_rights',
      purpose: 'Consent withdrawal processing',
      consent_id: withdrawnConsent.id
    }), headers);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Consent withdrawn successfully',
        data: {
          consent_id: withdrawnConsent.id,
          withdrawn_at: withdrawnConsent.withdrawn_at,
          impact: 'Related data processing will cease or require alternative legal basis'
        }
      })
    };

  } catch (error) {
    console.error('Consent withdrawal error:', error);
    throw error;
  }
}

// Check data minimization compliance
async function dataMinimizationCheck(queryParams, headers) {
  try {
    const {
      data_category,
      purpose,
      start_date,
      end_date
    } = queryParams || {};

    // Get all tracking logs for analysis
    let query = supabase
      .from('gdpr_tracking_logs')
      .select('*');

    if (data_category) {
      query = query.eq('data_category', data_category);
    }

    if (purpose) {
      query = query.eq('purpose', purpose);
    }

    if (start_date) {
      query = query.gte('logged_at', start_date);
    }

    if (end_date) {
      query = query.lte('logged_at', end_date);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      throw logsError;
    }

    // Analyze data minimization
    const analysis = {
      total_processing_events: logs?.length || 0,
      data_categories: {},
      purposes: {},
      recommendations: []
    };

    logs?.forEach(log => {
      // Count by data category
      analysis.data_categories[log.data_category] = 
        (analysis.data_categories[log.data_category] || 0) + 1;

      // Count by purpose
      analysis.purposes[log.purpose] = 
        (analysis.purposes[log.purpose] || 0) + 1;
    });

    // Generate recommendations
    const categoryThreshold = 100; // Events threshold for review
    Object.entries(analysis.data_categories).forEach(([category, count]) => {
      if (count > categoryThreshold) {
        analysis.recommendations.push({
          type: 'data_minimization',
          category,
          message: `High volume of ${category} data processing (${count} events). Review necessity.`,
          priority: 'medium'
        });
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          analysis,
          compliance_status: analysis.recommendations.length === 0 ? 'good' : 'review_needed'
        }
      })
    };

  } catch (error) {
    console.error('Data minimization check error:', error);
    throw error;
  }
}

// Conduct Privacy Impact Assessment (PIA/DPIA)
async function privacyImpactAssessment(requestBody, headers) {
  try {
    const {
      processing_description,
      purposes,
      data_categories,
      individuals_affected,
      privacy_risks,
      mitigation_measures,
      necessity_justification,
      proportionality_assessment,
      stakeholder_consultation,
      monitoring_measures
    } = JSON.parse(requestBody || '{}');

    if (!processing_description || !purposes || !data_categories) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Processing description, purposes, and data categories are required'
        })
      };
    }

    const { data: pia, error: piaError } = await supabase
      .from('privacy_impact_assessments')
      .insert({
        processing_description,
        purposes: Array.isArray(purposes) ? purposes : [purposes],
        data_categories: Array.isArray(data_categories) ? data_categories : [data_categories],
        individuals_affected,
        privacy_risks: privacy_risks || [],
        mitigation_measures: mitigation_measures || [],
        necessity_justification,
        proportionality_assessment,
        stakeholder_consultation: stakeholder_consultation || false,
        monitoring_measures: monitoring_measures || [],
        status: 'draft',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (piaError) {
      throw piaError;
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Privacy Impact Assessment created successfully',
        data: {
          pia_id: pia.id,
          status: pia.status,
          next_steps: [
            'Review and complete all assessment sections',
            'Consult with stakeholders if required',
            'Implement identified mitigation measures',
            'Submit for approval if processing can proceed'
          ]
        }
      })
    };

  } catch (error) {
    console.error('Privacy Impact Assessment error:', error);
    throw error;
  }
}