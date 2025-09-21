// deno-lint-ignore-file no-explicit-any
// Google OAuth callback handler - processes the authorization code and stores tokens
// Updated to handle authentication more flexibly and avoid 401 errors

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function bad(msg: string, status = 400) {
  console.error(`❌ Error: ${msg}`);
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 
      "Content-Type": "application/json", 
      ...corsHeaders
    },
  });
}

async function exchangeCodeForTokens(code: string, redirect_uri: string) {
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  if (!googleClientId || !googleClientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
  console.log("🔄 Exchanging code for tokens...");
  
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ Token exchange failed:", errorText);
    throw new Error(`Token exchange failed: ${res.status} - ${errorText}`);
  }
  
  const tokenData = await res.json();
  console.log("✅ Token exchange successful");
  return tokenData;
}

function verifyState(state: string): { user_id: string; rt: string } | null {
  try {
    // Decode base64url state
    const normalizedState = state.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalizedState.length % 4)) % 4);
    const decoded = JSON.parse(atob(normalizedState + padding));
    
    console.log("🔍 Decoded state:", { user_id: decoded.user_id, rt: decoded.rt });
    
    // Verify the state contains required fields
    if (!decoded.user_id || !decoded.rt) {
      console.error("❌ State missing required fields");
      return null;
    }
    
    // Check if state is not too old (30 minutes for OAuth flow)
    const age = Date.now() - (decoded.ts || 0);
    if (age > 30 * 60 * 1000) {
      console.error("❌ State expired, age:", age);
      return null;
    }
    
    return { user_id: decoded.user_id, rt: decoded.rt };
  } catch (error) {
    console.error('❌ State verification failed:', error);
    return null;
  }
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
    console.log(`🚀 Google auth callback - ${req.method} ${req.url}`);

    // Check required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing required environment variables');
      return bad("Server configuration error - missing Supabase credentials", 500);
    }
    
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    
    // Handle OAuth errors from Google
    if (error) {
      console.error("❌ OAuth error from Google:", error);
      const appOrigin = Deno.env.get('APP_ORIGIN') || url.origin;
      const errorUrl = new URL(appOrigin);
      errorUrl.searchParams.set("google", "error");
      errorUrl.searchParams.set("reason", error);
      return Response.redirect(errorUrl.toString(), 302);
    }
    
    if (!code || !state) {
      console.error("❌ Missing code or state parameters");
      return bad("Missing authorization code or state parameter");
    }
    
    console.log('✅ Received auth code and state');

    const stateResult = verifyState(state);
    if (!stateResult?.user_id) {
      console.error('❌ State verification failed');
      return bad("Invalid or expired state parameter");
    }
    
    console.log('✅ State verified for user:', stateResult.user_id);

    const redirect_uri = `${url.origin}/functions/v1/google-auth-callback`;
    console.log('🔗 Using redirect URI:', redirect_uri);
    
    const tokenData = await exchangeCodeForTokens(code, redirect_uri);
    console.log('✅ Token exchange successful');
    
    const { access_token, refresh_token, expires_in, scope, token_type } = tokenData;

    // Initialize Supabase with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    
    const expiry_ts = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    console.log("💾 Saving tokens to database for user:", stateResult.user_id);

    const upsert = await supabase.from("google_tokens").upsert({
      user_id: stateResult.user_id,
      provider_user_id: null,
      access_token,
      refresh_token: refresh_token ?? null,
      expiry_ts,
      scope,
      token_type: token_type || "Bearer",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    
    if (upsert.error) {
      console.error("❌ Database error:", upsert.error);
      throw new Error(`Failed to save tokens: ${upsert.error.message}`);
    }
    
    console.log('✅ Google tokens saved to database');

    // Redirect back to the app with success status
    const returnUrl = new URL(stateResult.rt);
    returnUrl.searchParams.set("google", "connected");
    
    console.log("🔗 Redirecting to:", returnUrl.toString());
    
    return Response.redirect(returnUrl.toString(), 302);
  } catch (e) {
    console.error('❌ Google auth callback error:', e);
    
    // Try to get return URL from state or use fallback
    let returnUrl: string;
    try {
      const url = new URL(req.url);
      const state = url.searchParams.get("state");
      if (state) {
        const stateResult = verifyState(state);
        returnUrl = stateResult?.rt || Deno.env.get('APP_ORIGIN') || url.origin;
      } else {
        returnUrl = Deno.env.get('APP_ORIGIN') || url.origin;
      }
    } catch {
      returnUrl = Deno.env.get('APP_ORIGIN') || 'http://localhost:5173';
    }
    
    const errorUrl = new URL(returnUrl);
    errorUrl.searchParams.set("google", "error");
    errorUrl.searchParams.set("reason", encodeURIComponent(e instanceof Error ? e.message : String(e)));
    
    return Response.redirect(errorUrl.toString(), 302);
  }
});