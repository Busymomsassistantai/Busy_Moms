const { createClient } = require('@supabase/supabase-js');

const TOKEN_URL = "https://oauth2.googleapis.com/token";

exports.handler = async (event, context) => {
  console.log('🚀 Google auth callback function called');
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
    const code = event.queryStringParameters?.code;
    const state = event.queryStringParameters?.state;
    const error = event.queryStringParameters?.error;

    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error);
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=' + encodeURIComponent(error);
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    if (!code || !state) {
      console.error('❌ Missing code or state');
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=missing_parameters';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (e) {
      console.error('❌ Invalid state:', e);
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=invalid_state';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    console.log('✅ State decoded:', stateData);

    // Exchange code for tokens
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials');
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=missing_credentials';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    console.log('🔄 Exchanging code for tokens...');
    
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://chic-duckanoo-b6e66f.netlify.app/.netlify/functions/google-auth-callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=token_exchange_failed';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Save tokens to Supabase
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase credentials');
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=missing_supabase_config';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const expiry_ts = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    console.log('💾 Saving tokens for user:', stateData.user_id);

    const { error: dbError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: stateData.user_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_ts,
        scope: tokenData.scope,
        token_type: tokenData.token_type || 'Bearer',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=database_error';
      return {
        statusCode: 302,
        headers: { ...headers, 'Location': returnUrl },
        body: ''
      };
    }

    console.log('✅ Tokens saved successfully');

    // Redirect back to app with success
    const returnUrl = stateData.return_to + '?google=connected';
    return {
      statusCode: 302,
      headers: { ...headers, 'Location': returnUrl },
      body: ''
    };

  } catch (error) {
    console.error('❌ Callback error:', error);
    const returnUrl = 'https://chic-duckanoo-b6e66f.netlify.app?google=error&reason=' + encodeURIComponent(error.message);
    return {
      statusCode: 302,
      headers: { ...headers, 'Location': returnUrl },
      body: ''
    };
  }
};