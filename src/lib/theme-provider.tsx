import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AppearanceContext } from './appearance-context';
import {
  APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, contrastColor, resolveColorMode,
  resolvePalette, shade, validateAppearance, withAlpha,
  type AppearanceSettings, type CustomPreset,
} from './appearance-config';

const CUSTOM_PRESETS_STORAGE_KEY = 'cameron-appearance-custom-presets-v1';
const optionalFontStylesheets: Partial<Record<AppearanceSettings['fontFamily'], string>> = {
  jakarta: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  manrope: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
  dmsans: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
  roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
};

function readLocalSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored) return validateAppearance(JSON.parse(stored));

    // Preserve an existing visitor's previous color choice as a Classic setup.
    const legacy = window.localStorage.getItem('cameron-theme');
    const legacyAccent: Record<string, string> = { indigo: '#6366f1', ocean: '#0891b2', sunset: '#db2777', forest: '#059669' };
    if (legacy && legacyAccent[legacy]) return { ...DEFAULT_APPEARANCE, themePreset: 'classic', colorMode: 'light', accentColor: legacyAccent[legacy] };
  } catch {
    // Corrupt storage should never prevent the learning application from rendering.
  }
  return { ...DEFAULT_APPEARANCE };
}

function readCustomPresets(): CustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 12).flatMap((item): CustomPreset[] => {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.id !== 'string') return [];
      return [{ id: item.id.slice(0, 80), name: item.name.slice(0, 48), settings: validateAppearance(item.settings) }];
    });
  } catch {
    return [];
  }
}

function applyCssVariables(settings: AppearanceSettings, resolvedMode: 'light' | 'dark') {
  const root = document.documentElement;
  const palette = resolvePalette(settings, resolvedMode);
  const primary = palette.primary;
  const density = settings.density === 'compact' ? '0.88' : settings.density === 'spacious' ? '1.13' : '1';
  const radius: Record<AppearanceSettings['radiusScale'], string> = { sharp: '4px', small: '8px', medium: '12px', large: '16px', extra: '22px' };
  const shadow: Record<AppearanceSettings['shadowLevel'], string> = {
    none: 'none', soft: `0 1px 2px rgba(2, 6, 23, .04), 0 8px 20px -12px ${withAlpha(palette.foreground, .25)}`,
    medium: `0 12px 30px -18px ${withAlpha(palette.foreground, .36)}`, floating: `0 24px 60px -24px ${withAlpha(palette.foreground, .48)}`,
  };
  const font: Record<AppearanceSettings['fontFamily'], string> = {
    inter: 'Inter, ui-sans-serif, system-ui, sans-serif', jakarta: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
    geist: 'Geist, Inter, ui-sans-serif, system-ui, sans-serif', manrope: 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif',
    dmsans: '"DM Sans", Inter, ui-sans-serif, system-ui, sans-serif', roboto: 'Roboto, Inter, ui-sans-serif, system-ui, sans-serif',
  };
  const transparency = settings.panelTransparency === 'low' ? '.94' : settings.panelTransparency === 'high' ? '.74' : '.85';

  const vars: Record<string, string> = {
    '--background': palette.background, '--background-secondary': palette.backgroundSecondary, '--surface': palette.surface,
    '--surface-hover': palette.surfaceHover, '--surface-active': withAlpha(primary, .14), '--card': palette.card,
    '--card-hover': palette.surfaceHover, '--foreground': palette.foreground, '--foreground-muted': palette.muted,
    '--foreground-subtle': palette.subtle, '--border': palette.border, '--border-strong': palette.borderStrong,
    '--primary': primary, '--primary-hover': shade(primary, .16), '--primary-active': shade(primary, .25),
    '--primary-foreground': contrastColor(primary), '--secondary': palette.secondary, '--accent': palette.secondary,
    '--success': palette.success, '--warning': palette.warning, '--danger': palette.danger, '--info': palette.info,
    '--radius-sm': radius[settings.radiusScale], '--radius-md': `calc(${radius[settings.radiusScale]} + 4px)`, '--radius-lg': `calc(${radius[settings.radiusScale]} + 8px)`, '--radius-xl': `calc(${radius[settings.radiusScale]} + 14px)`,
    '--shadow-sm': settings.shadowLevel === 'none' ? 'none' : shadow.soft, '--shadow-md': shadow[settings.shadowLevel], '--shadow-lg': shadow[settings.shadowLevel],
    '--font-ui': font[settings.fontFamily], '--font-scale': String(settings.fontScale), '--density': density, '--panel-alpha': transparency,
    // Legacy aliases let the existing, stable component library consume the new engine safely.
    '--theme-primary': primary, '--theme-primary-strong': shade(primary, .16), '--theme-secondary': palette.secondary,
    '--theme-soft': withAlpha(primary, resolvedMode === 'dark' ? .18 : .10), '--theme-ring': withAlpha(primary, .32),
    '--theme-canvas': palette.background, '--theme-page': palette.backgroundSecondary, '--theme-surface': palette.surface,
    '--theme-dark': resolvedMode === 'dark' ? palette.background : '#0f172a', '--theme-dark-alt': resolvedMode === 'dark' ? palette.backgroundSecondary : '#172554',
    '--theme-grid': withAlpha(primary, resolvedMode === 'dark' ? .12 : .08),
  };
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.dataset.appearanceEngine = 'true';
  root.dataset.appearance = settings.themePreset;
  root.dataset.colorModeResolved = resolvedMode;
  root.dataset.navigationStyle = settings.navigationStyle;
  root.dataset.navigationShape = settings.navigationShape;
  root.dataset.sidebarMode = settings.sidebarMode;
  root.dataset.density = settings.density;
  root.dataset.colorIntensity = settings.colorIntensity;
  root.dataset.ambientBackground = settings.ambientBackground;
  root.dataset.cardStyle = settings.cardStyle;
  root.dataset.backgroundPattern = settings.backgroundPattern;
  root.dataset.motionLevel = settings.motionLevel;
  root.dataset.visionMode = settings.visionMode;
  root.dataset.contentWidth = settings.contentWidth;
  root.dataset.focusMode = String(settings.focusMode);
  root.dataset.comfortMode = String(settings.comfortMode);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const remoteAppearance = profile?.preferences?.appearance;
  const [settings, setSettings] = useState<AppearanceSettings>(readLocalSettings);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(readCustomPresets);
  const [systemIsDark, setSystemIsDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [studioOpen, setStudioOpen] = useState(false);
  const resolvedMode = resolveColorMode(settings.colorMode, systemIsDark);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // Existing Inter and Geist faces are preloaded by the document. Optional
    // faces are only requested after a learner explicitly selects one.
    const href = optionalFontStylesheets[settings.fontFamily];
    if (!href || document.head.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  }, [settings.fontFamily]);

  // A remote profile preference is only read when no local editing has occurred.
  useEffect(() => {
    const appearance = remoteAppearance;
    if (!appearance || typeof appearance !== 'object') return;
    try {
      const local = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (!local) setSettings(validateAppearance(appearance));
    } catch {
      // Keep the current local fallback if storage is unavailable.
    }
  }, [profile?.id, remoteAppearance]);

  useEffect(() => {
    applyCssVariables(settings, resolvedMode);
    try { window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings)); } catch { /* local persistence is optional */ }
  }, [settings, resolvedMode]);

  useEffect(() => {
    try { window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(customPresets)); } catch { /* local persistence is optional */ }
  }, [customPresets]);

  // Keep cross-device sync deliberately best-effort and debounced. Existing
  // profile preferences are preserved so this feature cannot replace unrelated settings.
  useEffect(() => {
    if (!user || !profile) return;
    const timer = window.setTimeout(() => {
      const preferences = { ...(profile.preferences ?? {}), appearance: settings };
      void supabase.from('profiles').update({ preferences }).eq('id', user.id).then(({ error }) => {
        if (error) console.warn('Appearance sync will continue locally:', error.message);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [profile, settings, user]);

  const updateSettings = useCallback((updates: Partial<AppearanceSettings>) => {
    setSettings((current) => validateAppearance({ ...current, ...updates }));
  }, []);
  const replaceSettings = useCallback((next: AppearanceSettings) => setSettings(validateAppearance(next)), []);
  const resetSettings = useCallback(() => setSettings({ ...DEFAULT_APPEARANCE }), []);
  const saveCustomPreset = useCallback((name: string) => {
    const cleanName = name.trim().slice(0, 48);
    if (!cleanName) return;
    setCustomPresets((items) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: cleanName, settings }, ...items].slice(0, 12));
  }, [settings]);
  const renameCustomPreset = useCallback((id: string, name: string) => {
    const cleanName = name.trim().slice(0, 48);
    if (!cleanName) return;
    setCustomPresets((items) => items.map((item) => item.id === id ? { ...item, name: cleanName } : item));
  }, []);
  const deleteCustomPreset = useCallback((id: string) => setCustomPresets((items) => items.filter((item) => item.id !== id)), []);

  const value = useMemo(() => ({
    settings, resolvedMode, customPresets, studioOpen, updateSettings, replaceSettings, resetSettings, saveCustomPreset, renameCustomPreset, deleteCustomPreset,
    openStudio: () => setStudioOpen(true), closeStudio: () => setStudioOpen(false),
  }), [settings, resolvedMode, customPresets, studioOpen, updateSettings, replaceSettings, resetSettings, saveCustomPreset, renameCustomPreset, deleteCustomPreset]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

// Kept as an alias so any integrations importing the previous provider keep working.
export const ThemeProvider = AppearanceProvider;
