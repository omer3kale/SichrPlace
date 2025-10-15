import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      const { message, email, category, severity, user_id } = JSON.parse(event.body || '{}');

      // Validate required fields
      if (!message) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Message is required' })
        };
      }

      // Insert feedback into Supabase
      const { data, error } = await supabase
        .from('user_feedback')
        .insert([
          {
            message,
            email: email || null,
            category: category || 'general',
            severity: severity || 'medium',
            user_id: user_id || null,
            status: 'new',
            created_at: new Date().toISOString(),
            user_agent: event.headers['user-agent'] || null,
            page_url: event.headers.referer || null
          }
        ])
        .select();

      if (error) {
        console.error('[FEEDBACK] Database error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to save feedback' })
        };
      }

      // Send Slack notification for high-severity feedback
      if (severity === 'high' || category === 'bug') {
        await sendSlackNotification({
          message,
          email,
          category,
          severity,
          id: data[0].id
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Feedback submitted successfully',
          id: data[0].id
        })
      };
    }

    if (event.httpMethod === 'GET') {
      // Admin endpoint to list feedback (add auth later)
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[FEEDBACK] Database error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to fetch feedback' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, feedback: data })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('[FEEDBACK] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};

async function sendSlackNotification(feedback) {
  const slackWebhook = process.env.SLACK_ERROR_WEBHOOK; // Reuse error webhook
  
  if (!slackWebhook) {
    console.log('[SLACK] No webhook configured for feedback notifications');
    return;
  }

  const slackPayload = {
    text: `💬 New High-Priority Feedback - SichrPlace`,
    attachments: [
      {
        color: feedback.severity === 'high' ? 'danger' : 'warning',
        fields: [
          {
            title: 'Category',
            value: feedback.category || 'general',
            short: true
          },
          {
            title: 'Severity',
            value: feedback.severity || 'medium',
            short: true
          },
          {
            title: 'Email',
            value: feedback.email || 'Anonymous',
            short: true
          },
          {
            title: 'Feedback ID',
            value: feedback.id,
            short: true
          },
          {
            title: 'Message',
            value: feedback.message.slice(0, 300) + (feedback.message.length > 300 ? '...' : ''),
            short: false
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });

    if (response.ok) {
      console.log('[SLACK] Feedback notification sent successfully');
    } else {
      console.error('[SLACK] Failed to send feedback notification:', response.status);
    }
  } catch (error) {
    console.error('[SLACK] Error sending feedback notification:', error);
  }
}