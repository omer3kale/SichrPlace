const express = require('express');
const router = express.Router();

// Ensure fetch is available in all supported Node environments
const fetch = global.fetch
  ? (...args) => global.fetch(...args)
  : (...args) => import('node-fetch').then(({ default: fetchImpl }) => fetchImpl(...args));

// PayPal configuration
const paypalBaseURL = process.env.PAYPAL_ENVIRONMENT === 'production' 
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

function isPayPalConfigured() {
  return Boolean(paypalClientId && paypalClientSecret);
}

// Helper function to get PayPal access token
async function getPayPalAccessToken() {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
  }

  const authHeader = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  
  try {
    const response = await fetch(`${paypalBaseURL}/v1/oauth2/token`, {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('PayPal Token Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data,
        clientIdPrefix: paypalClientId?.substring(0, 20),
        environment: paypalBaseURL
      });
      throw new Error(`PayPal token request failed: ${data.error || response.statusText}`);
    }
    
    return data.access_token;
  } catch (error) {
    console.error('PayPal Access Token Error:', error);
    throw error;
  }
}

/**
 * @route   GET /api/paypal/config
 * @desc    Get PayPal configuration
 * @access  Public
 */
router.get('/config', (req, res) => {
  if (!isPayPalConfigured()) {
    return res.status(503).json({
      error: 'PayPal credentials not configured',
      hint: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable payments.'
    });
  }

  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    currency: 'EUR',
    supportedPaymentMethods: ['paypal']
  });
});

/**
 * @route   POST /api/paypal/create
 * @desc    Create PayPal payment order
 * @access  Private
 */
router.post('/create', async (req, res) => {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        error: 'PayPal is not configured',
        hint: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the environment before creating payments.'
      });
    }

    const { amount, currency = 'EUR', description = 'SichrPlace Booking Fee', apartmentId, viewingRequestId, returnUrl, cancelUrl } = req.body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const accessToken = await getPayPalAccessToken();

    const createPayment = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        description: description,
        custom_id: apartmentId || '',
        invoice_id: viewingRequestId || `INV_${Date.now()}`
      }],
      application_context: {
        return_url: returnUrl || `${req.protocol}://${req.get('host')}/api/paypal/success`,
        cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/api/paypal/cancel`,
        brand_name: 'SichrPlace',
        user_action: 'PAY_NOW'
      }
    };

    const response = await fetch(`${paypalBaseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(createPayment)
    });

    const data = await response.json();

    if (response.ok) {
      // Store payment details in memory for now (in production, use database)
      if (!global.paymentStore) global.paymentStore = {};
      global.paymentStore[data.id] = {
        userId: req.user?.id || null,
        apartmentId,
        viewingRequestId,
        amount,
        currency,
        description,
        created: new Date()
      };

      res.json({
        success: true,
        orderId: data.id,
        approvalUrl: data.links.find(link => link.rel === 'approve')?.href
      });
    } else {
      console.error('PayPal Create Error:', data);
      res.status(400).json({ error: 'Failed to create PayPal order', details: data });
    }
  } catch (error) {
    console.error('PayPal creation error:', error);
    res.status(500).json({ error: 'Internal server error creating payment' });
  }
});

/**
 * @route   POST /api/paypal/execute
 * @desc    Execute/capture PayPal payment
 * @access  Private
 */
router.post('/execute', async (req, res) => {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        error: 'PayPal is not configured',
        hint: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the environment before executing payments.'
      });
    }

    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${paypalBaseURL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (response.ok && data.status === 'COMPLETED') {
      // Get stored payment details
      const paymentDetails = global.paymentStore?.[orderId];
      const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
      
      // Here you would typically save to database
      console.log('Payment completed:', {
        orderId,
        paymentDetails,
        paypalData: data
      });

      // Clear cached order details once captured
      if (global.paymentStore && global.paymentStore[orderId]) {
        delete global.paymentStore[orderId];
      }

      res.json({
        success: true,
        orderId: data.id,
        status: data.status,
        transactionId: captureId,
        paymentDetails,
        message: 'Payment completed successfully'
      });
    } else {
      console.error('PayPal Capture Error:', data);
      res.status(400).json({ error: 'Failed to capture payment', details: data });
    }
  } catch (error) {
    console.error('PayPal execution error:', error);
    res.status(500).json({ error: 'Internal server error executing payment' });
  }
});

/**
 * @route   POST /api/paypal/marketplace/capture
 * @desc    Capture marketplace item payment
 * @access  Public (marketplace purchases don't require authentication)
 */
router.post('/marketplace/capture', async (req, res) => {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        error: 'PayPal is not configured',
        hint: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the environment before capturing payments.'
      });
    }

    const { 
      orderID, 
      paymentID, 
      itemName, 
      amount, 
      sellerId, 
      sellerEmail, 
      payerDetails 
    } = req.body;
    
    // Validate required fields
    if (!orderID || !itemName || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: orderID, itemName, amount' 
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    const response = await fetch(`${paypalBaseURL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const captureData = await response.json();

    if (response.ok && captureData.status === 'COMPLETED') {
      // Store marketplace transaction details
      if (!global.marketplaceStore) global.marketplaceStore = {};
      global.marketplaceStore[orderID] = {
        paymentID,
        itemName,
        amount: parseFloat(amount),
        sellerId,
        sellerEmail,
        payerDetails: {
          name: payerDetails?.name?.given_name + ' ' + payerDetails?.name?.surname,
          email: payerDetails?.email_address,
          payerId: payerDetails?.payer_id
        },
        transactionId: captureData.purchase_units[0]?.payments?.captures[0]?.id,
        status: 'completed',
        created: new Date(),
        paypalData: captureData
      };

      console.log('Marketplace payment completed:', {
        orderID,
        itemName,
        amount,
        sellerId,
        transactionId: captureData.purchase_units[0]?.payments?.captures[0]?.id
      });

      // In a real application, you would:
      // 1. Save transaction to database
      // 2. Send email notifications to buyer and seller
      // 3. Update item availability if needed
      // 4. Create seller notification

      res.json({
        success: true,
        orderID: orderID,
        transactionId: captureData.purchase_units[0]?.payments?.captures[0]?.id,
        status: captureData.status,
        itemName,
        amount,
        sellerEmail,
        message: 'Marketplace payment completed successfully',
        nextSteps: 'The seller will be notified and will contact you shortly.'
      });
    } else {
      console.error('PayPal Marketplace Capture Error:', captureData);
      res.status(400).json({ 
        error: 'Failed to capture marketplace payment', 
        details: captureData 
      });
    }
  } catch (error) {
    console.error('Marketplace payment error:', error);
    res.status(500).json({ 
      error: 'Internal server error processing marketplace payment',
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/paypal/webhook
 * @desc    Handle PayPal webhooks
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('PayPal Webhook received:', event.event_type);
    
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment capture completed:', event.resource);
        // Handle successful payment
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        console.log('Payment capture denied:', event.resource);
        // Handle failed payment
        break;
      default:
        console.log('Unhandled webhook event:', event.event_type);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
