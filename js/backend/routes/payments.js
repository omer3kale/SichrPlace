// payments.js - RESTful payment endpoints for integration tests
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * POST /api/payments/create
 * Create a payment transaction
 */
router.post('/create', auth, async (req, res) => {
  try {
    const { amount, payment_method, description } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Amount must be greater than 0'
      });
    }

    // Mock payment creation for now
    const payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: req.user.id,
      amount: amount.toFixed(2),
      payment_method: payment_method || 'credit_card',
      description: description || 'Payment transaction',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get('/history', auth, async (req, res) => {
  try {
    // Mock payment history for now
    const payments = [
      {
        id: `pay_${Date.now()}_history1`,
        user_id: req.user.id,
        amount: '100.00',
        payment_method: 'credit_card',
        description: 'Test payment',
        status: 'completed',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
});

/**
 * POST /api/payments/refund
 * Create a refund request
 */
router.post('/refund', auth, async (req, res) => {
  try {
    const { payment_id, reason, amount } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required'
      });
    }

    // Mock refund creation
    const refund = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payment_id: payment_id,
      user_id: req.user.id,
      amount: amount ? amount.toFixed(2) : '0.00',
      reason: reason || 'Refund requested',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    res.status(201).json(refund);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create refund'
    });
  }
});

/**
 * GET /api/payments/:id
 * Get payment details by ID
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Mock payment retrieval
    const payment = {
      id: id,
      user_id: req.user.id,
      amount: '100.00',
      payment_method: 'credit_card',
      description: 'Payment transaction',
      status: 'completed',
      created_at: new Date().toISOString()
    };

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
});

module.exports = router;
