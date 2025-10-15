const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { GdprService } = require('../services/GdprService');

const ensureUserPresent = (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
};

/**
 * POST /api/gdpr/consent
 * Record user consent
 */
router.post('/consent', [
  auth,
  body('consentTypes').isObject().withMessage('Consent types must be an object'),
  body('privacyPolicyVersion').optional().isString(),
  body('termsVersion').optional().isString()
], async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const logDataProcessingFn = GdprService?.logDataProcessing;
    const createConsentFn = GdprService?.createConsent;

    if (typeof logDataProcessingFn !== 'function' || typeof createConsentFn !== 'function') {
      throw new Error('Consent service not configured');
    }

    // Log the consent action
    await logDataProcessingFn({
      user_id: req.user.id,
      action: 'consent_update',
      data_type: 'user_consent',
      purpose: 'consent_management',
      legal_basis: 'consent',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Update consent for each purpose
    for (const [purposeName, granted] of Object.entries(req.body.consentTypes)) {
      // This would need a proper purpose lookup in a real implementation
      // For now, we'll create a simple consent record
      await createConsentFn({
        user_id: req.user.id,
        purpose_id: purposeName, // In real implementation, lookup purpose by name
        granted
      });
    }

    res.json({
      success: true,
      message: 'Consent recorded successfully'
    });
  } catch (error) {
    console.error('Error recording consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record consent',
      message: 'Failed to record consent',
      details: error.message
    });
  }
});

/**
 * GET /api/gdpr/consent
 * Get user's current consent status
 */
router.get('/consent', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const consent = await (GdprService.getUserConsent
      ? GdprService.getUserConsent(req.user.id)
      : GdprService.getUserConsents(req.user.id));

    if (!consent) {
      return res.json({
        success: true,
        consent: null,
        message: 'No consent record found'
      });
    }

    res.json({
      success: true,
      consent
    });
  } catch (error) {
    console.error('Error getting consent:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch consent status', details: error.message });
  }
});

/**
 * POST /api/gdpr/request
 * Create a GDPR request (access, deletion, etc.)
 */
router.post('/request', [
  auth,
  body('requestType').isIn(['access', 'rectification', 'deletion', 'portability', 'restriction', 'objection'])
    .withMessage('Invalid request type'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description too long')
], async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Check for existing pending requests of the same type
    const existingRequest = await GdprService.findExistingRequest(req.user.id, req.body.requestType);

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending request of this type',
        message: `You already have a pending ${req.body.requestType} request`
      });
    }

    const createdAt = new Date().toISOString();

    const gdprRequest = await GdprService.createRequest({
      user_id: req.user.id,
      request_type: req.body.requestType,
      description: req.body.description || `User requested ${req.body.requestType} request`,
      status: 'pending',
      created_at: createdAt,
      metadata: {
        submittedVia: 'api',
        requestData: req.body.requestData || {},
        requesterEmail: req.user.email
      }
    });

    res.status(201).json({
      success: true,
      message: 'GDPR request submitted successfully',
      requestId: gdprRequest.id || gdprRequest._id,
      request: gdprRequest
    });
  } catch (error) {
    console.error('Error creating GDPR request:', error);
    res.status(500).json({ success: false, error: 'Failed to create GDPR request', details: error.message });
  }
});

/**
 * GET /api/gdpr/requests
 * Get user's GDPR requests
 */
router.get('/requests', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const requests = await GdprService.getRequests({ userId: req.user.id });

    res.json({
      success: true,
      requests: requests || []
    });
  } catch (error) {
    console.error('Error getting GDPR requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch GDPR requests', details: error.message });
  }
});

/**
 * GET /api/gdpr/export
 * Export user data (Right to Data Portability)
 * This creates a request that will be processed by admin
 */
router.get('/export', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    // Check for existing pending export requests
    const existingRequest = await GdprService.findExistingRequest(req.user.id, 'portability');

    if (existingRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have a pending data export request' 
      });
    }

    // Create a data portability request
    const gdprRequest = await GdprService.createRequest({
      user_id: req.user.id,
      request_type: 'portability',
      description: 'User requested data export via API',
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        requestMethod: 'api',
        format: 'json',
        requesterEmail: req.user.email
      }
    });

    res.status(201).json({
      success: true,
      message: 'Data export request submitted. You will receive an email when your data is ready for download.',
      request: gdprRequest
    });
  } catch (error) {
    console.error('Error requesting data export:', error);
    res.status(500).json({ success: false, error: 'Failed to request data export', details: error.message });
  }
});

/**
 * DELETE /api/gdpr/account
 * Request account deletion (Right to Erasure)
 */
router.delete('/account', [
  auth,
  body('confirmation').equals('DELETE_MY_ACCOUNT').withMessage('Confirmation text required')
], async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Check for existing pending deletion requests
    const existingRequest = await GdprService.findExistingRequest(req.user.id, 'deletion');

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending account deletion request',
        message: 'You already have a pending account deletion request'
      });
    }

    const gdprRequest = await GdprService.createGdprRequest({
      userId: req.user.id,
      email: req.user.email,
      requestType: 'deletion',
      description: 'User requested account deletion via API',
      requestData: { 
        requestMethod: 'api',
        confirmationProvided: true,
        requestedAt: new Date()
      }
    });

    res.json({ 
      success: true, 
      message: 'Account deletion request submitted. Your account will be deleted within 30 days.',
      requestId: gdprRequest._id,
      warning: 'This action cannot be undone. All your data will be permanently deleted.'
    });
  } catch (error) {
    console.error('Error requesting account deletion:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/gdpr/withdraw-consent
 * Withdraw consent for data processing
 */
router.post('/withdraw-consent', [
  auth,
  body('consentType').isIn(['analytics', 'marketing', 'functional']).withMessage('Invalid consent type')
], async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = req.user;
    const consentId = req.body.consentId || req.body.consent_id;

    let updatedRecord;
    
    // If consentId is provided, directly update that consent record
    if (consentId && GdprService.updateConsent) {
      updatedRecord = await GdprService.updateConsent(consentId, {
        granted: false,
        withdrawn_at: new Date().toISOString()
      });
    } else {
      // Otherwise, fetch user's current consent and update
      let currentConsent = null;
      if (GdprService.getUserConsent) {
        currentConsent = await GdprService.getUserConsent(req.user.id);
      } else if (GdprService.getUserConsents) {
        const list = await GdprService.getUserConsents(req.user.id);
        if (Array.isArray(list)) {
          currentConsent = list[0];
        }
      }
      
      if (!currentConsent) {
        return res.status(404).json({ success: false, message: 'No consent record found' });
      }

      const updatedConsentTypes = { ...currentConsent.consentTypes };
      updatedConsentTypes[req.body.consentType] = {
        given: false,
        timestamp: new Date().toISOString()
      };

      updatedRecord = await GdprService.recordConsent({
        userId: req.user.id,
        email: user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        consentTypes: updatedConsentTypes,
        privacyPolicyVersion: currentConsent.privacyPolicyVersion,
        termsVersion: currentConsent.termsVersion,
        consentMethod: 'updated'
      });
    }

    // Log the consent withdrawal
    await GdprService.logDataProcessing({
      user_id: req.user.id,
      email: user.email,
      action: 'consent_withdrawn',
      dataType: 'consent_record',
      legalBasis: 'consent',
      purpose: `User withdrew consent for ${req.body.consentType}`,
      dataCategories: ['consent_data'],
      retentionPeriod: 'Until account deletion',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      processingDetails: { withdrawnConsentType: req.body.consentType }
    });

    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
      consentId: updatedRecord?.id || updatedRecord?._id || consentId || null
    });
  } catch (error) {
    console.error('Error withdrawing consent:', error);
    res.status(500).json({ success: false, error: 'Failed to withdraw consent', details: error.message });
  }
});

/**
 * GET /api/gdpr/consent-status
 * Get user's current consent status
 */
router.get('/consent-status', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const consents = await GdprService.getUserConsents(req.user.id);
    
    res.json({
      success: true,
      consents: consents || []
    });
  } catch (error) {
    console.error('Error fetching consent status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch consent status' });
  }
});

/**
 * GET /api/gdpr/data
 * Export user data (for integration tests)
 */
router.get('/data', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const userData = {
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role,
        createdAt: req.user.created_at
      },
      consents: await GdprService.getUserConsents(req.user.id).catch(() => []),
      requests: await GdprService.getRequests({ userId: req.user.id }).catch(() => [])
    };

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user data' });
  }
});

/**
 * POST /api/gdpr/delete
 * Create a data deletion request (for integration tests)
 */
router.post('/delete', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const deletionRequest = await GdprService.createRequest({
      user_id: req.user.id,
      request_type: 'delete',
      description: req.body.reason || 'User requested data deletion',
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        reason: req.body.reason,
        requestedAt: new Date().toISOString()
      }
    });

    res.status(201).json({
      id: deletionRequest.id || deletionRequest._id,
      request_type: 'delete',
      status: 'pending',
      created_at: deletionRequest.created_at
    });
  } catch (error) {
    console.error('Error creating deletion request:', error);
    res.status(500).json({ success: false, error: 'Failed to create deletion request' });
  }
});

/**
 * GET /api/gdpr/consents
 * Get all user consents (for integration tests)
 */
router.get('/consents', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const consents = await GdprService.getUserConsents(req.user.id);
    res.json(consents || []);
  } catch (error) {
    console.error('Error fetching consents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch consents' });
  }
});

/**
 * PUT /api/gdpr/consents/:purposeId
 * Update user consent for a specific purpose (for integration tests)
 */
router.put('/consents/:purposeId', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const { purposeId } = req.params;
    const { given } = req.body;

    const consent = await GdprService.createConsent({
      user_id: req.user.id,
      purpose_id: purposeId,
      granted: given,
      granted_at: given ? new Date().toISOString() : null
    });

    res.json({
      purpose_id: purposeId,
      given: given,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({ success: false, error: 'Failed to update consent' });
  }
});

/**
 * GET /api/gdpr/consent-purposes
 * Get all available consent purposes (for integration tests)
 */
router.get('/consent-purposes', async (req, res) => {
  try {
    // Mock consent purposes for now
    const purposes = [
      {
        id: 'marketing',
        name: 'Marketing Communications',
        description: 'Receive promotional emails and offers',
        required: false
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Allow us to collect analytics data to improve our service',
        required: false
      },
      {
        id: 'essential',
        name: 'Essential Services',
        description: 'Required for basic platform functionality',
        required: true
      }
    ];

    res.json(purposes);
  } catch (error) {
    console.error('Error fetching consent purposes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch consent purposes' });
  }
});

/**
 * GET /api/gdpr/export-data
 * Export user's data
 */
router.get('/export-data', auth, async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const exportData = await (GdprService.exportUserData
      ? GdprService.exportUserData({ userId: req.user.id })
      : {
          profile: req.user,
          consents: await GdprService.getUserConsents(req.user.id),
          requests: await GdprService.getRequests({ userId: req.user.id }),
          processingLogs: await GdprService.getProcessingLogs({ userId: req.user.id })
        });

    // Log the data export
    await GdprService.logDataProcessing({
      user_id: req.user.id,
      email: req.user.email,
      action: 'data_exported',
      dataType: 'user_data_export',
      legalBasis: 'consent',
      purpose: 'User data export request',
      dataCategories: ['user_profile', 'consent_data', 'request_data'],
      retentionPeriod: 'Export file deleted after 30 days',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user.id}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

/**
 * POST /api/gdpr/delete-account
 * Initiate account deletion request
 */
router.post('/delete-account', [
  auth,
  body('confirmation').equals('DELETE_MY_ACCOUNT').withMessage('Invalid confirmation phrase')
], async (req, res) => {
  try {
    if (!ensureUserPresent(req, res)) {
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid confirmation phrase' });
    }

    // Create deletion request
    const deletionRequest = await GdprService.createRequest({
      user_id: req.user.id,
      request_type: 'deletion',
      description: 'Account deletion request',
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        confirmationPhrase: req.body.confirmation,
        requestedAt: new Date().toISOString()
      }
    });

    // Log the deletion request
    await GdprService.logDataProcessing({
      user_id: req.user.id,
      email: req.user.email,
      action: 'account_deletion_requested',
      dataType: 'deletion_request',
      legalBasis: 'consent',
      purpose: 'User account deletion request',
      dataCategories: ['user_profile', 'all_user_data'],
      retentionPeriod: 'Data will be deleted within 30 days',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      processingDetails: { requestId: deletionRequest.id }
    });

    res.json({
      success: true,
      message: 'Account deletion request submitted. Your account will be deleted within 30 days.',
      requestId: deletionRequest.id
    });
  } catch (error) {
    console.error('Error processing deletion request:', error);
    res.status(500).json({ success: false, error: 'Failed to process deletion request' });
  }
});

module.exports = router;
