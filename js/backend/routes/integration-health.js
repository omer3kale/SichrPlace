const express = require('express');
const router = express.Router();
const IntegrationHealthService = require('../services/IntegrationHealthService');

router.get('/', async (req, res) => {
  try {
    const status = await IntegrationHealthService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      allReady: false,
      error: error.message || 'Failed to evaluate integration health'
    });
  }
});

module.exports = router;
