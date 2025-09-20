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
  RefreshCw,
  Link,
  CheckCircle,
} from 'lucide-react';

import { EventForm } from './forms/EventForm';
import { ConnectGoogleCalendarButton } from './ConnectGoogleCalendarButton';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';
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
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [showGoogleConnect, setShowGoogleConnect] = useState(false);

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

  // Check Google Calendar connection status
  useEffect(() => {
    checkGoogleConnection();
  }, []);

  const checkGoogleConnection = async () => {
    try {
      await googleCalendarService.initialize();
      setIsGoogleConnected(googleCalendarService.isSignedIn());
    } catch (error) {
      console.error('Error checking Google Calendar connection:', error);
      setIsGoogleConnected(false);
    }
  };

  const syncWithGoogleCalendar = async () => {
    if (!isGoogleConnected) {
      setShowGoogleConnect(true);
      return;
    }

    setSyncingGoogle(true);
    try {
      // Get Google Calendar events for the current month
      const timeMin = monthStart.toISOString();
      const timeMax = monthEnd.toISOString();
      
      const events = await googleCalendarService.getEvents({
        timeMin,
        timeMax,
        maxResults: 100
      });

      setGoogleEvents(events);
      
      // Optionally sync Google events to local database
      // This would require additional logic to avoid duplicates
      
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      setError('Failed to sync with Google Calendar. Please try again.');
    } finally {
      setSyncingGoogle(false);
    }
  };

  // --- Derived day agenda ----------------------------------------------------
  const itemsForSelectedDate = useMemo(() => {
    if (!selectedDate) return { events: [] as DbEvent[], reminders: [] as any[] };
    const d = toLocalISODate(selectedDate);

    const dayDbEvents = events.filter(ev => ev.event_date === d);
    const dayReminders = reminders.filter(rem => rem.reminder_date === d);
    const dayGoogleEvents = googleEvents.filter(ev => {
      if (ev.start?.date) return ev.start.date === d;
      if (ev.start?.dateTime) return ev.start.dateTime.split('T')[0] === d;
      return false;
    });

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

    return { events: sorted, reminders: sortedReminders, googleEvents: dayGoogleEvents };
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
      const googleEventCount = googleEvents.filter(ev => {
        if (ev.start?.date) return ev.start.date === d;
        if (ev.start?.dateTime) return ev.start.dateTime.split('T')[0] === d;
        return false;
      }).length;
      return eventCount + reminderCount + googleEventCount;
    },
    [events, reminders, googleEvents]
  );

  const isCurrentMonth = (day: Date) => day.getMonth() === currentDate.getMonth();

  // --- UI --------------------------------------------------------------------
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Today's Events */}
          <div className="lg:col-span-1 space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">TODAY</h1>
                  <p className="text-gray-500">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowGoogleConnect(true)}
                    className={`px-3 py-2 rounded-full text-sm font-medium flex items-center space-x-1 ${
                      isGoogleConnected 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Link className="w-3 h-3" />
                    <span>{isGoogleConnected ? 'Connected' : 'Connect'}</span>
                  </button>
                  <button
                    onClick={syncWithGoogleCalendar}
                    disabled={syncingGoogle}
                    className="px-3 py-2 bg-blue-100 text-blue-600 rounded-full text-sm font-medium flex items-center space-x-1 hover:bg-blue-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    <span>{syncingGoogle ? 'Syncing...' : 'Sync'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Today's Events */}
            <div className="space-y-3">
              {itemsForSelectedDate.events.length === 0 && itemsForSelectedDate.reminders.length === 0 && (itemsForSelectedDate.googleEvents?.length || 0) === 0 ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                  <p className="text-gray-500">No events today</p>
                </div>
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
                      className="bg-gradient-to-r from-orange-400 to-pink-400 rounded-2xl p-4 text-white cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{ev.title}</h3>
                        <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                          {formatTimeRange(ev.start_time, ev.end_time) || 'All day'}
                        </span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center space-x-1 text-sm opacity-90">
                          <MapPin className="w-3 h-3" />
                          <span>{ev.location}</span>
                        </div>
                      )}
                      {ev.description && (
                        <p className="text-sm opacity-90 mt-2">{ev.description}</p>
                      )}
                    </div>
                  ))}
                  
                  {/* Google Calendar Events */}
                  {(itemsForSelectedDate.googleEvents || []).map((ev, i) => (
                    <div
                      key={`google-event-${ev.id}-${i}`}
                      className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl p-4 text-white cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{ev.summary || 'Untitled Event'}</h3>
                          <div className="w-4 h-4 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">G</span>
                          </div>
                        </div>
                        <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                          {ev.start?.dateTime 
                            ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                            : 'All day'
                          }
                        </span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center space-x-1 text-sm opacity-90">
                          <MapPin className="w-3 h-3" />
                          <span>{ev.location}</span>
                        </div>
                      )}
                      {ev.description && (
                        <p className="text-sm opacity-90 mt-2">{ev.description}</p>
                      )}
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
                      className="bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl p-4 text-white cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{reminder.title}</h3>
                        <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                          {reminder.reminder_time ? formatTimeRange(reminder.reminder_time, null) : 'All day'}
                        </span>
                      </div>
                      {reminder.description && (
                        <p className="text-sm opacity-90">{reminder.description}</p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right Column - Calendar and Actions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Mini Calendar */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{monthLabel}</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToday}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={goPrevMonth}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={goNextMonth}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS_SHORT.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {daysInGrid.map((day, idx) => {
                  const isToday = isSameDay(day, new Date());
                  const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const count = dayEventsCount(day);
                  const inCurrentMonth = isCurrentMonth(day);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        onDayClick(day);
                        setShowEventForm(true);
                      }}
                      className={`
                        relative h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                        ${selected 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                          : isToday 
                          ? 'bg-orange-100 text-orange-600' 
                          : inCurrentMonth 
                          ? 'text-gray-900 hover:bg-gray-100' 
                          : 'text-gray-300'
                        }
                      `}
                    >
                      {day.getDate()}
                      {count > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Quick Actions</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Click any day to create a new event</p>
                <p>• Click on events or reminders to edit them</p>
              </div>
            </div>

            {/* Google Calendar Integration */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                    <p className="text-sm text-gray-500">
                      {isGoogleConnected ? 'Connected and syncing' : 'Connect to sync your events'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isGoogleConnected && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Connected</span>
                    </div>
                  )}
                </div>
              </div>

              {isGoogleConnected ? (
                <div className="space-y-3">
                  <button
                    onClick={syncWithGoogleCalendar}
                    disabled={syncingGoogle}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingGoogle ? 'animate-spin' : ''}`} />
                    <span>{syncingGoogle ? 'Syncing...' : 'Sync with Google Calendar'}</span>
                  </button>
                  
                  {googleEvents.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <p>Found {googleEvents.length} Google Calendar events this month</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Connect your Google Calendar to sync events automatically</p>
                  <ConnectGoogleCalendarButton />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-xl">Create Event</h4>
              <button
                onClick={() => setShowEventForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
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

      {/* Google Calendar Connection Modal */}
      {showGoogleConnect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Connect Google Calendar</h2>
                <button
                  onClick={() => setShowGoogleConnect(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-8 h-8 text-blue-600" />
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sync with Google Calendar</h3>
                  <p className="text-gray-600 text-sm">
                    Connect your Google Calendar to automatically sync events between your calendar and this app.
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">What you'll get:</h4>
                  <ul className="text-sm text-blue-700 space-y-1 text-left">
                    <li>• View Google Calendar events in this app</li>
                    <li>• Create events that sync to Google Calendar</li>
                    <li>• Automatic two-way synchronization</li>
                    <li>• Never miss an appointment again</li>
                  </ul>
                </div>

                <ConnectGoogleCalendarButton />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Event/Reminder Details Modal */}
      {showEventDetails && (selectedEvent || selectedReminder) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
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
                    <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
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
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this event?')) {
                          try {
                            const { error } = await supabase
                              .from('events')
                              .delete()
                              .eq('id', selectedEvent.id);
                            
                            if (!error) {
                              setShowEventDetails(false);
                              setSelectedEvent(null);
                              loadEvents(); // Refresh events list
                            } else {
                              alert('Error deleting event. Please try again.');
                            }
                          } catch (error) {
                            console.error('Error deleting event:', error);
                            alert('Error deleting event. Please try again.');
                          }
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
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
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this reminder?')) {
                          try {
                            const { error } = await supabase
                              .from('reminders')
                              .delete()
                              .eq('id', selectedReminder.id);
                            
                            if (!error) {
                              setShowEventDetails(false);
                              setSelectedReminder(null);
                              loadEvents(); // Refresh reminders list
                            } else {
                              alert('Error deleting reminder. Please try again.');
                            }
                          } catch (error) {
                            console.error('Error deleting reminder:', error);
                            alert('Error deleting reminder. Please try again.');
                          }
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
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
    </div>
    </>
  );
}