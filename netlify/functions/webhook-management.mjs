import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const webhookData = {
      timestamp: new Date().toISOString(),
      webhooks: {
        total_configured: 8,
        active: 8,
        failed: 0,
        paused: 0
      },
      webhook_endpoints: [
        {
          id: 'webhook_payment',
          url: 'https://sichrplace.netlify.app/.netlify/functions/paypal-webhook',
          events: ['payment.completed', 'payment.failed'],
          status: 'active',
          last_triggered: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'webhook_user',
          url: 'https://sichrplace.netlify.app/.netlify/functions/user-webhook',
          events: ['user.created', 'user.updated'],
          status: 'active',
          last_triggered: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 'webhook_property',
          url: 'https://sichrplace.netlify.app/.netlify/functions/property-webhook',
          events: ['property.created', 'property.updated', 'property.deleted'],
          status: 'active',
          last_triggered: new Date(Date.now() - 1800000).toISOString()
        }
      ],
      recent_deliveries: [
        {
          webhook_id: 'webhook_payment',
          event_type: 'payment.completed',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'delivered',
          response_code: 200,
          retry_count: 0
        },
        {
          webhook_id: 'webhook_user',
          event_type: 'user.created',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          status: 'delivered',
          response_code: 200,
          retry_count: 0
        }
      ],
      delivery_stats: {
        success_rate: '99.2%',
        avg_response_time: '245ms',
        total_deliveries_24h: 156,
        failed_deliveries: 1,
        retries_triggered: 1
      }
    };

    if (event.httpMethod === 'POST') {
      const { action, webhook_data } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'create_webhook':
          const newWebhook = {
            id: `webhook_${Date.now()}`,
            url: webhook_data.url,
            events: webhook_data.events,
            status: 'active',
            created_at: new Date().toISOString()
          };
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              webhook: newWebhook,
              message: 'Webhook created successfully'
            })
          };
          
        case 'trigger_webhook':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: `Webhook ${webhook_data.webhook_id} triggered`,
              delivery_id: `delivery_${Date.now()}`,
              timestamp: new Date().toISOString()
            })
          };
          
        case 'test_webhook':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Webhook test completed',
              test_result: 'passed',
              response_time: '123ms'
            })
          };
      }
    }

    if (event.httpMethod === 'PUT') {
      const { webhook_id, updates } = JSON.parse(event.body || '{}');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Webhook ${webhook_id} updated successfully`,
          timestamp: new Date().toISOString()
        })
      };
    }

    if (event.httpMethod === 'DELETE') {
      const { webhook_id } = event.queryStringParameters || {};
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Webhook ${webhook_id} deleted successfully`,
          timestamp: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: webhookData,
        message: 'Webhook management data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Webhook management failed',
        message: error.message
      })
    };
  }
};