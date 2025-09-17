import React, { useState } from "react";
import { createRecipeLink, createShoppingListLink, getNearbyRetailers, type LineItem } from "../../lib/instacartClient";
import { toLineItem } from "../../lib/instacartMap";

type LinkResult = { url?: string; error?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Actions({ link }: { link: string | undefined }) {
  if (!link) return null;
  return (
    <div className="mt-3 flex items-center gap-3">
      <a href={link} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 hover:bg-gray-50">Open Link</a>
      <button
        className="rounded-xl border px-3 py-2 hover:bg-gray-50"
        onClick={() => link && navigator.clipboard.writeText(link)}
      >
        Copy URL
      </button>
      <code className="block max-w-full truncate text-sm text-gray-500">{link}</code>
    </div>
  );
}

function parseLinesToItems(raw: string): LineItem[] {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(l => toLineItem({ name: l }));
}

export default function ShoppingTab() {
  // Retailers
  const [zip, setZip] = useState("32801");
  const [country, setCountry] = useState("US");
  const [retailers, setRetailers] = useState<any[] | null>(null);
  const [retLoading, setRetLoading] = useState(false);
  const [retErr, setRetErr] = useState<string | null>(null);

  // Recipe
  const [recipeTitle, setRecipeTitle] = useState("Busy Moms Chicken Tacos");
  const [recipeIngredients, setRecipeIngredients] = useState("chicken breast 1.5 lb\nyellow onion 1 ea\nflour tortillas 10 ea\nshredded cheese 8 oz");
  const [recipeInstructions, setRecipeInstructions] = useState("Dice onion\nShred lettuce\nWarm tortillas");
  const [recipeLink, setRecipeLink] = useState<LinkResult>({});
  const [recipeLoading, setRecipeLoading] = useState(false);

  // Shopping list
  const [listTitle, setListTitle] = useState("Weekly Essentials");
  const [listItems, setListItems] = useState("eggs 12 ea\nmilk 1890 ml");
  const [listLink, setListLink] = useState<LinkResult>({});
  const [listLoading, setListLoading] = useState(false);

  async function onFindRetailers() {
    setRetLoading(true);
    setRetErr(null);
    setRetailers(null);
    try {
      const res = await getNearbyRetailers(zip, country);
      const arr = Array.isArray((res as any).retailers) ? (res as any).retailers : (res as any);
      setRetailers(arr || []);
    } catch (e: any) {
      setRetErr(e?.message ?? "Failed to fetch retailers");
    } finally {
      setRetLoading(false);
    }
  }

  async function onCreateRecipe() {
    setRecipeLoading(true);
    setRecipeLink({});
    try {
      const ingLines = recipeIngredients.split("\n").map(s => s.trim()).filter(Boolean);
      if (ingLines.length === 0) throw new Error("Add at least one ingredient line.");
      const ingredients = parseLinesToItems(ingLines.join("\n"));
      const instructions = recipeInstructions.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await createRecipeLink({
        title: recipeTitle,
        instructions,
        ingredients,
        landing_page_configuration: {
          partner_linkback_url: "https://app.busymoms.ai/return",
          enable_pantry_items: true,
        },
      });
      setRecipeLink({ url: (res as any).products_link_url });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to create recipe link";
      setRecipeLink({ error: msg });
    } finally {
      setRecipeLoading(false);
    }
  }

  async function onCreateList() {
    setListLoading(true);
    setListLink({});
    try {
      const itemLines = listItems.split("\n").map(s => s.trim()).filter(Boolean);
      if (itemLines.length === 0) throw new Error("Add at least one shopping list line.");
      const line_items = parseLinesToItems(itemLines.join("\n"));
      const res = await createShoppingListLink({
        title: listTitle,
        line_items,
        landing_page_configuration: {
          partner_linkback_url: "https://app.busymoms.ai/return",
        },
      });
      setListLink({ url: (res as any).products_link_url });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to create shopping list link";
      setListLink({ error: msg });
    } finally {
      setListLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold">Shopping</h1>

      <Section title="Find nearby retailers">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Postal Code</span>
            <input className="rounded-xl border px-3 py-2" value={zip} onChange={e => setZip(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Country</span>
            <select className="rounded-xl border px-3 py-2" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="US">US</option>
              <option value="CA">CA</option>
            </select>
          </label>
          <button className="rounded-xl border px-4 py-2 hover:bg-gray-50" onClick={onFindRetailers} disabled={retLoading}>
            {retLoading ? "Loading..." : "Find Stores"}
          </button>
        </div>
        {retErr && <p className="mt-2 text-sm text-red-600">{retErr}</p>}
        {retailers && (
          <ul className="mt-3 list-disc pl-5">
            {retailers.map((r: any, idx: number) => (
              <li key={idx} className="text-sm">{r?.name ?? JSON.stringify(r)}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Create a recipe link">
        <div className="grid gap-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Title</span>
            <input className="rounded-xl border px-3 py-2" value={recipeTitle} onChange={e => setRecipeTitle(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Ingredients (one per line)</span>
            <textarea className="min-h-[100px] rounded-xl border px-3 py-2" value={recipeIngredients} onChange={e => setRecipeIngredients(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Instructions (one per line)</span>
            <textarea className="min-h-[80px] rounded-xl border px-3 py-2" value={recipeInstructions} onChange={e => setRecipeInstructions(e.target.value)} />
          </label>
          <button className="rounded-xl border px-4 py-2 hover:bg-gray-50" onClick={onCreateRecipe} disabled={recipeLoading}>
            {recipeLoading ? "Creating..." : "Create Recipe Link"}
          </button>
          {recipeLink.error && <p className="text-sm text-red-600">{recipeLink.error}</p>}
          <Actions link={recipeLink.url} />
        </div>
      </Section>

      <Section title="Create a shopping list link">
        <div className="grid gap-3">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Title</span>
            <input className="rounded-xl border px-3 py-2" value={listTitle} onChange={e => setListTitle(e.target.value)} />
          </label>
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Items (one per line)</span>
            <textarea className="min-h-[100px] rounded-xl border px-3 py-2" value={listItems} onChange={e => setListItems(e.target.value)} />
          </label>
          <button className="rounded-xl border px-4 py-2 hover:bg-gray-50" onClick={onCreateList} disabled={listLoading}>
            {listLoading ? "Creating..." : "Create Shopping List Link"}
          </button>
          {listLink.error && <p className="text-sm text-red-600">{listLink.error}</p>}
          <Actions link={listLink.url} />
        </div>
      </Section>
    </div>
  );
}