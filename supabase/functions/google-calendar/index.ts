/*
  # Google Calendar API Integration

  1. Purpose
    - Proxy Google Calendar API requests with OAuth
    - Handle OAuth token refresh automatically
    - Provide secure access to Google Calendar data

  2. Security
    - Uses service role key for database access
    - Handles both authenticated and anonymous users
    - Automatic token refresh

  3. API Actions
    - listUpcoming: Get upcoming events
    - getEvents: Get events in date range
    - insertEvent: Create new calendar event
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
  console.log("🔄 Refreshing Google access token...");
  
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Token refresh failed:", errorText);
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json();
  console.log("✅ Token refresh successful");
  return tokenData;
}

async function getValidAccessToken(supabase: any, userId: string, googleClientId: string, googleClientSecret: string) {
  console.log("🔍 Getting valid access token for user:", userId);
  
  const { data: tokenData, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Database error fetching tokens:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!tokenData) {
    console.error("❌ No Google tokens found for user:", userId);
    throw new Error('Google Calendar not connected. Please connect your Google Calendar first.');
  }

  console.log("✅ Found stored tokens, checking expiry...");

  const now = new Date();
  const expiry = new Date(tokenData.expiry_ts);
  
  if (now >= expiry) {
    console.log("⏰ Token expired, refreshing...");
    
    if (!tokenData.refresh_token) {
      console.error("❌ No refresh token available");
      throw new Error('Google Calendar connection expired. Please reconnect your Google Calendar.');
    }

    try {
      const refreshResponse = await refreshGoogleToken(
        tokenData.refresh_token,
        googleClientId,
        googleClientSecret
      );

      const newExpiry = new Date(Date.now() + (refreshResponse.expires_in * 1000));
      
      const { error: updateError } = await supabase
        .from('google_tokens')
        .update({
          access_token: refreshResponse.access_token,
          expiry_ts: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error("❌ Failed to update refreshed token:", updateError);
        throw new Error(`Failed to update token: ${updateError.message}`);
      }

      console.log("✅ Token refreshed and updated");
      return refreshResponse.access_token;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      throw new Error('Failed to refresh Google Calendar token. Please reconnect your Google Calendar.');
    }
  }

  console.log("✅ Using existing valid token");
  return tokenData.access_token;
}

async function makeGoogleCalendarRequest(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const url = `https://www.googleapis.com/calendar/v3${endpoint}`;
  
  console.log(`📡 Making Google Calendar API request: ${options.method || 'GET'} ${endpoint}`);
  
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
    console.error(`❌ Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log("✅ Google Calendar API request successful");
  return data;
}

function getSafeUserId(req: Request, body: any): string {
  if (body?.userId) {
    console.log("📝 Using user ID from body:", body.userId);
    return body.userId;
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.sub) {
          console.log("📝 Using user ID from JWT:", payload.sub);
          return payload.sub;
        }
      }
    } catch (error) {
      console.log("⚠️ Could not parse JWT");
    }
  }

  const anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log("📝 Using anonymous user ID:", anonId);
  return anonId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 Google Calendar API - ${req.method} ${req.url}`);

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

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

    let body: any = {};
    try {
      body = await req.json();
    } catch (error) {
      console.error("❌ Invalid JSON in request body:", error);
      return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    const { action } = body;

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    const userId = getSafeUserId(req, body);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    if (action === "isConnected") {
      try {
        const { data: tokenData, error } = await supabase
          .from("google_tokens")
          .select("access_token, expiry_ts")
          .eq("user_id", userId)
          .maybeSingle();

        const isConnected = !error && !!tokenData?.access_token;
        console.log(`🔍 Connection check for user ${userId}: ${isConnected}`);

        return jsonResponse({
          connected: isConnected,
          expiry_ts: tokenData?.expiry_ts ?? null
        });
      } catch (error) {
        console.error("❌ Connection check failed:", error);
        return jsonResponse({ connected: false, error: error.message }, 500);
      }
    }

    if (action === "disconnect") {
      try {
        const { error } = await supabase
          .from("google_tokens")
          .delete()
          .eq("user_id", userId);

        if (error) {
          console.error("❌ Failed to disconnect Google Calendar:", error);
          return jsonResponse({
            success: false,
            error: "Failed to disconnect Google Calendar",
            details: error.message
          }, 500);
        }

        console.log(`✅ Google Calendar disconnected for user: ${userId}`);
        return jsonResponse({
          success: true,
          message: "Google Calendar disconnected successfully"
        });
      } catch (error) {
        console.error("❌ Disconnect action failed:", error);
        return jsonResponse({
          success: false,
          error: "Failed to disconnect Google Calendar",
          details: error instanceof Error ? error.message : "Unknown error"
        }, 500);
      }
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(supabase, userId, googleClientId, googleClientSecret);
    } catch (error) {
      console.error('❌ Failed to get Google access token:', error);
      return jsonResponse({ 
        error: "Google Calendar authentication failed",
        details: error instanceof Error ? error.message : "Unknown authentication error",
        action: "reconnect_required"
      }, 401);
    }

    console.log(`📅 Processing Google Calendar action: ${action} for user: ${userId}`);

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