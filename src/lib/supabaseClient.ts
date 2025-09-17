import { createClient } from "@supabase/supabase-js";

const RAW_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const RAW_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";
const RAW_FN_BASE = (import.meta.env.VITE_FUNCTIONS_URL as string | undefined) || "";
const RAW_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined) || "";

/** Extract a 20-char project ref from a Supabase host URL (supabase.co or functions.supabase.co). */
function extractRefFromUrl(u?: string): string | undefined {
  if (!u) return;
  const m =
    u.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/i) ||
    u.match(/^https:\/\/([a-z0-9]{20})\.functions\.supabase\.co/i);
  return m?.[1];
}

/** Build the canonical Supabase URL for a given ref. */
function urlFromRef(ref?: string): string {
  return ref ? `https://${ref}.supabase.co` : "";
}

function normalizeSupabaseUrl(): { url: string; ref?: string; warned: boolean } {
  const explicitRef = RAW_REF?.trim() || undefined;
  const fnRef = extractRefFromUrl(RAW_FN_BASE);
  const urlRef = extractRefFromUrl(RAW_URL);
  // Choose authoritative ref: explicit > functions > url
  const ref = explicitRef || fnRef || urlRef;
  let url = RAW_URL || urlFromRef(ref);
  let warned = false;

  if (ref && urlRef && ref !== urlRef) {
    console.warn(
      `[Supabase] Project ref mismatch (URL=${urlRef}, expected=${ref}). Using normalized URL for safety.`
    );
    url = urlFromRef(ref);
    warned = true;
  }
  return { url, ref, warned };
}

const { url: SUPABASE_URL_NORM, ref: SUPABASE_REF, warned } = normalizeSupabaseUrl();

if (!SUPABASE_URL_NORM) {
  console.error(
    "[Supabase] VITE_SUPABASE_URL is missing or could not be normalized. Expected https://<project_ref>.supabase.co"
  );
}
if (!RAW_ANON) {
  console.error("[Supabase] VITE_SUPABASE_ANON_KEY is missing. Auth calls will fail.");
}

if (typeof window !== "undefined" && !(window as any).__supabase_boot_logged) {
  console.debug("[Supabase] Using URL =", SUPABASE_URL_NORM || "(not set)", "ref =", SUPABASE_REF || "(unknown)");
  if (warned) console.debug("[Supabase] URL was normalized due to mismatch.");
  (window as any).__supabase_boot_logged = true;
}

export const supabase = createClient(SUPABASE_URL_NORM, RAW_ANON, {
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

export const SUPABASE_URL = SUPABASE_URL_NORM;
export const SUPABASE_PROJECT_REF = SUPABASE_REF;