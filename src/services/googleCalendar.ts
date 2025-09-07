import { supabase } from "../lib/supabase";
import { ICalendarProvider, CalendarEventInput, CalendarCreateResult } from "./calendarProvider";

const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? "").replace(/\/+$/, "");


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

/** ---- Low-level helpers that talk to your server/Edge Function ------------- */
async function callCalendar(action: string, body: Record<string, any> = {}) {
if (!FUNCTIONS_BASE) {
// Treat as disabled in dev if no server is configured
throw new Error('Calendar server is not configured (missing VITE_FUNCTIONS_URL).');
}
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) throw new Error('Not signed in');

const res = await fetch(${FUNCTIONS_BASE}/google-calendar, {
method: 'POST',
headers: {
'content-type': 'application/json',
Authorization: Bearer ${session.access_token},
},
body: JSON.stringify({ action, ...body }),
});

if (!res.ok) {
const text = await res.text().catch(() => '');
throw new Error(Google Calendar error ${res.status}: ${text || res.statusText});
}
return res.json();
}

export async function listUpcoming(maxResults = 10) {
const data = await callCalendar('listUpcoming', { maxResults });
return data.items || [];
}

export async function getEvents(params: GetEventsParams = {}) {
const data = await callCalendar('getEvents', params);
return data.items || [];
}

export async function insertEvent(event: any) {
const data = await callCalendar('insertEvent', { event });
return data;
}

/** ---- Simple class used by UI components ----------------------------------- */
export class GoogleCalendarService {
private ready = false;
private signedIn = false;

async initialize(): Promise<void> {
this.ready = !!FUNCTIONS_BASE;
if (!this.ready) {
// no server configured; operate in disabled mode
this.signedIn = false;
return;
}
// Try to see if token exists server-side
try {
const items = await listUpcoming(1);
this.signedIn = Array.isArray(items);
} catch {
this.signedIn = false;
}
}

isReady(): boolean {
return this.ready;
}

isSignedIn(): boolean {
return this.signedIn;
}

async signIn(): Promise<void> {
if (!FUNCTIONS_BASE) throw new Error('Calendar server not configured.');
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) throw new Error('Not signed in');

const res = await fetch(`${FUNCTIONS_BASE}/google-oauth/start`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}` },
  redirect: 'manual',
});

const loc = res.headers.get('Location');
if (!loc) throw new Error('OAuth start failed: missing redirect');
window.location.href = loc;


}

async getEvents(params: GetEventsParams = {}) {
if (!this.ready || !this.signedIn) return [];
return getEvents(params);
}

async signOut(): Promise<void> {
if (!this.ready) return;
await callCalendar('signOut');
this.signedIn = false;
}

async listUpcoming(maxResults = 10) {
if (!this.ready || !this.signedIn) return [];
return listUpcoming(maxResults);
}

async insertEvent(event: any) {
if (!this.ready || !this.signedIn) throw new Error('Not signed in to Google Calendar.');
return insertEvent(event);
}
}

export const googleCalendarService = new GoogleCalendarService();

/**

Google-backed calendar provider for AI injection.
*/
export class GoogleCalendarProvider implements ICalendarProvider {
constructor(private svc: GoogleCalendarService) {}

isAvailable(): boolean {
return this.svc.isReady() && this.svc.isSignedIn();
}

async createEvent(userId: string, event: CalendarEventInput): Promise<CalendarCreateResult> {
// Map CalendarEventInput -> Google Calendar API event body
// If time provided, use dateTime; otherwise use all-day (date).
const toDateTime = (date: string, time?: string | null) => {
if (!time) return null;
// Basic local dateTime; a production impl should handle time zones explicitly
return ${date}T${time};
};

let startDateTime = toDateTime(event.date, event.start_time);
let endDateTime = toDateTime(event.date, event.end_time);

// If only start_time exists, default end to +30 minutes
if (startDateTime && !endDateTime) {
  const d = new Date(startDateTime);
  if (!Number.isNaN(d.getTime())) {
    d.setMinutes(d.getMinutes() + 30);
    endDateTime = d.toISOString().slice(0,19);
  }
}

const googleEvent: any = {
  summary: event.title,
  description: event.source === 'ai' ? 'Created by Sara' : undefined,
  location: event.location || undefined,
  start: startDateTime
    ? { dateTime: startDateTime }
    : { date: event.date },
  end: endDateTime
    ? { dateTime: endDateTime }
    : { date: event.date },
  attendees: Array.isArray(event.participants)
    ? event.participants.map((email) => ({ email }))
    : undefined,
};

const created = await this.svc.insertEvent(googleEvent);

const id = created?.id ?? created?.event?.id ?? created?.data?.id ?? '';
return {
  id: id ? String(id) : '',
  externalId: id ? String(id) : undefined,
  provider: 'google',
  raw: created,
};


}
}