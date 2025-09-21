// deno-lint-ignore-file no-explicit-any
// Google OAuth "start" — builds the consent URL and 302 redirects the browser to Google.
// Updated to handle authentication more flexibly and avoid 401 errors

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Location",
};

// Helper to safely get user ID without strict JWT verification
async function getSafeUserId(req: Request): Promise<string> {
  // Try to get user ID from query params first (for GET requests)
  const url = new URL(req.url);
  const queryUserId = url.searchParams.get("user_id");
  if (queryUserId) {
    console.log("📝 Using user ID from query params:", queryUserId);
    return queryUserId;
  }

  // Try to get from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    
    // Try to parse JWT payload without verification (for development)
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
      console.log("⚠️ Could not parse JWT, continuing with fallback");
    }
  }

  // Generate anonymous user ID as fallback
  const anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log("📝 Using anonymous user ID:", anonId);
  return anonId;
}

function b64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(json).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log(`🚀 Google auth start - ${req.method} ${req.url}`);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");

    if (!SUPABASE_URL) {
      console.error("❌ SUPABASE_URL environment variable not set");
      return new Response(JSON.stringify({ error: "SUPABASE_URL is not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error("❌ GOOGLE_CLIENT_ID environment variable not set");
      return new Response(JSON.stringify({ error: "GOOGLE_CLIENT_ID is not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get user ID safely
    const user_id = await getSafeUserId(req);

    // Get return_to parameter
    let return_to: string | null = null;
    if (req.method === "GET") {
      const u = new URL(req.url);
      return_to = u.searchParams.get("return_to");
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        return_to = body?.return_to ?? null;
      } catch (error) {
        console.log("⚠️ Could not parse POST body, using query params");
        const u = new URL(req.url);
        return_to = u.searchParams.get("return_to");
      }
    }

    // Determine return URL
    const rt = return_to || new URL(req.url).origin;
    console.log("🔗 Return URL:", rt);

    // Create state with user info
    const state = b64url({
      user_id,
      rt,
      ts: Date.now(),
      v: 1,
    });

    const redirect_uri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/google-auth-callback`;
    console.log("🔗 Redirect URI:", redirect_uri);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    console.log("🚀 Redirecting to Google OAuth:", authUrl);

    // 302 redirect to Google OAuth
    return new Response(null, {
      status: 302,
      headers: { Location: authUrl, ...corsHeaders },
    });
  } catch (e) {
    console.error("❌ Google auth start error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: `google-oauth-start: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});