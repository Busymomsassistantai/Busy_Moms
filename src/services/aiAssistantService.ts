import { supabase, Reminder, ShoppingItem, UUID, Task, Event as DbEvent, FamilyMember } from '../lib/supabase';
import { openaiService } from './openai';
import { ICalendarProvider, LocalCalendarProvider, CalendarEventInput } from './calendarProvider';
import { calendarContextService } from './calendarContext';

/** Central brain for "Sara" — routes natural language to concrete app actions. */
export interface AIAction {
  type: 'calendar' | 'reminder' | 'shopping' | 'shopping_query' | 'shopping_update' | 'shopping_delete' | 'task' | 'family' | 'family_query' | 'family_update' | 'family_delete' | 'chat';
  success: boolean;
  message: string;
  data?: unknown;
}

type IntentType = 'calendar' | 'calendar_query' | 'calendar_update' | 'calendar_delete' | 'reminder' | 'shopping' | 'shopping_query' | 'shopping_update' | 'shopping_delete' | 'task' | 'task_query' | 'task_update' | 'task_delete' | 'family' | 'family_query' | 'family_update' | 'family_delete' | 'chat';

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

  const systemPrompt = `You are a smart assistant that classifies user messages into actions.
Return ONLY valid JSON with this exact format: {"type": "calendar|calendar_query|calendar_update|calendar_delete|reminder|shopping|shopping_query|shopping_update|shopping_delete|task|task_query|task_update|task_delete|family|family_query|family_update|family_delete|chat", "details": {...}}

Current Calendar Context:
${calendarSummary}

For shopping creation: {"type": "shopping", "details": {"title": "item name", "category": "dairy|produce|meat|bakery|baby|household|other", "quantity": 1, "urgent": false}}
For shopping queries: {"type": "shopping_query", "details": {"query_type": "all|pending|completed|search", "search_term": "keyword"}}
For shopping updates: {"type": "shopping_update", "details": {"search_term": "item to find", "updates": {"completed": true|false, "quantity": number, "urgent": true|false}}}
For shopping deletion: {"type": "shopping_delete", "details": {"search_term": "item to delete"}}

For family member creation: {"type": "family", "details": {"name": "person name", "age": number, "gender": "Boy|Girl|Other", "relationship": "description"}}
For family queries: {"type": "family_query", "details": {"query_type": "all|search", "search_term": "name"}}
For family updates: {"type": "family_update", "details": {"search_term": "name to find", "updates": {"age": number, "school": "school name", "grade": "grade level"}}}
For family deletion: {"type": "family_delete", "details": {"search_term": "name to delete"}}

For reminders: {"type": "reminder", "details": {"title": "reminder text", "date": "YYYY-MM-DD", "time": "HH:MM:SS"}}
For calendar creation: {"type": "calendar", "details": {"title": "event name", "date": "YYYY-MM-DD", "time": "HH:MM:SS", "location": "place"}}
For calendar queries: {"type": "calendar_query", "details": {"query_type": "today|week|availability|search|next", "date": "YYYY-MM-DD", "search_term": "keyword"}}
For calendar updates: {"type": "calendar_update", "details": {"search_term": "event to find", "updates": {"date": "new date", "time": "new time", "location": "new location"}}}
For calendar deletion: {"type": "calendar_delete", "details": {"search_term": "event to delete", "date": "YYYY-MM-DD"}}
For task creation: {"type": "task", "details": {"title": "task name", "category": "chores|homework|sports|music|health|social|other", "priority": "low|medium|high", "assigned_to": "person name", "date": "YYYY-MM-DD", "time": "HH:MM:SS"}}
For task queries: {"type": "task_query", "details": {"query_type": "all|pending|in_progress|completed|search|assigned_to", "search_term": "keyword", "assigned_to": "person name"}}
For task updates: {"type": "task_update", "details": {"search_term": "task to find", "updates": {"status": "pending|in_progress|completed|cancelled", "priority": "low|medium|high", "date": "new date"}}}
For task deletion: {"type": "task_delete", "details": {"search_term": "task to delete"}}
For chat: {"type": "chat", "details": {"query": "user question"}}

Examples:
"add milk to shopping list" -> {"type": "shopping", "details": {"title": "milk", "category": "dairy", "quantity": 1}}
"what's on my shopping list" -> {"type": "shopping_query", "details": {"query_type": "all"}}
"mark milk as bought" -> {"type": "shopping_update", "details": {"search_term": "milk", "updates": {"completed": true}}}
"remove bread from shopping list" -> {"type": "shopping_delete", "details": {"search_term": "bread"}}
"add my daughter Emma age 8" -> {"type": "family", "details": {"name": "Emma", "age": 8, "gender": "Girl"}}
"who's in my family" -> {"type": "family_query", "details": {"query_type": "all"}}
"update Emma's age to 9" -> {"type": "family_update", "details": {"search_term": "Emma", "updates": {"age": 9}}}
"remind me to call mom tomorrow at 3pm" -> {"type": "reminder", "details": {"title": "call mom", "date": "tomorrow", "time": "15:00:00"}}
"schedule dentist appointment next Friday" -> {"type": "calendar", "details": {"title": "dentist appointment", "date": "next Friday"}}
"what's on my calendar today" -> {"type": "calendar_query", "details": {"query_type": "today"}}
"create task to clean room" -> {"type": "task", "details": {"title": "clean room", "category": "chores"}}
"what tasks do I have" -> {"type": "task_query", "details": {"query_type": "all"}}`;

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
  async processUserMessage(message: string, userId: UUID, conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>): Promise<AIAction> {
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
        case 'shopping_query':
          return this.handleShoppingQuery(intent.details || {}, userId);
        case 'shopping_update':
          return this.handleShoppingUpdate(intent.details || {}, userId);
        case 'shopping_delete':
          return this.handleShoppingDelete(intent.details || {}, userId);
        case 'task':
          return this.handleTaskAction(intent.details || {}, userId);
        case 'task_query':
          return this.handleTaskQuery(intent.details || {}, userId);
        case 'task_update':
          return this.handleTaskUpdate(intent.details || {}, userId);
        case 'task_delete':
          return this.handleTaskDelete(intent.details || {}, userId);
        case 'family':
          return this.handleFamilyAction(intent.details || {}, userId);
        case 'family_query':
          return this.handleFamilyQuery(intent.details || {}, userId);
        case 'family_update':
          return this.handleFamilyUpdate(intent.details || {}, userId);
        case 'family_delete':
          return this.handleFamilyDelete(intent.details || {}, userId);
        default:
          return this.handleChatAction(intent.details || {}, message, calendarContext, conversationHistory);
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

  /** Direct calendar event creation with structured data (for voice AI, etc.) */
  async createCalendarEvent(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleCalendarAction(details, userId);
  }

  /** Direct calendar event update with structured data (for voice AI, etc.) */
  async updateCalendarEvent(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleCalendarUpdate(details, userId);
  }

  /** Direct calendar event deletion with structured data (for voice AI, etc.) */
  async deleteCalendarEvent(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleCalendarDelete(details, userId);
  }

  /** Direct task creation with structured data (for voice AI, etc.) */
  async createTask(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleTaskAction(details, userId);
  }

  /** Direct task query with structured data (for voice AI, etc.) */
  async queryTasks(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleTaskQuery(details, userId);
  }

  /** Direct task update with structured data (for voice AI, etc.) */
  async updateTask(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleTaskUpdate(details, userId);
  }

  /** Direct task deletion with structured data (for voice AI, etc.) */
  async deleteTask(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    return this.handleTaskDelete(details, userId);
  }

  /** Calendar Creation */
  private async handleCalendarAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('📅 Creating calendar event with details:', details);

    const title = String(details.title ?? 'New event');
    const date = toISODate(details.date);
    const start_time = toISOTime(details.time || details.start_time);
    const end_time = toISOTime(details.end_time);
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

    const conflictCheck = await calendarContextService.checkConflicts(userId, date, start_time, end_time);
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
      start_time: start_time ?? undefined,
      end_time: end_time ?? undefined,
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

      let timeMsg = '';
      if (start_time && end_time) {
        timeMsg = ` from ${start_time.slice(0,5)} to ${end_time.slice(0,5)}`;
      } else if (start_time) {
        timeMsg = ` at ${start_time.slice(0,5)}`;
      }

      return {
        type: 'calendar',
        success: true,
        message: `✅ Scheduled: ${title} on ${date}${timeMsg}`,
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

      if (updates.time || updates.start_time) {
        const newTime = toISOTime(updates.time || updates.start_time);
        if (newTime) updatePayload.start_time = newTime;
      }

      if (updates.end_time) {
        const newEndTime = toISOTime(updates.end_time);
        if (newEndTime) updatePayload.end_time = newEndTime;
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

      if (updatePayload.event_date || updatePayload.start_time || updatePayload.end_time) {
        const checkDate = updatePayload.event_date || event.event_date;
        const checkTime = updatePayload.start_time || event.start_time;
        const checkEndTime = updatePayload.end_time || event.end_time;
        const conflictCheck = await calendarContextService.checkConflicts(
          userId,
          checkDate,
          checkTime,
          checkEndTime,
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
    const description = details.description ? String(details.description) : null;
    const due_date = toISODate(details.date);
    const due_time = toISOTime(details.time);
    const p = details.priority ? details.priority.toString().toLowerCase() : undefined;
    const priority = (p === 'low' || p === 'medium' || p === 'high') ? p : 'medium';
    const category = String(details.category ?? 'other');
    const points = coerceInt(details.points, 0) ?? 0;
    const notes = details.notes ? String(details.notes) : null;

    let assigned_to = null;
    if (details.assigned_to) {
      const memberName = String(details.assigned_to).toLowerCase();
      const { data: members } = await supabase
        .from('family_members')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', `%${memberName}%`);

      if (members && members.length > 0) {
        assigned_to = members[0].id;
      }
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          user_id: userId,
          title,
          description,
          due_date,
          due_time,
          priority,
          status: 'pending',
          category,
          points,
          notes,
          assigned_to
        }])
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .single();

      if (error) {
        console.error('❌ Task creation error:', error);
        return { type: 'task', success: false, message: error.message || 'Failed to create task.' };
      }

      console.log('✅ Task created successfully:', data);

      let message = `✅ Task created: ${title}`;
      if (due_date) message += ` due ${due_date}`;
      if ((data as any).assigned_family_member) {
        message += ` assigned to ${(data as any).assigned_family_member.name}`;
      }

      return {
        type: 'task',
        success: true,
        message,
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

  /** Task Query */
  private async handleTaskQuery(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('📋 Querying tasks with details:', details);

    const queryType = String(details.query_type || 'all');
    const searchTerm = details.search_term ? String(details.search_term) : null;
    const assignedTo = details.assigned_to ? String(details.assigned_to) : null;

    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (queryType !== 'all' && queryType !== 'search' && queryType !== 'assigned_to') {
        query = query.eq('status', queryType);
      }

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      if (assignedTo) {
        const { data: members } = await supabase
          .from('family_members')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', `%${assignedTo}%`);

        if (members && members.length > 0) {
          query = query.eq('assigned_to', members[0].id);
        }
      }

      const { data: tasks, error } = await query;

      if (error) throw error;

      if (!tasks || tasks.length === 0) {
        return {
          type: 'task',
          success: true,
          message: 'You have no tasks matching your criteria.',
          data: { tasks: [] }
        };
      }

      let message = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''}:\n`;
      tasks.forEach((task: any, i: number) => {
        message += `${i + 1}. ${task.title}`;
        if (task.status) message += ` (${task.status})`;
        if (task.assigned_family_member) message += ` - assigned to ${task.assigned_family_member.name}`;
        if (task.due_date) message += ` - due ${task.due_date}`;
        message += '\n';
      });

      return {
        type: 'task',
        success: true,
        message,
        data: { tasks }
      };
    } catch (error) {
      console.error('❌ Task query error:', error);
      return {
        type: 'task',
        success: false,
        message: `Failed to query tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Task Update */
  private async handleTaskUpdate(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('✏️ Updating task with details:', details);

    const searchTerm = String(details.search_term || '');
    const updates = details.updates as Record<string, unknown> || {};

    if (!searchTerm) {
      return {
        type: 'task',
        success: false,
        message: 'Please specify which task you want to update.'
      };
    }

    try {
      const { data: tasks, error: searchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .ilike('title', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!tasks || tasks.length === 0) {
        return {
          type: 'task',
          success: false,
          message: `No tasks found matching "${searchTerm}".`
        };
      }

      if (tasks.length > 1) {
        const taskList = tasks.map((t: any) => t.title).join(', ');
        return {
          type: 'task',
          success: false,
          message: `Multiple tasks found matching "${searchTerm}": ${taskList}. Please be more specific.`,
          data: { tasks }
        };
      }

      const task = tasks[0];
      const updatePayload: any = { updated_at: new Date().toISOString() };

      if (updates.title) updatePayload.title = String(updates.title);
      if (updates.description) updatePayload.description = String(updates.description);
      if (updates.category) updatePayload.category = String(updates.category);
      if (updates.priority) updatePayload.priority = String(updates.priority);
      if (updates.status) {
        updatePayload.status = String(updates.status);
        if (updatePayload.status === 'completed') {
          updatePayload.completed_at = new Date().toISOString();
        }
      }
      if (updates.notes) updatePayload.notes = String(updates.notes);
      if (updates.points !== undefined) updatePayload.points = coerceInt(updates.points, 0);

      if (updates.date || updates.due_date) {
        const newDate = toISODate(updates.date || updates.due_date);
        if (newDate) updatePayload.due_date = newDate;
      }

      if (updates.time || updates.due_time) {
        const newTime = toISOTime(updates.time || updates.due_time);
        if (newTime) updatePayload.due_time = newTime;
      }

      if (updates.assigned_to) {
        const memberName = String(updates.assigned_to).toLowerCase();
        const { data: members } = await supabase
          .from('family_members')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', `%${memberName}%`);

        if (members && members.length > 0) {
          updatePayload.assigned_to = members[0].id;
        }
      }

      if (Object.keys(updatePayload).length === 1) {
        return {
          type: 'task',
          success: false,
          message: 'No valid updates provided.'
        };
      }

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', task.id)
        .select(`
          *,
          assigned_family_member:family_members(id, name, age)
        `)
        .single();

      if (updateError) throw updateError;

      return {
        type: 'task',
        success: true,
        message: `✅ Updated task "${task.title}" successfully!`,
        data: { task: updatedTask }
      };
    } catch (error) {
      console.error('❌ Task update error:', error);
      return {
        type: 'task',
        success: false,
        message: `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Task Delete */
  private async handleTaskDelete(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🗑️ Deleting task with details:', details);

    const searchTerm = String(details.search_term || '');

    if (!searchTerm) {
      return {
        type: 'task',
        success: false,
        message: 'Please specify which task you want to delete.'
      };
    }

    try {
      const { data: tasks, error: searchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .ilike('title', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!tasks || tasks.length === 0) {
        return {
          type: 'task',
          success: false,
          message: `No tasks found matching "${searchTerm}".`
        };
      }

      if (tasks.length > 1) {
        const taskList = tasks.map((t: any) => t.title).join(', ');
        return {
          type: 'task',
          success: false,
          message: `Multiple tasks found matching "${searchTerm}": ${taskList}. Please be more specific.`,
          data: { tasks }
        };
      }

      const task = tasks[0];
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (deleteError) throw deleteError;

      return {
        type: 'task',
        success: true,
        message: `✅ Deleted task "${task.title}" from your list.`,
        data: { task }
      };
    } catch (error) {
      console.error('❌ Task delete error:', error);
      return {
        type: 'task',
        success: false,
        message: `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Shopping Query */
  private async handleShoppingQuery(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🛒 Querying shopping list with details:', details);

    const queryType = String(details.query_type || 'all');
    const searchTerm = details.search_term ? String(details.search_term) : null;

    try {
      let query = supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (queryType === 'pending') {
        query = query.eq('completed', false);
      } else if (queryType === 'completed') {
        query = query.eq('completed', true);
      }

      if (searchTerm) {
        query = query.ilike('item', `%${searchTerm}%`);
      }

      const { data: items, error } = await query;

      if (error) throw error;

      if (!items || items.length === 0) {
        return {
          type: 'shopping_query',
          success: true,
          message: queryType === 'pending' ? 'Your shopping list is empty!' : 'No shopping items found.',
          data: { items: [] }
        };
      }

      let message = `You have ${items.length} item${items.length > 1 ? 's' : ''} on your shopping list:\n`;
      items.forEach((item: any, i: number) => {
        message += `${i + 1}. ${item.item}`;
        if (item.quantity > 1) message += ` (x${item.quantity})`;
        if (item.completed) message += ` ✓`;
        if (item.urgent) message += ` 🔥`;
        message += '\n';
      });

      return {
        type: 'shopping_query',
        success: true,
        message,
        data: { items }
      };
    } catch (error) {
      console.error('❌ Shopping query error:', error);
      return {
        type: 'shopping_query',
        success: false,
        message: `Failed to query shopping list: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Shopping Update */
  private async handleShoppingUpdate(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('✏️ Updating shopping item with details:', details);

    const searchTerm = String(details.search_term || '');
    const updates = details.updates as Record<string, unknown> || {};

    if (!searchTerm) {
      return {
        type: 'shopping_update',
        success: false,
        message: 'Please specify which item you want to update.'
      };
    }

    try {
      const { data: items, error: searchError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', userId)
        .ilike('item', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!items || items.length === 0) {
        return {
          type: 'shopping_update',
          success: false,
          message: `No shopping items found matching "${searchTerm}".`
        };
      }

      if (items.length > 1) {
        const itemList = items.map((item: any) => item.item).join(', ');
        return {
          type: 'shopping_update',
          success: false,
          message: `Multiple items found matching "${searchTerm}": ${itemList}. Please be more specific.`,
          data: { items }
        };
      }

      const item = items[0];
      const updatePayload: any = {};

      if (updates.completed !== undefined) updatePayload.completed = Boolean(updates.completed);
      if (updates.quantity !== undefined) updatePayload.quantity = coerceInt(updates.quantity, 1);
      if (updates.urgent !== undefined) updatePayload.urgent = Boolean(updates.urgent);
      if (updates.category) updatePayload.category = String(updates.category);
      if (updates.notes) updatePayload.notes = String(updates.notes);

      if (Object.keys(updatePayload).length === 0) {
        return {
          type: 'shopping_update',
          success: false,
          message: 'No valid updates provided.'
        };
      }

      const { data: updatedItem, error: updateError } = await supabase
        .from('shopping_lists')
        .update(updatePayload)
        .eq('id', item.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        type: 'shopping_update',
        success: true,
        message: `✅ Updated "${item.item}" successfully!`,
        data: { item: updatedItem }
      };
    } catch (error) {
      console.error('❌ Shopping update error:', error);
      return {
        type: 'shopping_update',
        success: false,
        message: `Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Shopping Delete */
  private async handleShoppingDelete(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🗑️ Deleting shopping item with details:', details);

    const searchTerm = String(details.search_term || '');

    if (!searchTerm) {
      return {
        type: 'shopping_delete',
        success: false,
        message: 'Please specify which item you want to delete.'
      };
    }

    try {
      const { data: items, error: searchError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', userId)
        .ilike('item', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!items || items.length === 0) {
        return {
          type: 'shopping_delete',
          success: false,
          message: `No shopping items found matching "${searchTerm}".`
        };
      }

      if (items.length > 1) {
        const itemList = items.map((item: any) => item.item).join(', ');
        return {
          type: 'shopping_delete',
          success: false,
          message: `Multiple items found matching "${searchTerm}": ${itemList}. Please be more specific.`,
          data: { items }
        };
      }

      const item = items[0];
      const { error: deleteError } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', item.id);

      if (deleteError) throw deleteError;

      return {
        type: 'shopping_delete',
        success: true,
        message: `✅ Removed "${item.item}" from your shopping list.`,
        data: { item }
      };
    } catch (error) {
      console.error('❌ Shopping delete error:', error);
      return {
        type: 'shopping_delete',
        success: false,
        message: `Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Family Member Creation */
  private async handleFamilyAction(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('👨‍👩‍👧‍👦 Creating family member with details:', details);

    const name = String(details.name ?? 'Family Member');
    const age = coerceInt(details.age, null);
    const gender = details.gender ? String(details.gender) : 'Other';
    const relationship = details.relationship ? String(details.relationship) : null;

    if (!name || name === 'Family Member') {
      return {
        type: 'family',
        success: false,
        message: 'Please provide a name for the family member.'
      };
    }

    try {
      const { data, error } = await supabase
        .from('family_members')
        .insert([{
          user_id: userId,
          name,
          age,
          gender,
          ...(relationship && { medical_notes: `Relationship: ${relationship}` })
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Family member creation error:', error);
        return { type: 'family', success: false, message: error.message || 'Failed to add family member.' };
      }

      console.log('👨‍👩‍👧‍👦 Family member created successfully:', data);
      return {
        type: 'family',
        success: true,
        message: `✅ Added ${name}${age ? ` (age ${age})` : ''} to your family!`,
        data
      };
    } catch (error) {
      console.error('❌ Family member creation error:', error);
      return {
        type: 'family',
        success: false,
        message: `Failed to add family member: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Family Query */
  private async handleFamilyQuery(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('👨‍👩‍👧‍👦 Querying family members with details:', details);

    const queryType = String(details.query_type || 'all');
    const searchTerm = details.search_term ? String(details.search_term) : null;

    try {
      let query = supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data: members, error } = await query;

      if (error) throw error;

      if (!members || members.length === 0) {
        return {
          type: 'family_query',
          success: true,
          message: 'No family members found. You can add family members by saying "Add my daughter Emma age 8".',
          data: { members: [] }
        };
      }

      let message = `You have ${members.length} family member${members.length > 1 ? 's' : ''}:\n`;
      members.forEach((member: any, i: number) => {
        message += `${i + 1}. ${member.name}`;
        if (member.age) message += ` (age ${member.age})`;
        if (member.gender && member.gender !== 'Other') message += ` - ${member.gender}`;
        if (member.school) message += ` - ${member.school}`;
        if (member.grade) message += ` (${member.grade})`;
        message += '\n';
      });

      return {
        type: 'family_query',
        success: true,
        message,
        data: { members }
      };
    } catch (error) {
      console.error('❌ Family query error:', error);
      return {
        type: 'family_query',
        success: false,
        message: `Failed to query family members: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Family Update */
  private async handleFamilyUpdate(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('✏️ Updating family member with details:', details);

    const searchTerm = String(details.search_term || '');
    const updates = details.updates as Record<string, unknown> || {};

    if (!searchTerm) {
      return {
        type: 'family_update',
        success: false,
        message: 'Please specify which family member you want to update.'
      };
    }

    try {
      const { data: members, error: searchError } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!members || members.length === 0) {
        return {
          type: 'family_update',
          success: false,
          message: `No family members found matching "${searchTerm}".`
        };
      }

      if (members.length > 1) {
        const memberList = members.map((m: any) => m.name).join(', ');
        return {
          type: 'family_update',
          success: false,
          message: `Multiple family members found matching "${searchTerm}": ${memberList}. Please be more specific.`,
          data: { members }
        };
      }

      const member = members[0];
      const updatePayload: any = { updated_at: new Date().toISOString() };

      if (updates.name) updatePayload.name = String(updates.name);
      if (updates.age !== undefined) updatePayload.age = coerceInt(updates.age, null);
      if (updates.gender) updatePayload.gender = String(updates.gender);
      if (updates.school) updatePayload.school = String(updates.school);
      if (updates.grade) updatePayload.grade = String(updates.grade);
      if (updates.allergies) {
        const allergiesList = Array.isArray(updates.allergies)
          ? updates.allergies.map(a => String(a))
          : String(updates.allergies).split(',').map(a => a.trim());
        updatePayload.allergies = allergiesList;
      }
      if (updates.medical_notes) updatePayload.medical_notes = String(updates.medical_notes);

      if (Object.keys(updatePayload).length === 1) {
        return {
          type: 'family_update',
          success: false,
          message: 'No valid updates provided.'
        };
      }

      const { data: updatedMember, error: updateError } = await supabase
        .from('family_members')
        .update(updatePayload)
        .eq('id', member.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        type: 'family_update',
        success: true,
        message: `✅ Updated ${member.name}'s information successfully!`,
        data: { member: updatedMember }
      };
    } catch (error) {
      console.error('❌ Family update error:', error);
      return {
        type: 'family_update',
        success: false,
        message: `Failed to update family member: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Family Delete */
  private async handleFamilyDelete(details: Record<string, unknown>, userId: UUID): Promise<AIAction> {
    console.log('🗑️ Deleting family member with details:', details);

    const searchTerm = String(details.search_term || '');

    if (!searchTerm) {
      return {
        type: 'family_delete',
        success: false,
        message: 'Please specify which family member you want to remove.'
      };
    }

    try {
      const { data: members, error: searchError } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${searchTerm}%`);

      if (searchError) throw searchError;

      if (!members || members.length === 0) {
        return {
          type: 'family_delete',
          success: false,
          message: `No family members found matching "${searchTerm}".`
        };
      }

      if (members.length > 1) {
        const memberList = members.map((m: any) => m.name).join(', ');
        return {
          type: 'family_delete',
          success: false,
          message: `Multiple family members found matching "${searchTerm}": ${memberList}. Please be more specific.`,
          data: { members }
        };
      }

      const member = members[0];
      const { error: deleteError } = await supabase
        .from('family_members')
        .delete()
        .eq('id', member.id);

      if (deleteError) throw deleteError;

      return {
        type: 'family_delete',
        success: true,
        message: `✅ Removed ${member.name} from your family list.`,
        data: { member }
      };
    } catch (error) {
      console.error('❌ Family delete error:', error);
      return {
        type: 'family_delete',
        success: false,
        message: `Failed to remove family member: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /** Chat - Handle general conversation */
  private async handleChatAction(details: Record<string, unknown>, originalMessage: string, calendarContext?: any, conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>): Promise<AIAction> {
    console.log('💬 Handling chat message:', originalMessage);
    console.log('💬 Conversation history length:', conversationHistory?.length || 0);

    try {
      const contextInfo = calendarContext ? `\n\nCurrent Calendar Context:\n${calendarContext.summary}` : '';

      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        {
          role: 'system',
          content: `You are Sara, a helpful AI assistant for busy parents. You help with family scheduling, task management, shopping lists, family member management, reminders, and general parenting advice.${contextInfo}

Keep responses concise, practical, and empathetic. Always consider the busy lifestyle of parents and provide actionable suggestions. Use a warm, supportive tone.

You have full access to the user's calendar, tasks, shopping list, and family members. You can:

CALENDAR:
- Answer questions about their schedule ("What's on my calendar today?")
- Check availability ("Am I free tomorrow afternoon?")
- Find specific events ("When is my dentist appointment?")
- Create new events ("Schedule a meeting tomorrow at 2pm")
- Update existing events ("Move my dentist appointment to next week")
- Delete events ("Cancel my meeting tomorrow")

TASKS:
- View all tasks or filter by status ("What tasks do I have?", "Show pending tasks")
- Create new tasks for family members ("Create a task for Sarah to clean her room")
- Update task details ("Change homework task priority to high")
- Mark tasks as complete ("Mark the homework task as done")
- Delete tasks ("Delete the grocery shopping task")

SHOPPING LIST:
- View shopping list ("What's on my shopping list?", "Show me pending items")
- Add items to shopping list ("Add milk to the shopping list", "Add 2 loaves of bread")
- Mark items as purchased ("Mark milk as bought")
- Update item quantities ("Change milk quantity to 2")
- Remove items ("Remove bread from shopping list", "Delete milk from list")

FAMILY MEMBERS:
- View family members ("Who's in my family?", "List all family members")
- Add family members ("Add my daughter Emma age 8", "Add my son Jack")
- Update family info ("Update Emma's age to 9", "Set Emma's school to Lincoln Elementary")
- Remove family members ("Remove Jack from family list")

OTHER:
- Set reminders ("remind me to call mom tomorrow at 3pm")
- Answer general questions about parenting and family management

When answering questions, reference the calendar, task, shopping, and family context when relevant. If the user mentions planning something, check for conflicts proactively.

IMPORTANT: Maintain conversation context. If the user refers to previous topics, tasks, people, or items mentioned earlier in the conversation, remember and reference them appropriately.`
        }
      ];

      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        // Include the last 10 messages to keep context manageable
        const recentHistory = conversationHistory.slice(-10);
        messages.push(...recentHistory);
      }

      // Add the current message
      messages.push({
        role: 'user',
        content: originalMessage
      });

      const response = await openaiService.chat(messages);

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