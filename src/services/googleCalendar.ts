import { supabase } from "../lib/supabase";
import { ICalendarProvider, CalendarEventInput, CalendarCreateResult } from "./calendarProvider";

const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? "").replace(/\/+$/, "");
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

/** Minimal Google Calendar types we use */
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

export interface GetEventsParams {
  q?: string;
  timeMin?: string; // RFC3339 string
  timeMax?: string; // RFC3339 string
  maxResults?: number;
}

/** Narrower event payload for inserts */
type GoogleDateTime = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEventBody = {
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleDateTime;
  end?: GoogleDateTime;
  attendees?: Array<{ email: string }>;
};

/** ---- Low-level helpers that talk to your server/Edge Function ------------- */
async function callCalendar(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  const candidates: string[] = [];
  if (FUNCTIONS_BASE) {
    candidates.push(
      `${FUNCTIONS_BASE}/google-calendar`,
      `${FUNCTIONS_BASE}/functions/v1/google-calendar`
    );
  }
  if (SUPABASE_URL) {
    candidates.push(`${SUPABASE_URL}/functions/v1/google-calendar`);
  }
  candidates.push('/.netlify/functions/google-calendar');
  candidates.push('/google-calendar', '/api/google-calendar');

  const tried: string[] = [];
  for (const url of Array.from(new Set(candidates))) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...body }),
      });
      tried.push(`${url} -> ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) continue;
      return await res.json().catch(() => ({}));
    } catch (e) {
      tried.push(`${url} -> ${(e as Error).message}`);
      continue;
    }
  }
  throw new Error(`Google Calendar endpoint not reachable. Tried: ${tried.join(' | ')}`);
}

export async function listUpcoming(maxResults = 10): Promise<GoogleCalendarEvent[]> {
  const data = await callCalendar('listUpcoming', { maxResults });
  return (data.items as GoogleCalendarEvent[]) || [];
}

export async function getEvents(params: GetEventsParams = {}): Promise<GoogleCalendarEvent[]> {
  const data = await callCalendar('getEvents', params);
  return (data.items as GoogleCalendarEvent[]) || [];
}

export async function insertEvent(event: GoogleEventBody): Promise<unknown> {
  const data = await callCalendar('insertEvent', { event });
  return data;
}

/** ---- Service class used by UI components --------------------------------- */
export class GoogleCalendarService {
  private ready = false;
  private signedIn = false;

  async initialize(): Promise<void> {
    this.ready = !!(FUNCTIONS_BASE || SUPABASE_URL);
    const { data: { session } } = await supabase.auth.getSession();
    this.signedIn = !!session?.access_token;
    console.info('[GoogleCalendar] initialize => ready:', this.ready, 'signedIn:', this.signedIn);
  }

  /**
   * For this implementation, Google authentication is mediated by your server/Edge Function
   * using the Supabase user session. There is no separate gapi.signIn() on the client.
   * This method exists so UI code calling `googleCalendarService.signIn()` does not break.
   */
  async signIn(): Promise<void> {
    if (!this.ready) await this.initialize();
    const { data: { session } } = await supabase.auth.getSession();
    this.signedIn = !!session?.access_token;
    if (!this.signedIn) {
      throw new Error('Please sign into the app first (no Supabase session found).');
    }
  }

  /**
   * Optional convenience: mark as signed out. If you add a server endpoint to revoke the
   * Google refresh token, call it here before flipping the local state.
   */
  async signOut(): Promise<void> {
    this.signedIn = false;
  }

  isAvailable(): boolean {
    return !!(FUNCTIONS_BASE || SUPABASE_URL);
  }
  isReady(): boolean {
    return this.ready;
  }
  isSignedIn(): boolean {
    return this.signedIn;
  }

  async listUpcoming(maxResults = 10): Promise<GoogleCalendarEvent[]> {
    if (!this.ready) await this.initialize();
    return listUpcoming(maxResults);
  }

  async getEvents(params: GetEventsParams = {}): Promise<GoogleCalendarEvent[]> {
    if (!this.ready) await this.initialize();
    return getEvents(params);
  }

  async insertEvent(event: GoogleEventBody): Promise<unknown> {
    if (!this.ready) await this.initialize();
    return insertEvent(event);
  }
}

export const googleCalendarService = new GoogleCalendarService();

/** ---- Provider to fit the generic calendar interface ---------------------- */
export class GoogleCalendarProvider implements ICalendarProvider {
  constructor(private svc: GoogleCalendarService) {}

  isAvailable(): boolean | Promise<boolean> { return this.svc.isAvailable(); }

  /**
   * Create an event by mapping our local schema -> Google Calendar schema.
   * - If start_time is provided, we create a timed event (30m default length).
   * - If no start_time, we create an all-day event.
   */
  async createEvent(userId: string, event: CalendarEventInput): Promise<CalendarCreateResult> {
    if (!this.svc.isReady() || !this.svc.isSignedIn()) {
      await this.svc.initialize();
      if (!this.svc.isSignedIn()) throw new Error('Please connect Google Calendar first.');
    }

    // Build start/end
    let startDateTime: string | undefined;
    let endDateTime: string | undefined;

    if (event.start_time) {
      startDateTime = `${event.date}T${event.start_time}`;
      if (event.end_time) {
        endDateTime = `${event.date}T${event.end_time}`;
      } else {
        const d = new Date(`${event.date}T${event.start_time}`);
        if (!Number.isNaN(d.getTime())) {
          d.setMinutes(d.getMinutes() + 30);
          endDateTime = d.toISOString().slice(0, 19);
        }
      }
    }

    const googleEvent: GoogleEventBody = {
      summary: event.title,
      description: event.source === 'ai' ? 'Created by Sara' : undefined,
      location: event.location || undefined,
      start: startDateTime
        ? { dateTime: startDateTime }
        : { date: event.date },
      end: endDateTime
        ? { dateTime: endDateTime }
        : (event.start_time ? { dateTime: `${event.date}T${event.start_time}` } : { date: event.date }),
      attendees: Array.isArray(event.participants)
        ? event.participants.filter(Boolean).map(e => ({ email: String(e) }))
        : undefined,
    };

    const created: any = await this.svc.insertEvent(googleEvent);
    const id = created?.id ?? created?.event?.id ?? created?.data?.id ?? '';
    return {
      id: id ? String(id) : '',
      externalId: id ? String(id) : undefined,
      provider: 'google',
      raw: created,
    };
  }
}
