import { supabase } from "../lib/supabase";

const FUNCTIONS_BASE = import.meta.env.VITE_FUNCTIONS_URL || "";

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
  async listUpcoming(maxResults = 10) {
    return listUpcoming(maxResults);
  }

  async insertEvent(event: any) {
    return insertEvent(event);
  }
}

export const googleCalendarService = new GoogleCalendarService();
