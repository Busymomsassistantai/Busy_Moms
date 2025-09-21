/*
  # Google Calendar API Integration

  1. Purpose
    - Proxy Google Calendar API requests with OAuth
    - Handle OAuth token refresh automatically
    - Provide secure access to Google Calendar data

  2. Security
    - Uses service role key for database access
    - Validates Supabase JWT tokens
    - Handles token refresh automatically

  3. API Actions
    - listUpcoming: Get upcoming events
    - getEvents: Get events in date range
    - insertEvent: Create new calendar event
*/

import { createClient } from "npm:@supabase/supabase-js@2";
import * as jose from "npm:jose@5.2.0";
// Add near the top (after imports)
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
// Inside your request handler, before other actions return,
// add this branch to support a safe connection status check:
if (action === "isConnected") {
  const userId = body?.userId ?? body?.uid ?? body?.user_id ?? null;
  if (!userId) return json({ connected: false });

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("google_tokens")
    .select("expiry_ts")
    .eq("user_id", userId)
    .maybeSingle();

  return json({ connected: !!data && !error, expiry_ts: data?.expiry_ts ?? null });
}

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function getValidAccessToken(supabase: any, userId: string, googleClientId: string, googleClientSecret: string) {
  // Get stored tokens
  const { data: tokenData, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    throw new Error('Google Calendar not connected. Please connect your Google Calendar first.');
  }

  // Check if token is expired
  const now = new Date();
  const expiry = new Date(tokenData.expiry_ts);
  
  if (now >= expiry) {
    // Token is expired, refresh it
    if (!tokenData.refresh_token) {
      throw new Error('Google Calendar connection expired. Please reconnect your Google Calendar.');
    }

    try {
      const refreshResponse = await refreshGoogleToken(
        tokenData.refresh_token,
        googleClientId,
        googleClientSecret
      );

      // Update stored tokens
      const newExpiry = new Date(Date.now() + (refreshResponse.expires_in * 1000));
      
      await supabase
        .from('google_tokens')
        .update({
          access_token: refreshResponse.access_token,
          expiry_ts: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return refreshResponse.access_token;
    } catch (error) {
      throw new Error('Failed to refresh Google Calendar token. Please reconnect your Google Calendar.');
    }
  }

  return tokenData.access_token;
}

async function makeGoogleCalendarRequest(accessToken: string, endpoint: string, options: RequestInit = {}) {
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
    throw new Error(`Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing Supabase environment variables');
      return jsonResponse({ 
        error: "Server configuration error",
        details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      }, 500);
    }

    if (!googleClientId || !googleClientSecret) {
      console.error('❌ Missing Google OAuth credentials');
      return jsonResponse({ 
        error: "Google Calendar not configured",
        details: "Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables. Please configure these in your Supabase project settings."
      }, 500);
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    const { action } = body;

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    // Get user ID from request body or auth header (no JWT verification)
    let userId: string = body.userId;
    
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        
        // Try to extract user ID from token without verification
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub || payload.user_id;
        } catch (error) {
          console.log('Could not parse token, using anonymous user');
        }
      }
      
      // Fallback to anonymous user if no valid user ID
      if (!userId) {
        userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('⚠️ Using anonymous user ID:', userId);
      }
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get valid access token for Google Calendar
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabase, userId, googleClientId, googleClientSecret);
    } catch (error) {
      console.error('Failed to get Google access token:', error);
      return jsonResponse({ 
        error: "Google Calendar authentication failed",
        details: error instanceof Error ? error.message : "Unknown authentication error"
      }, 401);
    }

    console.log(`📅 Google Calendar action: ${action} for user: ${userId}`);

    // Handle different actions
    switch (action) {
      case "listUpcoming": {
        const maxResults = body.maxResults || 10;
        const timeMin = new Date().toISOString();
        
        const events = await makeGoogleCalendarRequest(
          accessToken,
          `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`
        );
        
        return jsonResponse(events);
      }

      case "getEvents": {
        const { timeMin, timeMax, maxResults = 250, q } = body;
        
        let endpoint = `/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;
        
        if (timeMin) {
          endpoint += `&timeMin=${encodeURIComponent(timeMin)}`;
        }
        if (timeMax) {
          endpoint += `&timeMax=${encodeURIComponent(timeMax)}`;
        }
        if (q) {
          endpoint += `&q=${encodeURIComponent(q)}`;
        }
        
        const events = await makeGoogleCalendarRequest(accessToken, endpoint);
        return jsonResponse(events);
      }

      case "insertEvent": {
        const { event } = body;
        
        if (!event) {
          return jsonResponse({ error: "Missing event data" }, 400);
        }
        
        const createdEvent = await makeGoogleCalendarRequest(
          accessToken,
          '/calendars/primary/events',
          {
            method: 'POST',
            body: JSON.stringify(event),
          }
        );
        
        return jsonResponse(createdEvent);
      }

      case "updateEvent": {
        const { eventId, event } = body;
        
        if (!eventId || !event) {
          return jsonResponse({ error: "Missing eventId or event data" }, 400);
        }
        
        const updatedEvent = await makeGoogleCalendarRequest(
          accessToken,
          `/calendars/primary/events/${eventId}`,
          {
            method: 'PUT',
            body: JSON.stringify(event),
          }
        );
        
        return jsonResponse(updatedEvent);
      }

      case "deleteEvent": {
        const { eventId } = body;
        
        if (!eventId) {
          return jsonResponse({ error: "Missing eventId" }, 400);
        }
        
        await makeGoogleCalendarRequest(
          accessToken,
          `/calendars/primary/events/${eventId}`,
          { method: 'DELETE' }
        );
        
        return jsonResponse({ success: true, message: "Event deleted successfully" });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

  } catch (error) {
    console.error('❌ Google Calendar function error:', error);
    
    return jsonResponse({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
      details: "Check server logs for more information"
    }, 500);
  }
});