// deno-lint-ignore-file no-explicit-any
// Google OAuth "start" — builds the consent URL and 302 redirects the browser to Google.
// Key fixes:
//  - Use esm.sh import (Deno-friendly) instead of `npm:`
//  - Handle both authenticated and unauthenticated requests
//  - Robust CORS + exposed Location header for fetch(..., { redirect: "manual" })
//  - Safer fallbacks for APP_ORIGIN / return_to

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// Scope just for Calendar; you can add "openid email profile" if you also use user info.
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Location", // allow client to read the redirect target
};

// Helper to get user ID from auth header or generate anonymous ID
async function getUserIdFromAuthHeader(authHeader?: string): Promise<string> {
  // If no auth header, generate anonymous user ID for demo purposes
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("⚠️ No auth header, using anonymous user ID");
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  const accessToken = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log("⚠️ Supabase not configured, using anonymous user ID");
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user?.id) {
      console.log("⚠️ Invalid token, using anonymous user ID");
      return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return data.user.id;
  } catch (error) {
    console.log("⚠️ Auth check failed, using anonymous user ID");
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || ""; // optional, used as a fallback

    if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not set");
    if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not set");

    // Accept both GET ?return_to= and POST {return_to}
    let return_to: string | null = null;
    let user_id: string;
    
    if (req.method === "GET") {
      const u = new URL(req.url);
      return_to = u.searchParams.get("return_to");
      user_id = u.searchParams.get("user_id") || await getUserIdFromAuthHeader(req.headers.get("Authorization") || undefined);
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return_to = body?.return_to ?? null;
      user_id = body?.user_id || await getUserIdFromAuthHeader(req.headers.get("Authorization") || undefined);
    } else {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    // `return_to` is where your callback will bounce the browser after finishing
    const rt = return_to || APP_ORIGIN || new URL(req.url).origin;

    const state = b64url({
      user_id,
      rt,
      ts: Date.now(),
      v: 1,
      // optional: include a hash/nonce if you want extra validation in the callback
      // n: crypto.randomUUID(),
    });

    const redirect_uri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/google-auth-callback`;
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

    // 302 to Google; client can read Location because we expose the header
    return new Response(null, {
      status: 302,
      headers: { Location: authUrl, ...corsHeaders },
    });
  } catch (e) {
    // Surface a precise error to the browser (makes frontend debugging sane)
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: `google-oauth-start: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
