import React, { useState } from 'react';
import { Plus, MapPin, Clock, Users, MessageCircle, Gift, Calendar as CalendarIcon, FolderSync as Sync, ExternalLink, ChevronLeft, ChevronRight, Smartphone, X } from 'lucide-react';
import { EventForm } from './forms/EventForm';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { Event, Reminder, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

export function Calendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showEventForm, setShowEventForm] = useState(false);
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleServiceReady, setIsGoogleServiceReady] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDay = (date1: Date | null, date2: Date) => {
    if (!date1) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const hasItemsOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const dayEvents = events.filter(event => event.event_date === dateString);
    const dayReminders = reminders.filter(reminder => reminder.reminder_date === dateString);
    return { 
      hasEvents: dayEvents.length > 0, 
      hasReminders: dayReminders.length > 0, 
      count: dayEvents.length + dayReminders.length 
    };
  };
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="aspect-square"></div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isSelected = isSameDay(selectedDate, date);
      const isTodayDate = isToday(date);
      const { hasEvents, hasReminders, count } = hasItemsOnDate(date);

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition-all hover:bg-gray-100 relative ${
            isSelected
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : isTodayDate
              ? 'bg-purple-100 text-purple-700 font-semibold'
              : 'text-gray-700'
          }`}
        >
          <span className="mb-1">{day}</span>
          {(hasEvents || hasReminders) && (
            <div className="flex space-x-1">
              {hasEvents && (
                <div className={`w-2 h-2 rounded-full ${
                  isSelected ? 'bg-white' : 'bg-blue-500'
                }`}></div>
              )}
            </div>
          )}
        </button>
      );
    }

    return days;
  };

  const getEventColor = (type: string) => {
    const colors = {
      sports: 'bg-blue-100 text-blue-800 border-blue-200',
      party: 'bg-pink-100 text-pink-800 border-pink-200',
      meeting: 'bg-purple-100 text-purple-800 border-purple-200',
      medical: 'bg-red-100 text-red-800 border-red-200',
      school: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      family: 'bg-green-100 text-green-800 border-green-200',
      other: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const formatTime = (startTime?: string, endTime?: string) => {
    if (!startTime) return '';
    const start = new Date(`2000-01-01T${startTime}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    if (endTime) {
      const end = new Date(`2000-01-01T${endTime}`).toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      return `${start} - ${end}`;
    }
    return start;
  };

  const handleEventCreated = (newEvent: Event) => {
    setEvents(prev => [...prev, newEvent]);
    loadEventsAndReminders(); // Reload to get fresh data
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setSelectedReminder(null);
    setShowEventDetails(true);
  };

  const handleReminderClick = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setSelectedEvent(null);
    setShowEventDetails(true);
  };

  const closeEventDetails = () => {
    setSelectedEvent(null);
    setSelectedReminder(null);
    setShowEventDetails(false);
  };

  // Load events and reminders from database
  const loadEventsAndReminders = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      console.log('📅 Loading events and reminders for user:', user.id);
      
      // Load events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (eventsError) {
        console.error('❌ Error loading events:', eventsError);
      } else {
        console.log('✅ Loaded events:', eventsData);
        setEvents(eventsData || []);
      }

      // Load reminders
      const { data: remindersData, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('reminder_date', { ascending: true });

      if (remindersError) {
        console.error('❌ Error loading reminders:', remindersError);
      } else {
        console.log('✅ Loaded reminders:', remindersData);
        setReminders(remindersData || []);
      }
    } catch (error) {
      console.error('❌ Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts or user changes
  React.useEffect(() => {
    if (user) {
      loadEventsAndReminders();
    }
  }, [user]);

  // Filter events and reminders for selected date
  const getItemsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    
    const dayEvents = events.filter(event => event.event_date === dateString);
    const dayReminders = reminders.filter(reminder => reminder.reminder_date === dateString);
    
    return { events: dayEvents, reminders: dayReminders };
  };

  const connectGoogleCalendar = async () => {
    try {
      setError(null);
      setSyncingCalendar(true);
      
      // Sign in to Google Calendar
      await googleCalendarService.signIn();
      
      setIsGoogleConnected(true);
      setSyncingCalendar(false);
      
      // Automatically sync events after connection
      await syncWithGoogleCalendar();
      
    } catch (error) {
      console.error('Failed to connect Google Calendar:', error);
      setSyncingCalendar(false);
      setError(error instanceof Error ? error.message : 'Failed to connect to Google Calendar');
    }
  };

  const syncWithGoogleCalendar = async () => {
    if (!isGoogleConnected) {
      connectGoogleCalendar();
      return;
    }

    try {
      setSyncingCalendar(true);
      setError(null);
      
      if (!googleCalendarService.isSignedIn()) {
        await connectGoogleCalendar();
        return;
      }
      
      // Fetch events from Google Calendar
      const fetchedEvents = await googleCalendarService.getEvents();
      setGoogleEvents(fetchedEvents);
      
      setSyncingCalendar(false);
      
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      setSyncingCalendar(false);
      setError(error instanceof Error ? error.message : 'Failed to sync calendar');
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      await googleCalendarService.signOut();
      setIsGoogleConnected(false);
      setGoogleEvents([]);
      setError(null);
    } catch (error) {
      console.error('Failed to disconnect Google Calendar:', error);
      setError('Failed to disconnect from Google Calendar');
    }
  };

  // Check if user is already signed in on component mount
  React.useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        await googleCalendarService.initialize();
        setIsGoogleServiceReady(true);
        if (googleCalendarService.isSignedIn()) {
          setIsGoogleConnected(true);
          await syncWithGoogleCalendar();
        }
      } catch (error) {
        console.error('Failed to check Google auth status:', error);
        setIsGoogleServiceReady(false);
      }
    };
    
    checkGoogleAuth();
  }, []);

  return (
    <div className="h-screen overflow-y-auto pb-24">
      {/* Header */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <p className="text-gray-600">{getMonthName(currentDate)}</p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={syncWithGoogleCalendar}
              disabled={syncingCalendar}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isGoogleConnected 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50`}
            >
              {syncingCalendar ? (
                <Sync className="w-5 h-5 animate-spin" />
              ) : (
                <CalendarIcon className="w-5 h-5" />
              )}
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
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Google Calendar Integration Status */}
        <div className={`p-4 rounded-xl border-2 mb-4 ${
          isGoogleConnected 
            ? 'bg-green-50 border-green-200' 
            : error 
            ? 'bg-red-50 border-red-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon className={`w-5 h-5 ${
                isGoogleConnected ? 'text-green-600' : error ? 'text-red-600' : 'text-blue-600'
              }`} />
              <div>
                <h3 className={`font-medium ${
                  isGoogleConnected ? 'text-green-900' : error ? 'text-red-900' : 'text-blue-900'
                }`}>
                  Google Calendar {isGoogleConnected ? 'Connected' : error ? 'Error' : 'Integration'}
                </h3>
                <p className={`text-sm ${
                  isGoogleConnected ? 'text-green-700' : error ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {isGoogleConnected 
                    ? 'Your events sync automatically with Google Calendar'
                    : error 
                    ? error
                    : 'Connect to sync your events with Google Calendar'
                  }
                </p>
              </div>
            </div>
            {isGoogleConnected ? (
              <div className="flex space-x-2">
                <button
                  onClick={syncWithGoogleCalendar}
                  disabled={syncingCalendar}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center space-x-1"
                >
                  {syncingCalendar ? (
                    <>
                      <Sync className="w-3 h-3 animate-spin" />
                      <span>Syncing...</span>
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
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {syncingCalendar ? (
                  <>
                    <Sync className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : !isGoogleServiceReady ? (
                  <>
                    <Sync className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
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

        {/* Environment Variable Warning */}
        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-yellow-800 text-xs font-bold">!</span>
              </div>
              <div>
                <h3 className="font-medium text-yellow-900 mb-1">Setup Required</h3>
                <p className="text-sm text-yellow-800 mb-2">
                  To enable Google Calendar integration, you need to:
                </p>
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
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
              {day}
            </div>
          ))}

          {/* Display events and reminders for selected date */}
          {selectedDate && (() => {
            const { events: dayEvents, reminders: dayReminders } = getItemsForDate(selectedDate);
            
            return (
              <>
                {/* Database Events */}
                {dayEvents.map((event) => (
                  <div
                    key={`event-${event.id}`}
                    className={`p-4 rounded-xl border-2 ${getEventColor(event.event_type || 'other')} hover:shadow-md transition-all cursor-pointer`}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            Event
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm opacity-75 mb-2">{event.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-sm opacity-75 mb-2">
                          {event.start_time && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(event.start_time, event.end_time)}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                        {event.participants && event.participants.length > 0 && (
                          <div className="flex items-center space-x-1 text-sm opacity-75">
                            <Users className="w-4 h-4" />
                            <span>{event.participants.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {event.rsvp_required && (
                      <div className="flex space-x-2 mt-3">
                        {['Buy Gift', 'RSVP'].map((action) => (
                          <button
                            key={action}
                            className="flex items-center space-x-1 px-3 py-1 bg-white bg-opacity-50 rounded-full text-sm font-medium hover:bg-opacity-75 transition-colors"
                          >
                            {action === 'Buy Gift' && <Gift className="w-3 h-3" />}
                            {action === 'RSVP' && <MessageCircle className="w-3 h-3" />}
                            <span>{action}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Database Reminders */}
                {dayReminders.map((reminder) => (
                  <div
                    key={`reminder-${reminder.id}`}
                    className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-200 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{reminder.title}</h3>
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            Reminder
                          </span>
                          {reminder.priority === 'high' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              High Priority
                            </span>
                          )}
                        </div>
                        {reminder.description && (
                          <p className="text-sm text-gray-600 mb-2">{reminder.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          {reminder.reminder_time && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{new Date(`2000-01-01T${reminder.reminder_time}`).toLocaleTimeString([], { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}</span>
                            </div>
                          )}
                          {reminder.recurring && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {reminder.recurring_pattern}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
          {renderCalendarDays()}
          
          {/* Display events and reminders for selected date in calendar grid */}
          {selectedDate && (() => {
            const { events: dayEvents, reminders: dayReminders } = getItemsForDate(selectedDate);
            
            return (
              <>
                {/* Database Events */}
                {dayEvents.map((event) => (
                  <div
                    key={`event-${event.id}`}
                    className={`p-4 rounded-xl border-2 ${getEventColor(event.event_type || 'other')} hover:shadow-md transition-all cursor-pointer`}
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            Event
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm opacity-75 mb-2">{event.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-sm opacity-75 mb-2">
                          {event.start_time && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(event.start_time, event.end_time)}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-4 h-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                        {event.participants && event.participants.length > 0 && (
                          <div className="flex items-center space-x-1 text-sm opacity-75">
                            <Users className="w-4 h-4" />
                            <span>{event.participants.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {event.rsvp_required && (
                      <div className="flex space-x-2 mt-3">
                        {['Buy Gift', 'RSVP'].map((action) => (
                          <button
                            key={action}
                            className="flex items-center space-x-1 px-3 py-1 bg-white bg-opacity-50 rounded-full text-sm font-medium hover:bg-opacity-75 transition-colors"
                          >
                            {action === 'Buy Gift' && <Gift className="w-3 h-3" />}
                            {action === 'RSVP' && <MessageCircle className="w-3 h-3" />}
                            <span>{action}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Database Reminders */}
                {dayReminders.map((reminder) => (
                  <div
                    key={`reminder-${reminder.id}`}
                    className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-200 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleReminderClick(reminder)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{reminder.title}</h3>
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            Reminder
                          </span>
                          {reminder.priority === 'high' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              High Priority
                            </span>
                          )}
                        </div>
                        {reminder.description && (
                          <p className="text-sm text-gray-600 mb-2">{reminder.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          {reminder.reminder_time && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{new Date(`2000-01-01T${reminder.reminder_time}`).toLocaleTimeString([], { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}</span>
                            </div>
                          )}
                          {reminder.recurring && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {reminder.recurring_pattern}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </div>

      <div className="p-6">
        {/* Selected Date Events and Reminders */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedDate ? selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) : 'Select a date'}
          </h2>
          
          <div className="space-y-4">
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-2 text-gray-600">Loading events...</span>
              </div>
            )}

            {/* Empty state for no events */}
            {!loading && selectedDate && (() => {
              const { events: dayEvents, reminders: dayReminders } = getItemsForDate(selectedDate);
              return dayEvents.length === 0 && dayReminders.length === 0 && googleEvents.length === 0;
            })() && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No events or reminders</h3>
                <p className="text-gray-600 mb-4">
                  No events or reminders scheduled for {selectedDate.toLocaleDateString()}
                </p>
                <button
                  onClick={() => setShowEventForm(true)}
                  className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
                >
                  Add Event
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Event List for Selected Date */}
        {selectedDate && (() => {
          const { events: dayEvents, reminders: dayReminders } = getItemsForDate(selectedDate);
          return (
            <div className="text-center text-gray-500 text-sm">
              Click on events in the calendar grid above to view details, or use the "+" button to add new events.
              <br />
              {dayEvents.length + dayReminders.length > 0 && `${dayEvents.length + dayReminders.length} item(s) scheduled for this date.`}
            </div>
          );
        })()}

        {/* WhatsApp Integration Alert */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 cursor-pointer hover:bg-green-100 transition-colors" onClick={() => setShowWhatsAppForm(true)}>
          <div className="flex items-start space-x-3">
            <MessageCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900 mb-1">WhatsApp Integration</h3>
              <p className="text-sm text-green-700 mb-2">
                Click to parse WhatsApp messages and create events automatically
              </p>
              <div className="bg-white p-3 rounded-lg border border-green-200 text-sm">
                <p className="text-gray-700 mb-2">
                  "Hi everyone! Sophia's 7th birthday party this Saturday 2-5pm at Chuck E. Cheese on Main Street. RSVP by Thursday! 🎂🎉"
                </p>
                <button className="text-green-600 font-medium hover:underline" onClick={(e) => {
                  e.stopPropagation();
                  setShowWhatsAppForm(true);
                }}>
                  Parse Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EventForm
        isOpen={showEventForm}
        onClose={() => setShowEventForm(false)}
        onEventCreated={handleEventCreated}
      />

      <WhatsAppIntegration
        isOpen={showWhatsAppForm}
        onClose={() => setShowWhatsAppForm(false)}
        onEventCreated={handleEventCreated}
      />

      {/* Event Details Modal */}
      {showEventDetails && (selectedEvent || selectedReminder) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedEvent ? 'Event Details' : 'Reminder Details'}
                </h2>
                <button
                  onClick={closeEventDetails}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Event Details */}
              {selectedEvent && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h3>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getEventColor(selectedEvent.event_type || 'other')}`}>
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
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium text-gray-700">Date</p>
                        <p className="text-gray-600">{new Date(selectedEvent.event_date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</p>
                      </div>
                    </div>

                    {(selectedEvent.start_time || selectedEvent.end_time) && (
                      <div className="flex items-center space-x-3">
                        <Clock className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-700">Time</p>
                          <p className="text-gray-600">{formatTime(selectedEvent.start_time, selectedEvent.end_time)}</p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.location && (
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-700">Location</p>
                          <p className="text-gray-600">{selectedEvent.location}</p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                      <div className="flex items-start space-x-3">
                        <Users className="w-5 h-5 text-purple-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-700">Participants</p>
                          <p className="text-gray-600">{selectedEvent.participants.join(', ')}</p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.rsvp_required && (
                      <div className="flex items-center space-x-3">
                        <MessageCircle className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-700">RSVP Status</p>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              selectedEvent.rsvp_status === 'yes' ? 'bg-green-100 text-green-700' :
                              selectedEvent.rsvp_status === 'no' ? 'bg-red-100 text-red-700' :
                              selectedEvent.rsvp_status === 'maybe' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {selectedEvent.rsvp_status?.charAt(0).toUpperCase() + selectedEvent.rsvp_status?.slice(1) || 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          selectedEvent.source === 'whatsapp' ? 'bg-green-500' :
                          selectedEvent.source === 'calendar_sync' ? 'bg-blue-500' :
                          'bg-purple-500'
                        }`}></div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Source</p>
                        <p className="text-gray-600 capitalize">
                          {selectedEvent.source === 'calendar_sync' ? 'Calendar Sync' : selectedEvent.source || 'Manual'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.rsvp_required && (
                    <div className="border-t pt-4 mt-6">
                      <h4 className="font-medium text-gray-700 mb-3">Quick Actions</h4>
                      <div className="flex space-x-2">
                        <button className="flex items-center space-x-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">
                          <MessageCircle className="w-3 h-3" />
                          <span>RSVP Yes</span>
                        </button>
                        <button className="flex items-center space-x-1 px-3 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors">
                          <Gift className="w-3 h-3" />
                          <span>Buy Gift</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reminder Details */}
              {selectedReminder && (
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedReminder.title}</h3>
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                      Reminder
                    </span>
                    {selectedReminder.priority === 'high' && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        High Priority
                      </span>
                    )}
                  </div>

                  {selectedReminder.description && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Description</h4>
                      <p className="text-gray-600">{selectedReminder.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="font-medium text-gray-700">Date</p>
                        <p className="text-gray-600">{new Date(selectedReminder.reminder_date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</p>
                      </div>
                    </div>

                    {selectedReminder.reminder_time && (
                      <div className="flex items-center space-x-3">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium text-gray-700">Time</p>
                          <p className="text-gray-600">{new Date(`2000-01-01T${selectedReminder.reminder_time}`).toLocaleTimeString([], { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}</p>
                        </div>
                      </div>
                    )}

                    {selectedReminder.priority && (
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <div className={`w-3 h-3 rounded-full ${
                            selectedReminder.priority === 'high' ? 'bg-red-500' :
                            selectedReminder.priority === 'medium' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}></div>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">Priority</p>
                          <p className="text-gray-600 capitalize">{selectedReminder.priority}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          selectedReminder.recurring ? 'bg-blue-500' : 'bg-gray-500'
                        }`}></div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Recurring</p>
                        <p className="text-gray-600">
                          {selectedReminder.recurring ? selectedReminder.recurring_pattern || 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}