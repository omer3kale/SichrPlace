const express = require('express');
const router = express.Router();
const SmartMatchingService = require('../services/SmartMatchingService');
const auth = require('../middleware/auth');

const parseIntParam = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseUserType = (value) => {
  if (!value) return 'tenant';
  const normalised = value.toString().trim().toLowerCase();
  if (['tenant', 'landlord'].includes(normalised)) {
    return normalised;
  }
  return 'tenant';
};

router.get('/tenant', auth, async (req, res) => {
  try {
    const options = {
      limit: parseIntParam(req.query.limit, 20),
      fetchLimit: parseIntParam(req.query.fetchLimit, undefined)
    };

    const result = await SmartMatchingService.getTenantMatches(req.user.id, options);

    res.json(result);
  } catch (error) {
    console.error('Smart matching tenant error', error);
    res.status(500).json({
      success: false,
      error: 'Smart matching konnte nicht ausgeführt werden.',
      message: error.message
    });
  }
});

router.get('/landlord', auth, async (req, res) => {
  try {
    const options = {
      limit: parseIntParam(req.query.limit, 25),
      fetchLimit: parseIntParam(req.query.fetchLimit, undefined)
    };

    const result = await SmartMatchingService.getLandlordMatches(req.user.id, options);

    res.json(result);
  } catch (error) {
    console.error('Smart matching landlord error', error);
    res.status(500).json({
      success: false,
      error: 'Smart matching konnte nicht ausgeführt werden.',
      message: error.message
    });
  }
});

router.get('/preferences', auth, async (req, res) => {
  try {
    const userType = parseUserType(req.query.userType || req.query.user_type);
    const result = await SmartMatchingService.getPreferences(req.user.id, userType);

    res.json(result);
  } catch (error) {
    console.error('Smart matching preferences load error', error);
    res.status(500).json({
      success: false,
      error: 'Präferenzen konnten nicht geladen werden.',
      message: error.message
    });
  }
});

router.post('/preferences', auth, async (req, res) => {
  try {
    const userType = parseUserType(req.body.userType || req.body.user_type);

    const result = await SmartMatchingService.upsertPreferences(
      req.user.id,
      userType,
      req.body
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Smart matching preferences save error', error);
    res.status(500).json({
      success: false,
      error: 'Präferenzen konnten nicht gespeichert werden.',
      message: error.message
    });
  }
});

module.exports = router;
