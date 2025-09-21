// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"].join(" ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Location", // ✅ expose redirect header to the browser
};

async function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice("Bearer ".length);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase configuration missing");

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error(`Invalid token: ${error?.message || "User not found"}`);
  return { user_id: user.id };
}

function buildState(user_id: string, nonce: string) {
  const stateData = { user_id, nonce, timestamp: Date.now(), secret: Deno.env.get("STATE_SECRET") || "dev" };
  return btoa(JSON.stringify(stateData));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!googleClientId) {
      return new Response(JSON.stringify({
        error: "Google Calendar not configured",
        details: "GOOGLE_CLIENT_ID environment variable is missing.",
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Validate auth & get user ID
    const { user_id } = await getUserFromAuthHeader(req.headers.get("Authorization") || undefined);

    const return_to = new URL(req.url).searchParams.get("return_to") || Deno.env.get("APP_ORIGIN")!;
    const nonce = crypto.randomUUID();
    const state = buildState(user_id, nonce);

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: `${Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "")}/functions/v1/google-auth-callback`,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    // 302 with Location + CORS headers (Location is exposed above)
    return new Response(null, {
      status: 302,
      headers: { Location: authUrl, ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      details: "Check server logs for more information",
    }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
