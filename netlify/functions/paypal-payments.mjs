import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Environment validation
const paypalBaseURL = process.env.PAYPAL_ENVIRONMENT === 'production' 
  ? 'https://api.paypal.com'
  : 'https://api.sandbox.paypal.com';

const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const jwtSecret = process.env.JWT_SECRET;
const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!paypalClientId || !paypalClientSecret || !jwtSecret) {
  throw new Error('Missing required PayPal environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, JWT_SECRET');
}

if (!paypalWebhookId) {
  throw new Error('Missing required PayPal environment variable: PAYPAL_WEBHOOK_ID');
}

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to build standardized headers
const buildHeaders = (additionalHeaders = {}) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin, Access-Control-Request-Headers',
  ...additionalHeaders
});

// Helper function to create standardized responses
const respond = (data, statusCode = 200, additionalHeaders = {}) => ({
  statusCode,
  headers: buildHeaders(additionalHeaders),
  body: JSON.stringify(data)
});

// Helper function to parse request body safely
const parseRequestBody = (body) => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
};

// Helper function to sanitize string inputs
const sanitizeString = (value, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
};

// Helper function to sanitize numeric inputs
const sanitizeNumber = (value, min = 0, max = 999999) => {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};

// Helper function to create HTTP errors
const httpError = (statusCode, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Helper function to extract bearer token
const extractBearerToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
};

// Helper function to get PayPal access token with enhanced error handling
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
    
    if (!response.ok) {
      throw new Error(`PayPal API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('PayPal access token not received');
    }
    
    return data.access_token;
  } catch (error) {
    console.error('PayPal Access Token Error:', error);
    throw httpError(502, 'Failed to authenticate with PayPal', { originalError: error.message });
  }
};

// Helper function to authenticate token with enhanced security
const authenticateToken = async (headers) => {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader) {
    throw httpError(401, 'Authentication required');
  }

  const token = extractBearerToken(authHeader);
  if (!token) {
    throw httpError(401, 'Invalid authorization format');
  }

  const sanitizedToken = sanitizeString(token, 1000);
  if (!sanitizedToken) {
    throw httpError(401, 'Invalid token format');
  }

  try {
    const decoded = jwt.verify(sanitizedToken, jwtSecret);
    return decoded;
  } catch (jwtError) {
    console.error('JWT verification error:', jwtError.message);
    throw httpError(401, 'Invalid or expired token');
  }
};

const getHeaderValue = (headers = {}, name) => {
  if (!headers || !name) return null;
  const target = name.toLowerCase();
  const match = Object.keys(headers).find((key) => key.toLowerCase() === target);
  return match ? headers[match] : null;
};

const mapPayPalStatusToDomain = (status) => {
  if (!status) return null;
  const normalized = status.toString().toLowerCase();
  switch (normalized) {
    case 'created':
    case 'pending':
    case 'approved':
    case 'completed':
    case 'cancelled':
    case 'failed':
    case 'refunded':
      return normalized;
    case 'denied':
    case 'declined':
    case 'voided':
    case 'expired':
      return 'failed';
    case 'success':
    case 'captured':
      return 'completed';
    case 'partially_refunded':
      return 'refunded';
    default:
      return null;
  }
};

const ensurePaymentTransaction = async ({
  paymentId,
  userId,
  viewingRequestId,
  apartmentId,
  amount,
  currency,
  status,
  gatewayStatus,
  gatewayResponse
}) => {
  if (!paymentId) {
    throw httpError(400, 'Payment identifier is required');
  }

  const payload = {
    payment_id: paymentId,
    user_id: userId || null,
    viewing_request_id: viewingRequestId || null,
    apartment_id: apartmentId || null,
    amount: typeof amount === 'number' ? amount : amount ? Number.parseFloat(amount) : null,
    currency: currency || 'EUR',
    payment_method: 'paypal',
    status: status || 'created',
    gateway_status: gatewayStatus || null,
  gateway_response: gatewayResponse || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('payment_transactions')
    .upsert([payload], { onConflict: 'payment_id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert payment transaction:', error);
    throw httpError(500, 'Failed to persist payment transaction', error);
  }

  return data;
};

const updatePaymentTransaction = async (paymentId, fields = {}) => {
  if (!paymentId) {
    throw httpError(400, 'Payment identifier is required for update');
  }

  const sanitizedFields = {
    ...fields,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: lookupError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (lookupError) {
    console.error('Payment lookup failed:', lookupError);
    throw httpError(500, 'Failed to load payment transaction', lookupError);
  }

  if (!existing) {
    if (!Number.isFinite(sanitizedFields.amount)) {
      throw httpError(400, 'Cannot create payment transaction without amount data');
    }

    return ensurePaymentTransaction({
      paymentId,
      status: sanitizedFields.status,
      gatewayStatus: sanitizedFields.gateway_status,
      gatewayResponse: sanitizedFields.gateway_response,
      amount: sanitizedFields.amount,
      currency: sanitizedFields.currency,
      userId: sanitizedFields.user_id,
      viewingRequestId: sanitizedFields.viewing_request_id,
      apartmentId: sanitizedFields.apartment_id
    });
  }

  const { data, error } = await supabase
    .from('payment_transactions')
    .update(sanitizedFields)
    .eq('payment_id', paymentId)
    .select()
    .single();

  if (error) {
    console.error('Payment update failed:', error);
    throw httpError(500, 'Failed to update payment transaction', error);
  }

  return data;
};

const PAYMENT_NOTIFICATION_TYPES = {
  success: 'payment_success',
  failure: 'payment_failed',
  refund: 'payment_success'
};

const createPaymentNotification = async ({
  userId,
  type,
  title,
  message,
  relatedEntityId
}) => {
  if (!userId || !type) {
    return;
  }

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      related_entity_type: 'payment',
      related_entity_id: relatedEntityId || null,
      priority: type === PAYMENT_NOTIFICATION_TYPES.failure ? 'high' : 'normal'
    });
  } catch (notificationError) {
    console.error('Failed to record payment notification:', notificationError);
  }
};

const recordPaymentEvent = async ({
  paymentId,
  userId,
  viewingRequestId,
  apartmentId,
  amount,
  currency,
  status,
  gatewayStatus,
  gatewayResponse,
  payerId,
  transactionId,
  completedAt,
  refundedAt,
  refundAmount,
  fees,
  netAmount
}) => {
  const domainStatus = mapPayPalStatusToDomain(status) || status || null;

  const updateFields = {};

  if (domainStatus) updateFields.status = domainStatus;
  if (gatewayStatus || status) updateFields.gateway_status = gatewayStatus || status;
  if (gatewayResponse) updateFields.gateway_response = gatewayResponse;
  if (transactionId) updateFields.transaction_id = transactionId;
  if (payerId) updateFields.payer_id = payerId;
  if (completedAt) updateFields.completed_at = completedAt;
  if (refundedAt) updateFields.refunded_at = refundedAt;

  const normalizedRefund = typeof refundAmount === 'number'
    ? refundAmount
    : refundAmount
      ? Number.parseFloat(refundAmount)
      : null;
  if (Number.isFinite(normalizedRefund)) updateFields.refund_amount = normalizedRefund;

  const normalizedFees = typeof fees === 'number'
    ? fees
    : fees
      ? Number.parseFloat(fees)
      : null;
  if (Number.isFinite(normalizedFees)) updateFields.fees = normalizedFees;

  const normalizedNet = typeof netAmount === 'number'
    ? netAmount
    : netAmount
      ? Number.parseFloat(netAmount)
      : null;
  if (Number.isFinite(normalizedNet)) updateFields.net_amount = normalizedNet;

  const normalizedAmount = typeof amount === 'number'
    ? amount
    : amount
      ? Number.parseFloat(amount)
      : existingAmountFallback(gatewayResponse);
  if (Number.isFinite(normalizedAmount)) updateFields.amount = normalizedAmount;

  if (currency) updateFields.currency = currency;
  if (userId) updateFields.user_id = userId;
  if (viewingRequestId) updateFields.viewing_request_id = viewingRequestId;
  if (apartmentId) updateFields.apartment_id = apartmentId;

  const updated = await updatePaymentTransaction(paymentId, updateFields);
  return updated;
};

const existingAmountFallback = (gatewayResponse) => {
  if (!gatewayResponse) return null;
  const amountValue = gatewayResponse?.amount?.value
    || gatewayResponse?.purchase_units?.[0]?.amount?.value
    || gatewayResponse?.payment_source?.paypal?.amount?.value
    || gatewayResponse?.seller_receivable_breakdown?.gross_amount?.value
    || gatewayResponse?.seller_payable_breakdown?.gross_amount?.value;

  if (!amountValue) return null;
  const parsed = Number.parseFloat(amountValue);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveOrderIdFromResource = (resource = {}) => {
  return resource?.supplementary_data?.related_ids?.order_id
    || resource?.custom_id
    || resource?.invoice_id
    || resource?.id
    || null;
};

const verifyPayPalWebhookSignature = async (headers, body) => {
  const transmissionId = getHeaderValue(headers, 'paypal-transmission-id');
  const transmissionTime = getHeaderValue(headers, 'paypal-transmission-time');
  const certUrl = getHeaderValue(headers, 'paypal-cert-url');
  const authAlgo = getHeaderValue(headers, 'paypal-auth-algo');
  const transmissionSig = getHeaderValue(headers, 'paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error('Missing PayPal webhook headers', {
      hasTransmissionId: Boolean(transmissionId),
      hasTransmissionTime: Boolean(transmissionTime),
      hasCertUrl: Boolean(certUrl),
      hasAuthAlgo: Boolean(authAlgo),
      hasTransmissionSig: Boolean(transmissionSig)
    });
    throw httpError(401, 'Invalid PayPal webhook headers');
  }

  const accessToken = await getPayPalAccessToken();

  const verificationPayload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: paypalWebhookId,
    webhook_event: body
  };

  const verifyResponse = await fetch(`${paypalBaseURL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(verificationPayload)
  });

  if (!verifyResponse.ok) {
    const errorData = await verifyResponse.json().catch(() => ({}));
    console.error('PayPal webhook verification failed:', errorData);
    throw httpError(401, 'Failed to verify PayPal webhook signature', { paypalError: errorData });
  }

  const verificationResult = await verifyResponse.json();
  if (verificationResult?.verification_status !== 'SUCCESS') {
    console.error('PayPal webhook signature invalid:', verificationResult);
    throw httpError(401, 'Invalid PayPal webhook signature');
  }
};

export const handler = async (event, context) => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: buildHeaders(), body: '' };
    }

    switch (event.httpMethod) {
      case 'GET':
        return await getPayPalConfig();
      case 'POST':
        return await handlePayPalAction(event);
      default:
        throw httpError(405, 'Method not allowed');
    }
  } catch (error) {
    console.error('PayPal function error:', error);
    
    // Handle HTTP errors (from httpError helper)
    if (error.statusCode) {
      return respond({
        success: false,
        message: error.message,
        ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details })
      }, error.statusCode);
    }
    
    // Handle unexpected errors
    return respond({
      success: false,
      message: 'Payment processing failed',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    }, 500);
  }
};

// GET PayPal configuration with enhanced security
const getPayPalConfig = async () => {
  return respond({
    success: true,
    data: {
      clientId: paypalClientId,
      environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox'
    }
  });
};

// POST handle PayPal actions with enhanced security
const handlePayPalAction = async (event) => {
  const path = sanitizeString(event.path || '', 200);
  const body = parseRequestBody(event.body);

  if (path.includes('/create')) {
    return await createPayPalOrder(event.headers, body);
  } else if (path.includes('/capture') || path.includes('/execute')) {
    return await capturePayPalOrder(event.headers, body);
  } else if (path.includes('/webhooks')) {
    return await handlePayPalWebhook(event);
  } else {
    throw httpError(404, 'PayPal action not found');
  }
};

// Create PayPal order with enhanced security and validation
const createPayPalOrder = async (requestHeaders, body) => {
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
  
  // Validate and sanitize inputs
  const sanitizedAmount = sanitizeNumber(amount, 0.01, 999999);
  if (!amount || sanitizedAmount <= 0) {
    throw httpError(400, 'Valid amount is required');
  }
  
  const sanitizedCurrency = sanitizeString(currency, 3) || 'EUR';
  const sanitizedDescription = sanitizeString(description, 200) || 'SichrPlace Booking Fee';
  const sanitizedApartmentId = sanitizeString(apartmentId, 50);
  const sanitizedViewingRequestId = sanitizeString(viewingRequestId, 50);

  const createPayment = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: sanitizedCurrency,
        value: sanitizedAmount.toFixed(2)
      },
      description: sanitizedDescription,
      custom_id: sanitizedApartmentId || '',
      invoice_id: sanitizedViewingRequestId || `INV_${Date.now()}_${user.userId}`
    }],
    application_context: {
      return_url: sanitizeString(returnUrl, 500) || 'https://sichrplace.netlify.app/payment-success',
      cancel_url: sanitizeString(cancelUrl, 500) || 'https://sichrplace.netlify.app/payment-cancel',
      brand_name: 'SichrPlace',
      user_action: 'PAY_NOW'
    }
  };

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${paypalBaseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(createPayment)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw httpError(400, 'Failed to create PayPal order', { paypalError: errorData });
    }

    const data = await response.json();
    const approvalUrl = data.links?.find(link => link.rel === 'approve')?.href;

    await ensurePaymentTransaction({
      paymentId: data.id,
      userId: user.userId || user.id || null,
      viewingRequestId: sanitizedViewingRequestId || null,
      apartmentId: sanitizedApartmentId || null,
      amount: sanitizedAmount,
      currency: sanitizedCurrency,
      status: mapPayPalStatusToDomain(data.status) || 'created',
      gatewayStatus: data.status,
      gatewayResponse: data
    });
    
    return respond({
      success: true,
      data: {
        orderId: data.id,
        approvalUrl,
        orderDetails: data
      }
    });
  // Let errors bubble up to main handler
};

// Capture PayPal order with enhanced security and validation
const capturePayPalOrder = async (requestHeaders, body) => {
  const user = await authenticateToken(requestHeaders);
  const { orderId, paymentId, payerId } = body;

  const orderIdToCapture = sanitizeString(orderId || paymentId, 50);
  const sanitizedViewingRequestId = sanitizeString(body.viewingRequestId, 50) || null;
  const sanitizedApartmentId = sanitizeString(body.apartmentId, 50) || null;

  if (!orderIdToCapture) {
    throw httpError(400, 'Order ID is required');
  }

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${paypalBaseURL}/v2/checkout/orders/${orderIdToCapture}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw httpError(400, 'Failed to capture PayPal order', { paypalError: errorData });
  }

  const data = await response.json();
  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  const captureAmount = capture?.amount?.value || data?.purchase_units?.[0]?.amount?.value;
  const captureCurrency = capture?.amount?.currency_code || data?.purchase_units?.[0]?.amount?.currency_code || 'EUR';
  const captureStatus = capture?.status || data?.status;
  const captureId = capture?.id || capture?.transaction_id || null;
  const payerIdentifier = payerId || data?.payer?.payer_id || capture?.payer?.payer_id || null;

  const updatedTransaction = await recordPaymentEvent({
    paymentId: orderIdToCapture,
    userId: user.userId || user.id || null,
    viewingRequestId: sanitizedViewingRequestId,
    apartmentId: sanitizedApartmentId,
    amount: captureAmount,
    currency: captureCurrency,
    status: captureStatus,
    gatewayStatus: captureStatus,
    gatewayResponse: data,
    payerId: payerIdentifier,
    transactionId: captureId,
    completedAt: captureStatus && captureStatus.toLowerCase() === 'completed' ? new Date().toISOString() : null
  });

  await createPaymentNotification({
    userId: updatedTransaction?.user_id,
    type: PAYMENT_NOTIFICATION_TYPES.success,
    title: 'Payment captured successfully',
    message: `We’ve received your PayPal payment of ${captureCurrency} ${captureAmount}.`,
    relatedEntityId: updatedTransaction?.id
  });

  return respond({
    success: true,
    data: {
      status: (captureStatus || 'COMPLETED').toLowerCase(),
      orderId: data.id || orderIdToCapture,
      captureDetails: data
    }
  });
  // Let errors bubble up to main handler
};

// Handle PayPal webhooks with enhanced security and processing
const handlePayPalWebhook = async (event) => {
  const headers = event.headers || {};
  const body = parseRequestBody(event.body);

  console.log('PayPal webhook received:', {
    eventType: body?.event_type,
    resourceId: body?.resource?.id
  });

  // Validate webhook payload
  if (!body || typeof body !== 'object') {
    throw httpError(400, 'Invalid webhook payload');
  }

  const eventType = sanitizeString(body.event_type, 100);
  if (!eventType) {
    throw httpError(400, 'Missing event type in webhook');
  }

  if (process.env.NODE_ENV === 'production' || process.env.PAYPAL_VERIFY_WEBHOOKS === 'true') {
    await verifyPayPalWebhookSignature(headers, body);
  }

  const resource = body.resource || {};
  const paymentId = resolveOrderIdFromResource(resource);
  let updatedTransaction = null;

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const amountValue = resource?.amount?.value
        || resource?.seller_payable_breakdown?.gross_amount?.value;
      const currencyCode = resource?.amount?.currency_code
        || resource?.seller_payable_breakdown?.gross_amount?.currency_code
        || 'EUR';
      const feesValue = resource?.seller_payable_breakdown?.paypal_fee?.value
        || resource?.seller_receivable_breakdown?.paypal_fee?.value;
      const netAmountValue = resource?.seller_payable_breakdown?.net_amount?.value
        || resource?.seller_receivable_breakdown?.net_amount?.value;
      const completionTimestamp = resource?.update_time || resource?.create_time || new Date().toISOString();

      updatedTransaction = await recordPaymentEvent({
        paymentId: paymentId || resource.id,
        amount: amountValue,
        currency: currencyCode,
        status: resource.status || 'COMPLETED',
        gatewayStatus: resource.status || 'COMPLETED',
        gatewayResponse: resource,
        payerId: resource?.payer?.payer_id || null,
        transactionId: resource?.id || null,
        completedAt: completionTimestamp,
        fees: feesValue,
        netAmount: netAmountValue
      });

      await createPaymentNotification({
        userId: updatedTransaction?.user_id,
        type: PAYMENT_NOTIFICATION_TYPES.success,
        title: 'Payment received',
        message: `Your PayPal payment of ${currencyCode} ${amountValue} has been completed successfully.`,
        relatedEntityId: updatedTransaction?.id
      });
      break;
    }
    case 'PAYMENT.CAPTURE.DENIED': {
      const amountValue = resource?.amount?.value;
      const currencyCode = resource?.amount?.currency_code || 'EUR';
      updatedTransaction = await recordPaymentEvent({
        paymentId: paymentId || resource.id,
        amount: amountValue,
        currency: currencyCode,
        status: resource.status || 'DENIED',
        gatewayStatus: resource.status || 'DENIED',
        gatewayResponse: resource,
        payerId: resource?.payer?.payer_id || null,
        transactionId: resource?.id || null
      });

      await createPaymentNotification({
        userId: updatedTransaction?.user_id,
        type: PAYMENT_NOTIFICATION_TYPES.failure,
        title: 'Payment failed',
        message: `Your PayPal payment of ${currencyCode} ${amountValue} could not be completed. Please try again or use a different payment method.`,
        relatedEntityId: updatedTransaction?.id
      });
      break;
    }
    case 'PAYMENT.CAPTURE.REFUNDED': {
      const refundAmount = resource?.amount?.value;
      const currencyCode = resource?.amount?.currency_code || 'EUR';
      const refundTimestamp = resource?.update_time || resource?.create_time || new Date().toISOString();

      updatedTransaction = await recordPaymentEvent({
        paymentId: paymentId || resource.id,
        amount: refundAmount,
        currency: currencyCode,
        status: 'REFUNDED',
        gatewayStatus: resource.status || 'REFUNDED',
        gatewayResponse: resource,
        transactionId: resource?.id || null,
        refundedAt: refundTimestamp,
        refundAmount
      });

      await createPaymentNotification({
        userId: updatedTransaction?.user_id,
        type: PAYMENT_NOTIFICATION_TYPES.success,
        title: 'Payment refunded',
        message: `Your PayPal payment was refunded for ${currencyCode} ${refundAmount}. The amount should arrive in your account shortly.`,
        relatedEntityId: updatedTransaction?.id
      });
      break;
    }
    default:
      console.log('Unhandled webhook event:', eventType);
  }

  return respond({
    success: true,
    message: 'Webhook processed successfully',
    eventType
  });
};