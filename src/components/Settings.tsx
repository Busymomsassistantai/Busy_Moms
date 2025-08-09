import React, { useState } from 'react';
import { User, Bell, Shield, Smartphone, MessageCircle, CreditCard, HelpCircle, LogOut } from 'lucide-react';

export function Settings() {
  const [notifications, setNotifications] = useState({
    events: true,
    shopping: true,
    reminders: true,
    whatsapp: false
  });

  const settingSections = [
    {
      title: 'Family Profile',
      items: [
        {
          icon: User,
          title: 'Family Members',
          description: 'Emma (7), Tom (5)',
          action: 'Edit'
        },
        {
          icon: Shield,
          title: 'Privacy & Safety',
          description: 'Allergies, medical info, emergency contacts',
          action: 'Manage'
        }
      ]
    },
    {
      title: 'Integrations',
      items: [
        {
          icon: MessageCircle,
          title: 'WhatsApp Integration',
          description: 'Parse messages and images for events',
          toggle: true,
          enabled: notifications.whatsapp
        },
        {
          icon: Smartphone,
          title: 'Smartwatch',
          description: 'Apple Watch connected',
          action: 'Paired'
        }
      ]
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: Bell,
          title: 'Event Reminders',
          description: 'Get notified about upcoming events',
          toggle: true,
          enabled: notifications.events
        },
        {
          icon: Bell,
          title: 'Shopping Alerts',
          description: 'Auto-reorder and list reminders',
          toggle: true,
          enabled: notifications.shopping
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          icon: CreditCard,
          title: 'Subscription',
          description: 'Premium Plan - $9.99/month',
          action: 'Manage'
        },
        {
          icon: HelpCircle,
          title: 'Help & Support',
          description: 'FAQs, contact support',
          action: 'View'
        }
      ]
    }
  ];

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="h-screen overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sarah Johnson</h1>
            <p className="text-purple-100">sarah.johnson@email.com</p>
          </div>
        </div>
        
        <div className="bg-white bg-opacity-10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">Premium Plan</h3>
              <p className="text-sm text-purple-100">All features unlocked</p>
            </div>
            <div className="px-3 py-1 bg-white bg-opacity-20 rounded-full">
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* AI Personality Setting */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">AI Assistant Personality</h3>
          <div className="grid grid-cols-3 gap-2">
            {['Friendly', 'Professional', 'Humorous'].map((personality) => (
              <button
                key={personality}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  personality === 'Friendly'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-100'
                }`}
              >
                {personality}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                      </div>
                      
                      {item.toggle ? (
                        <button
                          onClick={() => toggleNotification(item.title.includes('WhatsApp') ? 'whatsapp' : item.title.includes('Event') ? 'events' : 'shopping')}
                          className={`w-12 h-6 rounded-full relative transition-all ${
                            item.enabled ? 'bg-purple-500' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${
                            item.enabled ? 'right-0.5' : 'left-0.5'
                          }`}></div>
                        </button>
                      ) : (
                        <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                          {item.action}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Background Check History */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Background Check History</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium text-gray-900">Maria Rodriguez</h3>
                <p className="text-sm text-gray-600">Completed March 10, 2025</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  ✓ Passed
                </div>
              </div>
            </div>
            <button className="text-purple-600 text-sm hover:underline">
              View Full Report
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <button className="w-full mt-8 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center space-x-2">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}