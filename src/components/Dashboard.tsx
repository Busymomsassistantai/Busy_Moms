import React from 'react';
import { Calendar, ShoppingBag, MessageCircle, Clock, Heart, Gift, Users, LogOut, Smartphone, User, Sparkles } from 'lucide-react';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { DailyAffirmations } from './DailyAffirmations';
import { useAuth } from '../hooks/useAuth';
import { supabase, Profile, Event, ShoppingItem, Reminder, Affirmation } from '../lib/supabase';
import { affirmationService } from '../services/affirmationService';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

import { SubScreen } from '../App';

interface DashboardProps {
  onNavigate: (screen: 'calendar' | 'family' | 'more') => void;
  onNavigateToSubScreen: (screen: SubScreen) => void;
  onVoiceChatOpen?: () => void;
}

export function Dashboard({ onNavigate, onNavigateToSubScreen, onVoiceChatOpen }: DashboardProps) {
  const { signOut } = useAuth();
  const { user } = useAuth();
  const [isWhatsAppOpen, setIsWhatsAppOpen] = React.useState(false);
  const [showAffirmations, setShowAffirmations] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [showEventsPopup, setShowEventsPopup] = React.useState(false);
  const [showTasksPopup, setShowTasksPopup] = React.useState(false);
  const [showRemindersPopup, setShowRemindersPopup] = React.useState(false);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [todayEvents, setTodayEvents] = React.useState<Event[]>([]);
  const [googleEvents, setGoogleEvents] = React.useState<GoogleCalendarEvent[]>([]);
  const [syncedGoogleEventIds, setSyncedGoogleEventIds] = React.useState<Set<string>>(new Set());
  const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
  const [tasks, setTasks] = React.useState<ShoppingItem[]>([]);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [todayAffirmation, setTodayAffirmation] = React.useState<Affirmation | null>(null);

  // Load user profile
  React.useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted && !error && profileData) {
          setProfile(profileData);
        }
      } catch (error: any) {
        if (mounted) {
          console.error('Error loading profile:', error);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false
    }
  }, [user]);

  // Helper function to format time for display
  const formatEventTime = (timeString: string | null | undefined): string => {
    if (!timeString) return 'All day';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const minute = parseInt(minutes, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  // Load events, tasks, and reminders
  const loadDashboardData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Load upcoming events for next 7 days (for event count)
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', today)
        .lte('event_date', nextWeek)
        .order('event_date', { ascending: true });

      if (!eventsError) {
        setEvents(eventsData || []);

        // Filter today's local events
        const todayLocalEvents = (eventsData || [])
          .filter(event => event.event_date === today);

        // Load sync mappings to identify which Google events are already in local DB
        const { data: mappingsData } = await supabase
          .from('calendar_sync_mappings')
          .select('google_event_id')
          .eq('user_id', user.id);

        const googleIds = new Set((mappingsData || []).map(m => m.google_event_id));
        setSyncedGoogleEventIds(googleIds);

        // Check if Google Calendar is connected
        const connected = await googleCalendarService.isConnected(user.id);
        setIsGoogleConnected(connected);

        let todayGoogleEvents: GoogleCalendarEvent[] = [];
        if (connected) {
          try {
            // Load Google Calendar events for today
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const gEvents = await googleCalendarService.getEvents({
              timeMin: startOfDay.toISOString(),
              timeMax: endOfDay.toISOString(),
              maxResults: 50
            });

            // Filter out Google events that are already synced to local DB
            todayGoogleEvents = gEvents.filter(ev => {
              if (!ev.id || googleIds.has(ev.id)) return false;
              if (ev.start?.date) return ev.start.date === today;
              if (ev.start?.dateTime) return ev.start.dateTime.split('T')[0] === today;
              return false;
            });

            setGoogleEvents(todayGoogleEvents);
          } catch (error) {
            console.error('Error loading Google Calendar events:', error);
            setGoogleEvents([]);
          }
        } else {
          setGoogleEvents([]);
        }

        // Merge and sort all today's events
        const allTodayEvents = [...todayLocalEvents];

        // Convert Google events to a format compatible with Event type for display
        const googleEventsForDisplay = todayGoogleEvents.map(gEvent => ({
          id: gEvent.id || '',
          user_id: user.id,
          title: gEvent.summary || 'Untitled Event',
          description: gEvent.description || null,
          event_date: today,
          start_time: gEvent.start?.dateTime
            ? new Date(gEvent.start.dateTime).toTimeString().split(' ')[0]
            : null,
          end_time: gEvent.end?.dateTime
            ? new Date(gEvent.end.dateTime).toTimeString().split(' ')[0]
            : null,
          location: gEvent.location || null,
          participants: null,
          event_type: 'other' as const,
          source: 'google' as const,
          created_at: '',
          updated_at: '',
          is_google_event: true
        } as Event & { is_google_event?: boolean }));

        const mergedEvents = [...allTodayEvents, ...googleEventsForDisplay].sort((a, b) => {
          // Sort by start_time, putting all-day events (no start_time) first
          if (!a.start_time && !b.start_time) return 0;
          if (!a.start_time) return -1;
          if (!b.start_time) return 1;
          return a.start_time.localeCompare(b.start_time);
        });

        setTodayEvents(mergedEvents);
      }

      // Load incomplete shopping items (tasks)
      const { data: tasksData, error: tasksError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (!tasksError) {
        setTasks(tasksData || []);
      }

      // Load upcoming reminders (next 7 days)
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .gte('reminder_date', today)
        .lte('reminder_date', nextWeek)
        .order('reminder_date', { ascending: true })
        .order('reminder_time', { ascending: true });

      if (!remindersError) {
        setReminders(remindersData || []);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      loadDashboardData();
      loadTodayAffirmation();
    }
  }, [user]);

  const loadTodayAffirmation = async () => {
    try {
      let affirmation = await affirmationService.getTodaysAffirmation();

      if (!affirmation) {
        console.log('No affirmation for today, generating automatically...');
        affirmation = await affirmationService.generateAffirmation(false);
      }

      setTodayAffirmation(affirmation);
    } catch (error) {
      console.error('Error loading today\'s affirmation:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const quickActions = [
    { icon: Calendar, title: 'View Calendar', desc: 'See all your events', color: 'from-rose-400 to-pink-400', action: () => onNavigate('calendar') },
    { icon: ShoppingBag, title: 'Shopping List', desc: `${tasks.length} item${tasks.length === 1 ? '' : 's'} needed`, color: 'from-amber-400 to-orange-400', action: () => onNavigateToSubScreen('shopping') },
    { icon: Users, title: 'Family Hub', desc: 'Organize by family member', color: 'from-violet-400 to-purple-400', action: () => onNavigate('family') },
    { icon: MessageCircle, title: 'AI Assistant', desc: 'Get help with anything', color: 'from-fuchsia-400 to-pink-400', action: () => onVoiceChatOpen?.() }
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 text-white p-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Good Morning, {profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}!</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSignOut}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Heart className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
        
        {/* Daily Summary */}
        <div className="bg-white bg-opacity-10 rounded-xl p-3">
          <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm">
            <button 
              onClick={() => setShowEventsPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-1.5 py-1 rounded transition-colors"
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{events.length} events</span>
            </button>
            <button 
              onClick={() => setShowTasksPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-1.5 py-1 rounded transition-colors"
            >
              <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{tasks.length} shopping list</span>
            </button>
            <button 
              onClick={() => setShowRemindersPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-1.5 py-1 rounded transition-colors"
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{reminders.length} reminders</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 sm:p-6 sm:space-y-6">
        {/* Daily Affirmation */}
        {todayAffirmation && (
          <div
            onClick={() => setShowAffirmations(true)}
            className="bg-gradient-to-br from-rose-400 via-pink-400 to-orange-300 p-6 rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>

            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-5 h-5 text-white" />
                <span className="text-white font-semibold text-sm">Today's Affirmation</span>
              </div>

              <p className="text-white text-lg leading-relaxed mb-4">
                {todayAffirmation.affirmation_text}
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAffirmations(true);
                }}
                className="text-white text-sm font-medium hover:underline flex items-center space-x-1"
              >
                <span>View all affirmations</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {!todayAffirmation && (
          <div className="bg-gradient-to-br from-rose-100 to-pink-100 border-2 border-rose-300 p-6 rounded-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-rose-200 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Generating Your Daily Affirmation</h3>
                <p className="text-sm text-gray-600">Creating personalized encouragement based on your schedule...</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {quickActions.map((action, index) => (
              <div
                key={index}
                onClick={() => {
                  if (action.action) {
                    action.action();
                  }
                }}
                className="p-3 sm:p-4 rounded-xl bg-gradient-to-br shadow-sm hover:shadow-md transition-all cursor-pointer"
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <div className={`bg-gradient-to-br ${action.color} p-2 sm:p-3 rounded-xl mb-2 sm:mb-3 inline-block`}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{action.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Schedule */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Today's Schedule</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-rose-500"></div>
            </div>
          ) : todayEvents.length > 0 ? (
            <div className="space-y-3">
              {todayEvents.map((event) => {
                const isGoogleEvent = (event as any).is_google_event;
                return (
                  <div
                    key={event.id}
                    className={`p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                      isGoogleEvent
                        ? 'bg-gradient-to-br from-cyan-50 to-teal-50 border-2 border-cyan-200'
                        : 'bg-white border border-gray-100'
                    }`}
                    onClick={() => onNavigate('calendar')}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isGoogleEvent ? 'bg-cyan-100' : 'bg-rose-100'
                      }`}>
                        <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          isGoogleEvent ? 'text-cyan-600' : 'text-rose-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2 flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{event.title}</h3>
                            {isGoogleEvent && (
                              <div className="flex items-center space-x-1 px-2 py-0.5 bg-white rounded-full border border-cyan-300">
                                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                <span className="text-xs font-medium text-cyan-600">Google</span>
                              </div>
                            )}
                          </div>
                          <span className={`text-xs sm:text-sm font-medium ${
                            isGoogleEvent ? 'text-cyan-600' : 'text-rose-600'
                          }`}>{formatEventTime(event.start_time)}</span>
                        </div>
                        {event.location && (
                          <p className="text-xs sm:text-sm text-gray-600">{event.location}</p>
                        )}
                        {event.description && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-1">{event.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-gray-100 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">No events scheduled for today</p>
              <button
                onClick={() => onNavigate('calendar')}
                className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors"
              >
                Add Event
              </button>
            </div>
          )}
        </div>

        {/* Smart Reminders */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Smart Reminders</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-yellow-500"></div>
            </div>
          ) : reminders.length > 0 ? (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer">
                  <div className={`w-2 h-2 rounded-full ${reminder.priority === 'high' ? 'bg-red-400' : 'bg-yellow-400'}`}></div>
                  <div className="flex-1">
                    <span className="text-sm sm:text-base text-gray-800 font-medium">{reminder.title}</span>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                      {new Date(reminder.reminder_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                      {reminder.reminder_time && ` at ${formatEventTime(reminder.reminder_time)}`}
                    </div>
                    {reminder.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{reminder.description}</p>
                    )}
                  </div>
                  {reminder.priority === 'high' && (
                    <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      High Priority
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-gray-100 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">No upcoming reminders</p>
              <p className="text-xs text-gray-400">Ask Sarah to set reminders for you!</p>
            </div>
          )}
        </div>

        {/* AI Voice Assistant */}
        <div
          className="bg-gradient-to-r from-rose-50 to-pink-50 p-4 sm:p-6 rounded-xl border border-rose-100 cursor-pointer hover:shadow-md transition-all"
          onClick={() => onVoiceChatOpen?.()}
        >
          <div className="flex items-center space-x-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Sarah - Your Voice Assistant</h3>
              <p className="text-xs sm:text-sm text-gray-600">Talk to me anytime!</p>
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
            <p className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3">"Hey Sarah, what can you help me with today?"</p>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVoiceChatOpen?.();
                }}
                className="px-2 py-1 sm:px-3 bg-rose-100 text-rose-700 rounded-full text-xs sm:text-sm hover:bg-rose-200 transition-colors"
              >
                Add reminder for tomorrow
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVoiceChatOpen?.();
                }}
                className="px-2 py-1 sm:px-3 bg-rose-100 text-rose-700 rounded-full text-xs sm:text-sm hover:bg-rose-200 transition-colors"
              >
                Schedule dentist appointment
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVoiceChatOpen?.();
                }}
                className="px-2 py-1 sm:px-3 bg-rose-100 text-rose-700 rounded-full text-xs sm:text-sm hover:bg-rose-200 transition-colors"
              >
                Add milk to shopping list
              </button>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppIntegration
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        onEventCreated={(event) => {
          loadDashboardData();
        }}
      />

      {/* Events Popup */}
      {showEventsPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upcoming Events</h2>
                <button
                  onClick={() => setShowEventsPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-900 text-sm sm:text-base">{event.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {new Date(event.event_date).toLocaleDateString()} 
                        {event.start_time && ` at ${event.start_time}`}
                      </p>
                      {event.location && (
                        <p className="text-xs sm:text-sm text-gray-500">{event.location}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming events</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Popup */}
      {showTasksPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shopping List</h2>
                <button
                  onClick={() => setShowTasksPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-green-500"></div>
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base">{task.item}</h3>
                        {task.urgent && (
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        <p className="capitalize">{task.category}</p>
                        {(task as any).assigned_family_member && (
                          <div className="flex items-center space-x-1 mt-1">
                            <User className="w-3 h-3" />
                            <span className="text-xs">
                              For {(task as any).assigned_family_member.name}
                            </span>
                          </div>
                        )}
                      </div>
                      {task.quantity && task.quantity > 1 && (
                        <p className="text-xs sm:text-sm text-gray-500">Quantity: {task.quantity}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No pending items</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reminders Popup */}
      {showRemindersPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Upcoming Reminders</h2>
                <button
                  onClick={() => setShowRemindersPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : reminders.length > 0 ? (
                <div className="space-y-3">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 text-sm sm:text-base">{reminder.title}</h3>
                        {reminder.priority === 'high' && (
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            High Priority
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {new Date(reminder.reminder_date).toLocaleDateString()}
                        {reminder.reminder_time && ` at ${reminder.reminder_time}`}
                      </p>
                      {reminder.description && (
                        <p className="text-xs sm:text-sm text-gray-500">{reminder.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming reminders</p>
              )}
            </div>
          </div>
        </div>
      )}

      <DailyAffirmations
        isOpen={showAffirmations}
        onClose={() => {
          setShowAffirmations(false);
          loadTodayAffirmation();
        }}
      />
    </div>
  );
}