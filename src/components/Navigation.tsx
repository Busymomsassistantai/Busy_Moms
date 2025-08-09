import React from 'react';
import { Home, Calendar, ShoppingBag, Users, Settings } from 'lucide-react';
import { Screen } from '../App';

interface NavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function Navigation({ currentScreen, onScreenChange }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as Screen, icon: Home, label: 'Home' },
    { id: 'calendar' as Screen, icon: Calendar, label: 'Calendar' },
    { id: 'shopping' as Screen, icon: ShoppingBag, label: 'Shopping' },
    { id: 'contacts' as Screen, icon: Users, label: 'Contacts' },
    { id: 'settings' as Screen, icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-all ${
              currentScreen === item.id
                ? 'text-purple-600 bg-purple-50'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}