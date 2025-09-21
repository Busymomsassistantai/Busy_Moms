import { supabase } from "../lib/supabase";

/** -------- Types we use from Google Calendar -------- */
export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: Array<{ email: string; responseStatus?: string }>;
  htmlLink?: string;
}

type GetEventsParams = {
  timeMin?: string; // ISO 8601
  timeMax?: string; // ISO 8601
  maxResults?: number;
};

// The server expects { action, ...payload }
type CalendarAction =
  | "listUpcoming"
  | "getEvents"
  | "insertEvent";

/** -------- Endpoint discovery (prefer Supabase Edge) -------- */
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const FUNCTIONS_BASES: string[] = [];

if (SUPABASE_URL) {
  // ✅ Prefer Supabase Edge Functions
  FUNCTIONS_BASES.push(`${SUPABASE_URL}/functions/v1`);
}

// Optional Vite override (kept for legacy), but lower priority
const VITE_FUNCTIONS_URL = String(import.meta.env.VITE_FUNCTIONS_URL ?? "").replace(/\/+$/, "");
if (VITE_FUNCTIONS_URL) {
  FUNCTIONS_BASES.push(VITE_FUNCTIONS_URL);
}

// Last-ditch fallbacks (Netlify adapter paths, local dev, etc.)
FUNCTIONS_BASES.push("/.netlify/functions", "/functions/v1", "/api");

/** Resolve a working endpoint once and cache it */
let RESOLVED_BASE: string | null = null;

async function resolveBase(): Promise<string> {
  if (RESOLVED_BASE) return RESOLVED_BASE;

  const tried: string[] = [];
  for (const base of FUNCTIONS_BASES) {
    const url = `${base.replace(/\/+$/, "")}/google-calendar`;
    tried.push(url);
    try {
      // Probe with a cheap POST that most handlers will 405/404 but still CORS properly.
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping" }),
      });
      // Consider any CORS-successful response as reachable
      if (res.ok || res.status === 400 || res.status === 404 || res.status === 405) {
        RESOLVED_BASE = base.replace(/\/+$/, "");
        return RESOLVED_BASE;
      }
    } catch {
      // try next
    }
  }
  throw new Error(`Google Calendar endpoint not reachable. Tried: ${tried.join(" | ")}`);
}

/** -------- Low-level call helper -------- */
async function callCalendar<T = any>(action: CalendarAction, payload: Record<string, any> = {}): Promise<T> {
  const base = await resolveBase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in. Please sign in first.");
  }

  const res = await fetch(`${base}/google-calendar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Let the Edge Function validate the Supabase JWT
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload, userId: session.user?.id }),
  });

  if (!res.ok) {
    let msg = `Calendar action "${action}" failed: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      const t = await res.text().catch(() => "");
      if (t) msg = t;
    }
    throw new Error(msg);
  }

  return res.json();
}

/** -------- Public functions used in the app -------- */
export async function listUpcoming(maxResults = 10): Promise<GoogleCalendarEvent[]> {
  const data = await callCalendar("listUpcoming", { maxResults });
  // Expecting Google list response: { items: [...] }
  return (data.items as GoogleCalendarEvent[]) || [];
}

export async function getEvents(params: GetEventsParams = {}): Promise<GoogleCalendarEvent[]> {
  const data = await callCalendar("getEvents", params);
  return (data.items as GoogleCalendarEvent[]) || [];
}

type GoogleEventBody = {
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
};

export async function insertEvent(event: GoogleEventBody): Promise<any> {
  const data = await callCalendar("insertEvent", { event });
  return data;
}

/** -------- Service class (what Calendar.tsx uses) -------- */
export class GoogleCalendarService {
  private ready = false;
  private signedIn = false;

  async initialize(): Promise<void> {
    // If we can resolve a base and we have a session, we're "ready"
    await resolveBase();
    const { data: { session } } = await supabase.auth.getSession();
    this.signedIn = !!session?.access_token;
    this.ready = true;

    // Optional: quick check for token presence; ignore errors if RLS blocks
    if (this.signedIn && session?.user?.id) {
      try {
        const { data: tokenData } = await supabase
          .from("google_tokens")
          .select("access_token, expiry_ts")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!tokenData?.access_token) {
          this.signedIn = false;
        }
      } catch {
        // RLS may block SELECT; that's fine—we'll let actions fail with a clear message
      }
    }
  }

  /**
   * UI calls this to ensure tokens exist / are valid.
   * We don't launch a client-side Google popup; auth is mediated by Edge Functions.
   */
  async signIn(): Promise<void> {
    if (!this.ready) await this.initialize();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.user?.id) {
      throw new Error("Please sign into the app first.");
    }

    // Minimal verification by attempting a tiny query that depends on tokens.
    try {
      await listUpcoming(1);
      this.signedIn = true;
    } catch (e: any) {
      this.signedIn = false;
      throw new Error(
        e?.message?.includes("not connected")
          ? "Google Calendar not connected. Use the Connect button."
          : e?.message || "Google Calendar auth failed."
      );
    }
  }

  isReady() { return this.ready; }
  isSignedIn() { return this.signedIn; }

  async listUpcoming(maxResults = 10): Promise<GoogleCalendarEvent[]> {
    if (!this.ready) await this.initialize();
    if (!this.signedIn) await this.signIn();
    return listUpcoming(maxResults);
  }

  async getEvents(params: GetEventsParams = {}): Promise<GoogleCalendarEvent[]> {
    if (!this.ready) await this.initialize();
    if (!this.signedIn) await this.signIn();
    return getEvents(params);
  }

  async insertEventFromLocal(event: {
    title: string;
    date: string; // YYYY-MM-DD
    start_time?: string | null; // HH:mm:ss (optional)
    end_time?: string | null;   // HH:mm:ss (optional)
    location?: string | null;
    participants?: string[] | null;
  }): Promise<{ id: string; externalId?: string; provider: "google"; raw: any }> {
    if (!this.ready) await this.initialize();
    if (!this.signedIn) await this.signIn();

    // Map local event shape to Google event body
    const toDateTime = (d: string, t?: string | null) =>
      t ? new Date(`${d}T${t}Z`).toISOString() : undefined;

    const googleEvent: GoogleEventBody = {
      summary: event.title,
      description: undefined,
      location: event.location || undefined,
      start: event.start_time
        ? { dateTime: toDateTime(event.date, event.start_time) }
        : { date: event.date },
      end: event.end_time
        ? { dateTime: toDateTime(event.date, event.end_time) }
        : { date: event.date }, // all-day fallback
      attendees: Array.isArray(event.participants)
        ? event.participants.filter(Boolean).map(email => ({ email: String(email) }))
        : undefined,
    };

    const created: any = await insertEvent(googleEvent);
    const id = created?.id ?? created?.event?.id ?? created?.data?.id ?? "";
    return {
      id: id ? String(id) : "",
      externalId: id ? String(id) : undefined,
      provider: "google",
      raw: created,
    };
  }
}

/** Instance expected by Calendar.tsx */
export const googleCalendarService = new GoogleCalendarService();

// (Optional) Backward-compat alias if you also want `googleCalendar`
export const googleCalendar = googleCalendarService;
