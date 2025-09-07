import { supabase, Reminder, ShoppingItem, UUID, Task } from '../lib/supabase';
import { aiService } from './openai';
import { ICalendarProvider, LocalCalendarProvider, CalendarEventInput } from './calendarProvider';

/** Central brain for "Sara" — routes natural language to concrete app actions. */
export interface AIAction {
type: 'calendar' | 'reminder' | 'shopping' | 'task' | 'chat';
success: boolean;
message: string;
data?: unknown;
}

type IntentType = 'calendar' | 'reminder' | 'shopping' | 'task' | 'chat';

interface IntentResult {
type: IntentType;
details?: Record<string, unknown>;
}

/** ---- Shared helpers ---------------------------------------------------- */

function toISODate(input?: string | number | Date | unknown): string | null {
if (!input) return null;
const s = String(input).trim();

// Already ISO-like YYYY-MM-DD
const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (m) return m[0];

// Basic MM/DD or M/D this year
const m2 = s.match(/^(\d{1,2})/
$/);
if (m2) {
const year = new Date().getFullYear();
const mm = String(Math.max(1, Math.min(12, parseInt(m2[1], 10)))).padStart(2, '0');
const dd = String(Math.max(1, Math.min(31, parseInt(m2[2], 10)))).padStart(2, '0');
return `${year}-${mm}-${dd}`;
}

// Natural words "today" / "tomorrow"
const lower = s.toLowerCase();
if (lower === 'today') {
return new Date().toISOString().split('T')[0];
}
if (lower === 'tomorrow') {
const d = new Date();
d.setDate(d.getDate() + 1);
return d.toISOString().split('T')[0];
}

// Try parsing Date(...) and format to YYYY-MM-DD
const d = new Date(s);
if (!Number.isNaN(d.getTime())) {
return d.toISOString().split('T')[0];
}
return null;
}

function toISOTime(input?: string | number | Date | unknown): string | null {
if (!input) return null;
const s = String(input).trim();

// "3pm", "3:30 pm"
const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
if (ampm) {
let h = parseInt(ampm[1], 10);
const min = ampm[2] ? parseInt(ampm[2], 10) : 0;
const am = ampm[3].toLowerCase() === 'am';
if (am && h === 12) h = 0;
if (!am && h < 12) h += 12;
const hh = String(h).padStart(2, '0');
const mm = String(min).padStart(2, '0');
return `${hh}:${mm}:00`;
}

// "14" or "14:30"
const m2 = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
if (m2) {
const h = Math.max(0, Math.min(23, parseInt(m2[1], 10)));
const min = m2[2] ? parseInt(m2[2], 10) : 0;
const hh = String(h).padStart(2, '0');
const mm = String(min).padStart(2, '0');
return `${hh}:${mm}:00`;
}
return null;
}

function coerceInt(n: unknown, fallback: number | null = null): number | null {
const x = typeof n === 'string' ? parseInt(n, 10) : typeof n === 'number' ? n : NaN;
return Number.isFinite(x) ? x : fallback;
}

function sanitizeCategory(raw?: string | null): string | null {
if (!raw) return null;
const v = raw.toLowerCase();
const allowed = new Set([
'dairy','produce','meat','bakery','baby','beverages','frozen','household','snacks','health','pantry','other'
]);
return allowed.has(v) ? v : 'other';
}

/** Naive local classifier used as a safety net when the LLM call fails. */
function fallbackClassify(message: string): IntentResult {
const lower = message.toLowerCase();

// Shopping
if (/(add|buy|purchase|get)\s+.+(to|for)?\s*(the\s*)?(shopping|grocery)\s*list/.test(lower) ||
/(milk|eggs|bread|diapers|formula|apples|paper towels)/.test(lower)) {
const itemMatch = lower.match(/(?:add|buy|purchase|get)\s+([^.,;]+?)(?:\s+to|\s+for|\s+on|[.,;]|$)/);
return { type: 'shopping', details: { item: itemMatch ? itemMatch[1].trim() : null } };
}

// Reminder
if (/remind\s+me/.test(lower) || /set\s+(a\s+)?reminder/.test(lower)) {
// crude parse for date/time phrases:
const date = toISODate(lower.match(/\b(today|tomorrow|\d{1,2}[/]-?\d{1,2}(?:[/]-?\d{2,4})?|\d{4}-\d{2}-\d{2})\b/)?.[0]);
const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?)\b/)?.[0]);
return { type: 'reminder', details: { title: message, date, time } };
}

// Task
if (/\btask\b/.test(lower) || /to\sdo|todo/.test(lower) || /assign\b/.test(lower)) {
const titleMatch = lower.match(/(?:add|create|make)\s+(?:a\s+)?(?:new\s+)?task\s(?:called|named)?\s*([^.,;]+)|^(.)$/);
const title = (titleMatch?.[1] || titleMatch?.[2] || message).trim();
const date = toISODate(lower.match(/\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}[/]-?\d{1,2}(?:[/]-?\d{2,4})?)\b/)?.[0]);
const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s(?:am|pm)?|\d{1,2}(?::\d{2})?)\b/)?.[0]);
return { type: 'task', details: { title, date, time } };
}

// Calendar
if (/\b(event|meeting|appointment|schedule)\b/.test(lower) || /on\s+\d/.test(lower)) {
const date = toISODate(lower.match(/\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}[/]-?\d{1,2}(?:[/]-?\d{2,4})?)\b/)?.[0]);
const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?)\b/)?.[0]);
return { type: 'calendar', details: { title: message, date, time } };
}

return { type: 'chat' };
}

export class AIAssistantService {
private calendarProvider: ICalendarProvider;

constructor(provider?: ICalendarProvider) {
// Default to local DB provider unless explicitly injected
this.calendarProvider = provider ?? new LocalCalendarProvider();
}

/** Expose setter to inject a different provider at runtime. */
setCalendarProvider(provider: ICalendarProvider) {
this.calendarProvider = provider;
}

/** Main entry: classify -> route to handler */
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
case 'task':
return await this.handleTaskAction(intent.details || {}, userId);
default:
return { type: 'chat', success: true, message: 'Okay!', data: { echo: message } };
}
} catch (err: unknown) {
console.error('processUserMessage error:', err instanceof Error ? err.message : err);
// Last-ditch local fallback — try to do something useful
try {
const intent = fallbackClassify(message);
switch (intent.type) {
case 'calendar':
return await this.handleCalendarAction(intent.details || {}, userId);
case 'reminder':
return await this.handleReminderAction(intent.details || {}, userId);
case 'shopping':
return await this.handleShoppingAction(intent.details || {}, userId);
case 'task':
return await this.handleTaskAction(intent.details || {}, userId);
default:
return { type: 'chat', success: false, message: err?.message || 'Something went wrong.' };
}
} catch (e: unknown) {

return { type: 'chat', success: false, message: (e instanceof Error ? e.message : String(e)) || 'Something went wrong.' 
};
}
}
}

/** Model-based classifier with strict JSON output. */
private async classifyUserIntent(message: string): Promise<IntentResult> {
const today = new Date().toISOString().split('T')[0];
const system = [
'You classify the user request for an assistant app and return JSON only.',
'Schema:',
'{ "type": "calendar"|"reminder"|"shopping"|"task"|"chat", "details": { ... } }',
'Normalize dates to date:"YYYY-MM-DD"; times to time:"HH:MM:SS".',
'For calendar: title, date, time?, end_time?, location?, participants? (array of strings).',
'For reminder: title, date?, time?, notes?.',
'For shopping: item, quantity (integer?), category (dairy,produce,meat,bakery,baby,beverages,frozen,household,snacks,health,pantry,other), notes?.',
'For task: title, date?, time?, priority? (low|medium|high), assignee? (string).',
'Return ONLY minimal JSON with no commentary.'
].join(' ');
const user = `Today is ${today}. Classify and normalize this message: "${message}"`;

let raw: string;
try {
  raw = await aiService.chat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
} catch (e: unknown) {

  console.warn('LLM classify failed, using fallback:', (e instanceof Error ? e.message : String(e)));
  return fallbackClassify(message);

}

const cleaned = raw
  .trim()
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
return fallbackClassify(message);


}

/** Calendar events — now delegated to the injected provider. */
private async handleCalendarAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = (details.title || details.name || 'Untitled Event').toString().slice(0, 200);
const event_date = toISODate(details.date) || new Date().toISOString().split('T')[0];
const start_time = toISOTime(details.time);
let end_time = toISOTime(details.end_time);
const location = details.location ? String(details.location).slice(0, 200) : null;
const participants = Array.isArray(details.participants)
? details.participants.map((p: unknown) => String(p))
: null;

// If end_time is missing but start_time exists, default to +30m
if (start_time && !end_time) {
  const [hh, mm] = start_time.split(':').map((x) => parseInt(x,10));
  const d = new Date();
  d.setHours(hh, mm + 30, 0, 0);
  end_time = d.toTimeString().slice(0,8);
}

const payload: CalendarEventInput = {
  title,
  date: event_date!,
  start_time,
  end_time,
  location,
  participants,
  type: 'other',
  source: 'ai',
};

try {
  const result = await this.calendarProvider.createEvent(String(userId), payload);
  return {
    type: 'calendar',
    success: true,
    message: `Added "${title}" on ${event_date}.`,
    data: result,
  };
} catch (error: unknown) {
  return { type: 'calendar', success: false, message: error?.message || 'Failed to create event.' };
}


}

/** Reminders */
private async handleReminderAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = (details.title || details.name || 'Reminder').toString().slice(0, 200);
const reminder_date = toISODate(details.date);
const reminder_time = toISOTime(details.time);
const notes = details.notes ? String(details.notes).slice(0, 500) : null;

// Dedupe: same title+date+time
if (reminder_date) {
  try {
    const { data: rows } = await supabase
      .from('reminders')
      .select('id,title,reminder_date,reminder_time')
      .eq('user_id', userId)
      .eq('reminder_date', reminder_date)
      .ilike('title', title)
      .limit(1);
    if (rows && rows.length > 0) {
      return { type: 'reminder', success: true, message: 'Reminder already exists.', data: rows[0] };
    }
  } catch (_) {}
}

const payload: Partial<Reminder> = {
  user_id: userId,
  title,
  notes,
  reminder_date,
  reminder_time,
  completed: false,
};

const { data, error } = await supabase.from('reminders').insert([payload]).select('*').single();

if (error) {
  console.error('reminders insert error:', error);
  return { type: 'reminder', success: false, message: error.message || 'Failed to create reminder.' };
}

return { type: 'reminder', success: true, message: `Reminder set: ${title}.`, data };


}

/** Shopping list */
private async handleShoppingAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const item = (details.item || details.name || '').toString().trim();
if (!item) {
return { type: 'shopping', success: false, message: 'Please specify an item to add.' };
}
const quantity = coerceInt(details.quantity, 1);
const category = sanitizeCategory(details.category || null);
const notes = details.notes ? String(details.notes).slice(0, 500) : null;

// dedupe: same item not completed (case-insensitive)
try {
  const { data: rows } = await supabase
    .from('shopping_lists')
    .select('id, item, completed')
    .eq('user_id', userId)
    .eq('completed', false)
    .ilike('item', item)
    .limit(1);
  if (rows && rows.length > 0) {
    return { type: 'shopping', success: true, message: `“${item}” is already on your list.`, data: rows[0] };
  }
} catch (_e) {}

const payload: Partial<ShoppingItem> = {
  user_id: userId,
  item,
  quantity: quantity ?? 1,
  category,
  notes,
  completed: false,
};

const { data, error } = await supabase.from('shopping_lists').insert([payload]).select('*').single();

if (error) {
  console.error('shopping insert error:', error);
  return { type: 'shopping', success: false, message: error.message || 'Failed to add shopping item.' };
}

return { type: 'shopping', success: true, message: `Added “${item}” to your shopping list.`, data };


}

/** Tasks */
private async handleTaskAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = (details.title || details.name || 'Task').toString().slice(0, 200);
const due_date = toISODate(details.date);
const due_time = toISOTime(details.time);
const p = details.priority ? details.priority.toString().toLowerCase() : undefined;
const priority: Task['priority'] = (p === 'low' || p === 'medium' || p === 'high') ? p : 'medium';

// dedupe by title + due_date
if (due_date) {
  try {
    const { data: rows } = await supabase
      .from('tasks')
      .select('id,title,due_date')
      .eq('user_id', userId)
      .eq('due_date', due_date)
      .ilike('title', title)
      .limit(1);
    if (rows && rows.length > 0) {
      return { type: 'task', success: true, message: 'Task already exists.', data: rows[0] };
    }
  } catch (_) {}
}

const payload: Partial<Task> = {
  user_id: userId,
  title,
  description: details.description ? String(details.description).slice(0,500) : '',
  category: details.category ? String(details.category).slice(0,50) : 'other',
  priority: ['low','medium','high'].includes(String(priority)) ? priority : 'medium',
  status: 'pending',
  due_date,
  due_time,
  recurring: false,
};

const { data, error } = await supabase.from('tasks').insert([payload]).select('*').single();

if (error) {
  console.error('tasks insert error:', error);
  return { type: 'task', success: false, message: error.message || 'Failed to create task.' };
}

return { type: 'task', success: true, message: `Task added: ${title}`, data };


}
}

export const aiAssistantService = new AIAssistantService();