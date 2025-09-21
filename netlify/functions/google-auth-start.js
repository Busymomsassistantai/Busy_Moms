const { createClient } = require('@supabase/supabase-js');

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

exports.handler = async (event, context) => {
  console.log('🚀 Google auth start function called');
  console.log('Method:', event.httpMethod);
  console.log('Query params:', event.queryStringParameters);

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    
    if (!GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID not configured');
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Google Calendar not configured. Please set GOOGLE_CLIENT_ID environment variable.' 
        })
      };
    }

    // Get parameters
    const user_id = event.queryStringParameters?.user_id || `anon_${Date.now()}`;
    const return_to = event.queryStringParameters?.return_to || 'https://chic-duckanoo-b6e66f.netlify.app';
    
    console.log('🔍 Auth start for user:', user_id);
    console.log('🔗 Return URL:', return_to);

    // Create state
    const state = Buffer.from(JSON.stringify({
      user_id,
      return_to,
      timestamp: Date.now()
    })).toString('base64url');

    // Build redirect URI
    const redirect_uri = 'https://chic-duckanoo-b6e66f.netlify.app/.netlify/functions/google-auth-callback';
    
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    console.log('🚀 Redirecting to:', authUrl);

    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location': authUrl,
      },
      body: ''
    };

  } catch (error) {
    console.error('❌ Google auth start error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Authentication start failed',
        details: error.message 
      })
    };
  }
};