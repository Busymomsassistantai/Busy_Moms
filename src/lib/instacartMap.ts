/*
  # Instacart Mapping Utilities

  Utilities for mapping between our app's data structures and Instacart's API.
  Handles data transformation, validation, and normalization.

  Features:
  - Shopping list to Instacart cart conversion
  - Product matching and suggestions
  - Price and availability mapping
  - Category normalization
*/

import type { LineItem, Measurement } from "./instacartClient";

/** Very light normalization that:
 *  - Moves common size tokens into a measurement when feasible
 *  - Keeps 'name' generic and human-clean
 */
export function normalizeNameAndMeasurements(
  rawName: string,
  maybeDisplay?: string
): { name: string; display_text?: string; measurements?: Measurement[] } {
  let name = (rawName || "").trim();
  let display_text = (maybeDisplay || "").trim() || undefined;
  const measurements: Measurement[] = [];

  // Example heuristics: extract "8 oz", "12 oz", "1 lb", "dozen" -> measurements
  const sizeMatch = name.match(/\b(\d+(\.\d+)?)\s*(oz|ml|g|lb|lbs|ea)\b/i);
  if (sizeMatch) {
    const qty = Number(sizeMatch[1]);
    const unitRaw = sizeMatch[3].toLowerCase();
    const unit = unitRaw === "lbs" ? "lb" : unitRaw;
    if (!Number.isNaN(qty)) {
      measurements.push({ unit, quantity: qty });
      name = name.replace(sizeMatch[0], "").replace(/\s{2,}/g, " ").trim();
      if (!display_text) display_text = sizeMatch[0];
    }
  }

  // Basic cleanup: remove trailing commas, double spaces
  name = name.replace(/[,\s]+$/g, "").replace(/\s{2,}/g, " ");

  return { name, display_text, measurements: measurements.length ? measurements : undefined };
}

/** Map a raw Busy Moms item into an Instacart LineItem */
export function toLineItem(input: {
  name: string;
  display_text?: string;
  quantity?: number;
  unit?: string;
  measurements?: Measurement[];
  upcs?: string[];
  product_ids?: string[];
  brand_filters?: string[];
  health_filters?: string[];
}): LineItem {
  const norm = normalizeNameAndMeasurements(input.name, input.display_text);
  const li: LineItem = {
    name: norm.name,
    display_text: norm.display_text ?? input.display_text,
    filters: {
      brand_filters: input.brand_filters,
      health_filters: input.health_filters,
    },
    upcs: input.upcs,
    product_ids: input.product_ids,
  };

  // prefer explicit inputs; fallback to normalized measurement
  if (input.measurements?.length) {
    li.measurements = input.measurements;
  } else if (norm.measurements?.length) {
    li.measurements = norm.measurements;
  } else if (typeof input.quantity === "number" && input.unit) {
    li.quantity = input.quantity;
    li.unit = input.unit;
  } else {
    // default minimal quantity if nothing provided
    li.quantity = 1;
    li.unit = "ea";
  }

  return li;
}