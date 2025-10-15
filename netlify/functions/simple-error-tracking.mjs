// Enhanced Error Tracking Function with Slack Integration
export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const error = JSON.parse(event.body);
      console.error('[ERROR TRACKING]', error.type, ':', error.message);
      if (error.stack) console.error('Stack:', error.stack);
      
      // Send to Slack if webhook is configured
      await sendSlackAlert(error);
      
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true })
      };
    } catch (e) {
      console.error('[ERROR TRACKING] Failed to process:', e);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false })
      };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
}

async function sendSlackAlert(error) {
  const slackWebhook = process.env.SLACK_ERROR_WEBHOOK;
  
  if (!slackWebhook) {
    console.log('[SLACK] No webhook configured, skipping notification');
    return;
  }

  // Determine severity based on error type
  const severity = getSeverity(error);
  
  // Skip low-severity errors or implement throttling
  if (severity === 'low') {
    console.log('[SLACK] Low severity error, skipping notification');
    return;
  }

  const slackPayload = {
    text: `🚨 SichrPlace Error Alert - ${severity.toUpperCase()}`,
    attachments: [
      {
        color: severity === 'high' ? 'danger' : 'warning',
        fields: [
          {
            title: 'Error Type',
            value: error.type || 'unknown',
            short: true
          },
          {
            title: 'Message',
            value: error.message || 'No message',
            short: true
          },
          {
            title: 'URL',
            value: error.url || 'Unknown',
            short: true
          },
          {
            title: 'Timestamp',
            value: error.timestamp || new Date().toISOString(),
            short: true
          }
        ]
      }
    ]
  };

  if (error.stack && severity === 'high') {
    slackPayload.attachments[0].fields.push({
      title: 'Stack Trace',
      value: `\`\`\`${error.stack.slice(0, 500)}...\`\`\``,
      short: false
    });
  }

  try {
    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      console.error('[SLACK] Failed to send notification:', response.status);
    } else {
      console.log('[SLACK] Alert sent successfully');
    }
  } catch (slackError) {
    console.error('[SLACK] Error sending notification:', slackError);
  }
}

function getSeverity(error) {
  // High severity: JavaScript errors, promise rejections
  if (error.type === 'javascript_error' || error.type === 'promise_rejection') {
    return 'high';
  }
  
  // Medium severity: Network errors, API failures
  if (error.type === 'network_error' || error.message?.includes('fetch')) {
    return 'medium';
  }
  
  // Low severity: Everything else
  return 'low';
}