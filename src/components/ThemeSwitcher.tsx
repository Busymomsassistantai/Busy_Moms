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
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-900">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Theme</h3>
            <p className="text-sm text-gray-900 opacity-70">Choose your color scheme</p>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors hover:opacity-80 bg-gray-100 text-gray-900"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4" />
              <span className="text-sm font-medium">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              <span className="text-sm font-medium">Dark</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 rounded-xl border-2 bg-gray-50 border-gray-200">
        <p className="text-xs font-medium mb-3 text-gray-900 opacity-70">
          Preview
        </p>
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-blue-600 text-white">
            Primary
          </button>
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-gray-100 text-gray-900">
            Secondary
          </button>
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-orange-400 text-white">
            Accent
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {themeList.map((themeId) => {
          const theme = themes[themeId];
          const isActive = currentTheme === themeId;
          const colors = isDark ? theme.dark : theme.light;

          return (
            <div
              key={themeId}
              className="p-3 rounded-xl border-2 transition-colors bg-theme-surface"
              style={{
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: isActive ? 'var(--color-secondary)' : 'var(--color-surface)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex space-x-1">
                    <div
                      className="w-6 h-6 rounded-md border"
                      style={{
                        backgroundColor: colors.primary,
                        borderColor: 'var(--color-border)'
                      }}
                    />
                    <div
                      className="w-6 h-6 rounded-md border"
                      style={{
                        backgroundColor: colors.secondary,
                        borderColor: 'var(--color-border)'
                      }}
                    />
                    <div
                      className="w-6 h-6 rounded-md border"
                      style={{
                        backgroundColor: colors.accent,
                        borderColor: 'var(--color-border)'
                      }}
                    />
                  </div>

                  <div className="text-left flex-1">
                    <h4 className="font-medium text-sm text-gray-900">
                      {theme.name}
                    </h4>
                    <p className="text-xs text-gray-900 opacity-70">{theme.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isActive && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-600 text-white">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <button
                    onClick={() => changeTheme(themeId)}
                    className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    style={{
                      backgroundColor: colors.primary,
                      color: colors.primaryFg
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
