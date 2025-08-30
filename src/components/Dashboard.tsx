import React from 'react';
import { Calendar, ShoppingBag, MessageCircle, Clock, Heart, Gift, Car, Users, LogOut, Smartphone, Phone } from 'lucide-react';
import { AIChat } from './AIChat';
import { WhatsAppIntegration } from './WhatsAppIntegration';
import { VoiceChat } from './VoiceChat';
import { useAuth } from '../hooks/useAuth';
import { supabase, Profile, Event, ShoppingItem, Reminder } from '../lib/supabase';
import { speechService } from '../services/speechService'

interface DashboardProps {
  onNavigate: (screen: 'dashboard' | 'calendar' | 'contacts' | 'shopping' | 'settings' | 'ai-chat') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { signOut } = useAuth();
  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = React.useState(false);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [showEventsPopup, setShowEventsPopup] = React.useState(false);
  const [showTasksPopup, setShowTasksPopup] = React.useState(false);
  const [showRemindersPopup, setShowRemindersPopup] = React.useState(false);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [tasks, setTasks] = React.useState<ShoppingItem[]>([]);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [welcomeSpoken, setWelcomeSpoken] = React.useState(false)

  // Load user profile
  React.useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      try {
        // Add timeout for profile loading
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
          .abortSignal(controller.signal);
        
        clearTimeout(timeoutId)
        if (!error && profileData) {
          setProfile(profileData);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn('Profile loading timeout')
        } else {
          console.error('Error loading profile:', error);
        }
      }
    };
    
    loadProfile();
  }, [user]);

  // Welcome message when user first loads dashboard
  React.useEffect(() => {
    if (profile && !welcomeSpoken && speechService.isSupported()) {
      const welcomeMessage = `Welcome back, ${profile.full_name || 'there'}! I'm ready to help you manage your day.`;
      speechService.speakNotification(welcomeMessage);
      setWelcomeSpoken(true);
    }
  }, [profile, welcomeSpoken]);

  // Load events, tasks, and reminders
  const loadDashboardData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Load upcoming events (next 7 days)
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', today)
        .lte('event_date', nextWeek)
        .order('event_date', { ascending: true });

      if (!eventsError) {
        setEvents(eventsData || []);
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

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const todayEvents = [
    { time: '9:00 AM', title: 'Emma\'s Soccer Practice', location: 'Riverside Park' },
    { time: '2:00 PM', title: 'Pediatrician Appointment', location: 'Dr. Smith\'s Office' },
    { time: '4:00 PM', title: 'Jessica\'s Birthday Party', location: 'Community Center' }
  ];

  const quickActions = [
    { icon: Gift, title: 'Buy Gift', desc: 'For Jessica\'s party', color: 'from-pink-400 to-rose-400', action: null },
    { icon: Car, title: 'Schedule Ride', desc: 'To soccer practice', color: 'from-blue-400 to-cyan-400', action: null },
    { icon: ShoppingBag, title: 'Grocery Run', desc: '8 items needed', color: 'from-green-400 to-emerald-400', action: () => onNavigate('shopping') },
    { icon: Smartphone, title: 'Parse WhatsApp', desc: 'Add events from messages', color: 'from-green-400 to-emerald-400', action: () => setIsWhatsAppOpen(true) },
    { icon: Phone, title: 'Family Voice Chat', desc: 'Connect with family members', color: 'from-purple-400 to-indigo-400', action: () => setIsVoiceChatOpen(true) }
  ];

  const sampleReminders = [
    'Pack Emma\'s water bottle',
    'Buy birthday gift for Jessica',
    'Schedule parent-teacher conference',
    'Refill prescription for Tom'
  ];

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Good Morning, {profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}!</h1>
            <div className="grid grid-cols-2 gap-3">
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSignOut}
              className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
          </div>
        </div>
        
        {/* Daily Summary */}
        <div className="bg-white bg-opacity-10 rounded-xl p-4">
          <div className="flex items-center space-x-4 text-sm">
            <button 
              onClick={() => setShowEventsPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>{events.length} events</span>
            </button>
            <button 
              onClick={() => setShowTasksPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{tasks.length} shopping list</span>
            </button>
            <button 
              onClick={() => setShowRemindersPopup(true)}
              className="flex items-center space-x-1 hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span>{reminders.length} reminders</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <div
                key={index}
                onClick={() => {
                  if (action.action) {
                    action.action();
                  }
                }}
                className="p-4 rounded-xl bg-gradient-to-br shadow-sm hover:shadow-md transition-all cursor-pointer"
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <div className={`bg-gradient-to-br ${action.color} p-3 rounded-xl mb-3 inline-block`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Schedule */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Schedule</h2>
          <div className="space-y-3">
            {todayEvents.map((event, index) => (
              <div key={index} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      <span className="text-sm text-purple-600 font-medium">{event.time}</span>
                    </div>
                    <p className="text-sm text-gray-600">{event.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Reminders */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Smart Reminders</h2>
          <div className="space-y-2">
            {reminders.length > 0 ? reminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <div className="flex-1">
                  <span className="text-gray-800">{reminder.title}</span>
                  <div className="text-sm text-gray-600 mt-1">
                    {new Date(reminder.reminder_date).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric' 
                    })}
                    {reminder.reminder_time && ` at ${reminder.reminder_time}`}
                  </div>
                </div>
                {reminder.priority === 'high' && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    High Priority
                  </span>
                )}
              </div>
            )) : sampleReminders.map((reminder, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-800">{reminder}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Assistant */}
        <div 
          className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100 cursor-pointer hover:shadow-md transition-all"
          onClick={() => setIsChatOpen(true)}
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Your AI Assistant</h3>
              <p className="text-sm text-gray-600">Ask me anything!</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-gray-700 mb-3">"What can I help you with today?"</p>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsChatOpen(true);
                }}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
              >
                Add reminder
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsChatOpen(true);
                }}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
              >
                Schedule event
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsChatOpen(true);
                }}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
              >
                Shopping list
              </button>
            </div>
          </div>
        </div>
      </div>

      <AIChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <WhatsAppIntegration 
        isOpen={isWhatsAppOpen} 
        onClose={() => setIsWhatsAppOpen(false)}
        onEventCreated={(event) => {
          setEvents(prev => [...prev, event]);
        }}
      />
      <VoiceChat 
        isOpen={isVoiceChatOpen} 
        onClose={() => setIsVoiceChatOpen(false)}
        roomId="family-chat"
      />

      {/* Events Popup */}
      {showEventsPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upcoming Events</h2>
                <button
                  onClick={() => setShowEventsPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="p-3 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(event.event_date).toLocaleDateString()} 
                        {event.start_time && ` at ${event.start_time}`}
                      </p>
                      {event.location && (
                        <p className="text-sm text-gray-500">{event.location}</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Shopping List</h2>
                <button
                  onClick={() => setShowTasksPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">{task.item}</h3>
                        {task.urgent && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 capitalize">{task.category}</p>
                      {task.quantity && task.quantity > 1 && (
                        <p className="text-sm text-gray-500">Quantity: {task.quantity}</p>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Upcoming Reminders</h2>
                <button
                  onClick={() => setShowRemindersPopup(false)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : reminders.length > 0 ? (
                <div className="space-y-3">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">{reminder.title}</h3>
                        {reminder.priority === 'high' && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            High Priority
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {new Date(reminder.reminder_date).toLocaleDateString()}
                        {reminder.reminder_time && ` at ${reminder.reminder_time}`}
                      </p>
                      {reminder.description && (
                        <p className="text-sm text-gray-500">{reminder.description}</p>
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
    </div>
  );
}