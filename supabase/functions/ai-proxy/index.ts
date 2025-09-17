const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Diagnostics: no secrets leaked
    if (pathname.endsWith("/ping") && req.method === "GET") {
      return json({ ok: true, hasKey: !!OPENAI_API_KEY, base: OPENAI_BASE_URL });
    }

    // Chat completions proxy (OpenAI server-side)
    if (pathname.endsWith("/chat") && req.method === "POST") {
      if (!OPENAI_API_KEY) {
        return json({ error: "Server not configured: missing OPENAI_API_KEY" }, 500);
      }
      
      const body = await req.json().catch(() => ({}));
      const {
        model = "gpt-4o-mini",
        messages = [],
        temperature = 0.2,
        max_tokens = 512,
        response_format,
        ...rest
      } = body || {};

      const upstream = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          response_format,
          ...rest,
        }),
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return json({ error: "Not Found" }, 404);
  } catch (err) {
    console.error("[ai-proxy] error:", err);
    return json({ error: "Internal Server Error" }, 500);
  }
});