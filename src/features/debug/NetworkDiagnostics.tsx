import React, { useState } from "react";

const FN_BASE = (import.meta.env.VITE_FUNCTIONS_URL as string) || "NOT SET";
const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "NOT SET";

type Check = { name: string; ok: boolean; detail?: string };

export default function NetworkDiagnostics() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const results: Check[] = [];

    // 1) Report envs (safe)
    results.push({ name: "Env: VITE_FUNCTIONS_URL", ok: FN_BASE !== "NOT SET", detail: FN_BASE });
    results.push({ name: "Env: VITE_SUPABASE_URL", ok: SB_URL !== "NOT SET", detail: SB_URL });
    results.push({ name: "Context", ok: true, detail: JSON.stringify({
      origin: window.location.origin,
      secureContext: window.isSecureContext,
      crossOriginIsolated: (window as any).crossOriginIsolated ?? false
    }) });

    // 2) Ping Edge Function
    try {
      const u = `${FN_BASE.replace(/\/+$/, "")}/ping`;
      const r = await fetch(u, { method: "GET" });
      const j = await r.json().catch(() => ({}));
      results.push({ name: "Instacart Proxy /ping", ok: r.ok, detail: JSON.stringify(j) });
    } catch (e: any) {
      results.push({ name: "Instacart Proxy /ping", ok: false, detail: e?.message || String(e) });
    }

    // 3) Retailers sample
    try {
      const u = `${FN_BASE.replace(/\/+$/, "")}/retailers?postal_code=32801&country_code=US`;
      const r = await fetch(u, { method: "GET" });
      const j = await r.json().catch(() => ({}));
      results.push({ name: "Instacart Proxy /retailers", ok: r.ok, detail: r.ok ? "OK" : JSON.stringify(j) });
    } catch (e: any) {
      results.push({ name: "Instacart Proxy /retailers", ok: false, detail: e?.message || String(e) });
    }

    // 4) Supabase Auth health
    try {
      const u = `${SB_URL.replace(/\/+$/, "")}/auth/v1/health`;
      const r = await fetch(u, { method: "GET" });
      const j = await r.json().catch(() => ({}));
      results.push({ name: "Supabase /auth/v1/health", ok: r.ok, detail: r.ok ? "OK" : JSON.stringify(j) });
    } catch (e: any) {
      results.push({ name: "Supabase /auth/v1/health", ok: false, detail: e?.message || String(e) });
    }

    setChecks(results);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Network Diagnostics</h1>
      <p className="mb-4 text-sm text-gray-600">
        This tool verifies your client envs and reachability of the Supabase Edge Function and Auth endpoints.
      </p>
      <button className="rounded-xl border px-4 py-2 hover:bg-gray-50" onClick={run} disabled={running}>
        {running ? "Running..." : "Run Checks"}
      </button>
      <ul className="mt-4 space-y-2">
        {checks.map((c, i) => (
          <li key={i} className={`rounded-xl border p-3 ${c.ok ? "border-green-300" : "border-red-300"}`}>
            <div className="font-medium">{c.name}: {c.ok ? "✅ OK" : "❌ FAIL"}</div>
            {c.detail && <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">{c.detail}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}