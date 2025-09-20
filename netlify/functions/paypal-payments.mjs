import jwt from 'jsonwebtoken';

const paypalBaseURL = process.env.PAYPAL_ENVIRONMENT === 'production' 
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const jwtSecret = process.env.JWT_SECRET;

if (!paypalClientId || !paypalClientSecret || !jwtSecret) {
  throw new Error('Missing required PayPal environment variables');
}

// Helper function to get PayPal access token
const getPayPalAccessToken = async () => {
  const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
  
  try {
    const response = await fetch(`${paypalBaseURL}/v1/oauth2/token`, {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('PayPal Access Token Error:', error);
    throw error;
  }
};

// Helper function to authenticate token
const authenticateToken = async (headers) => {
  const authHeader = headers.authorization;
  if (!authHeader) {
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new Error('Malformed token');
  }

  const decoded = jwt.verify(token, jwtSecret);
  return decoded;
};

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await getPayPalConfig(headers);
      case 'POST':
        return await handlePayPalAction(event, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('PayPal function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};

// GET PayPal configuration
const getPayPalConfig = async (headers) => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      clientId: paypalClientId,
      environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
    })
  };
};

// POST handle PayPal actions
const handlePayPalAction = async (event, headers) => {
  const path = event.path;
  const body = JSON.parse(event.body || '{}');
  
  if (path.includes('/create')) {
    return await createPayPalOrder(event.headers, body, headers);
  } else if (path.includes('/capture') || path.includes('/execute')) {
    return await capturePayPalOrder(event.headers, body, headers);
  } else if (path.includes('/webhooks')) {
    return await handlePayPalWebhook(body, headers);
  }
  
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: 'Invalid PayPal action' })
  };
};

// Create PayPal order
const createPayPalOrder = async (requestHeaders, body, headers) => {
  try {
    const user = await authenticateToken(requestHeaders);
    const { 
      amount, 
      currency = 'EUR', 
      description = 'SichrPlace Booking Fee', 
      apartmentId, 
      viewingRequestId,
      returnUrl,
      cancelUrl 
    } = body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid amount is required' })
      };
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
        return_url: returnUrl || 'https://sichrplace.netlify.app/payment-success',
        cancel_url: cancelUrl || 'https://sichrplace.netlify.app/payment-cancel',
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
      // Find approval URL
      const approvalUrl = data.links?.find(link => link.rel === 'approve')?.href;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId: data.id,
          approvalUrl,
          data: data
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Failed to create PayPal order',
          details: data
        })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create PayPal order',
        details: error.message
      })
    };
  }
};

// Capture PayPal order
const capturePayPalOrder = async (requestHeaders, body, headers) => {
  try {
    const user = await authenticateToken(requestHeaders);
    const { orderId, paymentId, payerId } = body;
    
    const orderIdToCapture = orderId || paymentId;
    
    if (!orderIdToCapture) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Order ID is required' })
      };
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${paypalBaseURL}/v2/checkout/orders/${orderIdToCapture}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'completed',
          orderId: data.id,
          data: data
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Failed to capture PayPal order',
          details: data
        })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to capture PayPal order',
        details: error.message
      })
    };
  }
};

// Handle PayPal webhooks
const handlePayPalWebhook = async (body, headers) => {
  try {
    console.log('PayPal webhook received:', body);
    
    // In a real implementation, you would:
    // 1. Verify webhook signature
    // 2. Process different event types
    // 3. Update database records
    // 4. Send notifications
    
    const eventType = body.event_type;
    
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment capture completed:', body.resource);
        // Update database with successful payment
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        console.log('Payment capture denied:', body.resource);
        // Handle failed payment
        break;
      default:
        console.log('Unhandled webhook event:', eventType);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed'
      })
    };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process webhook',
        details: error.message
      })
    };
  }
};