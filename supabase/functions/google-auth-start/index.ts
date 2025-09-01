// deno-lint-ignore-file no-explicit-any
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import * as jose from "https://deno.land/x/jose@v4.15.4/index.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

const {
  APP_ORIGIN,
  STATE_SECRET,
  GOOGLE_CLIENT_ID,
  SUPABASE_URL,
} = Deno.env.toObject();

async function fetchSupabaseJWKS() {
  const jwksUrl = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
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
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { user_id, nonce, iat: getNumericDate(0), exp: getNumericDate(600) };
  return create(header, payload, STATE_SECRET as string);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": APP_ORIGIN,
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Vary": "Origin",
        },
      });
    }

    const { user_id } = await getUserFromAuthHeader(req.headers.get("Authorization") || undefined);
    const url = new URL(req.url);
    const returnTo = url.searchParams.get("return_to") || APP_ORIGIN;

    const nonce = crypto.randomUUID();
    const state = await buildStateJWT(user_id, nonce);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: `${new URL("/google-auth-callback", req.url).origin}/google-auth-callback`,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });

    return new Response(null, { status: 302, headers: { Location: `${GOOGLE_AUTH_URL}?${params.toString()}`, "Access-Control-Allow-Origin": APP_ORIGIN, "Vary": "Origin" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "content-type": "application/json", "Access-Control-Allow-Origin": APP_ORIGIN, "Vary": "Origin" } });
  }
});
