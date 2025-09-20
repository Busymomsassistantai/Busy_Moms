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
      
      // Use the Supabase functions endpoint directly
      const authUrl = `${SUPABASE_URL}/functions/v1/google-auth-start?return_to=${encodeURIComponent(return_to)}`;
      
      console.log(`🔍 Starting Google auth at: ${authUrl}`);
      
      // Make a request to get the redirect URL
      const res = await fetch(authUrl, {
        method: "GET",
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        redirect: "manual",
      });
      
      console.log(`📡 Auth endpoint response: ${res.status}`);
      
      if (res.status === 302) {
        const redirectUrl = res.headers.get("Location");
        if (redirectUrl) {
          console.log(`✅ Redirecting to Google OAuth: ${redirectUrl}`);
          window.location.href = redirectUrl;
        } else {
          throw new Error("No redirect URL received from auth endpoint");
        }
      } else {
        // Try to get error details from response
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error(`❌ Auth endpoint error: ${res.status} - ${errorText}`);
        throw new Error(`Authentication failed: ${res.status} - ${errorText}`);
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
          <p className="text-xs text-gray-500 mt-1">
            Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in your Supabase project settings.
          </p>
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