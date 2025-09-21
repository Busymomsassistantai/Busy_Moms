import { useState } from "react";
import { Calendar, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";

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
        // Handle other error responses
        let errorMessage = `Authentication failed: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.details?.includes('GOOGLE_CLIENT_ID')) {
            setShowSetupInstructions(true);
            errorMessage = "Google Calendar integration not configured. Please set up Google OAuth credentials.";
          } else {
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch {
          // If JSON parsing fails, try text
          try {
            const errorText = await res.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {
            // Use default error message
          }
        }
        console.error(`❌ Auth endpoint error: ${res.status} - ${errorMessage}`);
        throw new Error(errorMessage);
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700 font-medium">Configuration Required</p>
          </div>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setShowSetupInstructions(!showSetupInstructions)}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            {showSetupInstructions ? 'Hide' : 'Show'} setup instructions
          </button>
        </div>
      )}
      
      {showSetupInstructions && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <h4 className="font-medium text-blue-900">Google Calendar Setup Instructions:</h4>
          <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
            <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
            <li>Create a new project or select an existing one</li>
            <li>Enable the Google Calendar API</li>
            <li>Go to "Credentials" and create OAuth 2.0 Client IDs</li>
            <li>Add your domain to authorized origins and redirect URIs:
              <ul className="ml-4 mt-1 space-y-1 text-xs">
                <li>• Authorized origins: <code>{window.location.origin}</code></li>
                <li>• Redirect URI: <code>{window.location.origin}/functions/v1/google-auth-callback</code></li>
              </ul>
            </li>
            <li>Copy the Client ID and Client Secret</li>
            <li>In your Supabase dashboard, go to Settings → Environment Variables</li>
            <li>Add these variables:
              <ul className="ml-4 mt-1 space-y-1 text-xs">
                <li>• <code>GOOGLE_CLIENT_ID</code> = your Google OAuth Client ID</li>
                <li>• <code>GOOGLE_CLIENT_SECRET</code> = your Google OAuth Client Secret</li>
                <li>• <code>STATE_SECRET</code> = any random string for security</li>
              </ul>
            </li>
            <li>Redeploy your Supabase Edge Functions</li>
            <li>Make sure the redirect URI in Google Console exactly matches: <code>{window.location.origin}/functions/v1/google-auth-callback</code></li>
          </ol>
          <p className="text-xs text-blue-600 mt-2">
            The most common issue is mismatched redirect URIs between Google Console and your actual deployment URL.
          </p>
        </div>
      )}
      
      <button 
        onClick={startAuth} 
        disabled={loading}
        className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${
          error 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span>
          {loading ? "Connecting..." : error ? "Setup Required" : "Connect Google Calendar"}
        </span>
        <ExternalLink className="w-3 h-3" />
      </button>
      
      <p className="text-xs text-gray-500 text-center">
        {error 
          ? "Complete the setup instructions above to enable Google Calendar integration"
          : "You'll be redirected to Google to authorize calendar access"
        }
      </p>
    </div>
  );
}