import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Prefer project secret INSTACART_API_KEY (set in Supabase), fallback to INSTACART_API_KEY_DEV if present.
const INSTACART_API_KEY =
  Deno.env.get("INSTACART_API_KEY") ??
  Deno.env.get("INSTACART_API_KEY_DEV") ??
  "";
// Default to Instacart dev base; override with INSTACART_BASE_URL in Supabase secrets if needed.
const INSTACART_BASE_URL =
  Deno.env.get("INSTACART_BASE_URL") ?? "https://connect.dev.instacart.tools";

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extra },
  });
}

async function forward(path: string, init: RequestInit & { query?: URLSearchParams } = {}) {
  if (!INSTACART_API_KEY) {
    return json({ error: "Server not configured: missing INSTACART_API_KEY_DEV" }, 500);
  }

  const url = new URL(path, INSTACART_BASE_URL);
  if (init.query) url.search = init.query.toString();

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${INSTACART_API_KEY}`);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  });

  const text = await res.text();
  const isJSON = (res.headers.get("content-type") ?? "").includes("application/json");
  const payload = isJSON && text ? JSON.parse(text) : text;

  // Defense in depth — never leak sensitive fields
  if (typeof payload === "object" && payload) {
    // @ts-ignore
    delete payload?.token;
    // @ts-ignore
    delete payload?.api_key;
  }

  return new Response(isJSON ? JSON.stringify(payload) : String(payload), {
    status: res.status,
    headers: { "Content-Type": isJSON ? "application/json" : "text/plain", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const pathname = url.pathname; // e.g., /functions/v1/instacart-proxy/recipe

    if (pathname.endsWith("/recipe") && req.method === "POST") {
      const body = await req.text();
      return forward("/idp/v1/products/recipe", { method: "POST", body });
    }

    if (pathname.endsWith("/list") && req.method === "POST") {
      const body = await req.text();
      return forward("/idp/v1/products/products_link", { method: "POST", body });
    }

    if (pathname.endsWith("/retailers") && req.method === "GET") {
      const query = new URLSearchParams();
      const postal = url.searchParams.get("postal_code") ?? "";
      const country = url.searchParams.get("country_code") ?? "US";
      if (postal) query.set("postal_code", postal);
      if (country) query.set("country_code", country);
      return forward("/idp/v1/retailers", { method: "GET", query });
    }

    return json({ error: "Not Found" }, 404);
  } catch (err) {
    console.error("instacart-proxy error:", err);
    return json({ error: "Internal Server Error" }, 500);
  }
});