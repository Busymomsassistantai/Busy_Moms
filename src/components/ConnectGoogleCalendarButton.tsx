import { useState } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";

const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? "").replace(/\/+$/, "");
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Please sign in first");
      }

      const return_to = window.location.origin;
      
      // Try multiple endpoint candidates
      const candidates = [
        `${FUNCTIONS_BASE}/google-auth-start`,
        `${SUPABASE_URL}/functions/v1/google-auth-start`,
        '/.netlify/functions/google-auth-start',
        '/google-auth-start',
        '/api/google-auth-start'
      ].filter(Boolean);

      let authUrl: string | null = null;
      const tried: string[] = [];

      for (const url of candidates) {
        try {
          console.log(`🔍 Trying Google auth endpoint: ${url}`);
          const res = await fetch(`${url}?return_to=${encodeURIComponent(return_to)}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${session.access_token}` },
            redirect: "manual",
          });
          
          tried.push(`${url} -> ${res.status}`);
          
          if (res.status === 302) {
            const loc = res.headers.get("Location");
            if (loc) {
              authUrl = loc;
              console.log(`✅ Found auth URL: ${authUrl}`);
              break;
            }
          }
        } catch (e) {
          tried.push(`${url} -> ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
      }

      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error(`Google auth endpoint not available. Tried: ${tried.join(' | ')}`);
      }
    } catch (error) {
      console.error('❌ Google Calendar connection failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <button 
        onClick={startAuth} 
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        <Calendar className="w-4 h-4" />
        <span>{loading ? "Connecting..." : "Connect Google Calendar"}</span>
        <ExternalLink className="w-3 h-3" />
      </button>
      
      <p className="text-xs text-gray-500 text-center">
        You'll be redirected to Google to authorize calendar access
      </p>
    </div>
  );
}