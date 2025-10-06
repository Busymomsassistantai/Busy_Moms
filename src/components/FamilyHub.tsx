import React, { useState } from 'react';
import { Users, FolderOpen, UserPlus, ShoppingBag, CheckSquare, Calendar } from 'lucide-react';
import { NavigationHeader } from './NavigationHeader';
import { SubScreen, Screen } from '../App';

interface FamilyHubProps {
  onNavigateToSubScreen: (screen: SubScreen) => void;
  onNavigateToScreen: (screen: Screen) => void;
}

export function FamilyHub({ onNavigateToSubScreen, onNavigateToScreen }: FamilyHubProps) {
  const familyFeatures = [
    {
      id: 'family-folders' as SubScreen,
      icon: FolderOpen,
      title: 'Family Folders',
      description: 'Organize by family member',
      color: 'from-violet-400 to-purple-400'
    },
    {
      id: 'contacts' as SubScreen,
      icon: Users,
      title: 'Contacts',
      description: 'Manage family contacts',
      color: 'from-rose-400 to-pink-400'
    },
    {
      id: 'tasks' as SubScreen,
      icon: CheckSquare,
      title: 'Tasks',
      description: 'Family task management',
      color: 'from-amber-400 to-orange-400'
    },
    {
      id: 'shopping' as SubScreen,
      icon: ShoppingBag,
      title: 'Shopping',
      description: 'Shopping lists and items',
      color: 'from-fuchsia-400 to-pink-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 pb-24">
      <NavigationHeader
        title="Family"
        subtitle="Manage your family's activities and organization"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {familyFeatures.map((feature) => (
            <button
              key={feature.id}
              onClick={() => onNavigateToSubScreen(feature.id)}
              className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all text-left group"
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Family Calendar</h3>
              <p className="text-sm text-gray-600">View all family events in one place</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToScreen('calendar')}
            className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors font-medium"
          >
            View Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
