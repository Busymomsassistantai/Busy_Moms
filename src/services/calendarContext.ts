import { supabase } from '../lib/supabase';
import type { Event as DbEvent } from '../lib/supabase';

export interface CalendarContext {
  todayEvents: DbEvent[];
  upcomingEvents: DbEvent[];
  recentPastEvents: DbEvent[];
  todayBusySlots: TimeSlot[];
  todayFreeSlots: TimeSlot[];
  summary: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  event?: DbEvent;
}

export interface AvailabilityQuery {
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface ConflictCheck {
  hasConflict: boolean;
  conflictingEvents: DbEvent[];
  suggestions: string[];
}

export class CalendarContextService {
  async getCalendarContext(userId: string, lookAheadDays: number = 7): Promise<CalendarContext> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + lookAheadDays);
    const future = futureDate.toISOString().split('T')[0];

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const past = pastDate.toISOString().split('T')[0];

    const [todayResult, upcomingResult, pastResult] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_date', today)
        .order('start_time', { ascending: true }),

      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gt('event_date', today)
        .lte('event_date', future)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true }),

      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('event_date', past)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .limit(5)
    ]);

    const todayEvents = todayResult.data || [];
    const upcomingEvents = upcomingResult.data || [];
    const recentPastEvents = pastResult.data || [];

    const todayBusySlots = this.extractBusySlots(todayEvents);
    const todayFreeSlots = this.calculateFreeSlots(todayBusySlots, today);
    const summary = this.generateContextSummary(todayEvents, upcomingEvents, today);

    return {
      todayEvents,
      upcomingEvents,
      recentPastEvents,
      todayBusySlots,
      todayFreeSlots,
      summary,
    };
  }

  async getEventsForDateRange(userId: string, startDate: string, endDate: string): Promise<DbEvent[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching events for date range:', error);
      return [];
    }

    return data || [];
  }

  async getEventsForDate(userId: string, date: string): Promise<DbEvent[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .eq('event_date', date)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching events for date:', error);
      return [];
    }

    return data || [];
  }

  async checkAvailability(userId: string, query: AvailabilityQuery): Promise<{
    available: boolean;
    events: DbEvent[];
    freeSlots: TimeSlot[];
  }> {
    const events = await this.getEventsForDate(userId, query.date);

    if (events.length === 0) {
      return {
        available: true,
        events: [],
        freeSlots: [{ start: '00:00:00', end: '23:59:59' }],
      };
    }

    const busySlots = this.extractBusySlots(events);
    const freeSlots = this.calculateFreeSlots(busySlots, query.date);

    if (!query.startTime || !query.endTime) {
      return {
        available: freeSlots.length > 0,
        events,
        freeSlots,
      };
    }

    const requestedStart = this.timeToMinutes(query.startTime);
    const requestedEnd = this.timeToMinutes(query.endTime);

    const isAvailable = freeSlots.some(slot => {
      const slotStart = this.timeToMinutes(slot.start);
      const slotEnd = this.timeToMinutes(slot.end);
      return requestedStart >= slotStart && requestedEnd <= slotEnd;
    });

    return {
      available: isAvailable,
      events,
      freeSlots,
    };
  }

  async checkConflicts(
    userId: string,
    date: string,
    startTime: string | null,
    endTime: string | null,
    excludeEventId?: string
  ): Promise<ConflictCheck> {
    const events = await this.getEventsForDate(userId, date);
    const relevantEvents = events.filter(e => e.id !== excludeEventId);

    if (!startTime) {
      return {
        hasConflict: false,
        conflictingEvents: [],
        suggestions: [],
      };
    }

    const newStart = this.timeToMinutes(startTime);
    const newEnd = endTime ? this.timeToMinutes(endTime) : newStart + 60;

    const conflictingEvents = relevantEvents.filter(event => {
      if (!event.start_time) return false;

      const eventStart = this.timeToMinutes(event.start_time);
      const eventEnd = event.end_time
        ? this.timeToMinutes(event.end_time)
        : eventStart + 60;

      return (newStart < eventEnd && newEnd > eventStart);
    });

    if (conflictingEvents.length === 0) {
      return {
        hasConflict: false,
        conflictingEvents: [],
        suggestions: [],
      };
    }

    const busySlots = this.extractBusySlots(relevantEvents);
    const freeSlots = this.calculateFreeSlots(busySlots, date);
    const suggestions = this.generateAlternativeTimeSuggestions(freeSlots, newEnd - newStart);

    return {
      hasConflict: true,
      conflictingEvents,
      suggestions,
    };
  }

  async findNextEvent(userId: string): Promise<DbEvent | null> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .or(`event_date.gt.${today},and(event_date.eq.${today},start_time.gte.${currentTime})`)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error finding next event:', error);
      return null;
    }

    return data;
  }

  async searchEvents(userId: string, query: string): Promise<DbEvent[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,location.ilike.%${query}%,description.ilike.%${query}%`)
      .order('event_date', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error searching events:', error);
      return [];
    }

    return data || [];
  }

  private extractBusySlots(events: DbEvent[]): TimeSlot[] {
    return events
      .filter(e => e.start_time)
      .map(event => ({
        start: event.start_time!,
        end: event.end_time || this.addMinutesToTime(event.start_time!, 60),
        event,
      }))
      .sort((a, b) => this.timeToMinutes(a.start) - this.timeToMinutes(b.start));
  }

  private calculateFreeSlots(busySlots: TimeSlot[], date: string): TimeSlot[] {
    if (busySlots.length === 0) {
      return [{ start: '08:00:00', end: '20:00:00' }];
    }

    const freeSlots: TimeSlot[] = [];
    const workDayStart = '08:00:00';
    const workDayEnd = '20:00:00';

    const firstBusyStart = busySlots[0].start;
    if (this.timeToMinutes(firstBusyStart) > this.timeToMinutes(workDayStart)) {
      freeSlots.push({ start: workDayStart, end: firstBusyStart });
    }

    for (let i = 0; i < busySlots.length - 1; i++) {
      const currentEnd = busySlots[i].end;
      const nextStart = busySlots[i + 1].start;

      if (this.timeToMinutes(nextStart) > this.timeToMinutes(currentEnd)) {
        freeSlots.push({ start: currentEnd, end: nextStart });
      }
    }

    const lastBusyEnd = busySlots[busySlots.length - 1].end;
    if (this.timeToMinutes(lastBusyEnd) < this.timeToMinutes(workDayEnd)) {
      freeSlots.push({ start: lastBusyEnd, end: workDayEnd });
    }

    return freeSlots.filter(slot =>
      this.timeToMinutes(slot.end) - this.timeToMinutes(slot.start) >= 30
    );
  }

  private generateContextSummary(todayEvents: DbEvent[], upcomingEvents: DbEvent[], today: string): string {
    const parts: string[] = [];

    parts.push(`Today is ${new Date(today).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}.`);

    if (todayEvents.length === 0) {
      parts.push('You have no events scheduled for today.');
    } else {
      parts.push(`You have ${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''} today:`);
      todayEvents.forEach(event => {
        const time = event.start_time
          ? ` at ${this.formatTime(event.start_time)}`
          : '';
        parts.push(`- ${event.title}${time}${event.location ? ` at ${event.location}` : ''}`);
      });
    }

    if (upcomingEvents.length > 0) {
      const nextFewDays = upcomingEvents.slice(0, 5);
      parts.push(`\nUpcoming events (next 7 days):`);
      nextFewDays.forEach(event => {
        const date = new Date(event.event_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        const time = event.start_time
          ? ` at ${this.formatTime(event.start_time)}`
          : '';
        parts.push(`- ${date}: ${event.title}${time}`);
      });

      if (upcomingEvents.length > 5) {
        parts.push(`... and ${upcomingEvents.length - 5} more upcoming event${upcomingEvents.length - 5 > 1 ? 's' : ''}.`);
      }
    }

    return parts.join('\n');
  }

  private generateAlternativeTimeSuggestions(freeSlots: TimeSlot[], durationMinutes: number): string[] {
    const suggestions: string[] = [];

    for (const slot of freeSlots.slice(0, 3)) {
      const slotDuration = this.timeToMinutes(slot.end) - this.timeToMinutes(slot.start);
      if (slotDuration >= durationMinutes) {
        suggestions.push(`${this.formatTime(slot.start)} - ${this.formatTime(slot.end)}`);
      }
    }

    return suggestions;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const totalMinutes = this.timeToMinutes(time) + minutes;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
  }

  private formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  formatEventsAsNaturalLanguage(events: DbEvent[]): string {
    if (events.length === 0) {
      return 'You have no events.';
    }

    return events.map((event, index) => {
      const parts: string[] = [];

      if (index === 0) parts.push(`${index + 1}. `);
      else parts.push(`\n${index + 1}. `);

      parts.push(event.title);

      const date = new Date(event.event_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      parts.push(` on ${date}`);

      if (event.start_time) {
        parts.push(` at ${this.formatTime(event.start_time)}`);
      }

      if (event.end_time) {
        parts.push(` until ${this.formatTime(event.end_time)}`);
      }

      if (event.location) {
        parts.push(` at ${event.location}`);
      }

      if (event.participants && event.participants.length > 0) {
        parts.push(` with ${event.participants.join(', ')}`);
      }

      return parts.join('');
    }).join('');
  }
}

export const calendarContextService = new CalendarContextService();
