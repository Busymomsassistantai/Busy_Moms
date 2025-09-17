import { createRecipeLink, createShoppingListLink, getNearbyRetailers } from "../instacartClient";
import { toLineItem } from "../instacartMap";

export async function demoRecipe() {
  const ingredients = [
    toLineItem({ name: "chicken breast 1.5 lb" }),
    toLineItem({ name: "yellow onion", quantity: 1, unit: "ea", display_text: "1 medium, diced" }),
    toLineItem({ name: "flour tortillas 10 ea" }),
    toLineItem({ name: "shredded cheese 8 oz" }),
  ];

  return createRecipeLink({
    title: "Busy Moms Chicken Tacos",
    servings: 4,
    instructions: ["Dice onion", "Shred lettuce", "Warm tortillas"],
    ingredients,
    landing_page_configuration: {
      partner_linkback_url: "https://app.busymoms.ai/return",
      enable_pantry_items: true,
    },
  });
}

export async function demoList() {
  const line_items = [
    toLineItem({ name: "eggs 12 ea" }),
    toLineItem({ name: "milk", display_text: "Half-gallon", measurements: [{ unit: "ml", quantity: 1890 }] }),
  ];

  return createShoppingListLink({
    title: "Weekly Essentials",
    line_items,
    landing_page_configuration: {
      partner_linkback_url: "https://app.busymoms.ai/return",
    },
  });
}

export async function demoRetailers() {
  return getNearbyRetailers("32801", "US");
}