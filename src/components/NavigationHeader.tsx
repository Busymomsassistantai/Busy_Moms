import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';

interface NavigationHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function NavigationHeader({ title, subtitle, showBack, onBack, actions }: NavigationHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-theme-surface border-b border-theme-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {showBack && onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-theme-secondary rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-theme-fg opacity-70" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-theme-fg">{title}</h1>
              {subtitle && <p className="text-sm text-theme-fg opacity-70">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}
