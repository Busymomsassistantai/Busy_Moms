import React from 'react';
import { Palette, Moon, Sun, Check } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { themes, ThemeId } from '../lib/themes';

export function ThemeSwitcher() {
  const { theme: currentTheme, isDark, changeTheme, toggleDarkMode } = useTheme();

  const themeList: ThemeId[] = ['ocean', 'sunset', 'warmth', 'plum', 'sage'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
            <Palette className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Theme</h3>
            <p className="text-sm text-gray-600">Choose your color scheme</p>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-2">
        {themeList.map((themeId) => {
          const theme = themes[themeId];
          const isActive = currentTheme === themeId;
          const colors = isDark ? theme.dark : theme.light;

          return (
            <button
              key={themeId}
              onClick={() => changeTheme(themeId)}
              className={`w-full p-3 rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div
                      className="w-6 h-6 rounded-md border border-gray-200"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-gray-200"
                      style={{ backgroundColor: colors.secondary }}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-gray-200"
                      style={{ backgroundColor: colors.accent }}
                    />
                  </div>

                  <div className="text-left">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {theme.name}
                    </h4>
                    <p className="text-xs text-gray-600">{theme.description}</p>
                  </div>
                </div>

                {isActive && (
                  <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
