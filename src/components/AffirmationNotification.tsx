import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Affirmation } from '../lib/supabase';

interface AffirmationNotificationProps {
  affirmation: Affirmation | null;
  onDismiss: () => void;
  onView: () => void;
}

export function AffirmationNotification({ affirmation, onDismiss, onView }: AffirmationNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (affirmation) {
      setTimeout(() => setIsVisible(true), 100);
    } else {
      setIsVisible(false);
    }
  }, [affirmation]);

  if (!affirmation) return null;

  return (
    <div
      className={`fixed top-4 left-4 right-4 z-50 transition-all duration-500 transform ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      style={{ maxWidth: '600px', margin: '0 auto' }}
    >
      <div className="bg-gradient-to-r from-slate-500 via-slate-500 to-orange-400 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12 animate-pulse"></div>

        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
            <span className="text-white font-bold text-lg">Your Daily Affirmation</span>
          </div>

          <p className="text-white text-base leading-relaxed mb-4">
            {affirmation.affirmation_text}
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onView}
              className="px-4 py-2 bg-white bg-opacity-90 text-slate-600 rounded-lg font-medium hover:bg-opacity-100 transition-all"
            >
              View All Affirmations
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg font-medium hover:bg-opacity-30 transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
