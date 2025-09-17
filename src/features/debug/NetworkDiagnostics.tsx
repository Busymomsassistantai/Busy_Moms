import React, { useState } from "react";
import { decodeJwtPayload, extractRefFromIss } from "../../lib/jwt";

const FN_BASE = (import.meta.env.VITE_FUNCTIONS_URL as string) || "NOT SET";
const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "NOT SET";
const SB_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string) || "NOT SET";
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
const SB_VALID = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(SB_URL);
const EXPECTED_REF = 'rtvwcyrksplhsgycyfzo';

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
    results.push({ name: "Env: VITE_SUPABASE_PROJECT_REF", ok: SB_REF !== "NOT SET", detail: SB_REF });
    
    // Anon key decode and validation
    try {
      const short = ANON ? `${ANON.slice(0, 8)}…` : "(not set)";
      const payload = decodeJwtPayload(ANON);
      const role = payload?.role ?? "(unknown)";
      const iss = payload?.iss as string | undefined;
      const refFromAnon = extractRefFromIss(iss);
      const matches = SB_REF !== "NOT SET" && refFromAnon === SB_REF;
      
      results.push({ name: "Anon Key: present", ok: !!ANON, detail: short });
      results.push({ name: "Anon Key: role", ok: role === "anon", detail: String(role) });
      results.push({ name: "Anon Key: iss", ok: !!iss, detail: String(iss || "(none)") });
      results.push({ name: "Anon Key: project ref", ok: !!refFromAnon, detail: String(refFromAnon || "(none)") });
      results.push({ 
        name: "Anon Key matches project ref", 
        ok: !!matches, 
        detail: matches ? "✅ Match" : `❌ Expected ${SB_REF}, got ${refFromAnon || "(none)"}` 
      });
    } catch (e: any) {
      results.push({ name: "Anon Key: decode", ok: false, detail: e?.message || String(e) });
    }
    results.push({
      name: "Format: VITE_SUPABASE_URL",
      ok: SB_VALID,
      detail: SB_VALID ? `✅ Valid format (project ref: ${SB_URL.match(/([a-z0-9]{20})/)?.[1] || 'unknown'})` : `❌ Invalid format. Expected: https://${EXPECTED_REF}.supabase.co`
    });
    results.push({ name: "Context", ok: true, detail: JSON.stringify({
      origin: window.location.origin,
      secureContext: window.isSecureContext,
      crossOriginIsolated: (window as any).crossOriginIsolated ?? false
    }) });
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
      results.push({
        name: "Supabase /auth/v1/health",
        ok: false,
        detail: (e?.message || String(e)) + " — If DNS_PROBE_FINISHED_NXDOMAIN, check project ref. Expected: " + EXPECTED_REF
      });
        name: "Supabase /auth/v1/health",
        ok: false,
        detail: (e?.message || String(e)) + " — If DNS_PROBE_FINISHED_NXDOMAIN, check project ref. Expected: " + EXPECTED_REF
      });
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