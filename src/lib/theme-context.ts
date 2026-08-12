import { createContext, useContext } from 'react';

export const themes = [
  { id: 'indigo', primary: '#6366f1', secondary: '#3b82f6' },
  { id: 'ocean', primary: '#0891b2', secondary: '#2563eb' },
  { id: 'sunset', primary: '#db2777', secondary: '#f97316' },
  { id: 'forest', primary: '#059669', secondary: '#65a30d' },
] as const;

export type Theme = (typeof themes)[number]['id'];

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function getInitialTheme(): Theme {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('cameron-theme') : null;
  return themes.some(({ id }) => id === saved) ? saved as Theme : 'indigo';
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
