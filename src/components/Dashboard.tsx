import React from 'react';
import { Calendar, ShoppingBag, MessageCircle, Clock, Heart, Gift, Car, Users } from 'lucide-react';
import { AIChat } from './AIChat';

export function Dashboard() {
  const [isChatOpen, setIsChatOpen] = React.useState(false);

  const todayEvents = [
    { time: '9:00 AM', title: 'Emma\'s Soccer Practice', location: 'Riverside Park' },
    { time: '2:00 PM', title: 'Pediatrician Appointment', location: 'Dr. Smith\'s Office' },
    { time: '4:00 PM', title: 'Jessica\'s Birthday Party', location: 'Community Center' }
  ];

  const quickActions = [
    { icon: Gift, title: 'Buy Gift', desc: 'For Jessica\'s party', color: 'from-pink-400 to-rose-400' },
    { icon: Car, title: 'Schedule Ride', desc: 'To soccer practice', color: 'from-blue-400 to-cyan-400' },
    { icon: ShoppingBag, title: 'Grocery Run', desc: '8 items needed', color: 'from-green-400 to-emerald-400' },
    { icon: MessageCircle, title: 'RSVP Party', desc: 'Due today', color: 'from-purple-400 to-violet-400' }
  ];

  const reminders = [
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
            <h1 className="text-2xl font-bold">Good Morning, Sarah!</h1>
            <p className="text-purple-100">Here's what's happening today</p>
          </div>
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
        </div>
        
        {/* Daily Summary */}
        <div className="bg-white bg-opacity-10 rounded-xl p-4">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>3 events</span>
            </div>
            <div className="flex items-center space-x-1">
              <ShoppingBag className="w-4 h-4" />
              <span>8 tasks</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>2 reminders</span>
            </div>
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
            {reminders.map((reminder, index) => (
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
    </div>
  );
}