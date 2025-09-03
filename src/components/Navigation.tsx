import React from 'react';
import { Home, Calendar, ShoppingBag, Users, Settings, MessageCircle } from 'lucide-react';
import { Screen } from '../App';

interface NavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  onSignOut: () => void;
  onVoiceChatOpen?: () => void;
}

export function Navigation({ currentScreen, onScreenChange, onVoiceChatOpen }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as Screen, icon: Home, label: 'Home' },
    { id: 'calendar' as Screen, icon: Calendar, label: 'Calendar' },
    { id: 'ai-chat' as Screen, icon: MessageCircle, label: 'AI Chat' },
    { id: 'shopping' as Screen, icon: ShoppingBag, label: 'Shopping' },
    { id: 'contacts' as Screen, icon: Users, label: 'Contacts' },
    { id: 'settings' as Screen, icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center justify-around py-3 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'ai-chat') {
                onVoiceChatOpen?.();
              } else {
                onScreenChange(item.id);
              }
            }}
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-xl transition-all min-w-0 flex-1 ${
              currentScreen === item.id
                ? 'text-purple-600 bg-purple-50 scale-105'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${
              item.id === 'ai-chat' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' 
                : ''
            }`}>
              <item.icon className={`w-5 h-5 ${item.id === 'ai-chat' ? 'text-white' : ''}`} />
            </div>
            <span className="text-xs font-medium truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}