import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronDown, Copy, Download, Eye, Layers3, Palette, PanelRight,
  Pencil, RefreshCcw, Search, Shuffle, Sparkles, Upload, X, Zap,
} from 'lucide-react';
import { useAppearance } from '@/lib/theme';
import {
  accentOptions, appearancePresets, makeRandomAppearance, validateAppearance,
  type AppearanceSettings,
} from '@/lib/appearance-config';

type SettingKey = keyof AppearanceSettings;

const labelize = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());

function SettingTiles({
  setting, options, labels, search, visual = false,
}: {
  setting: SettingKey;
  options: readonly string[];
  labels?: Record<string, string>;
  search: string;
  visual?: boolean;
}) {
  const { settings, updateSettings } = useAppearance();
  if (search && ![labelize(setting), ...options, ...Object.values(labels ?? {})].join(' ').toLowerCase().includes(search)) return null;
  const current = String(settings[setting]);
  return (
    <div className="appearance-control">
      <div className="appearance-control-heading"><span>{labelize(setting)}</span></div>
      <div className={`appearance-tiles ${visual ? 'appearance-tiles-visual' : ''}`}>
        {options.map((option) => {
          const selected = current === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => updateSettings({ [setting]: option } as Partial<AppearanceSettings>)}
              className={`appearance-tile ${selected ? 'is-selected' : ''}`}
              aria-pressed={selected}
            >
              {visual && <MiniPreview type={String(setting)} value={option} />}
              <span>{labels?.[option] ?? labelize(option)}</span>
              {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniPreview({ type, value }: { type: string; value: string }) {
  return (
    <span className={`appearance-mini appearance-mini-${type} appearance-mini-${value}`} aria-hidden="true">
      <i /><b /><em />
    </span>
  );
}

function AppearancePreview() {
  const { settings, resolvedMode } = useAppearance();
  return (
    <div className="appearance-live-preview" data-preview-mode={resolvedMode} data-preview-card={settings.cardStyle}>
      <div className="appearance-preview-nav"><span /><span /><span /></div>
      <div className="appearance-preview-main">
        <div><i /><b /></div>
        <div><i /><b /></div>
        <div className="appearance-preview-button" />
      </div>
    </div>
  );
}

export function AppearanceStudio() {
  const {
    settings, resolvedMode, customPresets, studioOpen, updateSettings, replaceSettings,
    resetSettings, saveCustomPreset, renameCustomPreset, deleteCustomPreset, closeStudio,
  } = useAppearance();
  const [search, setSearch] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const filter = search.trim().toLowerCase();
  const shows = (...terms: string[]) => !filter || terms.join(' ').toLowerCase().includes(filter);

  useEffect(() => {
    if (!studioOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeStudio(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); };
  }, [studioOpen, closeStudio]);

  const exportConfig = useMemo(() => JSON.stringify(settings, null, 2), [settings]);
  const copyConfig = async () => {
    try { await navigator.clipboard.writeText(exportConfig); } catch { setImportError('Copy is unavailable in this browser. You can select the JSON below.'); }
  };
  const downloadConfig = () => {
    const href = URL.createObjectURL(new Blob([exportConfig], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = href; link.download = 'cameron-appearance.json'; link.click(); URL.revokeObjectURL(href);
  };
  const importConfig = () => {
    try {
      const parsed: unknown = JSON.parse(importValue);
      if (!parsed || typeof parsed !== 'object') throw new Error();
      replaceSettings(validateAppearance(parsed));
      setImportError(null); setImportValue('');
    } catch { setImportError('That is not a valid Cameron appearance configuration.'); }
  };
  const savePreset = () => {
    const name = window.prompt('Name this appearance preset');
    if (name?.trim()) saveCustomPreset(name);
  };
  const selectDesignPreset = (id: AppearanceSettings['themePreset']) => {
    if (id === 'classic') {
      updateSettings({
        themePreset: id, accentColor: 'preset', colorMode: 'light', navigationStyle: 'top', navigationShape: 'default',
        sidebarMode: 'full', backgroundPattern: 'none', cardStyle: 'default', fontFamily: 'inter', fontScale: 1,
        radiusScale: 'large', shadowLevel: 'soft', density: 'comfortable', motionLevel: 'normal', visionMode: 'normal',
        focusMode: false, comfortMode: false, contentWidth: 'wide', panelTransparency: 'medium', colorIntensity: 'balanced', ambientBackground: 'none',
      });
      return;
    }
    updateSettings({ themePreset: id, accentColor: 'preset' });
  };
  const renamePreset = (id: string, currentName: string) => {
    const name = window.prompt('Rename this appearance preset', currentName);
    if (name?.trim()) renameCustomPreset(id, name);
  };

  return (
    <div className={`appearance-overlay ${studioOpen ? 'is-open' : ''}`} aria-hidden={!studioOpen}>
      <button type="button" className="appearance-backdrop" aria-label="Close appearance studio" onClick={closeStudio} tabIndex={studioOpen ? 0 : -1} />
      <aside ref={panelRef} tabIndex={-1} className="appearance-studio" aria-label="Appearance Studio">
        <header className="appearance-studio-header">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="appearance-icon-button appearance-mobile-back" onClick={closeStudio} aria-label="Close appearance studio"><ArrowLeft className="h-5 w-5" /></button>
            <div><p className="appearance-kicker">Cameron Design Engine</p><h2>Appearance</h2></div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="appearance-text-button" onClick={() => setShowReset(true)}><RefreshCcw className="h-3.5 w-3.5" />Reset</button>
            <button type="button" className="appearance-icon-button appearance-close" onClick={closeStudio} aria-label="Close appearance studio"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="appearance-studio-scroll">
          <label className="appearance-search">
            <Search className="h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search appearance settings..." />
          </label>

          {!filter && <section className="appearance-section appearance-intro"><div><span className="appearance-kicker">Live preview</span><h3>{appearancePresets.find((item) => item.id === settings.themePreset)?.name} · {resolvedMode}</h3><p>Every choice is applied immediately and saved safely.</p></div><AppearancePreview /></section>}

          {shows('design preset theme classic cameron luxury arctic nature ember dracula midnight ocean graphite aurora') && (
            <section className="appearance-section"><SectionTitle icon={Palette} title="Design preset" description="A complete, intentional visual direction." />
              <div className="appearance-preset-grid">
                {appearancePresets.map((preset) => {
                  const selected = settings.themePreset === preset.id;
                  return <button key={preset.id} type="button" onClick={() => selectDesignPreset(preset.id)} className={`appearance-preset ${selected ? 'is-selected' : ''}`} aria-pressed={selected}>
                    <span className="appearance-preset-swatch" style={{ background: `linear-gradient(135deg, ${preset.dark.background}, ${preset.dark.primary} 64%, ${preset.dark.secondary})` }}><i /><b /></span>
                    <span><strong>{preset.name}</strong><small>{preset.description}</small></span>{selected && <Check className="h-4 w-4" />}
                  </button>;
                })}
              </div>
            </section>
          )}

          <SettingTiles setting="colorMode" options={['light', 'dark', 'system']} search={filter} labels={{ light: 'Light', dark: 'Dark', system: 'System' }} visual />

          {shows('accent color custom purple indigo blue cyan emerald lime amber orange rose magenta') && <section className="appearance-section"><SectionTitle icon={Sparkles} title="Accent color" description="Controls active states, focus rings and key actions." />
            <div className="appearance-accent-list">
              <button type="button" onClick={() => updateSettings({ accentColor: 'preset' })} className={`appearance-accent-preset ${settings.accentColor === 'preset' ? 'is-selected' : ''}`}><span className="appearance-accent-dot appearance-accent-preset-dot" />Preset <Check className="h-3.5 w-3.5" /></button>
              {accentOptions.map(([color, name]) => <button key={color} type="button" onClick={() => updateSettings({ accentColor: color })} title={name} className={`appearance-color-swatch ${settings.accentColor === color ? 'is-selected' : ''}`} style={{ backgroundColor: color }} aria-label={name}>{settings.accentColor === color && <Check className="h-3.5 w-3.5" />}</button>)}
              <label className="appearance-custom-color" title="Custom accent"><input aria-label="Custom accent color" type="color" value={settings.accentColor === 'preset' ? '#7567ff' : settings.accentColor} onChange={(event) => updateSettings({ accentColor: event.target.value })} /><span>Custom</span></label>
            </div>
          </section>}

          <SettingTiles setting="navigationStyle" options={['top', 'side', 'hybrid', 'floating']} search={filter} labels={{ top: 'Top navigation', side: 'Side navigation', hybrid: 'Hybrid', floating: 'Floating' }} visual />
          <SettingTiles setting="navigationShape" options={['default', 'slim', 'floating', 'stacked']} search={filter} labels={{ default: 'Default', slim: 'Slim', floating: 'Floating', stacked: 'Stacked' }} />
          <SettingTiles setting="sidebarMode" options={['full', 'compact', 'icons', 'auto']} search={filter} labels={{ full: 'Full', compact: 'Compact', icons: 'Icons only', auto: 'Auto collapse' }} />
          <SettingTiles setting="backgroundPattern" options={['none', 'grid', 'dots', 'diagonal', 'mesh', 'aurora', 'academic']} search={filter} visual />
          <SettingTiles setting="cardStyle" options={['default', 'tint', 'gradient', 'glass', 'outline', 'elevated', 'minimal']} search={filter} visual />
          <SettingTiles setting="radiusScale" options={['sharp', 'small', 'medium', 'large', 'extra']} search={filter} labels={{ sharp: 'Sharp', small: 'Small', medium: 'Medium', large: 'Large', extra: 'Extra rounded' }} />
          <SettingTiles setting="shadowLevel" options={['none', 'soft', 'medium', 'floating']} search={filter} labels={{ none: 'None', soft: 'Soft', medium: 'Medium', floating: 'Floating' }} />

          {shows('font typography scale inter jakarta geist manrope dm sans roboto') && <section className="appearance-section"><SectionTitle icon={Eye} title="Typography" description="A stable system font stack with practical scaling." />
            <SettingTiles setting="fontFamily" options={['inter', 'jakarta', 'geist', 'manrope', 'dmsans', 'roboto']} search="" labels={{ inter: 'Inter', jakarta: 'Plus Jakarta', geist: 'Geist', manrope: 'Manrope', dmsans: 'DM Sans', roboto: 'Roboto' }} />
            <label className="appearance-range"><span>Font size <b>{Math.round(settings.fontScale * 100)}%</b></span><input aria-label="Font size" type="range" min="0.9" max="1.2" step="0.05" value={settings.fontScale} onChange={(event) => updateSettings({ fontScale: Number(event.target.value) })} /><small>90% to 120%, applied to type rather than browser zoom.</small></label>
          </section>}

          <SettingTiles setting="density" options={['compact', 'comfortable', 'spacious']} search={filter} />
          <SettingTiles setting="motionLevel" options={['reduced', 'normal', 'enhanced']} search={filter} labels={{ reduced: 'Reduced', normal: 'Normal', enhanced: 'Enhanced' }} />
          <SettingTiles setting="visionMode" options={['normal', 'contrast', 'protanopia', 'deuteranopia', 'tritanopia', 'monochrome']} search={filter} labels={{ normal: 'Normal', contrast: 'High contrast', protanopia: 'Protanopia friendly', deuteranopia: 'Deuteranopia friendly', tritanopia: 'Tritanopia friendly', monochrome: 'Monochrome' }} />

          {shows('reading comfort focus content width transparency intensity ambient background') && <section className="appearance-section"><SectionTitle icon={Layers3} title="Comfort & workspace" description="Subtle controls for focus and long-form reading." />
            <Toggle label="Focus mode" description="Quiet decorative layers without changing course or exam controls." checked={settings.focusMode} onChange={(checked) => updateSettings({ focusMode: checked })} />
            <Toggle label="Comfort mode" description="Relaxed reading rhythm and paragraph measure." checked={settings.comfortMode} onChange={(checked) => updateSettings({ comfortMode: checked })} />
            <SettingTiles setting="contentWidth" options={['compact', 'balanced', 'wide', 'full']} search="" labels={{ compact: 'Compact', balanced: 'Balanced', wide: 'Wide', full: 'Full width' }} />
            <SettingTiles setting="panelTransparency" options={['low', 'medium', 'high']} search="" labels={{ low: 'Low', medium: 'Medium', high: 'High' }} />
            <SettingTiles setting="colorIntensity" options={['soft', 'balanced', 'vibrant']} search="" labels={{ soft: 'Soft', balanced: 'Balanced', vibrant: 'Vibrant' }} />
            <SettingTiles setting="ambientBackground" options={['none', 'glow', 'aurora', 'spotlight']} search="" labels={{ none: 'None', glow: 'Soft glow', aurora: 'Aurora', spotlight: 'Spotlight' }} />
          </section>}

          {shows('my presets save custom') && <section className="appearance-section"><SectionTitle icon={PanelRight} title="My presets" description="Save a trusted setup locally and reuse it any time." />
            <div className="appearance-preset-actions"><button type="button" className="appearance-secondary-action" onClick={savePreset}><Sparkles className="h-4 w-4" />Save current setup</button><button type="button" className="appearance-secondary-action" onClick={() => replaceSettings(makeRandomAppearance())}><Shuffle className="h-4 w-4" />Surprise me</button></div>
            {customPresets.length > 0 && <div className="appearance-custom-list">{customPresets.map((preset) => <div key={preset.id}><button type="button" onClick={() => replaceSettings(preset.settings)}><span className="appearance-custom-dot" style={{ background: preset.settings.accentColor === 'preset' ? 'var(--primary)' : preset.settings.accentColor }} />{preset.name}</button><button type="button" aria-label={`Rename ${preset.name}`} onClick={() => renamePreset(preset.id, preset.name)}><Pencil className="h-3.5 w-3.5" /></button><button type="button" aria-label={`Delete ${preset.name}`} onClick={() => deleteCustomPreset(preset.id)}><X className="h-3.5 w-3.5" /></button></div>)}</div>}
          </section>}

          {shows('advanced export import copy download json') && <section className="appearance-section appearance-advanced"><button type="button" className="appearance-advanced-toggle" onClick={() => setAdvancedOpen((value) => !value)}><span><Zap className="h-4 w-4" />Advanced</span><ChevronDown className={`h-4 w-4 ${advancedOpen ? 'rotate-180' : ''}`} /></button>
            {advancedOpen && <div className="appearance-advanced-body"><div className="appearance-preset-actions"><button type="button" className="appearance-secondary-action" onClick={() => void copyConfig()}><Copy className="h-4 w-4" />Copy config</button><button type="button" className="appearance-secondary-action" onClick={downloadConfig}><Download className="h-4 w-4" />Export JSON</button></div><label className="appearance-import"><span>Import appearance</span><textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Paste a Cameron appearance JSON configuration" /><button type="button" className="appearance-primary-action" onClick={importConfig}><Upload className="h-4 w-4" />Import safely</button></label>{importError && <p className="appearance-error">{importError}</p>}</div>}
          </section>}
        </div>
        {showReset && <div className="appearance-reset-confirm" role="dialog" aria-modal="true" aria-label="Reset appearance settings"><div><h3>Reset appearance settings?</h3><p>This restores Cameron Learning’s default appearance. Your account data will not change.</p><div><button type="button" className="appearance-secondary-action" onClick={() => setShowReset(false)}>Cancel</button><button type="button" className="appearance-danger-action" onClick={() => { resetSettings(); setShowReset(false); }}>Reset appearance</button></div></div></div>}
      </aside>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Palette; title: string; description: string }) {
  return <div className="appearance-section-title"><span><Icon className="h-4 w-4" />{title}</span><p>{description}</p></div>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="appearance-toggle"><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
