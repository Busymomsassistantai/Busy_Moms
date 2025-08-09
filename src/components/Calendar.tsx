import React, { useState } from 'react';
import { Plus, MapPin, Clock, Users, MessageCircle, Gift } from 'lucide-react';

export function Calendar() {
  const [selectedDate, setSelectedDate] = useState(15);

  const events = [
    {
      id: 1,
      title: 'Emma\'s Soccer Practice',
      time: '9:00 AM - 10:30 AM',
      location: 'Riverside Park',
      type: 'sports',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      participants: ['Emma']
    },
    {
      id: 2,
      title: 'Jessica\'s Birthday Party',
      time: '4:00 PM - 6:00 PM',
      location: 'Community Center',
      type: 'party',
      color: 'bg-pink-100 text-pink-800 border-pink-200',
      participants: ['Emma', 'Tom'],
      actions: ['Buy Gift', 'RSVP']
    },
    {
      id: 3,
      title: 'Parent-Teacher Conference',
      time: '2:00 PM - 2:30 PM',
      location: 'Lincoln Elementary',
      type: 'meeting',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      participants: ['Tom']
    }
  ];

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
          <button className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>

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
                className={`p-4 rounded-xl border-2 ${event.color} hover:shadow-md transition-all cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{event.title}</h3>
                    <div className="flex items-center space-x-3 text-sm opacity-75 mb-2">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-sm opacity-75">
                      <Users className="w-4 h-4" />
                      <span>{event.participants.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {event.actions && (
                  <div className="flex space-x-2 mt-3">
                    {event.actions.map((action) => (
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
    </div>
  );
}