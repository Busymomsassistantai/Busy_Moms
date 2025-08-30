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
import { supabase } from '../lib/supabase';
import type { Event as DbEvent } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

/**
 * Calendar
 * - Local date (no UTC drift)
 * - Month-range querying (lighter DB load)
 * - Keyboard navigation (← → T) & a11y labels
 * - Click-on-day to create event (pre-filled date)
 * - Inline agenda for selected day (sorted, handles all-day)
 * - Optional Google Calendar merge toggle (connect/disconnect)
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
  const [selectedEvent, setSelectedEvent] = useState<DbEvent | null>(null);
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
        .gte('event_date', toLocalISODate(monthStart))
        .lte('event_date', toLocalISODate(monthEnd))
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (qErr) throw qErr;
      setEvents(data ?? []);
    } catch (e) {
      console.error('❌ Error loading events:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, monthStart, monthEnd]);

  useEffect(() => {
    if (user?.id) loadEvents();
  }, [user?.id, loadEvents]);

  // --- Google Calendar bootstrapping & sync ---------------------------------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await googleCalendarService.initialize();
        if (mounted) {
          setIsGoogleServiceReady(true);
          setIsGoogleConnected(googleCalendarService.isSignedIn());
        }
      } catch (e) {
        console.error('Failed to init Google service', e);
        if (mounted) setIsGoogleServiceReady(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const connectGoogleCalendar = useCallback(async () => {
    try {
      setError(null);
      setSyncingCalendar(true);
      await googleCalendarService.signIn();
      setIsGoogleConnected(true);
    } catch (e) {
      console.error('Google connect error', e);
      setError(
        e instanceof Error ? e.message : 'Failed to connect to Google Calendar'
      );
    } finally {
      setSyncingCalendar(false);
    }
  }, []);

  const syncWithGoogleCalendar = useCallback(async () => {
    try {
      if (!isGoogleServiceReady) return;
      setSyncingCalendar(true);
      setError(null);

      // Ensure signed in, but avoid cross-calling connect->sync->connect cycles
      if (!googleCalendarService.isSignedIn()) {
        await googleCalendarService.signIn();
        setIsGoogleConnected(true);
      }

      const timeMin = new Date(monthStart);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(monthEnd);
      timeMax.setHours(23, 59, 59, 999);

      const gEvents =
        (await googleCalendarService.getEvents({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        })) ?? [];

      setGoogleEvents(gEvents);
    } catch (e) {
      console.error('Google sync error', e);
      setError(
        e instanceof Error ? e.message : 'Failed to sync Google Calendar'
      );
    } finally {
      setSyncingCalendar(false);
    }
  }, [isGoogleServiceReady, monthStart, monthEnd]);

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

  // Auto-sync when month changes (if enabled & ready)
  useEffect(() => {
    if (isGoogleServiceReady && mergeGoogle) {
      void syncWithGoogleCalendar();
    }
  }, [isGoogleServiceReady, mergeGoogle, monthStart, monthEnd, syncWithGoogleCalendar]);

  // --- Derived day agenda ----------------------------------------------------
  const itemsForSelectedDate = useMemo(() => {
    if (!selectedDate) return { events: [] as (DbEvent | GoogleCalendarEvent)[] };
    const d = toLocalISODate(selectedDate);

    const dayDbEvents = events.filter(ev => ev.event_date === d);

    const dayGoogleEvents = mergeGoogle
      ? googleEvents.filter(ge => {
          const raw = ge.start?.date ?? ge.start?.dateTime;
          if (!raw) return false;
          // For comparing by day only, UTC is fine here
          const isoDay = new Date(raw).toISOString().split('T')[0];
          return isoDay === d;
        })
      : [];

    const merged = [...dayDbEvents, ...dayGoogleEvents];

    const minutesKey = (it: any) => {
      // DB row: 'HH:MM' (string)
      if ('start_time' in it && it.start_time) {
        const [h, m] = String(it.start_time).split(':').map((n: string) => parseInt(n, 10));
        return (isNaN(h) ? 23 : h) * 60 + (isNaN(m) ? 59 : m);
      }
      // Google: dateTime or all-day date
      const s = it.start?.dateTime ?? it.start?.date;
      if (!s) return 24 * 60;
      const dt = new Date(s);
      return dt.getHours() * 60 + dt.getMinutes();
    };

    const sorted = merged.sort((a, b) => minutesKey(a) - minutesKey(b));
    return { events: sorted };
  }, [selectedDate, events, googleEvents, mergeGoogle]);

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
      const countDb = events.filter(ev => ev.event_date === d).length;
      const countG =
        mergeGoogle
          ? googleEvents.filter(ge => {
              const raw = ge.start?.date ?? ge.start?.dateTime;
              if (!raw) return false;
              return new Date(raw).toISOString().split('T')[0] === d;
            }).length
          : 0;
      return countDb + countG;
    },
    [events, googleEvents, mergeGoogle]
  );

  // --- UI --------------------------------------------------------------------
  return (
    <div className="w-full" onKeyDown={onKeyDown} tabIndex={0} aria-label="Calendar">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Previous month"
            onClick={goPrevMonth}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {monthLabel}
          </h2>
          <button
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Next month"
            onClick={goNextMonth}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            className="ml-2 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
            onClick={goToday}
            aria-label="Go to today"
          >
            Today (T)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEventForm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" /> New Event
          </button>

          <button
            onClick={() => setShowWhatsAppForm(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
            title="WhatsApp Integration"
          >
            <Smartphone className="w-4 h-4" /> WhatsApp
          </button>

          <div className="flex items-center gap-2 ml-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mergeGoogle}
                onChange={e => setMergeGoogle(e.target.checked)}
              />
              Merge Google
            </label>

            {isGoogleConnected ? (
              <button
                onClick={disconnectGoogleCalendar}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                title="Disconnect Google"
              >
                <X className="w-4 h-4" /> Disconnect
              </button>
            ) : (
              <button
                onClick={connectGoogleCalendar}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                title="Connect Google"
              >
                <Sync className="w-4 h-4" /> Connect
              </button>
            )}

            <button
              onClick={syncWithGoogleCalendar}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border"
              title="Sync Google now"
              disabled={!isGoogleServiceReady || !mergeGoogle || syncingCalendar}
            >
              {syncingCalendar ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Syncing…
                </>
              ) : (
                <>
                  <FolderSyncIcon /> Sync
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-red-800">
          <Info className="w-4 h-4 mt-0.5" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-1">
        {WEEKDAYS_SHORT.map((wd) => (
          <div key={wd} className="py-2">{wd}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-[1px] bg-gray-200 rounded overflow-hidden">
        {daysInGrid.map((day, idx) => {
          className="ml-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-sm font-medium text-gray-700 hover:text-purple-600 transition-all duration-200 shadow-sm"
          const isToday = isSameDay(day, new Date());
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const count = dayEventsCount(day);

          return (
            <button
              key={idx}
              onClick={() => onDayClick(day)}
              className={[
                'relative h-24 bg-white p-3 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 hover:bg-gray-50 transition-all duration-200 group',
                selected ? 'ring-2 ring-purple-500 bg-purple-50' : '',
              ].join(' ')}
              aria-label={`Day ${toLocalISODate(day)} (${count} events)`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${selected ? 'text-purple-700' : 'text-gray-700'} group-hover:text-purple-600 transition-colors`}>{day.getDate()}</span>
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  <span className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white text-[10px] px-2 py-1 font-medium shadow-sm">
                    Today
                  </span>
                )}
              </div>

              {count > 0 && (
                <div className="absolute bottom-1 left-1 right-1">
                  <div className={`text-[10px] font-medium ${selected ? 'text-purple-600' : 'text-gray-500'} group-hover:text-purple-600 transition-colors`}>
                    {count} event{count === 1 ? '' : 's'}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all duration-200"
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold">Agenda</h3>
          {selectedDate && (
            <span className="text-sm text-gray-500">
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading events…
          </div>
        ) : (
          <div className="space-y-2">
            {itemsForSelectedDate.events.length === 0 ? (
              <div className="text-sm text-gray-500">No events for this day.</div>
            ) : (
              itemsForSelectedDate.events.map((it: any, i) => {
                const isDb = 'id' in it && 'event_date' in it; // crude check
                if (isDb) {
                  const ev = it as DbEvent;
                  return (
                    <div
                      key={`db-${ev.id}-${i}`}
                      className={[
                        'border rounded p-2 text-sm flex items-start gap-2',
                        getEventBadge((ev as any).type),
                      ].join(' ')}
                    >
                      <Clock className="w-4 h-4 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold">{ev.title ?? 'Untitled event'}</div>
                        <div className="text-xs">
                          {formatTimeRange(ev.start_time, ev.end_time)}
                        </div>
                        {ev.location && (
                          <div className="text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </div>
                        )}
                        {ev.notes && (
                          <div className="text-xs mt-1 text-gray-700">
                            {ev.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  const ge = it as GoogleCalendarEvent;
                  const title =
                    ge.summary || (ge.id ? `Google event (${ge.id.slice(0, 6)}…)` : 'Google event');
                  const allDay = !!ge.start?.date && !ge.start?.dateTime;
                  const timeRange = allDay
                    ? 'All day'
                    : (() => {
                        const s = ge.start?.dateTime ?? ge.start?.date;
                        const e = ge.end?.dateTime ?? ge.end?.date;
                        if (!s) return '';
                        const fmt = (v?: string) =>
                          v
                            ? new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                            : '';
                        const left = fmt(s as string);
                        const right = fmt(e as string);
                        return right ? `${left} - ${right}` : left;
                      })();

                  return (
                    <div
                      key={`g-${ge.id ?? i}`}
                      className="border rounded p-2 text-sm flex items-start gap-2 bg-gray-100 text-gray-800 border-gray-200"
                    >
                      <CalendarIcon className="w-4 h-4 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold">{title}</div>
                        <div className="text-xs">{timeRange}</div>
                        {ge.location && (
                          <div className="text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ge.location}
                          </div>
                        )}
                      </div>
                      {ge.htmlLink && (
                        <a
                          href={ge.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline inline-flex items-center gap-1"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </a>
                      )}
                    </div>
                  );
                }
              })
            )}
          </div>
        )}
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Create / Edit Event</h4>
              <button
                onClick={() => setShowEventForm(false)}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Close event form"
              >
                <X className="w-5 h-5" />
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

      {/* WhatsApp modal */}
      {showWhatsAppForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">WhatsApp Integration</h4>
              <button
                onClick={() => setShowWhatsAppForm(false)}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Close WhatsApp modal"
              >
                <X className="w-5 h-5" />
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

/** Small icon alias for consistency with label */
function FolderSyncIcon() {
  return <Sync className="w-4 h-4" />;
}
