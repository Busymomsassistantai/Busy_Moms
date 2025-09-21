// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_ORIGIN = Deno.env.get("APP_ORIGIN")!;        // e.g., https://chic-duckanoo-b6e66f.netlify.app
const STATE_SECRET = Deno.env.get("STATE_SECRET")!;    // reserved for future validation

function b64url(input: string) {
  return btoa(input).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

serve(async (req) => {
  // Support both GET (?return_to=) and POST {return_to}
  let return_to: string | null = null;
  if (req.method === "GET") {
    const u = new URL(req.url);
    return_to = u.searchParams.get("return_to");
  } else if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    return_to = body?.return_to ?? null;
  } else {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const state = b64url(JSON.stringify({ t: Date.now(), rt: return_to ?? APP_ORIGIN }));
  const redirect_uri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/google-auth-callback`;
  const scope = encodeURIComponent("openid email https://www.googleapis.com/auth/calendar");

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline&prompt=consent&include_granted_scopes=true` +
    `&state=${state}`;

  // Pure 302 with Location; the client navigates via window.location.href
  return new Response(null, { status: 302, headers: new Headers({ "Location": authUrl }) });
});
