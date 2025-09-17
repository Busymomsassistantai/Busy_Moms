const AI_BASE =
  (import.meta.env.VITE_AI_FUNCTIONS_URL as string) ||
  "https://rtvwcyrksplhsgycyfzo.functions.supabase.co/ai-proxy";

const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

/** Optional auth header if your functions require anon token to invoke */
function withAuth(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  if (SUPABASE_ANON && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${SUPABASE_ANON}`);
  }
  headers.set("Content-Type", "application/json");
  return { ...init, headers };
}

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

export async function chatCompletion(input: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: any;
}) {
  if (!AI_BASE) {
    throw new Error("VITE_AI_FUNCTIONS_URL is not set");
  }
  const res = await fetch(`${AI_BASE.replace(/\/+$/, "")}/chat`, withAuth({
    method: "POST",
    body: JSON.stringify(input),
  }));
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch {}
    throw new Error(`[AI Proxy] HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<any>;
}