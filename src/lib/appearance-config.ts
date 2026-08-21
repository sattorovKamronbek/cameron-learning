export const APPEARANCE_STORAGE_KEY = 'cameron-appearance-v1';

export type PresetId =
  | 'classic' | 'cameron' | 'light' | 'dark' | 'luxury' | 'arctic'
  | 'nature' | 'ember' | 'dracula' | 'midnight' | 'ocean' | 'graphite' | 'aurora';
export type ColorMode = 'light' | 'dark' | 'system';
export type NavigationStyle = 'top' | 'side' | 'hybrid' | 'floating';
export type NavigationShape = 'default' | 'slim' | 'floating' | 'stacked';
export type SidebarMode = 'full' | 'compact' | 'icons' | 'auto';
export type BackgroundPattern = 'none' | 'grid' | 'dots' | 'diagonal' | 'mesh' | 'aurora' | 'academic';
export type CardStyle = 'default' | 'tint' | 'gradient' | 'glass' | 'outline' | 'elevated' | 'minimal';
export type RadiusScale = 'sharp' | 'small' | 'medium' | 'large' | 'extra';
export type ShadowLevel = 'none' | 'soft' | 'medium' | 'floating';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type MotionLevel = 'reduced' | 'normal' | 'enhanced';
export type VisionMode = 'normal' | 'contrast' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';
export type FontFamily = 'inter' | 'jakarta' | 'geist' | 'manrope' | 'dmsans' | 'roboto';
export type ContentWidth = 'compact' | 'balanced' | 'wide' | 'full';
export type Transparency = 'low' | 'medium' | 'high';
export type Intensity = 'soft' | 'balanced' | 'vibrant';
export type Ambient = 'none' | 'glow' | 'aurora' | 'spotlight';

export type AppearanceSettings = {
  version: 1;
  themePreset: PresetId;
  colorMode: ColorMode;
  accentColor: string;
  navigationStyle: NavigationStyle;
  navigationShape: NavigationShape;
  sidebarMode: SidebarMode;
  backgroundPattern: BackgroundPattern;
  cardStyle: CardStyle;
  fontFamily: FontFamily;
  fontScale: number;
  radiusScale: RadiusScale;
  shadowLevel: ShadowLevel;
  density: Density;
  motionLevel: MotionLevel;
  visionMode: VisionMode;
  focusMode: boolean;
  comfortMode: boolean;
  contentWidth: ContentWidth;
  panelTransparency: Transparency;
  colorIntensity: Intensity;
  ambientBackground: Ambient;
};

export type CustomPreset = { id: string; name: string; settings: AppearanceSettings };

export type Palette = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceHover: string;
  card: string;
  foreground: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
};

type Preset = {
  id: PresetId;
  name: string;
  description: string;
  light: Palette;
  dark: Palette;
};

const light = (primary: string, secondary: string, overrides: Partial<Palette> = {}): Palette => ({
  background: '#f7f8fc', backgroundSecondary: '#eef1f7', surface: '#ffffff', surfaceHover: '#f8faff', card: '#ffffff',
  foreground: '#182033', muted: '#687186', subtle: '#8d96a8', border: '#e4e8f0', borderStrong: '#cbd2df',
  primary, secondary, success: '#0f9d73', warning: '#b7791f', danger: '#cf4257', info: '#3377d7', ...overrides,
});

const dark = (primary: string, secondary: string, overrides: Partial<Palette> = {}): Palette => ({
  background: '#080a0f', backgroundSecondary: '#0d1017', surface: '#141923', surfaceHover: '#1b2130', card: '#181e2b',
  foreground: '#f7f8fc', muted: '#b9bfcc', subtle: '#777f91', border: '#283041', borderStrong: '#3a455c',
  primary, secondary, success: '#45d9a8', warning: '#ffbd5a', danger: '#ff758c', info: '#71b7ff', ...overrides,
});

export const appearancePresets: readonly Preset[] = [
  { id: 'classic', name: 'Classic', description: 'The original Cameron Learning appearance.', light: light('#6366f1', '#3b82f6', { background: '#ffffff', backgroundSecondary: '#f8fafc', card: '#ffffff', foreground: '#0f172a', muted: '#64748b', subtle: '#94a3b8', border: '#e2e8f0' }), dark: dark('#818cf8', '#60a5fa', { background: '#0f172a', backgroundSecondary: '#020617', surface: '#172033', card: '#172033' }) },
  { id: 'cameron', name: 'Cameron', description: 'Official premium Cameron identity.', light: light('#7567ff', '#45bfc5', { background: '#f7f7fb', backgroundSecondary: '#f0f1f8' }), dark: dark('#7567ff', '#45d9c5') },
  { id: 'light', name: 'Light', description: 'Minimal, bright and focused.', light: light('#6256db', '#3888d8', { background: '#fafaf8', backgroundSecondary: '#f4f5f1' }), dark: dark('#7467e8', '#5ca8e8', { background: '#15161a', backgroundSecondary: '#1b1c21' }) },
  { id: 'dark', name: 'Dark', description: 'Neutral dark professional.', light: light('#475569', '#64748b'), dark: dark('#8b95a7', '#b1bac8', { background: '#101114', backgroundSecondary: '#17181c', surface: '#1b1d22', card: '#202228' }) },
  { id: 'luxury', name: 'Luxury', description: 'Warm ivory with restrained gold.', light: light('#9b712d', '#694f2b', { background: '#faf7f0', backgroundSecondary: '#f3ecdf', card: '#fffdf8', foreground: '#30281f', muted: '#766b5d' }), dark: dark('#d0a653', '#a97e39', { background: '#171512', backgroundSecondary: '#211d17', surface: '#28221a', card: '#2e281f' }) },
  { id: 'arctic', name: 'Arctic', description: 'Icy blue, calm and glassy.', light: light('#5184df', '#8a78ed', { background: '#f7fbff', backgroundSecondary: '#edf6ff', card: '#fcfeff' }), dark: dark('#75aaff', '#ad9bff', { background: '#0b1422', backgroundSecondary: '#101e31', surface: '#15243a', card: '#192b44' }) },
  { id: 'nature', name: 'Nature', description: 'Deep green, sage and cream.', light: light('#4f8765', '#95ad77', { background: '#f8f8f1', backgroundSecondary: '#eef0e4', card: '#fefff9', foreground: '#20352a' }), dark: dark('#77b68c', '#bdcf91', { background: '#101b16', backgroundSecondary: '#16241d', surface: '#1b2d24', card: '#21362b' }) },
  { id: 'ember', name: 'Ember', description: 'Charcoal with warm amber energy.', light: light('#c35b28', '#d99732', { background: '#fcf8f4', backgroundSecondary: '#f8eee5', card: '#fffdfb' }), dark: dark('#ef7540', '#ffbd5a', { background: '#17110f', backgroundSecondary: '#211713', surface: '#2a1c16', card: '#302019' }) },
  { id: 'dracula', name: 'Dracula', description: 'Deep violet with cool highlights.', light: light('#7153be', '#4d9ed7', { background: '#faf8ff', backgroundSecondary: '#f0ecf9' }), dark: dark('#bd93f9', '#8be9fd', { background: '#1d1a28', backgroundSecondary: '#252033', surface: '#302a42', card: '#373047', foreground: '#f8f8f2', muted: '#c5c1d4' }) },
  { id: 'midnight', name: 'Midnight', description: 'Deep navy and indigo glow.', light: light('#4659cb', '#3288cc', { background: '#f7f9ff', backgroundSecondary: '#eef2fb' }), dark: dark('#7887ff', '#5eb6ff', { background: '#070d1b', backgroundSecondary: '#0b1428', surface: '#101d36', card: '#142440' }) },
  { id: 'ocean', name: 'Ocean', description: 'Navy with cyan and aqua.', light: light('#168bb5', '#29bda9', { background: '#f4fbfc', backgroundSecondary: '#e9f6f8' }), dark: dark('#40c9e6', '#45d9c5', { background: '#07171c', backgroundSecondary: '#0a222a', surface: '#10313a', card: '#133942' }) },
  { id: 'graphite', name: 'Graphite', description: 'Ultra-minimal black and gray.', light: light('#33363d', '#70747b', { background: '#fafafa', backgroundSecondary: '#f1f1f1', card: '#ffffff' }), dark: dark('#e2e4e8', '#a4a8b0', { background: '#0c0c0d', backgroundSecondary: '#151516', surface: '#1b1b1d', card: '#202023' }) },
  { id: 'aurora', name: 'Aurora', description: 'Dark neutral with violet-cyan color.', light: light('#795ee7', '#28bfc7', { background: '#f8f8ff', backgroundSecondary: '#f0f0fb' }), dark: dark('#9a7cff', '#45d9df', { background: '#0d0e14', backgroundSecondary: '#13151e', surface: '#1d1e2b', card: '#232535' }) },
] as const;

export const accentOptions = [
  ['#7567ff', 'Cameron Purple'], ['#5b5ce2', 'Indigo'], ['#3478f6', 'Electric Blue'], ['#00a9c7', 'Cyan'],
  ['#1caa76', 'Emerald'], ['#73a832', 'Lime'], ['#d38a28', 'Amber'], ['#df6430', 'Orange'],
  ['#d35270', 'Rose'], ['#bc4dca', 'Magenta'],
] as const;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  version: 1, themePreset: 'cameron', colorMode: 'dark', accentColor: 'preset',
  navigationStyle: 'top', navigationShape: 'default', sidebarMode: 'full', backgroundPattern: 'aurora',
  cardStyle: 'tint', fontFamily: 'inter', fontScale: 1, radiusScale: 'large', shadowLevel: 'soft',
  density: 'comfortable', motionLevel: 'normal', visionMode: 'normal', focusMode: false, comfortMode: false,
  contentWidth: 'wide', panelTransparency: 'medium', colorIntensity: 'balanced', ambientBackground: 'glow',
};

const valid = {
  themePreset: appearancePresets.map((item) => item.id), colorMode: ['light', 'dark', 'system'], navigationStyle: ['top', 'side', 'hybrid', 'floating'],
  navigationShape: ['default', 'slim', 'floating', 'stacked'], sidebarMode: ['full', 'compact', 'icons', 'auto'],
  backgroundPattern: ['none', 'grid', 'dots', 'diagonal', 'mesh', 'aurora', 'academic'], cardStyle: ['default', 'tint', 'gradient', 'glass', 'outline', 'elevated', 'minimal'],
  fontFamily: ['inter', 'jakarta', 'geist', 'manrope', 'dmsans', 'roboto'], radiusScale: ['sharp', 'small', 'medium', 'large', 'extra'], shadowLevel: ['none', 'soft', 'medium', 'floating'],
  density: ['compact', 'comfortable', 'spacious'], motionLevel: ['reduced', 'normal', 'enhanced'], visionMode: ['normal', 'contrast', 'protanopia', 'deuteranopia', 'tritanopia', 'monochrome'],
  contentWidth: ['compact', 'balanced', 'wide', 'full'], panelTransparency: ['low', 'medium', 'high'], colorIntensity: ['soft', 'balanced', 'vibrant'], ambientBackground: ['none', 'glow', 'aurora', 'spotlight'],
} as const;

function oneOf<T extends readonly string[]>(value: unknown, items: T, fallback: T[number]) {
  return typeof value === 'string' && (items as readonly string[]).includes(value) ? value as T[number] : fallback;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function validateAppearance(value: unknown): AppearanceSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_APPEARANCE };
  const raw = value as Record<string, unknown>;
  return {
    version: 1,
    themePreset: oneOf(raw.themePreset, valid.themePreset, DEFAULT_APPEARANCE.themePreset),
    colorMode: oneOf(raw.colorMode, valid.colorMode, DEFAULT_APPEARANCE.colorMode),
    accentColor: raw.accentColor === 'preset' || isHexColor(raw.accentColor) ? raw.accentColor : DEFAULT_APPEARANCE.accentColor,
    navigationStyle: oneOf(raw.navigationStyle, valid.navigationStyle, DEFAULT_APPEARANCE.navigationStyle),
    navigationShape: oneOf(raw.navigationShape, valid.navigationShape, DEFAULT_APPEARANCE.navigationShape),
    sidebarMode: oneOf(raw.sidebarMode, valid.sidebarMode, DEFAULT_APPEARANCE.sidebarMode),
    backgroundPattern: oneOf(raw.backgroundPattern, valid.backgroundPattern, DEFAULT_APPEARANCE.backgroundPattern),
    cardStyle: oneOf(raw.cardStyle, valid.cardStyle, DEFAULT_APPEARANCE.cardStyle),
    fontFamily: oneOf(raw.fontFamily, valid.fontFamily, DEFAULT_APPEARANCE.fontFamily),
    fontScale: typeof raw.fontScale === 'number' && raw.fontScale >= 0.9 && raw.fontScale <= 1.2 ? Math.round(raw.fontScale * 100) / 100 : DEFAULT_APPEARANCE.fontScale,
    radiusScale: oneOf(raw.radiusScale, valid.radiusScale, DEFAULT_APPEARANCE.radiusScale),
    shadowLevel: oneOf(raw.shadowLevel, valid.shadowLevel, DEFAULT_APPEARANCE.shadowLevel),
    density: oneOf(raw.density, valid.density, DEFAULT_APPEARANCE.density),
    motionLevel: oneOf(raw.motionLevel, valid.motionLevel, DEFAULT_APPEARANCE.motionLevel),
    visionMode: oneOf(raw.visionMode, valid.visionMode, DEFAULT_APPEARANCE.visionMode),
    focusMode: Boolean(raw.focusMode), comfortMode: Boolean(raw.comfortMode),
    contentWidth: oneOf(raw.contentWidth, valid.contentWidth, DEFAULT_APPEARANCE.contentWidth),
    panelTransparency: oneOf(raw.panelTransparency, valid.panelTransparency, DEFAULT_APPEARANCE.panelTransparency),
    colorIntensity: oneOf(raw.colorIntensity, valid.colorIntensity, DEFAULT_APPEARANCE.colorIntensity),
    ambientBackground: oneOf(raw.ambientBackground, valid.ambientBackground, DEFAULT_APPEARANCE.ambientBackground),
  };
}

export function getPreset(id: PresetId) {
  return appearancePresets.find((preset) => preset.id === id) ?? appearancePresets[1];
}

export function resolveColorMode(mode: ColorMode, systemIsDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;
}

export function resolvePalette(settings: AppearanceSettings, resolvedMode: 'light' | 'dark') {
  const preset = getPreset(settings.themePreset);
  const palette = { ...preset[resolvedMode] };
  if (settings.accentColor !== 'preset') palette.primary = settings.accentColor;
  if (settings.visionMode === 'contrast') {
    palette.foreground = resolvedMode === 'dark' ? '#ffffff' : '#06080d';
    palette.muted = resolvedMode === 'dark' ? '#e0e4ee' : '#283246';
    palette.border = resolvedMode === 'dark' ? '#667085' : '#718096';
  }
  if (settings.visionMode === 'protanopia' || settings.visionMode === 'deuteranopia') {
    palette.success = '#1683c7'; palette.danger = '#c94b8c'; palette.warning = '#9a6b00';
  }
  if (settings.visionMode === 'tritanopia') {
    palette.info = '#227b66'; palette.warning = '#b05b31';
  }
  if (settings.visionMode === 'monochrome') {
    palette.primary = resolvedMode === 'dark' ? '#e4e4e7' : '#303038'; palette.secondary = palette.primary;
    palette.success = palette.primary; palette.warning = palette.primary; palette.danger = palette.primary; palette.info = palette.primary;
  }
  return palette;
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function contrastColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#11131a' : '#ffffff';
}

export function shade(hex: string, percentage: number) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - percentage;
  return `#${[r, g, b].map((value) => Math.max(0, Math.round(value * factor)).toString(16).padStart(2, '0')).join('')}`;
}

export function makeRandomAppearance(): AppearanceSettings {
  const curated: Array<Pick<AppearanceSettings, 'themePreset' | 'colorMode' | 'backgroundPattern' | 'cardStyle' | 'ambientBackground'>> = [
    { themePreset: 'cameron', colorMode: 'dark', backgroundPattern: 'aurora', cardStyle: 'tint', ambientBackground: 'glow' },
    { themePreset: 'arctic', colorMode: 'light', backgroundPattern: 'grid', cardStyle: 'glass', ambientBackground: 'none' },
    { themePreset: 'nature', colorMode: 'light', backgroundPattern: 'academic', cardStyle: 'tint', ambientBackground: 'glow' },
    { themePreset: 'midnight', colorMode: 'dark', backgroundPattern: 'dots', cardStyle: 'elevated', ambientBackground: 'spotlight' },
    { themePreset: 'luxury', colorMode: 'light', backgroundPattern: 'none', cardStyle: 'outline', ambientBackground: 'none' },
    { themePreset: 'ocean', colorMode: 'dark', backgroundPattern: 'mesh', cardStyle: 'glass', ambientBackground: 'aurora' },
  ];
  return { ...DEFAULT_APPEARANCE, ...curated[Math.floor(Math.random() * curated.length)], accentColor: 'preset' };
}
