// Simple Error Tracking Function
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
      
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false })
      };
    }
  }

  return { statusCode: 405, body: 'Method not allowed' };
}