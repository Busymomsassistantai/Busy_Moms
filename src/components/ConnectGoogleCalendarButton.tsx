import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase"; // ✅ correct path

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!SUPABASE_URL) {
        throw new Error("Missing VITE_SUPABASE_URL");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in first");
      }

      const return_to = window.location.origin;
      const startUrl = `${SUPABASE_URL}/functions/v1/google-auth-start?return_to=${encodeURIComponent(return_to)}`;

      // Try fetch with manual redirect so we can read the Location header
      const res = await fetch(startUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`, // Edge fn expects this
          "Content-Type": "application/json",
        },
        redirect: "manual", // attempt to read Location header
      });

      // Some browsers return an "opaqueredirect" (no status, no headers).
      // In that case, just let the browser navigate to the start URL
      // and let the server 302 us to Google.
      // @ts-expect-error - type isn't in older TS lib dom
      if (res.type === "opaqueredirect") {
        window.location.href = startUrl;
        return;
      }

      // If we got an explicit 302, try to use the Location header.
      if (res.status === 302) {
        const redirectUrl = res.headers.get("Location");
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
        // No Location header exposed? Fall back to hard navigation.
        window.location.href = startUrl;
        return;
      }

      // Not a redirect; try to surface a helpful message.
      let errorMessage = `OAuth start failed: ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) errorMessage = data.error;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={startAuth} disabled={loading}>
        {loading ? "Connecting..." : "Connect Google Calendar"}
      </button>

      {error && (
        <div style={{ color: "crimson", marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default ConnectGoogleCalendarButton;
