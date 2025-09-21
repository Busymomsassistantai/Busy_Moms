import { useState } from "react";
import { Calendar, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase"; // ✅ correct path

const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? "").replace(/\/+$/, "");
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  const startAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in first");
      }

      const return_to = window.location.origin;

      // Call your Edge Function (it will 302 to Google)
      const authUrl = `${SUPABASE_URL}/functions/v1/google-auth-start?return_to=${encodeURIComponent(return_to)}`;
      const res = await fetch(authUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`, // Edge fn expects this
          "Content-Type": "application/json",
        },
        redirect: "manual", // we want to read the Location header
      });

      if (res.status === 302) {
        const redirectUrl = res.headers.get("Location");
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
      }

      // If we didn’t get a 302 with Location, try to surface a useful error
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
      setError(e.message ?? String(e));
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={startAuth} disabled={loading}>
        {loading ? "Connecting..." : "Connect Google Calendar"}
      </button>

      {error && (
        <div style={{ color: "crimson", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default ConnectGoogleCalendarButton;
