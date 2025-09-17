import { createClient } from "@supabase/supabase-js";

const RAW_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";
const RAW_FN_BASE = (import.meta.env.VITE_FUNCTIONS_URL as string | undefined) || "";
const RAW_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const RAW_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined) || "";

/** Extract 20-char project ref from a Supabase host URL (supabase.co or functions.supabase.co). */
function extractRef(u?: string): string | undefined {
  if (!u) return;
  const m =
    u.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/i) ||
    u.match(/^https:\/\/([a-z0-9]{20})\.functions\.supabase\.co/i);
  return m?.[1];
}

/** Build canonical Supabase URL for a given ref. */
function urlFromRef(ref?: string): string {
  return ref ? `https://${ref}.supabase.co` : "";
}

/**
 * Authoritative source of truth:
 * 1) VITE_SUPABASE_PROJECT_REF (explicit)
 * 2) ref from VITE_FUNCTIONS_URL (if set)
 * 3) ref from VITE_SUPABASE_URL (if set)
 */
function resolveProjectRef(): string | undefined {
  return RAW_REF?.trim() || extractRef(RAW_FN_BASE) || extractRef(RAW_SUPABASE_URL);
}

const REF = resolveProjectRef();
const SUPABASE_URL = urlFromRef(REF);

// Fail fast only if we cannot determine a valid URL/ref or anon key is missing.
if (!SUPABASE_URL) {
  console.error(
    "[Supabase] Could not determine project URL. Set VITE_SUPABASE_PROJECT_REF=rtvwcyrksplhsgycyfzo or VITE_SUPABASE_URL=https://rtvwcyrksplhsgycyfzo.supabase.co"
  );
}
if (!RAW_ANON) {
  console.error("[Supabase] VITE_SUPABASE_ANON_KEY is missing. Auth calls will fail.");
}

// Log once (no mismatch warnings; we normalize silently to avoid noisy consoles)
if (typeof window !== "undefined" && !(window as any).__supabase_boot_logged) {
  console.debug("[Supabase] Using URL =", SUPABASE_URL || "(not set)", "ref =", REF || "(unknown)");
  (window as any).__supabase_boot_logged = true;
}

export const supabase = createClient(SUPABASE_URL, RAW_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (input, init) => {
      return fetch(input, init).catch((err) => {
        console.error("[Supabase fetch error]", err);
        throw err;
      });
    },
  },
});

export { SUPABASE_URL, REF as SUPABASE_PROJECT_REF };