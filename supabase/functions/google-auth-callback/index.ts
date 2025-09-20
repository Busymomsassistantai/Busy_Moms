// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function bad(msg: string, status = 400) {
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
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return await res.json();
}

function verifyState(state: string): { user_id: string } | null {
  try {
    const stateSecret = Deno.env.get('STATE_SECRET') || 'default-secret-for-development';
    const decoded = JSON.parse(atob(state));
    
    // Verify the state contains required fields and secret matches
    if (!decoded.user_id || !decoded.secret || decoded.secret !== stateSecret) {
      return null;
    }
    
    // Check if state is not too old (10 minutes)
    const age = Date.now() - (decoded.timestamp || 0);
    if (age > 10 * 60 * 1000) {
      return null;
    }
    
    return { user_id: decoded.user_id };
  } catch (error) {
    console.error('State verification failed:', error);
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
    // Check required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appOrigin = Deno.env.get('APP_ORIGIN') || window.location.origin;
    const stateSecret = Deno.env.get('STATE_SECRET');
    
    if (!supabaseUrl || !serviceRoleKey || !stateSecret) {
      console.error('❌ Missing required environment variables');
      return bad("Server configuration error", 500);
    }
    
    console.log('🔍 Processing Google auth callback...');
    
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const returnTo = url.searchParams.get("return_to") || appOrigin;
    
    if (!code || !state) return bad("Missing code or state");
    
    console.log('✅ Received auth code and state');

    const stateResult = verifyState(state);
    if (!stateResult?.user_id) {
      console.error('❌ State verification failed');
      return bad("Invalid or expired state");
    }
    
    console.log('✅ State verified for user:', stateResult.user_id);

    const redirect_uri = `${url.origin}/functions/v1/google-auth-callback`;
    console.log('🔗 Using redirect URI:', redirect_uri);
    
    const tokenData = await exchangeCodeForTokens(code, redirect_uri);
    console.log('✅ Token exchange successful');
    
    const { access_token, refresh_token, expires_in, scope, token_type } = tokenData;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const expiry_ts = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    const upsert = await supabase.from("google_tokens").upsert({
      user_id: stateResult.user_id,
      provider_user_id: null,
      access_token,
      refresh_token: refresh_token ?? null,
      expiry_ts,
      scope,
      token_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    
    if (upsert.error) throw upsert.error;
    
    console.log('✅ Google tokens saved to database');

    const to = new URL(returnTo);
    to.searchParams.set("google", "connected");
    return Response.redirect(to.toString(), 302);
  } catch (e) {
    console.error('❌ Google auth callback error:', e);
    const appOrigin = Deno.env.get('APP_ORIGIN') || 'http://localhost:5173';
    const to = new URL(appOrigin);
    to.searchParams.set("google", "error");
    to.searchParams.set("reason", encodeURIComponent(e instanceof Error ? e.message : String(e)));
    return Response.redirect(to.toString(), 302);
  }
});
