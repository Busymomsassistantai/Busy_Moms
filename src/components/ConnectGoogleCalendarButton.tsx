import React, { useState } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "../lib/supabase";

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;
      
      // Build the auth start URL with user ID as query parameter
      const return_to = encodeURIComponent(window.location.origin);
      const authUrl = `https://chic-duckanoo-b6e66f.netlify.app/.netlify/functions/google-auth-start?user_id=${userId}&return_to=${return_to}`;
      
      console.log('🚀 Starting Google OAuth flow:', authUrl);
      
      // Direct navigation to avoid CORS issues
      window.location.href = authUrl;
    } catch (e: any) {
      console.error('❌ Google auth start error:', e);
      setError(e?.message ?? String(e));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button 
        onClick={startAuth} 
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        <Calendar className="w-4 h-4" />
        <span>{loading ? "Connecting..." : "Connect Google Calendar"}</span>
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectGoogleCalendarButton;