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
const m2 = s.match(/^(\d{1,2})[\/-](\d{1,2})$/);
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
// "14:30" or "14"
const m = s.match(/^(\d{2}):(\d{2})$/);
if (m) {
const hh = String(Math.max(0, Math.min(23, parseInt(m[1], 10)))).padStart(2, '0');
const mm = String(Math.max(0, Math.min(59, parseInt(m[2], 10)))).padStart(2, '0');
return `${hh}:${mm}:00`;
}
// "2pm", "2 pm", "2:30pm"
const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
if (ampm) {
let h = Math.max(1, Math.min(12, parseInt(ampm[1], 10)));
const m2 = Math.max(0, Math.min(59, ampm[2] ? parseInt(ampm[2], 10) : 0));
const suffix = ampm[3].toLowerCase();
if (suffix === 'pm' && h !== 12) h += 12;
if (suffix === 'am' && h === 12) h = 0;
const hh = String(h).padStart(2, '0');
const mm = String(m2).padStart(2, '0');
return `${hh}:${mm}:00`;
}
// "14" or "14:30"
const m2 = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
if (m2) {
const h = Math.max(0, Math.min(23, parseInt(m2[1], 10)));
const mm2 = Math.max(0, Math.min(59, m2[2] ? parseInt(m2[2], 10) : 0));
return `${String(h).padStart(2, '0')}:${String(mm2).padStart(2, '0')}:00`;
}
const d = new Date(s);
if (!Number.isNaN(d.getTime())) {
return d.toISOString().split('T')[1]?.slice(0, 8) || null;
}
return null;
}
function coerceInt(n: unknown, fallback: number | null = null): number | null {
const v = Number.parseInt(String(n ?? ''), 10);
return Number.isFinite(v) ? v : fallback;
}
/** ---- AI parsing -------------------------------------------------------- */
async function classifyMessage(message: string): Promise<IntentResult> {
const today = new Date().toISOString().split('T')[0];
const user = `Today is ${today}. Classify and normalize this message: "${message}"`;
const system = [
'You are a classifier that maps text to an intent: calendar|reminder|shopping|task|chat.',
'Return a minimal JSON with {type, details?}.',
'Details can include any of: title, date, time, participants, location, priority, list.',
'Dates should be ISO yyyy-mm-dd if you can infer them; times as HH:MM:SS.',
].join('\n');
try {
const resp = await aiService.chat([
{ role: 'system', content: system },
{ role: 'user', content: user }
]);
const text = resp?.choices?.[0]?.message?.content;
if (!text) return { type: 'chat' };
const jsonStart = text.indexOf('{');
const jsonEnd = text.lastIndexOf('}');
if (jsonStart >= 0 && jsonEnd > jsonStart) {
const payload = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as IntentResult;
return payload;
}
return { type: 'chat' };
} catch (e: unknown) {
console.warn('LLM classify failed, using fallback:', (e instanceof Error ? e.message : String(e)));
return fallbackClassify(message);
}
}
/** Simpler fallback classifier so app still works without LLM. */
function fallbackClassify(message: string): IntentResult {
const lower = message.toLowerCase();
// Shopping
if (/\bshopping\b/.test(lower) || /\bbuy\b/.test(lower) || /\badd to (the )?list\b/.test(lower)) {
const list = lower.includes('grocery') ? 'grocery' : 'general';
return { type: 'shopping', details: { list, title: message } };
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
return { type: 'chat', details: { title: message } };
}
/** ---- Main service ------------------------------------------------------ */
class AIAssistantService {
private calendarProvider: ICalendarProvider;
constructor(provider?: ICalendarProvider) {
this.calendarProvider = provider ?? new LocalCalendarProvider();
}
setCalendarProvider(provider: ICalendarProvider) {
this.calendarProvider = provider;
}
/** Entry point for a user's message */
async processUserMessage(message: string, userId: UUID): Promise<AIAction> {
try {
const intent = await classifyMessage(message);
switch (intent.type) {
case 'calendar':
return this.handleCalendarAction(intent.details || {}, userId);
case 'reminder':
return this.handleReminderAction(intent.details || {}, userId);
case 'shopping':
return this.handleShoppingAction(intent.details || {}, userId);
case 'task':
return this.handleTaskAction(intent.details || {}, userId);
default:
return { type: 'chat', success: true, message: 'I\'m here! How can I help?', data: { echo: message } };
}
} catch (err: unknown) {
console.error('processUserMessage error:', err instanceof Error ? err.message : err);
return { type: 'chat', success: false, message: 'Something went wrong.' };
}
}
/** Calendar */
private async handleCalendarAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = String(details.title ?? 'New event');
const date = toISODate(details.date);
const time = toISOTime(details.time);
const participants = Array.isArray(details.participants)
? details.participants.map((p: unknown) => String(p))
: null;
const location = details.location ? String(details.location) : null;
if (!date) {
return { type: 'calendar', success: false, message: 'Please provide a date for the event (YYYY-MM-DD, "today", etc.)' };
}
const input: CalendarEventInput = {
title,
date,
start_time: time ?? undefined,
end_time: undefined,
participants: participants ?? undefined,
location: location ?? undefined,
source: 'ai',
};
const result = await this.calendarProvider.createEvent(userId, input);
if (!result?.id && !result?.externalId) {
return { type: 'calendar', success: false, message: 'Failed to create calendar event.' };
}
return { type: 'calendar', success: true, message: `Scheduled: ${title} on ${date}${time ? ' at ' + time.slice(0,5) : ''}`, data: result };
}
/** Reminders */
private async handleReminderAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
console.log('Creating reminder with details:', details);
const title = String(details.title ?? 'Reminder');
const date = toISODate(details.date);
const time = toISOTime(details.time);
if (!date) {
return { type: 'reminder', success: false, message: 'Please include a date for the reminder.' };
}
const { data, error } = await supabase
.from('reminders')
.insert([{ 
user_id: userId, 
title, 
reminder_date: date, 
reminder_time: time,
priority: 'medium',
completed: false
}])
.select()
.single();
if (error) {
console.error('Reminder creation error:', error);
return { type: 'reminder', success: false, message: error.message || 'Failed to create reminder.' };
}
console.log('Reminder created successfully:', data);
return { type: 'reminder', success: true, message: `Reminder set for ${date}${time ? ' at ' + time.slice(0,5) : ''}: ${title}`, data };
}
/** Shopping */
private async handleShoppingAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = String(details.title ?? 'item');
const category = String(details.category ?? details.list ?? 'other');
const quantity = coerceInt(details['quantity'] ?? 1, 1) ?? 1;
const { data, error } = await supabase
.from('shopping_lists')
.insert([{ 
user_id: userId, 
item: title, 
category, 
quantity,
completed: false,
urgent: false
}])
.select()
.single();
if (error) {
console.error('Shopping item creation error:', error);
return { type: 'shopping', success: false, message: error.message || 'Failed to add to shopping list.' };
}
return { type: 'shopping', success: true, message: `Added to shopping list: ${title}${quantity > 1 ? ` x${quantity}` : ''}`, data };
}
/** Tasks */
private async handleTaskAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
const title = String(details.title ?? 'New task');
const due_date = toISODate(details.date);
const due_time = toISOTime(details.time);
const p = details.priority ? details.priority.toString().toLowerCase() : undefined;
const priority: Task['priority'] = (p === 'low' || p === 'medium' || p === 'high') ? p : 'medium';
const { data, error } = await supabase
.from('tasks')
.insert([{ 
user_id: userId, 
title, 
due_date, 
due_time, 
priority,
status: 'pending',
category: 'other',
points: 0
}])
.select()
.single();
if (error) {
console.error('tasks insert error:', error);
return { type: 'task', success: false, message: error.message || 'Failed to create task.' };
}
return { type: 'task', success: true, message: `Task added: ${title}`, data };
}
}
export const aiAssistantService = new AIAssistantService();