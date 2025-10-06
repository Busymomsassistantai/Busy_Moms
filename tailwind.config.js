/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'theme-bg': 'var(--color-background)',
        'theme-surface': 'var(--color-surface)',
        'theme-fg': 'var(--color-foreground)',
        'theme-primary': 'var(--color-primary)',
        'theme-primary-fg': 'var(--color-primary-fg)',
        'theme-secondary': 'var(--color-secondary)',
        'theme-secondary-fg': 'var(--color-secondary-fg)',
        'theme-accent': 'var(--color-accent)',
        'theme-accent-fg': 'var(--color-accent-fg)',
        'theme-border': 'var(--color-border)',
        'theme-ring': 'var(--color-ring)',
      },
    },
  },
  plugins: [],
};
