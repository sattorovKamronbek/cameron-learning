import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Command, Moon, Palette, Sun } from 'lucide-react';
import { useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { useAccessControl } from '@/lib/access';
import { useAppearance } from '@/lib/theme';

type CommandItem = { id: string; title: string; detail: string; action: () => void; icon: typeof Command };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { adminAccess, canManageContests } = useAccessControl();
  const { openStudio, updateSettings } = useAppearance();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setOpen((value) => !value);
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault(); setOpen(false); openStudio();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openStudio]);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const commands = useMemo<CommandItem[]>(() => {
    const go = (title: string, detail: string, path: string): CommandItem => ({ id: path, title, detail, icon: ArrowRight, action: () => { navigate(path); setOpen(false); } });
    const items = [
      go('Go to Home', 'Platform overview', '/'), go('Go to Courses', 'Learning catalogue', '/courses'),
      go('Go to Contests', 'Browse contests and exams', '/contests'), go('Go to Dashboard', 'Your learning progress', '/dashboard'),
      go('Open Profile', 'Account and learning record', '/profile'),
      { id: 'appearance', title: 'Open Appearance Studio', detail: 'Customize the visual workspace', icon: Palette, action: () => { setOpen(false); openStudio(); } },
      { id: 'dark', title: 'Switch to Dark Mode', detail: 'Use a dark appearance', icon: Moon, action: () => { updateSettings({ colorMode: 'dark' }); setOpen(false); } },
      { id: 'light', title: 'Switch to Light Mode', detail: 'Use a light appearance', icon: Sun, action: () => { updateSettings({ colorMode: 'light' }); setOpen(false); } },
    ];
    if (!user) return items.filter((item) => !['/dashboard', '/profile'].includes(item.id));
    if (canManageContests) items.push(go('Contest management', 'Authorized contest tools', '/contest-management'));
    if (adminAccess) items.push(go('Admin console', 'Authorized administration tools', '/admin'));
    return items;
  }, [adminAccess, canManageContests, navigate, openStudio, updateSettings, user]);
  const visible = commands.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()));

  if (!open) return null;
  return <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
    <button type="button" className="command-backdrop" aria-label="Close command palette" onClick={() => setOpen(false)} />
    <div className="command-palette">
      <div className="command-input"><Command className="h-5 w-5" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands or navigate…" /><kbd>Esc</kbd></div>
      <div className="command-results">{visible.length ? visible.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={item.action}><span className="command-icon"><Icon className="h-4 w-4" /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight className="ml-auto h-4 w-4" /></button>; }) : <p>No matching commands.</p>}</div>
      <footer><span><kbd>↵</kbd> Select</span><span><kbd>⌘</kbd><kbd>K</kbd> Toggle</span></footer>
    </div>
  </div>;
}
