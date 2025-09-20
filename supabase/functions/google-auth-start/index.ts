// deno-lint-ignore-file no-explicit-any
import * as jose from "npm:jose@5.2.0";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function fetchSupabaseJWKS() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');
  
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error("Failed to load Supabase JWKS");
  return await res.json();
}

async function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  
  const token = authHeader.slice("Bearer ".length);
  
  try {
    const jwks = await fetchSupabaseJWKS();
    const { payload } = await jose.jwtVerify(token, jose.createLocalJWKSet(jwks));
    const user_id = payload.sub as string | undefined;
    if (!user_id) throw new Error("Invalid token payload: no sub");
    return { user_id };
  } catch (error) {
    console.error('JWT verification failed:', error);
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Invalid token'}`);
  }
}

async function buildStateJWT(user_id: string, nonce: string) {
  const stateSecret = Deno.env.get('STATE_SECRET') || 'default-secret-for-development';
  const secret = new TextEncoder().encode(stateSecret);
  
  return await new jose.SignJWT({ user_id, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);
}

Deno.serve(async (req: Request) => {
  console.log(`📥 Google auth start request: ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Check required environment variables
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    
    if (!googleClientId) {
      console.error('❌ GOOGLE_CLIENT_ID not configured');
      return new Response(JSON.stringify({ 
        error: "Google Calendar not configured",
        details: "GOOGLE_CLIENT_ID environment variable is missing. Please configure this in your Supabase project settings."
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log('🔍 Starting Google Calendar auth flow...');
    
    // Get user from auth header
    let user_id: string;
    try {
      const authResult = await getUserFromAuthHeader(req.headers.get("Authorization") || undefined);
      user_id = authResult.user_id;
      console.log('✅ User authenticated:', user_id);
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        details: error instanceof Error ? error.message : "Please sign in first"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
    
    const url = new URL(req.url);
    const returnTo = url.searchParams.get("return_to") || req.headers.get("origin") || "http://localhost:5173";

    const nonce = crypto.randomUUID();
    const state = await buildStateJWT(user_id, nonce);
    
    // Use the current request URL to build the redirect URI
    const redirectUri = `${url.origin}/functions/v1/google-auth-callback`;
    console.log('🔗 Redirect URI:', redirectUri);

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    console.log('🚀 Redirecting to Google auth:', authUrl);
    
    return new Response(null, { 
      status: 302, 
      headers: { 
        Location: authUrl,
        ...corsHeaders
      } 
    });
  } catch (e) {
    console.error('❌ Google auth start error:', e);
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : 'Unknown error',
      details: 'Check server logs for more information'
    }), { 
      status: 500, 
      headers: { 
        "Content-Type": "application/json", 
        ...corsHeaders
      } 
    });
  }
});