import { createContext, useContext } from 'react';
import type { AppearanceSettings, CustomPreset } from './appearance-config';

export type AppearanceContextValue = {
  settings: AppearanceSettings;
  resolvedMode: 'light' | 'dark';
  customPresets: CustomPreset[];
  studioOpen: boolean;
  updateSettings: (updates: Partial<AppearanceSettings>) => void;
  replaceSettings: (settings: AppearanceSettings) => void;
  resetSettings: () => void;
  saveCustomPreset: (name: string) => void;
  renameCustomPreset: (id: string, name: string) => void;
  deleteCustomPreset: (id: string) => void;
  openStudio: () => void;
  closeStudio: () => void;
};

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within AppearanceProvider');
  return context;
}
