const express = require('express');
const router = express.Router();
const AdvancedGdprService = require('../utils/advancedGdprService');
const PrivacyComplianceScanner = require('../utils/privacyComplianceScanner');
const GdprService = require('../services/GdprService');
const ConsentPurpose = require('../models/ConsentPurpose');
const DataBreach = require('../models/DataBreach');
const DPIA = require('../models/DPIA');
const DataProcessingLog = require('../models/DataProcessingLog');

const ensureAuthenticated = (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
};

const sendValidationErrors = (res, errors) => {
  return res.status(400).json({ success: false, errors });
};

const BREACH_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'denied'];

const validateBreachPayload = (payload = {}) => {
  const errors = [];

  if (!payload.description) {
    errors.push('Description is required');
  }

  if (!payload.severity) {
    errors.push('Severity is required');
  } else if (!BREACH_SEVERITIES.includes(payload.severity)) {
    errors.push('Invalid severity value');
  }

  if (!Array.isArray(payload.dataTypesAffected) || payload.dataTypesAffected.length === 0) {
    errors.push('At least one affected data type is required');
  }

  return errors;
};

const validateDpiaPayload = (payload = {}) => {
  const errors = [];
  const { processingActivity } = payload;

  if (!processingActivity || typeof processingActivity !== 'object') {
    errors.push('Processing activity details are required');
  } else if (!processingActivity.name) {
    errors.push('Processing activity name is required');
  }

  return errors;
};

/**
 * Advanced Consent Management Routes
 */

// Create GDPR request endpoint
router.post('/requests', async (req, res) => {
  try {
    const { request_type, description } = req.body;
    
    if (!request_type) {
      return res.status(400).json({ error: 'Request type is required' });
    }

    const requestData = {
      request_type,
      description: description || `GDPR ${request_type} request`,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const result = await GdprService.createRequest(requestData);

    res.status(201).json({
      success: true,
      message: 'GDPR request created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating GDPR request:', error);
    res.status(500).json({ error: 'Failed to create GDPR request', details: error.message });
  }
});

router.get('/requests', async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return;
  }

  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const requests = await GdprService.getRequests(filter);

    res.json({
      success: true,
      requests,
      total: Array.isArray(requests) ? requests.length : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch GDPR requests', details: error.message });
  }
});

// Get all consent purposes with statistics
router.get('/consent-purposes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const consents = await GdprService.getConsentPurposes({ skip, limit });
    const total = await GdprService.countConsentPurposes();

    // Get consent statistics
    const stats = await GdprService.getConsentStatistics();

    res.json({
      consents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      },
      total,
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/requests/:requestId/status', async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return;
  }

  const { requestId } = req.params;
  const { status, notes } = req.body;

  const errors = [];
  if (!status) {
    errors.push('Status is required');
  } else if (!REQUEST_STATUSES.includes(status)) {
    errors.push('Invalid status value');
  }

  if (errors.length) {
    return sendValidationErrors(res, errors);
  }

  try {
    const updatedRequest = await GdprService.updateRequestStatus(requestId, status, notes);
    res.json({ success: true, request: updatedRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update request status', details: error.message });
  }
});

// Update consent purpose settings
router.put('/consent-purposes/:purposeId', async (req, res) => {
  try {
    const { purposeId } = req.params;
    const updates = req.body;

    const consent = await ConsentPurpose.findByIdAndUpdate(
      purposeId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!consent) {
      return res.status(404).json({ error: 'Consent purpose not found' });
    }

    res.json(consent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk consent cleanup (expired/withdrawn)
router.post('/consent-purposes/cleanup', async (req, res) => {
  try {
    const { action } = req.body; // 'deactivate_expired' or 'remove_withdrawn'

    let result;
    if (action === 'deactivate_expired') {
      result = await ConsentPurpose.updateMany(
        { expiryDate: { $lt: new Date() }, isActive: true },
        { isActive: false, updatedAt: new Date() }
      );
    } else if (action === 'remove_withdrawn') {
      result = await ConsentPurpose.deleteMany({
        withdrawalTimestamp: { $exists: true },
        withdrawalTimestamp: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days old
      });
    }

    res.json({
      message: `Consent cleanup completed`,
      affected: result.modifiedCount || result.deletedCount,
      action
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Data Breach Management Routes
 */

const listBreaches = async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return;
  }

  try {
    const { status, severity } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const breaches = await GdprService.getDataBreaches(filter);

    res.json({
      success: true,
      breaches
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch data breaches', details: error.message });
  }
};

const createBreach = async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return;
  }

  const errors = validateBreachPayload(req.body);
  if (errors.length) {
    return sendValidationErrors(res, errors);
  }

  try {
    const breach = await AdvancedGdprService.reportDataBreach(req.body);
    res.status(201).json({ success: true, breach });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to report data breach', details: error.message });
  }
};

// Get all data breaches (canonical and alias)
router.get('/data-breaches', listBreaches);
router.get('/breaches', listBreaches);

// Create new data breach report (canonical and alias)
router.post('/data-breaches', createBreach);
router.post('/breach', createBreach);

// Update breach status
router.put('/data-breaches/:breachId/status', async (req, res) => {
  try {
    const { breachId } = req.params;
    const { status, notes } = req.body;

    const breach = await AdvancedGdprService.updateBreachStatus(breachId, status, notes);
    res.json(breach);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark breach as reported to authority
router.put('/data-breaches/:breachId/report-authority', async (req, res) => {
  try {
    const { breachId } = req.params;
    const { reportDetails } = req.body;

    const breach = await DataBreach.findByIdAndUpdate(
      breachId,
      {
        reportedToAuthority: true,
        authorityNotification: {
          reportedAt: new Date(),
          reportReference: reportDetails.reference,
          reportedBy: req.user.username,
          reportDetails
        }
      },
      { new: true }
    );

    res.json(breach);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notify affected users
router.post('/data-breaches/:breachId/notify-users', async (req, res) => {
  try {
    const { breachId } = req.params;
    const { notificationMessage } = req.body;

    const breach = await DataBreach.findById(breachId);
    if (!breach) {
      return res.status(404).json({ error: 'Breach not found' });
    }

    // Update notification status for all affected users
    await DataBreach.updateOne(
      { _id: breachId },
      {
        $set: {
          'affectedUsers.$[].notified': true,
          'affectedUsers.$[].notificationDate': new Date()
        }
      }
    );

    res.json({ message: 'User notifications sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DPIA Management Routes
 */

// Get all DPIAs
router.get('/dpias', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const dpias = await DPIA.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DPIA.countDocuments(filter);

    // Get DPIA statistics
    const stats = await DPIA.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      dpias,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      },
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new DPIA
router.post('/dpias', async (req, res) => {
  try {
    const dpia = await AdvancedGdprService.createDPIA(req.body);
    res.status(201).json(dpia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update DPIA status
router.put('/dpias/:dpiaId', async (req, res) => {
  try {
    const { dpiaId } = req.params;
    const updates = req.body;

    const dpia = await DPIA.findByIdAndUpdate(
      dpiaId,
      { ...updates, lastUpdated: new Date() },
      { new: true }
    );

    if (!dpia) {
      return res.status(404).json({ error: 'DPIA not found' });
    }

    res.json(dpia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule DPIA review
router.post('/dpias/:dpiaId/schedule-review', async (req, res) => {
  try {
    const { dpiaId } = req.params;
    const { reviewDate, reviewType } = req.body;

    const dpia = await DPIA.findByIdAndUpdate(
      dpiaId,
      {
        'reviewSchedule.nextReview': new Date(reviewDate),
        'reviewSchedule.reviewType': reviewType,
        'reviewSchedule.scheduledBy': req.user.username,
        'reviewSchedule.scheduledAt': new Date()
      },
      { new: true }
    );

    res.json(dpia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Compliance Monitoring Routes
 */

// Run compliance scan
router.get('/compliance/scan', async (req, res) => {
  try {
    const report = await PrivacyComplianceScanner.generateDetailedReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get compliance dashboard data
router.get('/compliance/dashboard', async (req, res) => {
  try {
    const dashboard = await AdvancedGdprService.getComplianceDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get processing logs
router.get('/processing-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { action, dataType, legalBasis } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (dataType) filter.dataType = dataType;
    if (legalBasis) filter.legalBasis = legalBasis;

    const logs = await DataProcessingLog.find(filter)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DataProcessingLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const complianceReportHandler = async (req, res) => {
  try {
    const { format = 'json', dateFrom, dateTo } = req.query;
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.csv');
      return res.send('CSV export not implemented yet');
    }

    const filter = { dateFrom, dateTo };

    const [consentsRaw, requestsRaw, breachesRaw, dpiasRaw, logsRaw] = await Promise.all([
      GdprService.getConsentPurposes(filter),
      GdprService.getRequests(filter),
      GdprService.getDataBreaches(filter),
      GdprService.getDPIAs ? GdprService.getDPIAs(filter) : Promise.resolve([]),
      GdprService.getDataProcessingLogs
        ? GdprService.getDataProcessingLogs(filter)
        : Promise.resolve([])
    ]);

    const consents = Array.isArray(consentsRaw) ? consentsRaw : [];
    const requests = Array.isArray(requestsRaw) ? requestsRaw : [];
    const breaches = Array.isArray(breachesRaw) ? breachesRaw : [];
    const dpias = Array.isArray(dpiasRaw) ? dpiasRaw : [];
    const logs = Array.isArray(logsRaw) ? logsRaw : [];

    const reportData = {
      exportDate: new Date(),
      period: { from: dateFrom, to: dateTo },
      summary: {
        consents: consents.length,
        requests: requests.length,
        breaches: breaches.length,
        dpias: dpias.length,
        processingLogs: logs.length
      },
      data: {
        consents,
        requests,
        breaches,
        dpias,
        processingLogs: logs
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=compliance-report.json');
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Export compliance report (alias maintained for backwards compatibility)
router.get('/compliance/export', complianceReportHandler);
router.get('/compliance/report', complianceReportHandler);

// Run daily compliance check manually
router.post('/compliance/daily-check', async (req, res) => {
  try {
    const results = await AdvancedGdprService.runDailyComplianceCheck();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create DPIA (singular endpoint for tests)
router.post('/dpia', async (req, res) => {
  if (!ensureAuthenticated(req, res)) {
    return;
  }

  const errors = validateDpiaPayload(req.body);
  if (errors.length) {
    return sendValidationErrors(res, errors);
  }

  try {
    const dpia = await AdvancedGdprService.createDPIA(req.body);
    res.status(201).json({ success: true, dpia });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create DPIA', details: error.message });
  }
});

module.exports = router;
