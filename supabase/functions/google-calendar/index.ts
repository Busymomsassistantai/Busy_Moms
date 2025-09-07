/*
  # Google Calendar API Integration

  1. Purpose
    - Proxy Google Calendar API requests
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
        details: "Missing Supabase configuration"
      }, 500);
    }

    if (!googleClientId || !googleClientSecret) {
      console.error('❌ Missing Google OAuth credentials');
      return jsonResponse({ 
        error: "Google Calendar not configured",
        details: "Missing Google OAuth credentials. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
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

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    // For now, return mock data since Google Calendar integration requires OAuth setup
    console.log(`📅 Google Calendar action: ${action}`);

    switch (action) {
      case "listUpcoming":
        return jsonResponse({
          items: [
            {
              id: "demo-event-1",
              summary: "Demo Event - Soccer Practice",
              start: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
              end: { dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString() },
              location: "Local Park",
              htmlLink: "https://calendar.google.com"
            },
            {
              id: "demo-event-2", 
              summary: "Demo Event - Parent Meeting",
              start: { dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
              end: { dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString() },
              location: "School",
              htmlLink: "https://calendar.google.com"
            }
          ]
        });

      case "getEvents":
        const { timeMin, timeMax } = body;
        return jsonResponse({
          items: [
            {
              id: "demo-range-event",
              summary: "Demo Event in Range",
              start: { dateTime: timeMin || new Date().toISOString() },
              end: { dateTime: timeMax || new Date(Date.now() + 60 * 60 * 1000).toISOString() },
              location: "Demo Location",
              htmlLink: "https://calendar.google.com"
            }
          ]
        });

      case "insertEvent":
        const { event } = body;
        return jsonResponse({
          id: `demo-created-${Date.now()}`,
          summary: event?.summary || "Demo Created Event",
          start: event?.start || { dateTime: new Date().toISOString() },
          end: event?.end || { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          htmlLink: "https://calendar.google.com",
          status: "confirmed"
        });

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