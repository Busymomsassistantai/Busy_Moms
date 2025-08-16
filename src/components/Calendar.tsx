import React, { useState } from 'react';
import { Plus, MapPin, Clock, Users, MessageCircle, Gift, Calendar as CalendarIcon, FolderSync as Sync, ExternalLink } from 'lucide-react';
import { EventForm } from './forms/EventForm';
import { Event } from '../lib/supabase';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

export function Calendar() {
  const [selectedDate, setSelectedDate] = useState(15);
  const [showEventForm, setShowEventForm] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleServiceReady, setIsGoogleServiceReady] = useState(false);

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

  const getDaysInMonth = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push(i);
    }
    return days;
  };

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <p className="text-gray-600">March 2025</p>
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

        {/* Mini Calendar */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
              {day}
            </div>
          ))}
          {getDaysInMonth().slice(0, 14).map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                day === selectedDate
                  ? 'bg-purple-500 text-white'
                  : day === 15
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Today's Events */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            March {selectedDate}, 2025
          </h2>
          
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-4 rounded-xl border-2 ${getEventColor(event.event_type || 'other')} hover:shadow-md transition-all cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{event.title}</h3>
                    <div className="flex items-center space-x-3 text-sm opacity-75 mb-2">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(event.start_time, event.end_time)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-sm opacity-75">
                      <Users className="w-4 h-4" />
                      <span>{event.participants?.join(', ') || 'No participants'}</span>
                    </div>
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

            {/* Google Calendar Events */}
            {isGoogleConnected && googleEvents.map((googleEvent) => {
              const appEvent = googleCalendarService.convertToAppEvent(googleEvent);
              return (
                <div
                  key={`google-${googleEvent.id}`}
                  className={`p-4 rounded-xl border-2 ${getEventColor(appEvent.event_type)} hover:shadow-md transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold">{appEvent.title}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          Google
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-sm opacity-75 mb-2">
                        {appEvent.start_time && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(appEvent.start_time, appEvent.end_time)}</span>
                          </div>
                        )}
                        {appEvent.location && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{appEvent.location}</span>
                          </div>
                        )}
                      </div>
                      {appEvent.participants.length > 0 && (
                        <div className="flex items-center space-x-1 text-sm opacity-75">
                          <Users className="w-4 h-4" />
                          <span>{appEvent.participants.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty state for Google Calendar */}
            {isGoogleConnected && googleEvents.length === 0 && events.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <CalendarIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-medium text-green-900 mb-1">Google Calendar Synced</h3>
                <p className="text-sm text-green-700">
                  No events found for the selected date
                </p>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Integration Alert */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <MessageCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900 mb-1">WhatsApp Integration</h3>
              <p className="text-sm text-green-700 mb-2">
                New invitation detected in Mom's Group chat
              </p>
              <div className="bg-white p-3 rounded-lg border border-green-200 text-sm">
                <p className="text-gray-700 mb-2">
                  "Hi everyone! Sophia's 7th birthday party this Saturday 2-5pm at Chuck E. Cheese on Main Street. RSVP by Thursday! 🎂🎉"
                </p>
                <button className="text-green-600 font-medium hover:underline">
                  Add to Calendar
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
    </div>
  );
}