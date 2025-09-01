// deno-lint-ignore-file no-explicit-any
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  APP_ORIGIN,
  STATE_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = Deno.env.toObject();

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": APP_ORIGIN },
  });
}

async function exchangeCodeForTokens(code: string, redirect_uri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const returnTo = url.searchParams.get("return_to") || APP_ORIGIN;
    if (!code || !state) return bad("Missing code or state");

    const { payload } = await verify(state, STATE_SECRET as string, "HS256").catch(() => ({ payload: null as any }));
    if (!payload?.user_id) return bad("Invalid state");

    const redirect_uri = `${new URL("/google-auth-callback", req.url).origin}/google-auth-callback`;
    const tokenData = await exchangeCodeForTokens(code, redirect_uri);
    const { access_token, refresh_token, expires_in, scope, token_type } = tokenData;

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const expiry_ts = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    const upsert = await supabase.from("google_tokens").upsert({
      user_id: payload.user_id,
      provider_user_id: null,
      access_token,
      refresh_token: refresh_token ?? null,
      expiry_ts,
      scope,
      token_type,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upsert.error) throw upsert.error;

    const to = new URL(returnTo);
    to.searchParams.set("google", "connected");
    return Response.redirect(to.toString(), 302);
  } catch (e) {
    const to = new URL(APP_ORIGIN!);
    to.searchParams.set("google", "error");
    to.searchParams.set("reason", encodeURIComponent(e.message));
    return Response.redirect(to.toString(), 302);
  }
});
