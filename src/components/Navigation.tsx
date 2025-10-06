import React from 'react';
import { Home, Calendar, ShoppingBag, Users, Settings, MessageCircle, CheckSquare, FolderOpen } from 'lucide-react';
import { Screen } from '../App';
import { ThemeToggle } from './ThemeToggle';

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
    { id: 'family-folders' as Screen, icon: FolderOpen, label: 'Family' },
    { id: 'shopping' as Screen, icon: ShoppingBag, label: 'Shopping' },
    { id: 'tasks' as Screen, icon: CheckSquare, label: 'Tasks' },
    { id: 'contacts' as Screen, icon: Users, label: 'Contacts' },
    { id: 'settings' as Screen, icon: Settings, label: 'Settings' }
  ];

  return (
    <>
      {/* Top Navigation Bar with Theme Toggle */}
      <div className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-40 px-4 py-2">
        <div className="flex items-center justify-end">
          <ThemeToggle variant="icon" />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-pb">
        <div className="flex items-center justify-around py-1 sm:py-2 relative">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onScreenChange(item.id)}
              className={`flex flex-col items-center space-y-0.5 sm:space-y-1 py-1 sm:py-2 px-1 sm:px-3 rounded-lg transition-all ${
                currentScreen === item.id
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs font-medium hidden sm:block">{item.label}</span>
            </button>
          ))}

          {/* Voice Chat Button - Floating */}
          <button
            onClick={onVoiceChatOpen}
            className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="AI Voice Assistant"
          >
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </>
  );
}