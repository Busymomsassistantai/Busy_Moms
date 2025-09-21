import React from "react";
import { supabase } from "../lib/supabaseClient";

export default function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in first");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is not set");
      const base = supabaseUrl.replace(/\/+$/, "");
      const returnTo = encodeURIComponent(window.location.origin);

      // Hard navigation avoids CORS/302 header issues entirely.
      window.location.href = `${base}/functions/v1/google-auth-start?return_to=${returnTo}`;
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={startAuth} disabled={loading}>
        {loading ? "Connecting..." : "Connect Google Calendar"}
      </button>
      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
    </>
  );
}
