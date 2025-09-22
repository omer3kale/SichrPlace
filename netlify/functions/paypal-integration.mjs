import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// PayPal API configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'production' 
  ? 'https://api.paypal.com' 
  : 'https://api.sandbox.paypal.com';

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

// Helper function to get PayPal access token
const getPayPalAccessToken = async () => {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${data.error_description || data.error}`);
    }

    return data.access_token;
  } catch (error) {
    console.error('PayPal auth error:', error);
    throw error;
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
            'create_payment',
            'execute_payment',
            'capture_payment',
            'get_payment_details',
            'refund_payment',
            'get_config',
            'create_subscription',
            'cancel_subscription',
            'marketplace_capture',
            'webhook_handler'
          ]
        })
      };
    }

    // Verify authentication for most operations
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ') && action !== 'webhook_handler' && action !== 'get_config') {
      const token = authHeader.substring(7);
      user = verifyToken(token);
      
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid authentication token'
          })
        };
      }
    }

    switch (action) {
      case 'create_payment':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await createPayment(user.id, event.body, headers);
      
      case 'execute_payment':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await executePayment(user.id, event.body, headers);
      
      case 'capture_payment':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await capturePayment(user.id, event.body, headers);
      
      case 'get_payment_details':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await getPaymentDetails(user.id, event.queryStringParameters, headers);
      
      case 'refund_payment':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await refundPayment(user.id, event.body, headers);
      
      case 'get_config':
        return await getPayPalConfig(headers);
      
      case 'create_subscription':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await createSubscription(user.id, event.body, headers);
      
      case 'cancel_subscription':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await cancelSubscription(user.id, event.body, headers);
      
      case 'marketplace_capture':
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication required' }) };
        }
        return await marketplaceCapture(user.id, event.body, headers);
      
      case 'webhook_handler':
        return await handleWebhook(event.body, event.headers, headers);
      
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
    console.error('PayPal integration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'PayPal operation failed',
        error: error.message
      })
    };
  }
};

// Create PayPal payment
async function createPayment(userId, requestBody, headers) {
  try {
    const {
      amount,
      currency = 'EUR',
      description,
      booking_id,
      apartment_id,
      return_url,
      cancel_url,
      payment_method = 'paypal'
    } = JSON.parse(requestBody);

    if (!amount || !description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Amount and description are required'
        })
      };
    }

    // Validate booking if provided
    if (booking_id) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, user_id, total_amount, status')
        .eq('id', booking_id)
        .eq('user_id', userId)
        .single();

      if (bookingError || !booking) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Booking not found or unauthorized'
          })
        };
      }

      if (booking.status !== 'pending_payment') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Booking is not in a payable state'
          })
        };
      }
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal payment request
    const paymentRequest = {
      intent: 'sale',
      payer: {
        payment_method: payment_method
      },
      transactions: [{
        amount: {
          total: amount.toString(),
          currency: currency.toUpperCase()
        },
        description: description,
        custom: JSON.stringify({
          user_id: userId,
          booking_id: booking_id || null,
          apartment_id: apartment_id || null
        })
      }],
      redirect_urls: {
        return_url: return_url || `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: cancel_url || `${process.env.FRONTEND_URL}/payment/cancel`
      }
    };

    // Make PayPal API call
    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymentRequest)
    });

    const paymentData = await paypalResponse.json();

    if (!paypalResponse.ok) {
      throw new Error(`PayPal payment creation failed: ${paymentData.message || 'Unknown error'}`);
    }

    // Store payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        booking_id: booking_id || null,
        apartment_id: apartment_id || null,
        paypal_payment_id: paymentData.id,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        status: 'created',
        payment_method: 'paypal',
        description: description,
        paypal_data: paymentData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Database payment insert error:', paymentError);
      // Continue anyway as PayPal payment was created
    }

    // Find approval URL from PayPal response
    const approvalUrl = paymentData.links?.find(link => link.rel === 'approval_url')?.href;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          payment_id: paymentData.id,
          approval_url: approvalUrl,
          amount: amount,
          currency: currency,
          status: 'created',
          payment_record_id: payment?.id || null
        }
      })
    };

  } catch (error) {
    console.error('Create payment error:', error);
    throw error;
  }
}

// Execute PayPal payment
async function executePayment(userId, requestBody, headers) {
  try {
    const { payment_id, payer_id } = JSON.parse(requestBody);

    if (!payment_id || !payer_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment ID and Payer ID are required'
        })
      };
    }

    // Get payment record from database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('paypal_payment_id', payment_id)
      .eq('user_id', userId)
      .single();

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment record not found'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Execute payment with PayPal
    const executeRequest = {
      payer_id: payer_id
    };

    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payment/${payment_id}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(executeRequest)
    });

    const executionData = await paypalResponse.json();

    if (!paypalResponse.ok) {
      throw new Error(`PayPal payment execution failed: ${executionData.message || 'Unknown error'}`);
    }

    // Update payment record
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: executionData.state === 'approved' ? 'completed' : 'failed',
        payer_id: payer_id,
        paypal_data: executionData,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError) {
      console.error('Payment update error:', updateError);
    }

    // Update booking status if applicable
    if (payment.booking_id && executionData.state === 'approved') {
      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.booking_id);

      // Log activity
      await supabase
        .from('user_activity')
        .insert({
          user_id: userId,
          action: 'payment_completed',
          details: `Payment completed for booking ${payment.booking_id}`,
          created_at: new Date().toISOString()
        });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          payment_id: payment_id,
          status: executionData.state,
          amount: payment.amount,
          currency: payment.currency,
          transaction_id: executionData.transactions?.[0]?.related_resources?.[0]?.sale?.id,
          executed_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Execute payment error:', error);
    throw error;
  }
}

// Capture payment (for orders)
async function capturePayment(userId, requestBody, headers) {
  try {
    const { order_id, capture_id } = JSON.parse(requestBody);

    if (!order_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Order ID is required'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the order
    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      throw new Error(`PayPal order capture failed: ${captureData.message || 'Unknown error'}`);
    }

    // Store/update payment record
    const paymentRecord = {
      user_id: userId,
      paypal_payment_id: order_id,
      status: captureData.status === 'COMPLETED' ? 'completed' : 'pending',
      payment_method: 'paypal',
      paypal_data: captureData,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .upsert(paymentRecord, { onConflict: 'paypal_payment_id' })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment upsert error:', paymentError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          order_id: order_id,
          capture_id: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
          status: captureData.status,
          amount: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
          captured_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Capture payment error:', error);
    throw error;
  }
}

// Get payment details
async function getPaymentDetails(userId, queryParams, headers) {
  try {
    const { payment_id, include_paypal_details = 'false' } = queryParams || {};

    if (!payment_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment ID is required'
        })
      };
    }

    // Get payment from database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        booking:bookings(id, apartment_id, start_date, end_date),
        apartment:apartments(id, title, address)
      `)
      .eq('paypal_payment_id', payment_id)
      .eq('user_id', userId)
      .single();

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment not found'
        })
      };
    }

    let paypalDetails = null;
    if (include_paypal_details === 'true') {
      try {
        const accessToken = await getPayPalAccessToken();
        const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payment/${payment_id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (paypalResponse.ok) {
          paypalDetails = await paypalResponse.json();
        }
      } catch (error) {
        console.error('Failed to fetch PayPal details:', error);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ...payment,
          paypal_details: paypalDetails
        }
      })
    };

  } catch (error) {
    console.error('Get payment details error:', error);
    throw error;
  }
}

// Refund payment
async function refundPayment(userId, requestBody, headers) {
  try {
    const {
      payment_id,
      amount,
      reason = 'Refund requested by user'
    } = JSON.parse(requestBody);

    if (!payment_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment ID is required'
        })
      };
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('paypal_payment_id', payment_id)
      .eq('user_id', userId)
      .single();

    if (paymentError || !payment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Payment not found'
        })
      };
    }

    if (payment.status !== 'completed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Only completed payments can be refunded'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Get sale ID from payment data
    const saleId = payment.paypal_data?.transactions?.[0]?.related_resources?.[0]?.sale?.id;
    
    if (!saleId) {
      throw new Error('Sale ID not found in payment data');
    }

    // Create refund request
    const refundRequest = {
      amount: amount ? {
        total: amount.toString(),
        currency: payment.currency
      } : undefined,
      reason: reason
    };

    // Process refund with PayPal
    const refundResponse = await fetch(`${PAYPAL_BASE_URL}/v1/payments/sale/${saleId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(refundRequest)
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok) {
      throw new Error(`PayPal refund failed: ${refundData.message || 'Unknown error'}`);
    }

    // Create refund record
    const { data: refund, error: refundError } = await supabase
      .from('payment_refunds')
      .insert({
        payment_id: payment.id,
        paypal_refund_id: refundData.id,
        amount: parseFloat(amount || payment.amount),
        currency: payment.currency,
        reason: reason,
        status: refundData.state,
        paypal_data: refundData,
        processed_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (refundError) {
      console.error('Refund record creation error:', refundError);
    }

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: amount && parseFloat(amount) < payment.amount ? 'partially_refunded' : 'refunded',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          refund_id: refundData.id,
          amount: refundData.amount?.total || amount || payment.amount,
          currency: refundData.amount?.currency || payment.currency,
          status: refundData.state,
          reason: reason,
          processed_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Refund payment error:', error);
    throw error;
  }
}

// Get PayPal configuration
async function getPayPalConfig(headers) {
  try {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          client_id: PAYPAL_CLIENT_ID,
          environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
          currency: 'EUR',
          supported_payment_methods: ['paypal', 'card'],
          marketplace_enabled: true
        }
      })
    };

  } catch (error) {
    console.error('Get PayPal config error:', error);
    throw error;
  }
}

// Create subscription
async function createSubscription(userId, requestBody, headers) {
  try {
    const {
      plan_id,
      subscriber_info,
      start_date
    } = JSON.parse(requestBody);

    if (!plan_id || !subscriber_info) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Plan ID and subscriber info are required'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create subscription request
    const subscriptionRequest = {
      plan_id: plan_id,
      subscriber: subscriber_info,
      start_time: start_date || new Date().toISOString(),
      application_context: {
        brand_name: 'SichrPlace',
        locale: 'en-DE',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: `${process.env.FRONTEND_URL}/subscription/success`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`
      }
    };

    // Create subscription with PayPal
    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(subscriptionRequest)
    });

    const subscriptionData = await paypalResponse.json();

    if (!paypalResponse.ok) {
      throw new Error(`PayPal subscription creation failed: ${subscriptionData.message || 'Unknown error'}`);
    }

    // Store subscription record
    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        paypal_subscription_id: subscriptionData.id,
        plan_id: plan_id,
        status: subscriptionData.status,
        start_date: start_date || new Date().toISOString(),
        paypal_data: subscriptionData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('Subscription record creation error:', subscriptionError);
    }

    // Find approval URL
    const approvalUrl = subscriptionData.links?.find(link => link.rel === 'approve')?.href;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          subscription_id: subscriptionData.id,
          status: subscriptionData.status,
          approval_url: approvalUrl,
          created_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Create subscription error:', error);
    throw error;
  }
}

// Cancel subscription
async function cancelSubscription(userId, requestBody, headers) {
  try {
    const { subscription_id, reason = 'User requested cancellation' } = JSON.parse(requestBody);

    if (!subscription_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Subscription ID is required'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Cancel subscription with PayPal
    const cancelRequest = {
      reason: reason
    };

    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscription_id}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(cancelRequest)
    });

    if (!paypalResponse.ok) {
      const errorData = await paypalResponse.json();
      throw new Error(`PayPal subscription cancellation failed: ${errorData.message || 'Unknown error'}`);
    }

    // Update subscription record
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('paypal_subscription_id', subscription_id)
      .eq('user_id', userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          subscription_id: subscription_id,
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          reason: reason
        }
      })
    };

  } catch (error) {
    console.error('Cancel subscription error:', error);
    throw error;
  }
}

// Marketplace capture (for multi-party payments)
async function marketplaceCapture(userId, requestBody, headers) {
  try {
    const {
      order_id,
      payee_id,
      amount,
      platform_fee
    } = JSON.parse(requestBody);

    if (!order_id || !payee_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Order ID and Payee ID are required'
        })
      };
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture with marketplace context
    const captureRequest = {
      payment_instruction: {
        disbursement_mode: 'INSTANT',
        platform_fees: platform_fee ? [{
          amount: {
            currency_code: 'EUR',
            value: platform_fee.toString()
          }
        }] : []
      }
    };

    const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'PayPal-Partner-Attribution-Id': process.env.PAYPAL_BN_CODE || 'SichrPlace_SP'
      },
      body: JSON.stringify(captureRequest)
    });

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      throw new Error(`PayPal marketplace capture failed: ${captureData.message || 'Unknown error'}`);
    }

    // Store marketplace payment record
    const { data: payment, error: paymentError } = await supabase
      .from('marketplace_payments')
      .insert({
        user_id: userId,
        payee_id: payee_id,
        order_id: order_id,
        amount: parseFloat(amount || 0),
        platform_fee: parseFloat(platform_fee || 0),
        status: captureData.status,
        paypal_data: captureData,
        captured_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Marketplace payment record error:', paymentError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          order_id: order_id,
          capture_id: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
          status: captureData.status,
          amount: amount,
          platform_fee: platform_fee,
          payee_id: payee_id,
          captured_at: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Marketplace capture error:', error);
    throw error;
  }
}

// Handle PayPal webhooks
async function handleWebhook(requestBody, requestHeaders, headers) {
  try {
    const webhookEvent = JSON.parse(requestBody);
    
    // Verify webhook signature (implement webhook verification)
    // This is a simplified example - implement proper signature verification
    
    console.log('PayPal webhook received:', webhookEvent.event_type);

    // Handle different webhook events
    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptureCompleted(webhookEvent);
        break;
      
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentRefunded(webhookEvent);
        break;
      
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(webhookEvent);
        break;
      
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(webhookEvent);
        break;
      
      default:
        console.log('Unhandled webhook event:', webhookEvent.event_type);
    }

    // Log webhook event
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: webhookEvent.event_type,
        event_id: webhookEvent.id,
        webhook_data: webhookEvent,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully'
      })
    };

  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      })
    };
  }
}

// Webhook event handlers
async function handlePaymentCaptureCompleted(webhookEvent) {
  const captureId = webhookEvent.resource?.id;
  // Update payment status in database
  await supabase
    .from('payments')
    .update({
      status: 'completed',
      paypal_capture_id: captureId,
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paypal_payment_id', webhookEvent.resource?.supplementary_data?.related_ids?.order_id);
}

async function handlePaymentRefunded(webhookEvent) {
  const refundId = webhookEvent.resource?.id;
  // Update payment status for refund
  await supabase
    .from('payments')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString()
    })
    .eq('paypal_capture_id', webhookEvent.resource?.parent_payment);
}

async function handleSubscriptionActivated(webhookEvent) {
  const subscriptionId = webhookEvent.resource?.id;
  // Update subscription status
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paypal_subscription_id', subscriptionId);
}

async function handleSubscriptionCancelled(webhookEvent) {
  const subscriptionId = webhookEvent.resource?.id;
  // Update subscription status
  await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paypal_subscription_id', subscriptionId);
}