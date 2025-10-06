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
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-theme-secondary text-theme-secondary-fg">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-theme-fg">Theme</h3>
            <p className="text-sm text-theme-fg opacity-70">Choose your color scheme</p>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors hover:opacity-80 bg-theme-secondary text-theme-secondary-fg"
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

      <div className="p-4 rounded-xl border-2 bg-theme-bg border-theme-border">
        <p className="text-xs font-medium mb-3 text-theme-fg opacity-70">
          Preview
        </p>
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-theme-primary text-theme-primary-fg">
            Primary
          </button>
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-theme-secondary text-theme-secondary-fg">
            Secondary
          </button>
          <button className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-theme-accent text-theme-accent-fg">
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
            <button
              key={themeId}
              onClick={() => changeTheme(themeId)}
              className="w-full p-3 rounded-xl border-2 transition-all bg-theme-surface hover:opacity-90"
              style={{
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: isActive ? 'var(--color-secondary)' : 'var(--color-surface)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
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

                  <div className="text-left">
                    <h4 className="font-medium text-sm text-theme-fg">
                      {theme.name}
                    </h4>
                    <p className="text-xs text-theme-fg opacity-70">{theme.description}</p>
                  </div>
                </div>

                {isActive && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-theme-primary text-theme-primary-fg">
                    <Check className="w-4 h-4" />
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
