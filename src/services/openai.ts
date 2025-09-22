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
      if (!openai) {
        // Fallback parsing without AI
        return this.fallbackParseWhatsApp(message);
      }

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
      return this.fallbackParseWhatsApp(message);
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

  /** Fallback WhatsApp parsing without AI */
  private fallbackParseWhatsApp(message: string): {
    isEvent: boolean;
    eventDetails?: {
      title: string;
      date?: string;
      time?: string;
      location?: string;
    };
  } {
    const lower = message.toLowerCase();
    
    // Look for event keywords
    const eventKeywords = ['party', 'birthday', 'appointment', 'meeting', 'practice', 'game', 'event'];
    const hasEventKeyword = eventKeywords.some(keyword => lower.includes(keyword));
    
    if (!hasEventKeyword) {
      return { isEvent: false };
    }
    
    // Extract title (first sentence or up to date/time)
    const sentences = message.split(/[.!?]/);
    const title = sentences[0]?.trim() || message.substring(0, 50);
    
    // Look for dates
    const datePatterns = [
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(\d{1,2}\/\d{1,2}\/?\d{0,4})\b/,
      /\b(\d{1,2}-\d{1,2}-?\d{0,4})\b/,
      /\b(today|tomorrow|next week)\b/i
    ];
    
    let date = '';
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        date = match[1];
        break;
      }
    }
    
    // Look for times
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}-\d{1,2}(?:\s*(?:am|pm))?)\b/i;
    const timeMatch = message.match(timePattern);
    const time = timeMatch?.[1] || '';
    
    // Look for locations
    const locationPatterns = [
      /\bat\s+([^.!?]+?)(?:\s+on|\s+this|\s+next|$)/i,
      /\bin\s+([^.!?]+?)(?:\s+on|\s+this|\s+next|$)/i,
      /\b(?:location|venue|place):\s*([^.!?]+)/i
    ];
    
    let location = '';
    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        location = match[1]?.trim() || '';
        break;
      }
    }
    
    return {
      isEvent: true,
      eventDetails: {
        title: title || 'Event',
        date: date || undefined,
        time: time || undefined,
        location: location || undefined
      }
    };
  }
}
export default ConnectGoogleCalendarButton;
