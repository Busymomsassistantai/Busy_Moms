import { supabase } from '../lib/supabase';

export type ProviderKind = 'local' | 'google';

export interface CalendarEventInput {
title: string;
date: string; // YYYY-MM-DD
start_time?: string | null; // HH:MM:SS
end_time?: string | null; // HH:MM:SS
location?: string | null;
participants?: string[] | null;
type?: string | null; // e.g., 'other'
source?: string | null; // e.g., 'ai'
}

export interface CalendarCreateResult {
id: string;
externalId?: string;
provider: ProviderKind;
raw?: any;
}

export interface ICalendarProvider {
isAvailable(): boolean | Promise<boolean>;
createEvent(userId: string, event: CalendarEventInput): Promise<CalendarCreateResult>;
}

/**

Local (DB) calendar provider

Encapsulates dedupe + insert logic against the 'events' table.
*/
export class LocalCalendarProvider implements ICalendarProvider {
isAvailable(): boolean {
return true; // Local DB is always available under normal app conditions
}

async createEvent(userId: string, event: CalendarEventInput): Promise<CalendarCreateResult> {
const title = String(event.title).slice(0, 200);
const event_date = event.date;
const start_time = event.start_time ?? null;
const end_time = event.end_time ?? null;
const location = event.location ? String(event.location).slice(0, 200) : null;
const participants = Array.isArray(event.participants) ? event.participants.map(p => String(p)) : null;
const event_type = event.type ?? 'other';
const source = event.source ?? 'ai';

// Dedupe: same user + title + date (case-insensitive)
try {
  const { data: rows, error: selErr } = await supabase
    .from('events')
    .select('id, title, event_date')
    .eq('user_id', userId)
    .eq('event_date', event_date)
    .ilike('title', title)
    .limit(1);

  if (!selErr && rows && rows.length > 0) {
    const found = rows[0];
    return { id: found.id as string, provider: 'local', raw: found };
  }
} catch (_e) {
  // Non-fatal; continue to attempt insert
}

const payload: any = {
  user_id: userId,
  title,
  event_date,
  start_time,
  end_time,
  location,
  participants,
  event_type,
  source,
};

const { data, error } = await supabase.from('events').insert([payload]).select('*').single();
if (error) {
  throw new Error(error.message || 'Failed to create local event.');
}

return { id: String((data as any).id), provider: 'local', raw: data };


}
}