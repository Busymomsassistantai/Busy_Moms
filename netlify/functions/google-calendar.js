const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  console.log('🚀 Google Calendar API function called');
  console.log('Method:', event.httpMethod);

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      console.error('❌ Invalid JSON body');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    const { action, userId } = body;

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing action parameter' })
      };
    }

    // Get user ID from body or generate anonymous one
    const finalUserId = userId || `anon_${Date.now()}`;
    console.log('📅 Processing action:', action, 'for user:', finalUserId);

    // Initialize Supabase
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase configuration');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error',
          details: 'Missing Supabase credentials'
        })
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Google credentials
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Google Calendar not configured',
          details: 'Missing Google OAuth credentials'
        })
      };
    }

    // Handle connection check
    if (action === 'isConnected') {
      try {
        const { data: tokenData, error } = await supabase
          .from('google_tokens')
          .select('access_token, expiry_ts')
          .eq('user_id', finalUserId)
          .maybeSingle();

        const isConnected = !error && !!tokenData?.access_token;
        console.log('🔍 Connection check result:', isConnected);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            connected: isConnected,
            expiry_ts: tokenData?.expiry_ts || null
          })
        };
      } catch (error) {
        console.error('❌ Connection check failed:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            connected: false, 
            error: error.message 
          })
        };
      }
    }

    // Get valid access token
    let accessToken;
    try {
      const { data: tokenData, error } = await supabase
        .from('google_tokens')
        .select('*')
        .eq('user_id', finalUserId)
        .maybeSingle();

      if (error || !tokenData) {
        throw new Error('Google Calendar not connected. Please connect first.');
      }

      // Check if token is expired
      const now = new Date();
      const expiry = new Date(tokenData.expiry_ts);
      
      if (now >= expiry && tokenData.refresh_token) {
        console.log('⏰ Token expired, refreshing...');
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: tokenData.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          throw new Error('Token refresh failed');
        }

        const refreshData = await refreshResponse.json();
        const newExpiry = new Date(Date.now() + (refreshData.expires_in * 1000));
        
        await supabase
          .from('google_tokens')
          .update({
            access_token: refreshData.access_token,
            expiry_ts: newExpiry.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', finalUserId);

        accessToken = refreshData.access_token;
        console.log('✅ Token refreshed');
      } else {
        accessToken = tokenData.access_token;
        console.log('✅ Using existing token');
      }
    } catch (error) {
      console.error('❌ Token retrieval failed:', error);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Authentication failed',
          details: error.message,
          action: 'reconnect_required'
        })
      };
    }

    // Make Google Calendar API request
    const makeGoogleRequest = async (endpoint, options = {}) => {
      const url = `https://www.googleapis.com/calendar/v3${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    };

    // Handle different actions
    switch (action) {
      case 'listUpcoming': {
        const maxResults = body.maxResults || 10;
        const timeMin = new Date().toISOString();
        
        const events = await makeGoogleRequest(
          `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`
        );
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(events)
        };
      }

      case 'getEvents': {
        const { timeMin, timeMax, maxResults = 250 } = body;
        
        let endpoint = `/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;
        
        if (timeMin) endpoint += `&timeMin=${encodeURIComponent(timeMin)}`;
        if (timeMax) endpoint += `&timeMax=${encodeURIComponent(timeMax)}`;
        
        const events = await makeGoogleRequest(endpoint);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(events)
        };
      }

      case 'insertEvent': {
        const { event } = body;
        
        if (!event) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing event data' })
          };
        }
        
        const createdEvent = await makeGoogleRequest('/calendars/primary/events', {
          method: 'POST',
          body: JSON.stringify(event),
        });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(createdEvent)
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        };
    }

  } catch (error) {
    console.error('❌ Google Calendar function error:', error);
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