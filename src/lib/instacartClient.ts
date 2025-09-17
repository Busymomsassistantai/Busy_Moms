export interface Measurement {
  unit: string;      // e.g., "oz", "ml", "g", "lb", "ea"
  quantity: number;  // numeric amount
}

export interface LineItem {
  name: string;            // generic product name (no brand/size here)
  display_text?: string;   // human-readable extras (prep notes, size text)
  quantity?: number;       // use either quantity+unit OR measurements[] / line_item_measurements[]
  unit?: string;
  measurements?: Measurement[];
  line_item_measurements?: Measurement[];
  filters?: {
    brand_filters?: string[];   // exact, case-sensitive
    health_filters?: string[];  // exact, case-sensitive
  };
  product_ids?: string[];  // do NOT combine with upcs
  upcs?: string[];         // do NOT combine with product_ids
}

// Prefer env; fall back to your deployed URL so devs don't get "undefined" during local preview.
// This fallback contains NO secret and is safe to ship.
const FUNCTIONS_BASE =
  (import.meta.env.VITE_FUNCTIONS_URL as string) ||
  "https://rtvwcyrksplhsgycyfzo.functions.supabase.co/instacart-proxy";

const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

import { fetchWithTimeout } from "./net";

function getBaseOrThrow() {
  if (!FUNCTIONS_BASE) {
    throw new Error(
      "VITE_FUNCTIONS_URL is not set. Set it to your deployed function base: https://[PROJECT_REF].functions.supabase.co/instacart-proxy"
    );
  }
  if (typeof window !== "undefined" && !(window as any).__instacart_base_logged) {
    console.debug("[Instacart] FUNCTIONS_BASE =", FUNCTIONS_BASE);
    (window as any).__instacart_base_logged = true;
  }
  return FUNCTIONS_BASE.replace(/\/+$/, ""); // trim trailing slash
}

function withAuthHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  // Optional: some Supabase setups require anon auth header to invoke functions
  if (SUPABASE_ANON && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${SUPABASE_ANON}`);
  }
  return { ...init, headers };
}

function assertValidLineItem(i: LineItem) {
  if (!i.name) throw new Error("LineItem.name is required");
  if (i.product_ids && i.upcs) {
    throw new Error("Provide either product_ids or upcs, not both");
  }
  const hasQtyUnit = typeof i.quantity === "number" && !!i.unit;
  const hasMeasurements = Array.isArray(i.measurements) && i.measurements.length > 0;
  const hasLineItemMeasurements = Array.isArray(i.line_item_measurements) && i.line_item_measurements.length > 0;
  if (!(hasQtyUnit || hasMeasurements || hasLineItemMeasurements)) {
    throw new Error("Provide quantity+unit OR measurements[]/line_item_measurements[]");
  }
}

export async function createRecipeLink(input: {
  title: string;
  servings?: number;
  image_url?: string;
  instructions?: string[];
  ingredients: LineItem[];
  expires_in?: number; // seconds (optional)
  landing_page_configuration?: {
    partner_linkback_url?: string;
    enable_pantry_items?: boolean;
  };
}) {
  input.ingredients.forEach(assertValidLineItem);
  const base = getBaseOrThrow();
  const res = await fetchWithTimeout(`${base}/recipe`, withAuthHeaders({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 15000,
  }) as any).catch((e: any) => {
    throw new Error(`[Instacart] Recipe fetch failed: ${e.type || "unknown"} ${e.status || ""} ${e.bodyText || e.message || ""}`.trim());
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instacart recipe error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ products_link_url: string }>;
}

export async function createShoppingListLink(input: {
  title: string;
  image_url?: string;
  line_items: LineItem[];
  expires_in?: number; // seconds (optional)
  landing_page_configuration?: {
    partner_linkback_url?: string;
  };
}) {
  input.line_items.forEach(assertValidLineItem);
  const base = getBaseOrThrow();
  const res = await fetchWithTimeout(`${base}/list`, withAuthHeaders({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 15000,
  }) as any).catch((e: any) => {
    throw new Error(`[Instacart] List fetch failed: ${e.type || "unknown"} ${e.status || ""} ${e.bodyText || e.message || ""}`.trim());
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instacart list error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ products_link_url: string }>;
}

export async function getNearbyRetailers(postal_code: string, country_code = "US") {
  const base = getBaseOrThrow();
  const url = new URL(`${base}/retailers`);
  if (postal_code) url.searchParams.set("postal_code", postal_code);
  if (country_code) url.searchParams.set("country_code", country_code);
  const res = await fetchWithTimeout(url.toString(), withAuthHeaders({ method: "GET", timeoutMs: 15000 }) as any)
    .catch((e: any) => {
      throw new Error(`[Instacart] Retailers fetch failed: ${e.type || "unknown"} ${e.status || ""} ${e.bodyText || e.message || ""}`.trim());
    });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instacart retailers error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ retailers: unknown[] }>;
}