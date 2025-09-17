import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  MapPin,
  Clock,
  Users,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Bell,
} from 'lucide-react';

import { EventForm } from './forms/EventForm';
import { ReminderForm } from './forms/ReminderForm';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { supabase } from '../lib/supabase';
import type { Event as DbEvent } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
export function Calendar({ onNavigate }: DashboardProps) {
  const { user } = useAuth();

  // Core state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // UI modals
  const [showEventForm, setShowEventForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);

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

  // Helper to format dates without timezone issues
  const formatLocalDate = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString();
  };
  const onDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setShowCreateOptions(true);
  }, []);


  const handleEventSaved = useCallback(() => {
    setShowEventForm(false);
    setShowReminderForm(false);
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

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  // --- UI --------------------------------------------------------------------
  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
          </div>
          
          <div className="text-sm text-gray-600">
            {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            }) : 'Select a date'}
          </div>
        </div>

        {/* Today's Events */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-3">
            {itemsForSelectedDate.events.length === 0 && itemsForSelectedDate.reminders.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No events today</p>
              </div>
            ) : (
              <>
                {/* Events */}
                {itemsForSelectedDate.events.map((event, i) => (
                  <div
                    key={`event-${event.id}-${i}`}
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventDetails(true);
                    }}
                    className="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{event.title}</h3>
                      <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                        {event.event_type}
                      </span>
                    </div>
                    <div className="text-xs opacity-90 space-y-1">
                      {formatTimeRange(event.start_time, event.end_time) && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeRange(event.start_time, event.end_time)}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{event.location}</span>
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
                    className="bg-gradient-to-r from-orange-400 to-red-400 text-white p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{reminder.title}</h3>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="text-xs opacity-90">
                      {reminder.reminder_time ? formatTimeRange(reminder.reminder_time, null) : 'All day'}
                      {reminder.priority && reminder.priority !== 'medium' && (
                        <span className="ml-2 bg-white bg-opacity-20 px-2 py-1 rounded-full">
                          {reminder.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* View All Button */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={() => onNavigate?.('dashboard')}
              className="text-purple-600 text-sm font-medium hover:underline"
            >
              View All →
            </button>
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 p-6">
        {/* Mini Calendar */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={goPrevMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={goNextMonth}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS_FULL.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day.charAt(0)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysInGrid.map((day, idx) => {
              const isCurrentDay = isToday(day);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const count = dayEventsCount(day);
              const inCurrentMonth = isCurrentMonth(day);

              return (
                <button
                  key={idx}
                  onClick={() => onDayClick(day)}
                  className={`
                    relative h-8 w-8 text-sm rounded-lg transition-all hover:bg-purple-50
                    ${selected ? 'bg-purple-500 text-white' : ''}
                    ${isCurrentDay && !selected ? 'bg-purple-100 text-purple-700 font-semibold' : ''}
                    ${!inCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${count > 0 && !selected && !isCurrentDay ? 'bg-purple-50' : ''}
                  `}
                >
                  {day.getDate()}
                  {count > 0 && (
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full text-[8px] flex items-center justify-center ${
                      selected ? 'bg-white text-purple-500' : 'bg-purple-500 text-white'
                    }`}>
                      {count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={goToday}
              className="w-full py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Create Options Modal */}
      {showCreateOptions && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h2>
                <button
                  onClick={() => setShowCreateOptions(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowCreateOptions(false);
                    setShowEventForm(true);
                  }}
                  className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <CalendarIcon className="w-5 h-5" />
                    <div className="text-left">
                      <h3 className="font-semibold">Create Event</h3>
                      <p className="text-sm opacity-90">Schedule a meeting or appointment</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setShowCreateOptions(false);
                    setShowReminderForm(true);
                  }}
                  className="w-full p-4 bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5" />
                    <div className="text-left">
                      <h3 className="font-semibold">Create Reminder</h3>
                      <p className="text-sm opacity-90">Set a personal reminder</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Reminder form modal */}
      {showReminderForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm sm:text-base">Create / Edit Reminder</h4>
              <button
                onClick={() => setShowReminderForm(false)}
                className="p-0.5 sm:p-1 rounded hover:bg-gray-100"
                aria-label="Close reminder form"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <ReminderForm
              defaultDate={selectedDate ? toLocalISODate(selectedDate) : undefined}
              reminder={selectedReminder ?? undefined}
              onCancel={() => setShowReminderForm(false)}
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
                      <span>{formatLocalDate(selectedEvent.event_date)}</span>
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
                      <span>{formatLocalDate(selectedReminder.reminder_date)}</span>
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