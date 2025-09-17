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

const FUNCTIONS_BASE =
  (import.meta.env.VITE_FUNCTIONS_URL as string) ??
  "http://localhost:54321/functions/v1/instacart-proxy";

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
  const baseUrl = FUNCTIONS_BASE || `${SUPABASE_URL}/functions/v1`;
  const res = await fetch(`${baseUrl}/instacart-proxy/recipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
  const baseUrl = FUNCTIONS_BASE || `${SUPABASE_URL}/functions/v1`;
  const res = await fetch(`${baseUrl}/instacart-proxy/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instacart list error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ products_link_url: string }>;
}

export async function getNearbyRetailers(postal_code: string, country_code = "US") {
  const baseUrl = FUNCTIONS_BASE || `${SUPABASE_URL}/functions/v1`;
  const url = new URL(`${baseUrl}/instacart-proxy/retailers`);
  if (postal_code) url.searchParams.set("postal_code", postal_code);
  if (country_code) url.searchParams.set("country_code", country_code);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instacart retailers error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ retailers: unknown[] }>;
}