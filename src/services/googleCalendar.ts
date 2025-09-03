import { supabase } from "../lib/supabase";

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || "";

export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}

interface GetEventsParams {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

/** Lists upcoming primary calendar events via the server proxy. */
export async function listUpcoming(maxResults = 10) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  const res = await fetch(`${FUNCTIONS_BASE}/google-calendar`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: "listUpcoming", maxResults }),
  });
  if (!res.ok) throw new Error(`Calendar error: ${res.status}`);
  return await res.json();
}

/** Inserts an event into the user's primary calendar via the server proxy. */
export async function insertEvent(event: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  const res = await fetch(`${FUNCTIONS_BASE}/google-calendar`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: "insertEvent", event }),
  });
  if (!res.ok) throw new Error(`Insert error: ${res.status}`);
  return await res.json();
}

class GoogleCalendarService {
  private initialized = false;
  private connected = false;

  async initialize(): Promise<void> {
    try {
      // Check if user is authenticated with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      this.connected = !!session?.user;
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Calendar service:', error);
      this.initialized = false;
      throw error;
    }
  }

  async signIn(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in to Supabase");
      
      // Call the Google auth start function
      const res = await fetch(`${FUNCTIONS_BASE}/google-auth-start`, {
        method: "POST",
        headers: { 
          "content-type": "application/json", 
          Authorization: `Bearer ${session.access_token}` 
        },
      });
      
      if (!res.ok) throw new Error(`Google auth error: ${res.status}`);
      
      const { authUrl } = await res.json();
      if (authUrl) {
        // Open the auth URL in a new window
        window.open(authUrl, '_blank');
        this.connected = true;
      }
    } catch (error) {
      console.error('Failed to sign in to Google Calendar:', error);
      throw error;
    }
  }

  isSignedIn(): boolean {
    return this.connected;
  }

  async getEvents(params: GetEventsParams = {}): Promise<GoogleCalendarEvent[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      
      const res = await fetch(`${FUNCTIONS_BASE}/google-calendar`, {
        method: "POST",
        headers: { 
          "content-type": "application/json", 
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ 
          action: "getEvents", 
          ...params 
        }),
      });
      
      if (!res.ok) throw new Error(`Get events error: ${res.status}`);
      
      const result = await res.json();
      return result.items || [];
    } catch (error) {
      console.error('Failed to get Google Calendar events:', error);
      return [];
    }
  }

  async signOut(): Promise<void> {
    try {
      // For now, just mark as disconnected locally
      // A full implementation would revoke tokens on the backend
      this.connected = false;
    } catch (error) {
      console.error('Failed to sign out from Google Calendar:', error);
      throw error;
    }
  }

  async listUpcoming(maxResults = 10) {
    return listUpcoming(maxResults);
  }

  async insertEvent(event: any) {
    return insertEvent(event);
  }
}

export const googleCalendarService = new GoogleCalendarService();