/**
 * fetchWithTimeout wraps fetch with AbortController, returns rich errors:
 * - { type: "timeout" | "network" | "http", status?, bodyText? }
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    if (!res.ok) {
      // Try to capture a short body for diagnostics
      let bodyText = "";
      try { bodyText = await res.text(); } catch {}
      const err = new Error(`HTTP ${res.status} ${res.statusText}`) as any;
      err.type = "http";
      err.status = res.status;
      err.bodyText = bodyText;
      throw err;
    }
    return res;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      const err = new Error("Request timed out") as any;
      err.type = "timeout";
      throw err;
    }
    if (e?.type === "http") throw e;
    const err = new Error(e?.message || "Network error") as any;
    err.type = "network";
    throw err;
  } finally {
    clearTimeout(id);
  }
}