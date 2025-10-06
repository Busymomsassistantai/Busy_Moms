import React from 'react';
import { Home, Calendar, Users, Menu, MessageCircle } from 'lucide-react';
import { Screen } from '../App';

interface NavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  onSignOut: () => void;
  onVoiceChatOpen?: () => void;
}

export function ImprovedNavigation({ currentScreen, onScreenChange, onVoiceChatOpen }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as Screen, icon: Home, label: 'Home' },
    { id: 'calendar' as Screen, icon: Calendar, label: 'Calendar' },
    { id: 'family' as Screen, icon: Users, label: 'Family' },
    { id: 'more' as Screen, icon: Menu, label: 'More' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-theme-surface border-t border-theme-border z-50 safe-area-pb shadow-lg">
      <div className="flex items-center justify-around py-2 px-2 relative max-w-md mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onScreenChange(item.id)}
            className={`flex flex-col items-center space-y-1 py-2 px-4 rounded-xl transition-all min-w-[64px] ${
              currentScreen === item.id
                ? 'text-theme-primary bg-theme-secondary'
                : 'text-theme-fg opacity-60 hover:opacity-100 hover:bg-theme-secondary'
            }`}
            aria-label={item.label}
            aria-current={currentScreen === item.id ? 'page' : undefined}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}

        {onVoiceChatOpen && (
          <button
            onClick={onVoiceChatOpen}
            className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-14 h-14 bg-theme-accent text-theme-accent-fg rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
            title="AI Voice Assistant"
            aria-label="Open AI Voice Assistant"
          >
            <MessageCircle className="w-7 h-7" />
          </button>
        )}
      </div>
    </nav>
  );
}
