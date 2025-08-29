import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  MapPin,
  Clock,
  Users,
  MessageCircle,
  Gift,
  Calendar as CalendarIcon,
  FolderSync as Sync,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  X,
  Info,
  Loader2,
} from 'lucide-react';
import { EventForm } from './forms/EventForm';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { Event, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

/**
 * Calendar
 * - Cleaned up state & effects
 * - Month-range querying (lighter DB load)
 * - Keyboard navigation (← → T) & a11y labels
 * - Click-on-day to create event (pre-filled date)
 * - Inline agenda for selected day (sorted)
 * - Optional Google Calendar merge toggle
 * - Keeps original color language (purple, blue, green, etc.)
 */

// --- Helpers -----------------------------------------------------------------
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const toISODate = (d: Date) => d.toISOString().split('T')[0];

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

const getEventBadge = (type?: string) => EVENT_COLORS[type ?? 'other'] ?? EVENT_COLORS.other;

const formatTimeRange = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime) return '';
  const fmt = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google
  const [isGoogleServiceReady, setIsGoogleServiceReady] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [mergeGoogle, setMergeGoogle] = useState(true);

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);

  // --- Data loading: only load the visible month to reduce payload -----------
  const loadEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', toISODate(monthStart))
        .lte('event_date', toISODate(monthEnd))
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (qErr) throw qErr;
      setEvents(data ?? []);
    } catch (e: any) {
      console.error('❌ Error loading events:', e);
      setError(e?.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [user?.id, monthStart, monthEnd]);

  useEffect(() => {
    if (user?.id) loadEvents();
  }, [user?.id, loadEvents]);

  // --- Google Calendar bootstrapping & sync ---------------------------------
  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        await googleCalendarService.initialize();
        if (mounted) {
          setIsGoogleServiceReady(true);
          if (googleCalendarService.isSignedIn()) {
            setIsGoogleConnected(true);
            // Don't auto-sync on load to improve performance
            // await syncWithGoogleCalendar();
          }
        }
      } catch (e) {
        console.error('Failed to init Google service', e);
        if (mounted) {
          setIsGoogleServiceReady(false);
        }
      }
    })();
    
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogleCalendar = useCallback(async () => {
    try {
      setError(null);
      setSyncingCalendar(true);
      await googleCalendarService.signIn();
      setIsGoogleConnected(true);
      await syncWithGoogleCalendar();
    } catch (e: any) {
      console.error('Google connect error', e);
      setError(e?.message ?? 'Failed to connect to Google Calendar');
    } finally {
      setSyncingCalendar(false);
    }
  }, []);

  const syncWithGoogleCalendar = useCallback(async () => {
    try {
      setSyncingCalendar(true);
      setError(null);

      if (!googleCalendarService.isSignedIn()) {
        await connectGoogleCalendar();
        return;
      }

      // Pull just the month range from Google as well
      const gEvents = await googleCalendarService.getEvents({
        timeMin: new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).toISOString(),
        timeMax: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString(),
      });
      setGoogleEvents(gEvents);
    } catch (e: any) {
      console.error('Google sync error', e);
      setError(e?.message ?? 'Failed to sync Google Calendar');
    } finally {
      setSyncingCalendar(false);
    }
  }, [connectGoogleCalendar, monthStart, monthEnd]);

  const disconnectGoogleCalendar = useCallback(async () => {
    try {
      await googleCalendarService.signOut();
      setIsGoogleConnected(false);
      setGoogleEvents([]);
    } catch (e) {
      console.error('Google disconnect error', e);
      setError('Failed to disconnect from Google Calendar');
    }
  }, []);

  // --- Derived day agenda ----------------------------------------------------
  const itemsForSelectedDate = useMemo(() => {
    if (!selectedDate) return { events: [] as (Event | GoogleCalendarEvent)[] };
    const d = toISODate(selectedDate);

    const dayDbEvents = events.filter(ev => ev.event_date === d);

    const dayGoogleEvents = mergeGoogle
      ? googleEvents.filter(ge => {
          const start = ge.start?.date ?? ge.start?.dateTime;
          if (!start) return false;
          const iso = (typeof start === 'string' ? new Date(start) : start).toISOString().split('T')[0];
          return iso === d;
        })
      : [];

    const merged = [...dayDbEvents, ...dayGoogleEvents];

    // sort by start (db: start_time, google: start.dateTime/date)
    const getSortKey = (it: any) => {
      if ('start_time' in it && it.start_time) return it.start_time;
      const s = (it.start?.dateTime ?? it.start?.date) as string | undefined;
      if (!s) return '23:59';
      try {
        const dt = new Date(s);
        return `${dt.getHours().toString().padStart(2, '0')}:${dt
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
      } catch {
        return '23:59';
      }
    };

    const sorted = merged.sort((a, b) => (getSortKey(a) > getSortKey(b) ? 1 : -1));
    return { events: sorted };
  }, [selectedDate, events, googleEvents, mergeGoogle]);

  // --- Handlers --------------------------------------------------------------
  const onEventCreated = useCallback(
    (newEvent: Event) => {
      // optimistic add for current month
      const d = new Date(newEvent.event_date);
      if (
        d >= monthStart &&
        d <= monthEnd &&
        newEvent.user_id === user?.id
      ) {
        setEvents(prev => [...prev, newEvent]);
      }
      // refresh to keep in sync (handles edits/defaults)
      loadEvents();
    },
    [loadEvents, monthStart, monthEnd, user?.id]
  );

  const onDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const openCreateForDay = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowEventForm(true);
  }, []);

  const onEventClick = useCallback((ev: Event) => {
    setSelectedEvent(ev);
    setShowEventDetails(true);
  }, []);

  const closeEventDetails = useCallback(() => {
    setSelectedEvent(null);
    setShowEventDetails(false);
  }, []);

  const navigateMonth = useCallback((dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const nd = new Date(prev);
      nd.setMonth(prev.getMonth() + (dir === 'prev' ? -1 : 1));
      return nd;
    });
  }, []);

  const navigateToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  // keyboard shortcuts: ← → for months, T for today
  const headerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigateMonth('prev');
      if (e.key === 'ArrowRight') navigateMonth('next');
      if (e.key.toLowerCase() === 't') navigateToToday();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateMonth, navigateToToday]);

  // reload when month changes
  useEffect(() => {
    if (user?.id) loadEvents();
  }, [monthStart, monthEnd, user?.id, loadEvents]);

  // --- Calendar grid ---------------------------------------------------------
  const daysInMonth = useMemo(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(),
    [currentDate]
  );
  const firstDayOffset = useMemo(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(),
    [currentDate]
  );

  const hasDbItemsOn = useCallback(
    (date: Date) => {
      const ds = toISODate(date);
      const dayEvents = events.filter(e => e.event_date === ds);
      return { count: dayEvents.length, hasEvents: dayEvents.length > 0 };
    },
    [events]
  );

  const isToday = (d: Date) => new Date().toDateString() === d.toDateString();
  const isSameDay = (d1: Date | null, d2: Date) => !!d1 && d1.toDateString() === d2.toDateString();

  const monthLabel = useMemo(
    () => currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [currentDate]
  );

  // --- Render ----------------------------------------------------------------
  return (
    <div className="h-screen overflow-y-auto pb-24">
      {/* Header */}
      <div className="bg-white p-6 border-b border-gray-200" ref={headerRef}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <p className="text-gray-600">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Merge toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700 mr-2 select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                checked={mergeGoogle}
                onChange={(e) => setMergeGoogle(e.target.checked)}
              />
              Merge Google events
            </label>

            <button
              onClick={syncWithGoogleCalendar}
              disabled={syncingCalendar}
              title={isGoogleConnected ? 'Sync Google Calendar' : 'Connect Google Calendar'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                isGoogleConnected ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {syncingCalendar ? <Sync className="w-5 h-5 animate-spin" /> : <CalendarIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowWhatsAppForm(true)}
              className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              title="Parse WhatsApp Message"
            >
              <Smartphone className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowEventForm(true)}
              className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
              title="Add Event"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Google status card */}
        <div
          className={`p-4 rounded-xl border-2 mb-4 ${
            isGoogleConnected ? 'bg-green-50 border-green-200' : error ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon
                className={`w-5 h-5 ${isGoogleConnected ? 'text-green-600' : error ? 'text-red-600' : 'text-blue-600'}`}
              />
              <div>
                <h3
                  className={`font-medium ${isGoogleConnected ? 'text-green-900' : error ? 'text-red-900' : 'text-blue-900'}`}
                >
                  Google Calendar {isGoogleConnected ? 'Connected' : error ? 'Error' : 'Integration'}
                </h3>
                <p className={`${isGoogleConnected ? 'text-green-700' : error ? 'text-red-700' : 'text-blue-700'} text-sm`}>
                  {isGoogleConnected
                    ? 'Your events sync automatically with Google Calendar'
                    : error
                    ? error
                    : 'Connect to sync your events with Google Calendar'}
                </p>
              </div>
            </div>
            {isGoogleConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={syncWithGoogleCalendar}
                  disabled={syncingCalendar}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {syncingCalendar ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Syncing…</span>
                    </>
                  ) : (
                    <>
                      <Sync className="w-3 h-3" />
                      <span>Sync</span>
                    </>
                  )}
                </button>
                <button
                  onClick={disconnectGoogleCalendar}
                  className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectGoogleCalendar}
                disabled={syncingCalendar || !isGoogleServiceReady}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {syncingCalendar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting…</span>
                  </>
                ) : !isGoogleServiceReady ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading…</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-yellow-800 text-xs font-bold">!</span>
              </div>
              <div>
                <h3 className="font-medium text-yellow-900 mb-1">Setup Required</h3>
                <p className="text-sm text-yellow-800 mb-2">To enable Google Calendar integration, you need to:</p>
                <ol className="text-sm text-yellow-800 list-decimal list-inside space-y-1">
                  <li>Create a Google Cloud Console project</li>
                  <li>Enable the Google Calendar API</li>
                  <li>Set up OAuth 2.0 credentials</li>
                  <li>Add VITE_GOOGLE_CLIENT_ID to your environment variables</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <button
            onClick={navigateToToday}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
          >
            Today
          </button>

          <button
            onClick={() => navigateMonth('next')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Month grid">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-sm font-medium text-gray-400 py-2" role="columnheader">
              {d}
            </div>
          ))}

          {/* leading blanks */}
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const selected = isSameDay(selectedDate, date);
            const today = isToday(date);
            const { hasEvents, count } = hasDbItemsOn(date);

            return (
              <div key={day} className="relative">
                <button
                  onClick={() => onDayClick(date)}
                  onDoubleClick={() => openCreateForDay(date)}
                  className={`w-full aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition-all relative focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${
                    selected
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : today
                      ? 'bg-purple-100 text-purple-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label={`Select ${date.toDateString()}`}
                >
                  <span className="mb-1">{day}</span>
                  {hasEvents && (
                    <div className="flex items-center gap-1" aria-label={`${count} events`}>
                      <div className={`${selected ? 'bg-white' : 'bg-blue-500'} w-2 h-2 rounded-full`} />
                      {count > 1 && (
                        <span className={`text-[10px] ${selected ? 'text-white' : 'text-blue-700'}`}>×{count}</span>
                      )}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => openCreateForDay(date)}
                  className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-purple-500/80 text-white flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="Quick add"
                  aria-label="Quick add event"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Selected day heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h2>
          {selectedDate && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCreateForDay(selectedDate)}
                className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
              >
                Add Event
              </button>
              <button
                onClick={() => setShowWhatsAppForm(true)}
                className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              >
                Parse WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <span className="ml-2 text-gray-600">Loading events…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-4 flex items-start gap-2">
            <Info className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && selectedDate && itemsForSelectedDate.events.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events</h3>
            <p className="text-gray-600 mb-4">No events scheduled for {selectedDate.toLocaleDateString()}</p>
            <button
              onClick={() => setShowEventForm(true)}
              className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
            >
              Add Event
            </button>
          </div>
        )}

        {/* Agenda for selected day */}
        {selectedDate && itemsForSelectedDate.events.length > 0 && (
          <div className="space-y-3">
            {itemsForSelectedDate.events.map((ev: any, idx: number) => {
              const isGoogle = 'id' in ev && ev.htmlLink !== undefined; // rough check

              if (isGoogle) {
                // Google item
                const title = ev.summary ?? 'Google Event';
                const start = ev.start?.dateTime ?? ev.start?.date;
                const end = ev.end?.dateTime ?? ev.end?.date;
                const time = start ? formatTimeRange(new Date(start).toTimeString().slice(0,5), end ? new Date(end).toTimeString().slice(0,5) : undefined) : '';
                return (
                  <div key={`g-${idx}`} className={`p-4 rounded-xl border-2 ${getEventBadge('meeting')} hover:shadow-md transition-all`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{title}</h4>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Google</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm opacity-75">
                          {time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{time}</span>
                            </div>
                          )}
                          {ev.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{ev.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              // DB event
              const e = ev as Event;
              return (
                <div
                  key={`e-${e.id}`}
                  className={`p-4 rounded-xl border-2 ${getEventBadge(e.event_type || 'other')} hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => onEventClick(e)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{e.title}</h4>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Event</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm opacity-75">
                        {e.start_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeRange(e.start_time, e.end_time ?? undefined)}</span>
                          </div>
                        )}
                        {e.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{e.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WhatsApp CTA */}
        <div
          className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => setShowWhatsAppForm(true)}
        >
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900 mb-1">WhatsApp Integration</h3>
              <p className="text-sm text-green-700 mb-2">Click to parse WhatsApp messages and create events automatically</p>
              <div className="bg-white p-3 rounded-lg border border-green-200 text-sm">
                <p className="text-gray-700 mb-2">
                  "Hi everyone! Sophia's 7th birthday party this Saturday 2-5pm at Chuck E. Cheese on Main Street. RSVP by Thursday! 🎂🎉"
                </p>
                <button
                  className="text-green-600 font-medium hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWhatsAppForm(true);
                  }}
                >
                  Parse Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forms */}
      <EventForm
        isOpen={showEventForm}
        defaultDate={selectedDate ? toISODate(selectedDate) : undefined}
        onClose={() => setShowEventForm(false)}
        onEventCreated={onEventCreated}
      />

      <WhatsAppIntegration
        isOpen={showWhatsAppForm}
        onClose={() => setShowWhatsAppForm(false)}
        onEventCreated={onEventCreated}
      />

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Event Details</h2>
                <button
                  onClick={closeEventDetails}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h3>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getEventBadge(selectedEvent.event_type || 'other')}`}>
                    {selectedEvent.event_type?.charAt(0).toUpperCase() + selectedEvent.event_type?.slice(1) || 'Other'}
                  </div>
                </div>

                {selectedEvent.description && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">Description</h4>
                    <p className="text-gray-600">{selectedEvent.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-gray-700">Date</p>
                      <p className="text-gray-600">
                        {new Date(selectedEvent.event_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {(selectedEvent.start_time || selectedEvent.end_time) && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium text-gray-700">Time</p>
                        <p className="text-gray-600">{formatTimeRange(selectedEvent.start_time, selectedEvent.end_time)}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium text-gray-700">Location</p>
                        <p className="text-gray-600">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}

                  {Array.isArray((selectedEvent as any).participants) && (selectedEvent as any).participants.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-700">Participants</p>
                        <p className="text-gray-600">{(selectedEvent as any).participants.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {(selectedEvent as any).rsvp_required && (
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium text-gray-700">RSVP Status</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              (selectedEvent as any).rsvp_status === 'yes'
                                ? 'bg-green-100 text-green-700'
                                : (selectedEvent as any).rsvp_status === 'no'
                                ? 'bg-red-100 text-red-700'
                                : (selectedEvent as any).rsvp_status === 'maybe'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {(selectedEvent as any).rsvp_status?.charAt(0).toUpperCase() + (selectedEvent as any).rsvp_status?.slice(1) || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedEvent.source === 'whatsapp'
                            ? 'bg-green-500'
                            : selectedEvent.source === 'calendar_sync'
                            ? 'bg-blue-500'
                            : 'bg-purple-500'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Source</p>
                      <p className="text-gray-600 capitalize">
                        {selectedEvent.source === 'calendar_sync' ? 'Calendar Sync' : selectedEvent.source || 'Manual'}
                      </p>
                    </div>
                  </div>
                </div>

                {(selectedEvent as any).rsvp_required && (
                  <div className="border-t pt-4 mt-6">
                    <h4 className="font-medium text-gray-700 mb-3">Quick Actions</h4>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">
                        <MessageCircle className="w-3 h-3" />
                        <span>RSVP Yes</span>
                      </button>
                      <button className="flex items-center gap-1 px-3 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors">
                        <Gift className="w-3 h-3" />
                        <span>Buy Gift</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
