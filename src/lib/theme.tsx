import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('cameron-theme') : null;
  return themes.some(({ id }) => id === saved) ? saved as Theme : 'indigo';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem('cameron-theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
