import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  KeyboardEvent,
} from 'react';
import {
  Plus,
  MapPin,
  Clock,
  Users,
  MessageCircle,
  Gift,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  X,
  Info,
  Loader2,
  Bell,
} from 'lucide-react';

import { EventForm } from './forms/EventForm';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { supabase } from '../lib/supabase';
import type { Event as DbEvent } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Calendar
 * - Local date (no UTC drift)
 * - Month-range querying (lighter DB load)
 * - Keyboard navigation (← → T) & a11y labels
 * - Click-on-day to create event (pre-filled date)
 * - Inline agenda for selected day (sorted, handles all-day)
 * - Keeps original color language (purple, blue, green, etc.)
 */

// --- Helpers -----------------------------------------------------------------
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// Local YYYY-MM-DD (no UTC shift)
const toLocalISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const EVENT_COLORS: Record<string, string> = {
  sports: 'bg-blue-100 text-blue-800 border-blue-200',
  party: 'bg-pink-100 text-pink-800 border-pink-200',
  meeting: 'bg-purple-100 text-purple-800 border-purple-200',
  medical: 'bg-red-100 text-red-800 border-red-200',
  school: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  family: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

const getEventBadge = (type?: string) =>
  EVENT_COLORS[type ?? 'other'] ?? EVENT_COLORS.other;

const formatTimeRange = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime) return '';
  const fmt = (t: string) =>
    new Date(`2000-01-01T${t}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  const start = fmt(startTime);
  if (endTime) return `${start} - ${fmt(endTime)}`;
  return start;
};

// --- Component ---------------------------------------------------------------
export function Calendar() {
  const { user } = useAuth();

  // Core state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // UI modals
  const [showEventForm, setShowEventForm] = useState(false);
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);

  // Data
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DbEvent | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);

  // --- Data loading: only load the visible month to reduce payload -----------
  const loadEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Load events
      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', toLocalISODate(monthStart))
        .lte('event_date', toLocalISODate(monthEnd))
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (eventsErr) throw eventsErr;
      setEvents(eventsData ?? []);

      // Load reminders for the same date range
      const { data: remindersData, error: remindersErr } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .gte('reminder_date', toLocalISODate(monthStart))
        .lte('reminder_date', toLocalISODate(monthEnd))
        .eq('completed', false)
        .order('reminder_date', { ascending: true })
        .order('reminder_time', { ascending: true });

      if (remindersErr) throw remindersErr;
      setReminders(remindersData ?? []);
    } catch (e) {
      console.error('❌ Error loading calendar data:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, monthStart, monthEnd]);

  useEffect(() => {
    if (user?.id) loadEvents();
  }, [user?.id, loadEvents]);

  // --- Derived day agenda ----------------------------------------------------
  const itemsForSelectedDate = useMemo(() => {
    if (!selectedDate) return { events: [] as DbEvent[], reminders: [] as any[] };
    const d = toLocalISODate(selectedDate);

    const dayDbEvents = events.filter(ev => ev.event_date === d);
    const dayReminders = reminders.filter(rem => rem.reminder_date === d);

    const sorted = dayDbEvents.sort((a, b) => {
      const minutesKey = (it: DbEvent) => {
        if (it.start_time) {
          const [h, m] = String(it.start_time).split(':').map((n: string) => parseInt(n, 10));
          return (isNaN(h) ? 23 : h) * 60 + (isNaN(m) ? 59 : m);
        }
        return 24 * 60;
      };
      return minutesKey(a) - minutesKey(b);
    });

    const sortedReminders = dayReminders.sort((a, b) => {
      const minutesKey = (it: any) => {
        if (it.reminder_time) {
          const [h, m] = String(it.reminder_time).split(':').map((n: string) => parseInt(n, 10));
          return (isNaN(h) ? 23 : h) * 60 + (isNaN(m) ? 59 : m);
        }
        return 24 * 60;
      };
      return minutesKey(a) - minutesKey(b);
    });

    return { events: sorted, reminders: sortedReminders };
  }, [selectedDate, events, reminders]);

  // --- Calendar grid helpers -------------------------------------------------
  const monthLabel = useMemo(
    () =>
      currentDate.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [currentDate]
  );

  const firstDayOfGrid = useMemo(() => {
    const start = new Date(monthStart);
    const weekday = start.getDay(); // 0=Sun..6=Sat
    start.setDate(start.getDate() - weekday); // back to Sunday of the first row
    return start;
  }, [monthStart]);

  const daysInGrid = useMemo(() => {
    // Always render 6 weeks (6 * 7 = 42) so the grid is stable
    const days: Date[] = [];
    const d = new Date(firstDayOfGrid);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [firstDayOfGrid]);

  // --- Handlers --------------------------------------------------------------
  const goPrevMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);
  const goNextMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);
  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }, []);

  const onDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setShowEventForm(true);
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrevMonth();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNextMonth();
    } else if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      goToday();
    }
  }, [goPrevMonth, goNextMonth, goToday]);

  const handleEventSaved = useCallback(() => {
    setShowEventForm(false);
    void loadEvents();
  }, [loadEvents]);

  // --- Render helpers --------------------------------------------------------
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dayEventsCount = useCallback(
    (day: Date) => {
      const d = toLocalISODate(day);
      const eventCount = events.filter(ev => ev.event_date === d).length;
      const reminderCount = reminders.filter(rem => rem.reminder_date === d).length;
      return eventCount + reminderCount;
    },
    [events, reminders]
  );

  // --- UI --------------------------------------------------------------------
  return (
    <div className="w-full p-2 sm:p-4" onKeyDown={onKeyDown} tabIndex={0} aria-label="Calendar">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <button
            className="p-1 sm:p-2 rounded hover:bg-gray-100"
            aria-label="Previous month"
            onClick={goPrevMonth}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-1 sm:gap-2">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            {monthLabel}
          </h2>
          <button
            className="p-1 sm:p-2 rounded hover:bg-gray-100"
            aria-label="Next month"
            onClick={goNextMonth}
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            className="ml-1 sm:ml-2 px-2 sm:px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm"
            onClick={goToday}
            aria-label="Go to today"
          >
            <span className="hidden sm:inline">Today (T)</span>
            <span className="sm:hidden">Today</span>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowEventForm(true)}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Event</span>
            <span className="sm:hidden text-xs">New</span>
          </button>

          <button
            onClick={() => setShowWhatsAppForm(true)}
            className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
            title="WhatsApp Integration"
          >
            <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-2 sm:mb-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 sm:p-3 text-red-800">
          <Info className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5" />
          <div className="text-xs sm:text-sm">{error}</div>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1 sm:mb-2">
        {WEEKDAYS_SHORT.map((wd) => (
          <div key={wd} className="py-1 sm:py-2">{wd}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-[1px] bg-gray-200 rounded overflow-hidden mb-4 sm:mb-6">
        {daysInGrid.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const count = dayEventsCount(day);

          return (
            <button
              key={idx}
              onClick={() => onDayClick(day)}
              className={[
                'relative h-16 sm:h-24 bg-white p-1 sm:p-3 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 hover:bg-gray-50 transition-all duration-200 group',
                selected ? 'ring-2 ring-purple-500 bg-purple-50' : '',
              ].join(' ')}
              aria-label={`Day ${toLocalISODate(day)} (${count} events)`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-medium ${selected ? 'text-purple-700' : 'text-gray-700'} group-hover:text-purple-600 transition-colors`}>{day.getDate()}</span>
                {isToday && (
                  <span className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white text-[8px] sm:text-[10px] px-1 sm:px-2 py-0.5 sm:py-1 font-medium shadow-sm">
                    <span className="hidden sm:inline">Today</span>
                    <span className="sm:hidden">•</span>
                  </span>
                )}
              </div>

              {count > 0 && (
                <div className="absolute bottom-0.5 sm:bottom-1 left-0.5 sm:left-1 right-0.5 sm:right-1">
                  <div className={`text-[8px] sm:text-[10px] font-medium ${selected ? 'text-purple-600' : 'text-gray-500'} group-hover:text-purple-600 transition-colors`}>
                    <span className="hidden sm:inline">{count} event{count === 1 ? '' : 's'}</span>
                    <span className="sm:hidden">{count}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Agenda */}
      <div className="mt-4 sm:mt-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base sm:text-lg font-semibold">Agenda</h3>
          {selectedDate && (
            <span className="text-xs sm:text-sm text-gray-500">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            <span>Loading events…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {itemsForSelectedDate.events.length === 0 && itemsForSelectedDate.reminders.length === 0 ? (
              <div className="text-xs sm:text-sm text-gray-500">No events or reminders for this day.</div>
            ) : (
              <>
                {/* Events */}
                {itemsForSelectedDate.events.map((ev, i) => (
                  <div
                    key={`event-${ev.id}-${i}`}
                    onClick={() => {
                      setSelectedEvent(ev);
                      setShowEventDetails(true);
                    }}
                    className={[
                      'border rounded p-2 sm:p-3 text-xs sm:text-sm flex items-start gap-2 cursor-pointer hover:shadow-md transition-all',
                      getEventBadge(ev.event_type),
                    ].join(' ')}
                  >
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold">{ev.title ?? 'Untitled event'}</div>
                      <div className="text-xs sm:text-sm">
                        {formatTimeRange(ev.start_time, ev.end_time)}
                      </div>
                      {ev.location && (
                        <div className="text-xs sm:text-sm flex items-center gap-1">
                          <MapPin className="w-2 h-2 sm:w-3 sm:h-3" />
                          {ev.location}
                        </div>
                      )}
                      {ev.description && (
                        <div className="text-xs sm:text-sm mt-1 text-gray-700">
                          {ev.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Reminders */}
                {itemsForSelectedDate.reminders.map((reminder, i) => (
                  <div
                    key={`reminder-${reminder.id}-${i}`}
                    onClick={() => {
                      setSelectedReminder(reminder);
                      setShowEventDetails(true);
                    }}
                    className="border rounded p-2 sm:p-3 text-xs sm:text-sm flex items-start gap-2 bg-orange-50 border-orange-200 cursor-pointer hover:shadow-md transition-all"
                  >
                    <Bell className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-orange-600" />
                    <div className="flex-1">
                      <div className="font-semibold text-orange-800">{reminder.title}</div>
                      <div className="text-xs sm:text-sm text-orange-600">
                        {reminder.reminder_time ? formatTimeRange(reminder.reminder_time, null) : 'All day'}
                      </div>
                      {reminder.priority && reminder.priority !== 'medium' && (
                        <div className={`text-xs inline-block px-1.5 py-0.5 rounded-full mt-1 ${
                          reminder.priority === 'high' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {reminder.priority} priority
                        </div>
                      )}
                      {reminder.description && (
                        <div className="text-xs sm:text-sm mt-1 text-orange-700">
                          {reminder.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm sm:text-base">Create / Edit Event</h4>
              <button
                onClick={() => setShowEventForm(false)}
                className="p-0.5 sm:p-1 rounded hover:bg-gray-100"
                aria-label="Close event form"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <EventForm
              defaultDate={selectedDate ? toLocalISODate(selectedDate) : undefined}
              event={selectedEvent ?? undefined}
              onCancel={() => setShowEventForm(false)}
              onSaved={handleEventSaved}
            />
          </div>
        </div>
      )}

      {/* Event/Reminder Details Modal */}
      {showEventDetails && (selectedEvent || selectedReminder) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {selectedEvent ? 'Event Details' : 'Reminder Details'}
                </h2>
                <button
                  onClick={() => {
                    setShowEventDetails(false);
                    setSelectedEvent(null);
                    setSelectedReminder(null);
                  }}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {selectedEvent && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedEvent.title}</h3>
                    <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getEventBadge(selectedEvent.event_type)}`}>
                      {selectedEvent.event_type}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{new Date(selectedEvent.event_date).toLocaleDateString()}</span>
                    </div>

                    {(selectedEvent.start_time || selectedEvent.end_time) && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimeRange(selectedEvent.start_time, selectedEvent.end_time)}</span>
                      </div>
                    )}

                    {selectedEvent.location && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}

                    {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{selectedEvent.participants.join(', ')}</span>
                      </div>
                    )}

                    {selectedEvent.description && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{selectedEvent.description}</p>
                      </div>
                    )}

                    {selectedEvent.rsvp_required && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="font-medium text-blue-900">RSVP Required:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedEvent.rsvp_status === 'yes' ? 'bg-green-100 text-green-700' :
                            selectedEvent.rsvp_status === 'no' ? 'bg-red-100 text-red-700' :
                            selectedEvent.rsvp_status === 'maybe' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {selectedEvent.rsvp_status || 'pending'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowEventDetails(false);
                        setShowEventForm(true);
                      }}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={() => {
                        setShowEventDetails(false);
                        setSelectedEvent(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {selectedReminder && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedReminder.title}</h3>
                    <div className="flex items-center space-x-2">
                      <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        selectedReminder.priority === 'high' ? 'bg-red-100 text-red-700' :
                        selectedReminder.priority === 'low' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedReminder.priority || 'medium'} priority
                      </div>
                      <div className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Reminder
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{new Date(selectedReminder.reminder_date).toLocaleDateString()}</span>
                    </div>

                    {selectedReminder.reminder_time && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimeRange(selectedReminder.reminder_time, null)}</span>
                      </div>
                    )}

                    {selectedReminder.description && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{selectedReminder.description}</p>
                      </div>
                    )}

                    {selectedReminder.recurring && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="font-medium text-blue-900">Recurring:</span>
                          <span className="text-blue-700">{selectedReminder.recurring_pattern || 'Custom'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('reminders')
                            .update({ completed: true })
                            .eq('id', selectedReminder.id);
                          
                          if (!error) {
                            setShowEventDetails(false);
                            setSelectedReminder(null);
                            loadEvents(); // Refresh to remove completed reminder
                          }
                        } catch (error) {
                          console.error('Error completing reminder:', error);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Mark Complete
                    </button>
                    <button
                      onClick={() => {
                        setShowEventDetails(false);
                        setSelectedReminder(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp modal */}
      {showWhatsAppForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm sm:text-base">WhatsApp Integration</h4>
              <button
                onClick={() => setShowWhatsAppForm(false)}
                className="p-0.5 sm:p-1 rounded hover:bg-gray-100"
                aria-label="Close WhatsApp modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <WhatsAppIntegration
              onClose={() => setShowWhatsAppForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}