// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.15.4/index.ts";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  APP_ORIGIN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = Deno.env.toObject();

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": APP_ORIGIN,
      "Vary": "Origin",
    },
  });
}

async function getUserIdFromSupabaseJWT(token: string) {
  const jwksUrl = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  const jwks = await fetch(jwksUrl).then(r => r.json());
  const { payload } = await jose.jwtVerify(token, jose.createLocalJWKSet(jwks));
  return payload.sub as string;
}

async function getTokensForUser(supabase: any, user_id: string) {
  const { data, error } = await supabase.from("google_tokens").select("*").eq("user_id", user_id).single();
  if (error || !data) throw new Error("No Google connection for user");
  return data;
}

async function refreshAccessToken(refresh_token: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Google token");
  return await res.json();
}

async function ensureAccessToken(supabase: any, user_id: string) {
  const row = await getTokensForUser(supabase, user_id);
  const expiresAt = row.expiry_ts ? new Date(row.expiry_ts).getTime() : 0;
  const now = Date.now();
  if (now < expiresAt - 60_000 && row.access_token) return row.access_token as string;
  if (!row.refresh_token) throw new Error("Missing refresh_token; reconnect Google");

  const refreshed = await refreshAccessToken(row.refresh_token);
  const access_token = refreshed.access_token as string;
  const expires_in = refreshed.expires_in ?? 3600;
  const expiry_ts = new Date(now + expires_in * 1000).toISOString();
  const upd = await supabase.from("google_tokens").update({ access_token, expiry_ts, updated_at: new Date().toISOString() }).eq("user_id", user_id);
  if (upd.error) throw upd.error;
  return access_token;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("", { headers: { "Access-Control-Allow-Origin": APP_ORIGIN, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" } });
    }
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Missing Authorization" }, 401);
    const jwt = auth.slice("Bearer ".length);
    const user_id = await getUserIdFromSupabaseJWT(jwt);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const action = body?.action as string;
    const access_token = await ensureAccessToken(supabase, user_id);

    if (action === "listUpcoming") {
      const maxResults = body.maxResults ?? 10;
      const timeMin = new Date().toISOString();
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", String(maxResults));
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${access_token}` } });
      return json(await res.json(), res.status);
    }

    if (action === "insertEvent") {
      const event = body.event;
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "content-type": "application/json" },
        body: JSON.stringify(event),
      });
      return json(await res.json(), res.status);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 400);
  }
});
