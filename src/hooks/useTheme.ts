import { useState, useEffect } from 'react';
import { ThemeId, applyTheme, getStoredTheme, setStoredTheme, getStoredDarkMode, setStoredDarkMode } from '../lib/themes';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme());
  const [isDark, setIsDark] = useState<boolean>(getStoredDarkMode());

  useEffect(() => {
    applyTheme(theme, isDark);
  }, [theme, isDark]);

  const changeTheme = (newTheme: ThemeId) => {
    setTheme(newTheme);
    setStoredTheme(newTheme);
    applyTheme(newTheme, isDark);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    setStoredDarkMode(newDarkMode);
    applyTheme(theme, newDarkMode);
  };

  return {
    theme,
    isDark,
    changeTheme,
    toggleDarkMode,
  };
}
