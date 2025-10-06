import React, { useState } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getOAuthConfig } from "../lib/auth-config";

interface ConnectGoogleCalendarButtonProps {
  onConnected?: () => void;
}

export function ConnectGoogleCalendarButton({ onConnected }: ConnectGoogleCalendarButtonProps = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: getOAuthConfig()
      });

      if (error) {
        throw error;
      }

      console.log('🚀 Google OAuth redirect initiated');
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
        data-google-calendar-connect
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
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