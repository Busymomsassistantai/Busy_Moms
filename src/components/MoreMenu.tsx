import React from 'react';
import { Settings, HelpCircle, Info, Bell, MessageCircle, Shield, CreditCard, LogOut, Sparkles } from 'lucide-react';
import { NavigationHeader } from './NavigationHeader';
import { SubScreen } from '../App';

interface MoreMenuProps {
  onNavigateToSubScreen: (screen: SubScreen) => void;
  onSignOut: () => void;
  userName?: string;
  userEmail?: string;
}

export function MoreMenu({ onNavigateToSubScreen, onSignOut, userName, userEmail }: MoreMenuProps) {
  const menuSections = [
    {
      title: 'Settings',
      items: [
        {
          id: 'settings' as SubScreen,
          icon: Settings,
          title: 'App Settings',
          description: 'Preferences and configuration'
        }
      ]
    },
    {
      title: 'Features',
      items: [
        {
          icon: Sparkles,
          title: 'Daily Affirmations',
          description: 'Manage your daily encouragement',
          action: () => window.dispatchEvent(new CustomEvent('open-affirmations'))
        },
        {
          icon: Bell,
          title: 'Notifications',
          description: 'Manage alerts and reminders',
          action: () => onNavigateToSubScreen('settings' as SubScreen)
        }
      ]
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          title: 'Help & Support',
          description: 'Get help and contact support'
        },
        {
          icon: Info,
          title: 'About',
          description: 'App version and information'
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-theme-bg pb-24">
      <NavigationHeader
        title="More"
        subtitle="Additional features and settings"
      />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {userName && (
          <div className="bg-theme-primary text-theme-primary-fg rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-theme-primary-fg bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{userName}</h2>
                <p className="opacity-80">{userEmail}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="text-sm font-semibold text-theme-fg opacity-60 uppercase tracking-wider mb-3 px-2">
                {section.title}
              </h3>
              <div className="bg-theme-surface rounded-2xl border border-theme-border divide-y divide-theme-border">
                {section.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else if ('id' in item) {
                        onNavigateToSubScreen(item.id);
                      }
                    }}
                    className="w-full px-4 py-4 hover:bg-theme-secondary transition-colors text-left flex items-center space-x-4 group"
                  >
                    <div className="w-10 h-10 bg-theme-secondary rounded-lg flex items-center justify-center group-hover:bg-theme-accent transition-colors">
                      <item.icon className="w-5 h-5 text-theme-fg opacity-70 group-hover:text-theme-accent-fg transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-theme-fg">{item.title}</h4>
                      <p className="text-sm text-theme-fg opacity-70">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onSignOut}
          className="w-full mt-8 px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-semibold hover:bg-red-100 transition-colors flex items-center justify-center space-x-2 border border-red-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
