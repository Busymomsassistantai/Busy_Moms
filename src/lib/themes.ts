export type ThemeId = 'ocean' | 'sunset' | 'warmth' | 'plum' | 'sage';

export interface ThemeColors {
  id: ThemeId;
  name: string;
  description: string;
  light: {
    background: string;
    surface: string;
    foreground: string;
    primary: string;
    primaryFg: string;
    secondary: string;
    secondaryFg: string;
    accent: string;
    accentFg: string;
    border: string;
    ring: string;
  };
  dark: {
    background: string;
    surface: string;
    foreground: string;
    primary: string;
    primaryFg: string;
    secondary: string;
    secondaryFg: string;
    accent: string;
    accentFg: string;
    border: string;
    ring: string;
  };
}

export const themes: Record<ThemeId, ThemeColors> = {
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Calm blues and soft neutrals',
    light: {
      background: '#F0F4F8',
      surface: '#FFFFFF',
      foreground: '#1E293B',
      primary: '#0369A1',
      primaryFg: '#FFFFFF',
      secondary: '#E0E7EF',
      secondaryFg: '#1E293B',
      accent: '#F97316',
      accentFg: '#FFFFFF',
      border: '#CBD5E1',
      ring: '#0369A1',
    },
    dark: {
      background: '#0F172A',
      surface: '#1E293B',
      foreground: '#F1F5F9',
      primary: '#38BDF8',
      primaryFg: '#0F172A',
      secondary: '#334155',
      secondaryFg: '#F1F5F9',
      accent: '#FB923C',
      accentFg: '#0F172A',
      border: '#334155',
      ring: '#38BDF8',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm pinks and oranges',
    light: {
      background: '#FEF3F2',
      surface: '#FFFFFF',
      foreground: '#1F2937',
      primary: '#DC2626',
      primaryFg: '#FFFFFF',
      secondary: '#FED7AA',
      secondaryFg: '#1F2937',
      accent: '#F59E0B',
      accentFg: '#1F2937',
      border: '#FDE68A',
      ring: '#DC2626',
    },
    dark: {
      background: '#18181B',
      surface: '#27272A',
      foreground: '#FAFAFA',
      primary: '#F87171',
      primaryFg: '#18181B',
      secondary: '#52525B',
      secondaryFg: '#FAFAFA',
      accent: '#FBBF24',
      accentFg: '#18181B',
      border: '#3F3F46',
      ring: '#F87171',
    },
  },
  warmth: {
    id: 'warmth',
    name: 'Warm Neutrals',
    description: 'Soft beiges and blues',
    light: {
      background: '#FFFAF7',
      surface: '#FFFFFF',
      foreground: '#111827',
      primary: '#1E3A8A',
      primaryFg: '#FFFFFF',
      secondary: '#F4A77A',
      secondaryFg: '#1E3A8A',
      accent: '#65C3BA',
      accentFg: '#0F172A',
      border: '#E7E5E4',
      ring: '#1E3A8A',
    },
    dark: {
      background: '#0C1020',
      surface: '#12172A',
      foreground: '#F8FAFC',
      primary: '#1E3A8A',
      primaryFg: '#FFFFFF',
      secondary: '#F4A77A',
      secondaryFg: '#1E3A8A',
      accent: '#65C3BA',
      accentFg: '#0F172A',
      border: '#1F2A37',
      ring: '#1E3A8A',
    },
  },
  plum: {
    id: 'plum',
    name: 'Plum Garden',
    description: 'Deep magentas and sage',
    light: {
      background: '#F7F4F3',
      surface: '#FFFFFF',
      foreground: '#1F2937',
      primary: '#9D174D',
      primaryFg: '#FFFFFF',
      secondary: '#E7DAD1',
      secondaryFg: '#1F2937',
      accent: '#84A59D',
      accentFg: '#1F2937',
      border: '#E5E7EB',
      ring: '#9D174D',
    },
    dark: {
      background: '#121014',
      surface: '#17161A',
      foreground: '#F8FAFC',
      primary: '#9D174D',
      primaryFg: '#FFFFFF',
      secondary: '#E7DAD1',
      secondaryFg: '#1F2937',
      accent: '#84A59D',
      accentFg: '#1F2937',
      border: '#23232B',
      ring: '#9D174D',
    },
  },
  sage: {
    id: 'sage',
    name: 'Sage Serenity',
    description: 'Elegant neutrals with teal accents',
    light: {
      background: '#F8F5EF',
      surface: '#FFFFFF',
      foreground: '#0F172A',
      primary: '#4338CA',
      primaryFg: '#FFFFFF',
      secondary: '#65C3BA',
      secondaryFg: '#0F172A',
      accent: '#E6D9C6',
      accentFg: '#0F172A',
      border: '#E7E5E4',
      ring: '#4338CA',
    },
    dark: {
      background: '#0F1117',
      surface: '#141821',
      foreground: '#F8FAFC',
      primary: '#4338CA',
      primaryFg: '#FFFFFF',
      secondary: '#65C3BA',
      secondaryFg: '#0F172A',
      accent: '#E6D9C6',
      accentFg: '#0F172A',
      border: '#202736',
      ring: '#4338CA',
    },
  },
};

export function applyTheme(themeId: ThemeId, isDark: boolean = false): void {
  const theme = themes[themeId];
  if (!theme) return;

  const colors = isDark ? theme.dark : theme.light;
  const root = document.documentElement;

  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-foreground', colors.foreground);
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-fg', colors.primaryFg);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-secondary-fg', colors.secondaryFg);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-accent-fg', colors.accentFg);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-ring', colors.ring);
}

export function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem('app-theme');
  if (stored && stored in themes) {
    return stored as ThemeId;
  }
  return 'ocean';
}

export function setStoredTheme(themeId: ThemeId): void {
  localStorage.setItem('app-theme', themeId);
}

export function getStoredDarkMode(): boolean {
  const stored = localStorage.getItem('app-dark-mode');
  if (stored !== null) {
    return stored === 'true';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setStoredDarkMode(isDark: boolean): void {
  localStorage.setItem('app-dark-mode', isDark.toString());
}
