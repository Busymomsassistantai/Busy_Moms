import { supabase, Reminder, ShoppingItem, UUID, Task, Event as DbEvent } from '../lib/supabase';
import { openaiService } from './openai';
import { ICalendarProvider, LocalCalendarProvider, CalendarEventInput } from './calendarProvider';
import { calendarContextService } from './calendarContext';

/** Central brain for "Sara" — routes natural language to concrete app actions. */
export interface AIAction {
  type: 'calendar' | 'reminder' | 'shopping' | 'task' | 'chat';
  success: boolean;
  message: string;
  data?: unknown;
}

type IntentType = 'calendar' | 'calendar_query' | 'calendar_update' | 'calendar_delete' | 'reminder' | 'shopping' | 'task' | 'chat';

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
async function classifyMessage(message: string, calendarSummary: string): Promise<IntentResult> {
  const today = new Date().toISOString().split('T')[0];

  console.log('🤖 Classifying message:', message);

  const systemPrompt = `You are a smart calendar-aware assistant that classifies user messages into actions.
Return ONLY valid JSON with this exact format: {"type": "calendar|calendar_query|calendar_update|calendar_delete|reminder|shopping|task|chat", "details": {...}}

Current Calendar Context:
${calendarSummary}

For shopping: {"type": "shopping", "details": {"title": "item name", "category": "dairy|produce|meat|bakery|baby|household|other"}}
For reminders: {"type": "reminder", "details": {"title": "reminder text", "date": "YYYY-MM-DD", "time": "HH:MM:SS"}}
For calendar creation: {"type": "calendar", "details": {"title": "event name", "date": "YYYY-MM-DD", "time": "HH:MM:SS", "location": "place"}}
For calendar queries: {"type": "calendar_query", "details": {"query_type": "today|week|availability|search|next", "date": "YYYY-MM-DD", "search_term": "keyword"}}
For calendar updates: {"type": "calendar_update", "details": {"search_term": "event to find", "updates": {"date": "new date", "time": "new time", "location": "new location"}}}
For calendar deletion: {"type": "calendar_delete", "details": {"search_term": "event to delete", "date": "YYYY-MM-DD"}}
For tasks: {"type": "task", "details": {"title": "task name", "category": "chores|homework|sports|music|health|social|other"}}
For chat: {"type": "chat", "details": {"query": "user question"}}

Examples:
"add milk to shopping list" -> {"type": "shopping", "details": {"title": "milk", "category": "dairy"}}
"remind me to call mom tomorrow at 3pm" -> {"type": "reminder", "details": {"title": "call mom", "date": "tomorrow", "time": "15:00:00"}}
"schedule dentist appointment next Friday" -> {"type": "calendar", "details": {"title": "dentist appointment", "date": "next Friday"}}
"what's on my calendar today" -> {"type": "calendar_query", "details": {"query_type": "today"}}
"am I free tomorrow afternoon" -> {"type": "calendar_query", "details": {"query_type": "availability", "date": "tomorrow"}}
"move my dentist appointment to next week" -> {"type": "calendar_update", "details": {"search_term": "dentist", "updates": {"date": "next week"}}}
"cancel my meeting tomorrow" -> {"type": "calendar_delete", "details": {"search_term": "meeting", "date": "tomorrow"}}`;

  try {
    const response = await openaiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Today is ${today}. Classify: "${message}"` }
    ]);

    console.log('🤖 AI classification response:', response);

    // Extract JSON from response
    const payload = JSON.parse(response) as IntentResult;
    console.log('🎯 Parsed intent:', payload);
    return payload;
  } catch (e: unknown) {
    console.error('❌ LLM classify failed, using fallback:', (e instanceof Error ? e.message : String(e)));
    return fallbackClassify(message);
  }
}

/** Simpler fallback classifier so app still works without LLM. */
function fallbackClassify(message: string): IntentResult {
  const lower = message.toLowerCase();
  
  console.log('🔄 Using fallback classification for:', lower);
  
  // Shopping patterns
  if (/\b(add|put)\b.*\b(shopping|list)\b/.test(lower) || 
      /\b(buy|get|need)\b.*\b(milk|bread|eggs|groceries)\b/.test(lower)) {
    const itemMatch = lower.match(/(?:add|put|buy|get|need)\s+([^.!?]+?)(?:\s+(?:to|on|in)\s+(?:the\s+)?(?:shopping\s+)?list)?$/);
    const title = itemMatch?.[1]?.trim() || message;
    
    // Determine category
    let category = 'other';
    if (/\b(milk|cheese|yogurt|butter)\b/.test(lower)) category = 'dairy';
    else if (/\b(apple|banana|carrot|lettuce|fruit|vegetable)\b/.test(lower)) category = 'produce';
    else if (/\b(chicken|beef|fish|meat)\b/.test(lower)) category = 'meat';
    else if (/\b(bread|cake|muffin|bakery)\b/.test(lower)) category = 'bakery';
    else if (/\b(diaper|formula|baby|wipes)\b/.test(lower)) category = 'baby';
    else if (/\b(soap|detergent|cleaner|household)\b/.test(lower)) category = 'household';
    
    return { type: 'shopping', details: { title, category } };
  }
  
  // Reminder patterns
  if (/\bremind\s+me\b/.test(lower) || /\bset\s+(?:a\s+)?reminder\b/.test(lower)) {
    const titleMatch = lower.match(/remind\s+me\s+to\s+([^.!?]+)|set\s+(?:a\s+)?reminder\s+(?:to\s+)?([^.!?]+)/);
    const title = titleMatch?.[1]?.trim() || titleMatch?.[2]?.trim() || message;
    
    const date = toISODate(lower.match(/\b(today|tomorrow|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/)?.[0]);
    const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}(?::\d{2})?)\b/)?.[0]);
    
    return { type: 'reminder', details: { title, date, time } };
  }
  
  // Task patterns
  if (/\b(task|todo|to\s+do|assign)\b/.test(lower) || /\bcreate\s+(?:a\s+)?task\b/.test(lower)) {
    const titleMatch = lower.match(/(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s+(?:called|named)?\s*([^.!?]+)|^(.+)$/);
    const title = titleMatch?.[1]?.trim() || titleMatch?.[2]?.trim() || message;
    
    const date = toISODate(lower.match(/\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\b/)?.[0]);
    const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}(?::\d{2})?)\b/)?.[0]);
    
    return { type: 'task', details: { title, date, time } };
  }
  
  // Calendar patterns
  if (/\b(event|meeting|appointment|schedule)\b/.test(lower) || /\bon\s+\d/.test(lower)) {
    const date = toISODate(lower.match(/\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\b/)?.[0]);
    const time = toISOTime(lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}(?::\d{2})?)\b/)?.[0]);
    
    return { type: 'calendar', details: { title: message, date, time } };
  }
  
  console.log('🗣️ No specific pattern matched, treating as chat');
  return { type: 'chat', details: { query: message } };
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
    console.log('🎯 Processing user message:', message, 'for user:', userId);

    try {
      const calendarContext = await calendarContextService.getCalendarContext(userId);
      const intent = await classifyMessage(message, calendarContext.summary);
      console.log('🧠 Classified intent:', intent);

      switch (intent.type) {
        case 'calendar':
          return this.handleCalendarAction(intent.details || {}, userId);
        case 'calendar_query':
          return this.handleCalendarQuery(intent.details || {}, userId, calendarContext);
        case 'calendar_update':
          return this.handleCalendarUpdate(intent.details || {}, userId);
        case 'calendar_delete':
          return this.handleCalendarDelete(intent.details || {}, userId);
        case 'reminder':
          return this.handleReminderAction(intent.details || {}, userId);
        case 'shopping':
          return this.handleShoppingAction(intent.details || {}, userId);
        case 'task':
          return this.handleTaskAction(intent.details || {}, userId);
        default:
          return this.handleChatAction(intent.details || {}, message, calendarContext);
      }
    } catch (err: unknown) {
      console.error('❌ processUserMessage error:', err instanceof Error ? err.message : err);
      return {
        type: 'chat',
        success: false,
        message: 'I encountered an error processing your request. Please try again.'
      };
    }
  }

  /** Calendar Creation */
  private async handleCalendarAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('📅 Creating calendar event with details:', details);

    const title = String(details.title ?? 'New event');
    const date = toISODate(details.date);
    const time = toISOTime(details.time);
    const participants = Array.isArray(details.participants)
      ? details.participants.map((p: unknown) => String(p))
      : null;
    const location = details.location ? String(details.location) : null;

    if (!date) {
      return {
        type: 'calendar',
        success: false,
        message: 'Please provide a date for the event (e.g., "today", "tomorrow", "2024-03-15")'
      };
    }

    const conflictCheck = await calendarContextService.checkConflicts(userId, date, time, null);
    if (conflictCheck.hasConflict) {
      const conflictNames = conflictCheck.conflictingEvents.map(e => e.title).join(', ');
      let message = `⚠️ Schedule conflict detected! You already have: ${conflictNames} at that time.`;
      if (conflictCheck.suggestions.length > 0) {
        message += `\n\nSuggested alternative times: ${conflictCheck.suggestions.join(', ')}`;
      }
      return {
        type: 'calendar',
        success: false,
        message,
        data: { conflicts: conflictCheck.conflictingEvents, suggestions: conflictCheck.suggestions }
      };
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

    try {
      const result = await this.calendarProvider.createEvent(userId, input);
      console.log('📅 Calendar event created successfully:', result);

      if (!result?.id && !result?.externalId) {
        return { type: 'calendar', success: false, message: 'Failed to create calendar event.' };
      }

      return {
        type: 'calendar',
        success: true,
        message: `✅ Scheduled: ${title} on ${date}${time ? ' at ' + time.slice(0,5) : ''}`,
        data: result
      };
    } catch (error) {
      console.error('❌ Calendar creation error:', error);
      return {
        type: 'calendar',
        success: false,
        message: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Calendar Queries */
  private async handleCalendarQuery(details: Record<string, unknown>, userId: UUID, context: any): Promise<AIAction> {
    console.log('🔍 Querying calendar with details:', details);

    const queryType = String(details.query_type || 'today');

    try {
      switch (queryType) {
        case 'today': {
          if (context.todayEvents.length === 0) {
            return {
              type: 'calendar',
              success: true,
              message: 'You have no events scheduled for today. Your day is clear!',
              data: { events: [] }
            };
          }
          const formatted = calendarContextService.formatEventsAsNaturalLanguage(context.todayEvents);
          return {
            type: 'calendar',
            success: true,
            message: `Here's your schedule for today:\n${formatted}`,
            data: { events: context.todayEvents }
          };
        }

        case 'week': {
          if (context.upcomingEvents.length === 0) {
            return {
              type: 'calendar',
              success: true,
              message: 'You have no upcoming events this week. Enjoy your free time!',
              data: { events: [] }
            };
          }
          const formatted = calendarContextService.formatEventsAsNaturalLanguage(context.upcomingEvents);
          return {
            type: 'calendar',
            success: true,
            message: `Here are your upcoming events:\n${formatted}`,
            data: { events: context.upcomingEvents }
          };
        }

        case 'availability': {
          const date = toISODate(details.date) || new Date().toISOString().split('T')[0];
          const availability = await calendarContextService.checkAvailability(userId, { date });

          if (availability.available) {
            let message = `You are available on ${date}.`;
            if (availability.freeSlots.length > 0) {
              const slots = availability.freeSlots.map(slot =>
                `${slot.start.slice(0, 5)} - ${slot.end.slice(0, 5)}`
              ).join(', ');
              message += ` Free time slots: ${slots}`;
            }
            return {
              type: 'calendar',
              success: true,
              message,
              data: availability
            };
          } else {
            const formatted = calendarContextService.formatEventsAsNaturalLanguage(availability.events);
            return {
              type: 'calendar',
              success: true,
              message: `You have events on ${date}:\n${formatted}`,
              data: availability
            };
          }
        }

        case 'next': {
          const nextEvent = await calendarContextService.findNextEvent(userId);
          if (!nextEvent) {
            return {
              type: 'calendar',
              success: true,
              message: 'You have no upcoming events scheduled.',
              data: { event: null }
            };
          }
          const formatted = calendarContextService.formatEventsAsNaturalLanguage([nextEvent]);
          return {
            type: 'calendar',
            success: true,
            message: `Your next event is:\n${formatted}`,
            data: { event: nextEvent }
          };
        }

        case 'search': {
          const searchTerm = String(details.search_term || '');
          if (!searchTerm) {
            return {
              type: 'calendar',
              success: false,
              message: 'Please provide a search term to find events.'
            };
          }
          const events = await calendarContextService.searchEvents(userId, searchTerm);
          if (events.length === 0) {
            return {
              type: 'calendar',
              success: true,
              message: `No events found matching "${searchTerm}".`,
              data: { events: [] }
            };
          }
          const formatted = calendarContextService.formatEventsAsNaturalLanguage(events);
          return {
            type: 'calendar',
            success: true,
            message: `Found ${events.length} event${events.length > 1 ? 's' : ''} matching "${searchTerm}":\n${formatted}`,
            data: { events }
          };
        }

        default:
          return {
            type: 'calendar',
            success: false,
            message: 'I don\'t understand that calendar query. Try asking "What\'s on my calendar today?" or "Am I free tomorrow?"'
          };
      }
    } catch (error) {
      console.error('❌ Calendar query error:', error);
      return {
        type: 'calendar',
        success: false,
        message: `Failed to query calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Calendar Updates */
  private async handleCalendarUpdate(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('✏️ Updating calendar event with details:', details);

    const searchTerm = String(details.search_term || '');
    const updates = details.updates as Record<string, unknown> || {};

    if (!searchTerm) {
      return {
        type: 'calendar',
        success: false,
        message: 'Please specify which event you want to update.'
      };
    }

    try {
      const events = await calendarContextService.searchEvents(userId, searchTerm);
      if (events.length === 0) {
        return {
          type: 'calendar',
          success: false,
          message: `No events found matching "${searchTerm}". Please be more specific.`
        };
      }

      if (events.length > 1) {
        const formatted = calendarContextService.formatEventsAsNaturalLanguage(events);
        return {
          type: 'calendar',
          success: false,
          message: `Multiple events found matching "${searchTerm}". Please be more specific:\n${formatted}`,
          data: { events }
        };
      }

      const event = events[0];
      const updatePayload: any = {};

      if (updates.date) {
        const newDate = toISODate(updates.date);
        if (newDate) updatePayload.event_date = newDate;
      }

      if (updates.time) {
        const newTime = toISOTime(updates.time);
        if (newTime) updatePayload.start_time = newTime;
      }

      if (updates.location) {
        updatePayload.location = String(updates.location);
      }

      if (updates.title) {
        updatePayload.title = String(updates.title);
      }

      if (Object.keys(updatePayload).length === 0) {
        return {
          type: 'calendar',
          success: false,
          message: 'No valid updates provided. What would you like to change?'
        };
      }

      if (updatePayload.event_date || updatePayload.start_time) {
        const checkDate = updatePayload.event_date || event.event_date;
        const checkTime = updatePayload.start_time || event.start_time;
        const conflictCheck = await calendarContextService.checkConflicts(
          userId,
          checkDate,
          checkTime,
          null,
          event.id
        );

        if (conflictCheck.hasConflict) {
          const conflictNames = conflictCheck.conflictingEvents.map(e => e.title).join(', ');
          return {
            type: 'calendar',
            success: false,
            message: `⚠️ Cannot update: Schedule conflict with ${conflictNames}. Try a different time.`,
            data: { conflicts: conflictCheck.conflictingEvents }
          };
        }
      }

      const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', event.id)
        .select()
        .single();

      if (error) throw error;

      return {
        type: 'calendar',
        success: true,
        message: `✅ Updated "${event.title}" successfully!`,
        data: { event: data }
      };
    } catch (error) {
      console.error('❌ Calendar update error:', error);
      return {
        type: 'calendar',
        success: false,
        message: `Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Calendar Deletion */
  private async handleCalendarDelete(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🗑️ Deleting calendar event with details:', details);

    const searchTerm = String(details.search_term || '');
    const date = details.date ? toISODate(details.date) : null;

    if (!searchTerm) {
      return {
        type: 'calendar',
        success: false,
        message: 'Please specify which event you want to delete.'
      };
    }

    try {
      let events: DbEvent[];

      if (date) {
        const allEvents = await calendarContextService.searchEvents(userId, searchTerm);
        events = allEvents.filter(e => e.event_date === date);
      } else {
        events = await calendarContextService.searchEvents(userId, searchTerm);
      }

      if (events.length === 0) {
        return {
          type: 'calendar',
          success: false,
          message: `No events found matching "${searchTerm}".`
        };
      }

      if (events.length > 1) {
        const formatted = calendarContextService.formatEventsAsNaturalLanguage(events);
        return {
          type: 'calendar',
          success: false,
          message: `Multiple events found. Please be more specific about which event to delete:\n${formatted}`,
          data: { events }
        };
      }

      const event = events[0];
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      return {
        type: 'calendar',
        success: true,
        message: `✅ Deleted "${event.title}" from your calendar.`,
        data: { event }
      };
    } catch (error) {
      console.error('❌ Calendar delete error:', error);
      return {
        type: 'calendar',
        success: false,
        message: `Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Reminders */
  private async handleReminderAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('⏰ Creating reminder with details:', details);
    
    const title = String(details.title ?? 'Reminder');
    const date = toISODate(details.date);
    const time = toISOTime(details.time);

    if (!date) {
      return { 
        type: 'reminder', 
        success: false, 
        message: 'Please include a date for the reminder (e.g., "today", "tomorrow", "2024-03-15")' 
      };
    }

    try {
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
        console.error('❌ Reminder creation error:', error);
        return { type: 'reminder', success: false, message: error.message || 'Failed to create reminder.' };
      }

      console.log('⏰ Reminder created successfully:', data);
      return { 
        type: 'reminder', 
        success: true, 
        message: `✅ Reminder set for ${date}${time ? ' at ' + time.slice(0,5) : ''}: ${title}`, 
        data 
      };
    } catch (error) {
      console.error('❌ Reminder creation error:', error);
      return { 
        type: 'reminder', 
        success: false, 
        message: `Failed to create reminder: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /** Shopping */
  private async handleShoppingAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🛒 Adding shopping item with details:', details);
    
    const title = String(details.title ?? 'item');
    const category = String(details.category ?? details.list ?? 'other');
    const quantity = coerceInt(details.quantity ?? 1, 1) ?? 1;

    try {
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
        console.error('❌ Shopping item creation error:', error);
        return { type: 'shopping', success: false, message: error.message || 'Failed to add to shopping list.' };
      }

      console.log('🛒 Shopping item created successfully:', data);
      return { 
        type: 'shopping', 
        success: true, 
        message: `✅ Added to shopping list: ${title}${quantity > 1 ? ` x${quantity}` : ''}`, 
        data 
      };
    } catch (error) {
      console.error('❌ Shopping item creation error:', error);
      return { 
        type: 'shopping', 
        success: false, 
        message: `Failed to add to shopping list: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /** Tasks */
  private async handleTaskAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('✅ Creating task with details:', details);
    
    const title = String(details.title ?? 'New task');
    const due_date = toISODate(details.date);
    const due_time = toISOTime(details.time);
    const p = details.priority ? details.priority.toString().toLowerCase() : undefined;
    const priority = (p === 'low' || p === 'medium' || p === 'high') ? p : 'medium';
    const category = String(details.category ?? 'other');

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ 
          user_id: userId, 
          title, 
          due_date, 
          due_time, 
          priority,
          status: 'pending',
          category,
          points: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Task creation error:', error);
        return { type: 'task', success: false, message: error.message || 'Failed to create task.' };
      }

      console.log('✅ Task created successfully:', data);
      return { 
        type: 'task', 
        success: true, 
        message: `✅ Task created: ${title}${due_date ? ' due ' + due_date : ''}`, 
        data 
      };
    } catch (error) {
      console.error('❌ Task creation error:', error);
      return { 
        type: 'task', 
        success: false, 
        message: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /** Chat - Handle general conversation */
  private async handleChatAction(details: Record<string, unknown>, originalMessage: string, calendarContext?: any): Promise<AIAction> {
    console.log('💬 Handling chat message:', originalMessage);

    try {
      const contextInfo = calendarContext ? `\n\nCurrent Calendar Context:\n${calendarContext.summary}` : '';

      const response = await openaiService.chat([
        {
          role: 'system',
          content: `You are Sara, a helpful AI assistant for busy parents. You help with family scheduling, shopping lists, reminders, and general parenting advice.${contextInfo}

Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.

You have full access to the user's calendar and can:
- Answer questions about their schedule ("What's on my calendar today?")
- Check availability ("Am I free tomorrow afternoon?")
- Find specific events ("When is my dentist appointment?")
- Create new events ("Schedule a meeting tomorrow at 2pm")
- Update existing events ("Move my dentist appointment to next week")
- Delete events ("Cancel my meeting tomorrow")
- Add items to shopping lists ("add milk to shopping list")
- Set reminders ("remind me to call mom tomorrow at 3pm")
- Create tasks ("create task to clean room")
- Answer general questions about parenting and family management

When answering questions, reference the calendar context when relevant. If the user mentions planning something, check for conflicts proactively.`
        },
        {
          role: 'user',
          content: originalMessage
        }
      ]);

      return {
        type: 'chat',
        success: true,
        message: response,
        data: { query: originalMessage }
      };
    } catch (error) {
      console.error('❌ Chat response error:', error);
      return {
        type: 'chat',
        success: true,
        message: "I'm here to help! You can ask me about your schedule, add items to your shopping list, set reminders, schedule events, or create tasks. What would you like to do?",
        data: { query: originalMessage }
      };
    }
  }
}

export const aiAssistantService = new AIAssistantService();