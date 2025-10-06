import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
        className={`p-2 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${className}`}
        aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {resolvedTheme === 'light' ? (
          <Moon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        ) : (
          <Sun className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        )}
      </button>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setTheme('light')}
          className={`p-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
            theme === 'light'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Light mode"
          aria-pressed={theme === 'light'}
          title="Light mode"
        >
          <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'}`} />
        </button>

        <button
          onClick={() => setTheme('system')}
          className={`p-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
            theme === 'system'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="System theme"
          aria-pressed={theme === 'system'}
          title="Use system theme"
        >
          <Monitor className={`w-4 h-4 ${theme === 'system' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`} />
        </button>

        <button
          onClick={() => setTheme('dark')}
          className={`p-2 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
            theme === 'dark'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label="Dark mode"
          aria-pressed={theme === 'dark'}
          title="Dark mode"
        >
          <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-500' : 'text-gray-500 dark:text-gray-400'}`} />
        </button>
      </div>
    </div>
  );
}

export function ThemeToggleMenu() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'system' as const, label: 'System', icon: Monitor },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        aria-label="Theme options"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {theme === 'light' && <Sun className="w-4 h-4" />}
        {theme === 'system' && <Monitor className="w-4 h-4" />}
        {theme === 'dark' && <Moon className="w-4 h-4" />}
        <span className="text-sm font-medium">Theme</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20"
            role="menu"
            aria-orientation="vertical"
          >
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    theme === option.value
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  role="menuitem"
                  aria-current={theme === option.value}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                  {theme === option.value && (
                    <span className="ml-auto text-purple-600 dark:text-purple-400">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
