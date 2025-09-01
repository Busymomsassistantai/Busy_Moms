import { useState } from "react";
import { supabase } from "../lib/supabase";

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || "";

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);

  const startAuth = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      alert("Please sign in first");
      return;
    }
    const return_to = window.location.origin;
    const res = await fetch(`${FUNCTIONS_BASE}/google-auth-start?return_to=${encodeURIComponent(return_to)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
      redirect: "manual",
    });
    const loc = res.headers.get("Location");
    if (loc) window.location.href = loc;
    else setLoading(false);
  };

  return (
    <button onClick={startAuth} disabled={loading}>
      {loading ? "Connecting..." : "Connect Google Calendar"}
    </button>
  );
}
