// deno-lint-ignore-file no-explicit-any
import { create, getNumericDate } from "npm:djwt@3.0.2";
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
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing Authorization");
  const token = authHeader.slice("Bearer ".length);
  const jwks = await fetchSupabaseJWKS();
  const { payload } = await jose.jwtVerify(token, jose.createLocalJWKSet(jwks));
  const user_id = payload.sub as string | undefined;
  if (!user_id) throw new Error("Invalid token payload: no sub");
  return { user_id };
}

function buildStateJWT(user_id: string, nonce: string) {
  const stateSecret = Deno.env.get('STATE_SECRET');
  if (!stateSecret) throw new Error('STATE_SECRET not configured');
  
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { user_id, nonce, iat: getNumericDate(0), exp: getNumericDate(600) };
  return create(header, payload, stateSecret);
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
    const appOrigin = Deno.env.get('APP_ORIGIN') || '*';
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    
    if (!googleClientId) {
      console.error('❌ GOOGLE_CLIENT_ID not configured');
      return new Response(JSON.stringify({ 
        error: "Google Calendar not configured",
        details: "GOOGLE_CLIENT_ID environment variable is missing"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log('🔍 Starting Google Calendar auth flow...');
    
    const { user_id } = await getUserFromAuthHeader(req.headers.get("Authorization") || undefined);
    console.log('✅ User authenticated:', user_id);
    
    const url = new URL(req.url);
    const returnTo = url.searchParams.get("return_to") || appOrigin;

    const nonce = crypto.randomUUID();
    const state = await buildStateJWT(user_id, nonce);
    
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
      status: 400, 
      headers: { 
        "Content-Type": "application/json", 
        ...corsHeaders
      } 
    });
  }
});
