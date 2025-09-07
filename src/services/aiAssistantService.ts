import { supabase, Event, Reminder, ShoppingItem, UUID } from '../lib/supabase';
import { aiService } from './openai';

export interface AIAction {
type: 'calendar' | 'reminder' | 'shopping' | 'chat';
success: boolean;
message: string;
data?: any;
}

type IntentType = 'calendar' | 'reminder' | 'shopping' | 'chat';

interface IntentResult {
type: IntentType;
details?: Record<string, any>;
}

function isISODate(s?: string | null): boolean {
return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isISOTime(s?: string | null): boolean {
return !!s && /^\d{2}:\d{2}(:\d{2})?$/.test(s);
}

function toISODate(s?: string | null): string | null {
if (!s) return null;
if (isISODate(s)) return s;
const d = new Date(s);
if (!isNaN(d.getTime())) {
return d.toISOString().split('T')[0];
}
return null;
}

function toISOTime(s?: string | null): string | null {
if (!s) return null;
if (isISOTime(s)) {
return s.length === 5 ? ${s}:00 : s;
}
const trimmed = s.trim().toLowerCase();

// Match formats like "2pm", "2:30pm", "2 p.m.", "2:30 p.m."
const m = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p).?m?.?$/);
if (m) {
let h = parseInt(m[1], 10);
const min = m[2] ? parseInt(m[2], 10) : 0;
const ap = m[3];
if (ap === 'p' && h !== 12) h += 12;
if (ap === 'a' && h === 12) h = 0;
const hh = String(h).padStart(2, '0');
const mm = String(min).padStart(2, '0');
return ${hh}:${mm}:00;
}

// Match simple 24h formats like "14" or "14:30"
const m2 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
if (m2) {
const h = Math.max(0, Math.min(23, parseInt(m2[1], 10)));
const min = m2[2] ? parseInt(m2[2], 10) : 0;
const hh = String(h).padStart(2, '0');
const mm = String(min).padStart(2, '0');
return ${hh}:${mm}:00;
}

return null;
}

function coerceInt(n: any, fallback: number | null = null): number | null {
const x = typeof n === 'string' ? parseInt(n, 10) : typeof n === 'number' ? n : NaN;
return Number.isFinite(x) ? x : fallback;
}

function sanitizeCategory(raw?: string | null): string | null {
if (!raw) return null;
const v = raw.toLowerCase();
const allowed = new Set(['dairy','produce','meat','bakery','baby','beverages','frozen','household','snacks','health','pantry','other']);
return allowed.has(v) ? v : 'other';
}

export class AIAssistantService {
async processUserMessage(message: string, userId: UUID): Promise<AIAction> {
try {
const intent = await this.classifyUserIntent(message);
switch (intent.type) {
case 'calendar':
return await this.handleCalendarAction(intent.details || {}, userId);
case 'reminder':
return await this.handleReminderAction(intent.details || {}, userId);
case 'shopping':
return await this.handleShoppingAction(intent.details || {}, userId);
default:
return { type: 'chat', success: true, message: 'Okay!', data: { echo: message } };
}
} catch (err: any) {
console.error('processUserMessage error:', err);
return { type: 'chat', success: false, message: err?.message || 'Something went wrong.' };
}
}

private async classifyUserIntent(message: string): Promise<IntentResult> {
const today = new Date().toISOString().split('T')[0];
const system = [
'You classify the user request for an assistant app and return JSON only.',
'Schema:',
'{ "type": "calendar"|"reminder"|"shopping"|"chat", "details": { ... } }',
'For calendar/reminder provide ISO fields: date:"YYYY-MM-DD", time:"HH:MM:SS", end_time:"HH:MM:SS".',
'For shopping provide: item (string), quantity (integer), category (one of dairy,produce,meat,bakery,baby,beverages,frozen,household,snacks,health,pantry,other).',
'Return ONLY minimal JSON with no commentary.'
].join(' ');
const user = Today is ${today}. Classify and normalize this message: "${message}";

const raw = await aiService.chat([
  { role: 'system', content: system },
  { role: 'user', content: user }
]);

const cleaned = raw.trim()
  .replace(/^[\s\uFEFF\u200B]+/, '')
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```\s*$/i, '');

try {
  const parsed = JSON.parse(cleaned);
  if (parsed && typeof parsed.type === 'string') {
    return parsed;
  }
} catch (e) {
  console.error('classifyUserIntent JSON parse error:', e, 'raw:', raw);
}
return { type: 'chat' };


}

private async handleCalendarAction(details: Record<string, any>, userId: UUID): Promise<AIAction> {
const title = (details.title || details.name || 'Untitled Event').toString().slice(0, 200);
const event_date = toISODate(details.date) || new Date().toISOString().split('T')[0];
const start_time = toISOTime(details.time);
const end_time = toISOTime(details.end_time);
const location = details.location ? String(details.location).slice(0, 200) : null;
const participants = Array.isArray(details.participants) ? details.participants.map((p: any) => String(p)) : null;

// dedupe check: same user + title + date
let existingId: UUID | null = null;
try {
  const { data: rows } = await supabase
    .from('events')
    .select('id, title, event_date')
    .eq('user_id', userId)
    .eq('title', title)
    .eq('event_date', event_date)
    .limit(1);
  if (rows && rows.length > 0) existingId = rows[0].id;
} catch (e) {
  // non-fatal
}

if (existingId) {
  return { type: 'calendar', success: true, message: 'Event already exists.', data: { id: existingId } };
}

const payload: Partial<Event> = {
  user_id: userId,
  title,
  event_date,
  start_time,
  end_time,
  location,
  participants,
  source: 'ai'
};

const { data, error } = await supabase
  .from('events')
  .insert([payload])
  .select('*')
  .single();

if (error) {
  console.error('events insert error:', error);
  return { type: 'calendar', success: false, message: error.message || 'Failed to create event.' };
}

return { type: 'calendar', success: true, message: `Added "${title}" on ${event_date}.`, data };


}

private async handleReminderAction(details: Record<string, any>, userId: UUID): Promise<AIAction> {
const title = (details.title || details.name || 'Reminder').toString().slice(0, 200);
const reminder_date = toISODate(details.date);
const reminder_time = toISOTime(details.time);
const notes = details.notes ? String(details.notes).slice(0, 500) : null;

const payload: Partial<Reminder> = {
  user_id: userId,
  title,
  notes,
  reminder_date,
  reminder_time,
  completed: false
};

const { data, error } = await supabase
  .from('reminders')
  .insert([payload])
  .select('*')
  .single();

if (error) {
  console.error('reminders insert error:', error);
  return { type: 'reminder', success: false, message: error.message || 'Failed to create reminder.' };
}

return { type: 'reminder', success: true, message: `Reminder set: ${title}.`, data };


}

private async handleShoppingAction(details: Record<string, any>, userId: UUID): Promise<AIAction> {
const item = (details.item || details.name || '').toString().trim();
if (!item) {
return { type: 'shopping', success: false, message: 'Please specify an item to add.' };
}
const quantity = coerceInt(details.quantity, 1);
const category = sanitizeCategory(details.category || null);
const notes = details.notes ? String(details.notes).slice(0, 500) : null;

// dedupe: same item not completed
let exists = false;
try {
  const { data: rows } = await supabase
    .from('shopping_lists')
    .select('id, completed')
    .eq('user_id', userId)
    .eq('item', item)
    .limit(1);
  if (rows && rows.length > 0 && rows[0].completed === false) exists = true;
} catch (e) {
  // non-fatal
}

if (exists) {
  return { type: 'shopping', success: true, message: `“${item}” is already on your list.` };
}

const payload: Partial<ShoppingItem> = {
  user_id: userId,
  item,
  quantity: quantity ?? 1,
  category,
  notes,
  completed: false
};

const { data, error } = await supabase
  .from('shopping_lists')
  .insert([payload])
  .select('*')
  .single();

if (error) {
  console.error('shopping insert error:', error);
  return { type: 'shopping', success: false, message: error.message || 'Failed to add shopping item.' };
}

return { type: 'shopping', success: true, message: `Added “${item}” to your shopping list.`, data };


}
}

export const aiAssistantService = new AIAssistantService();