import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Menu, X, ChevronDown, BookOpen, GraduationCap, Map, FileText,
  Info, User, LogOut, Crown, Zap, Sparkles, Trophy, BarChart3,
  Award, Shield, Bell, Home, Activity, Code2, Sigma, Atom,
  FlaskConical, Languages, Brain, ClipboardList, TrendingUp,
  Clock, CheckCircle2, Star, Scale, Globe, MapPin, LineChart,
  Palette,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { checkAdminAccess } from '@/lib/security';
import { Logo } from '@/components/Logo';
import { NotificationBell } from '@/components/NotificationBell';
import type { Plan } from '@/lib/supabase';
import { languages, useTranslation } from '@/lib/i18n';
import { themes, useTheme } from '@/lib/theme';

/* ============ Navigation Structure ============ */

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  description?: string;
};

type NavEntry = {
  id: string;
  label: string;
  icon: typeof Home;
  items?: NavItem[];
  megaMenu?: {
    sections: { title: string; items: NavItem[] }[];
  };
};

const navGroups: NavEntry[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    items: [
      { to: '/', label: 'Home', icon: Home, description: 'Landing page & overview' },
      { to: '/profile', label: 'My Dashboard', icon: User, description: 'Ratings, activity & stats' },
      { to: '/notifications', label: 'Recent Activity', icon: Activity, description: 'Notifications & updates' },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: BookOpen,
    megaMenu: {
      sections: [
        {
          title: 'Learning Resources',
          items: [
            { to: '/courses', label: 'Courses', icon: BookOpen, description: 'Structured video courses' },
            { to: '/subjects', label: 'Subjects', icon: GraduationCap, description: 'Browse all 16+ subjects' },
            { to: '/roadmaps', label: 'Roadmaps', icon: Map, description: 'Step-by-step learning paths' },
            { to: '/resources', label: 'Resources', icon: FileText, description: 'Articles & guides' },
          ],
        },
        {
          title: 'Popular Subjects',
          items: [
            { to: '/subjects/programming', label: 'Programming', icon: Code2 },
            { to: '/subjects/mathematics', label: 'Mathematics', icon: Sigma },
            { to: '/subjects/physics', label: 'Physics', icon: Atom },
            { to: '/subjects/chemistry', label: 'Chemistry', icon: FlaskConical },
            { to: '/subjects/english', label: 'English', icon: Languages },
            { to: '/subjects/ai-ml', label: 'AI & ML', icon: Brain },
          ],
        },
      ],
    },
  },
  {
    id: 'compete',
    label: 'Compete',
    icon: Trophy,
    megaMenu: {
      sections: [
        {
          title: 'Programming',
          items: [
            { to: '/contests', label: 'Live Contests', icon: Trophy, description: 'Active & upcoming contests' },
            { to: '/contests?filter=practice', label: 'Practice Problems', icon: ClipboardList, description: 'Solo practice archive' },
            { to: '/contests?filter=virtual', label: 'Virtual Contests', icon: Clock, description: 'Replay past contests' },
          ],
        },
        {
          title: 'Academic Subjects',
          items: [
            { to: '/contests?subject=mathematics', label: 'Mathematics', icon: Sigma },
            { to: '/contests?subject=physics', label: 'Physics', icon: Atom },
            { to: '/contests?subject=chemistry', label: 'Chemistry', icon: FlaskConical },
            { to: '/contests?subject=biology', label: 'Biology', icon: BookOpen },
            { to: '/contests?subject=english', label: 'English', icon: Languages },
          ],
        },
        {
          title: 'Quick Access',
          items: [
            { to: '/contests?filter=upcoming', label: 'Upcoming Contest', icon: Clock },
            { to: '/contests?filter=finished', label: 'Recent Results', icon: CheckCircle2 },
            { to: '/profile', label: 'My Ratings', icon: TrendingUp },
            { to: '/contests?filter=history', label: 'Contest History', icon: Activity },
          ],
        },
      ],
    },
  },
  {
    id: 'community',
    label: 'Community',
    icon: Trophy,
    items: [
      { to: '/leaderboards', label: 'Rankings', icon: Trophy, description: 'Global & subject leaderboards' },
      { to: '/leaderboards', label: 'Leaderboards', icon: BarChart3, description: 'Country & school rankings' },
      { to: '/achievements', label: 'Badges', icon: Award, description: 'Badge collection & tiers' },
      { to: '/achievements', label: 'Achievements', icon: Star, description: 'All achievements' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Full analytics dashboard' },
      { to: '/analytics', label: 'Progress', icon: TrendingUp, description: 'Track your growth' },
      { to: '/analytics', label: 'Statistics', icon: Activity, description: 'Detailed performance stats' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    icon: Info,
    items: [
      { to: '/pricing', label: 'Pricing', icon: Crown, description: 'Plans & features' },
      { to: '/about', label: 'About', icon: Info, description: 'Our story & mission' },
      { to: '/resources', label: 'FAQ', icon: FileText, description: 'Help center & guides' },
      { to: '/about', label: 'Contact', icon: Globe, description: 'Get in touch' },
    ],
  },
];

const planBadge: Record<Plan, { icon: typeof Zap; label: string; color: string }> = {
  free: { icon: Sparkles, label: 'Free', color: 'bg-slate-100 text-slate-600' },
  pro: { icon: Zap, label: 'Pro', color: 'bg-indigo-100 text-indigo-700' },
  max: { icon: Crown, label: 'Max', color: 'bg-electric-100 text-electric-700' },
};

/* ============ Helper ============ */

function isActive(path: string, to: string): boolean {
  if (to === '/') return path === '/';
  return path === to || path.startsWith(`${to}/`);
}

function isGroupActive(path: string, group: NavEntry): boolean {
  if (group.items) {
    return group.items.some((item) => isActive(path, item.to));
  }
  if (group.megaMenu) {
    return group.megaMenu.sections.some((s) => s.items.some((item) => isActive(path, item.to)));
  }
  return false;
}

/* ============ Navbar Component ============ */

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { path } = useRouter();
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [path]);
  useEffect(() => { setUserMenuOpen(false); }, [path]);
  useEffect(() => { setOpenDropdown(null); }, [path]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (navRef.current && !navRef.current.contains(target)) {
        setOpenDropdown(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openDropdown]);

  // User menu outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) setUserMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [userMenuOpen]);

  useEffect(() => {
    let active = true;
    if (!user) { setCanAccessAdmin(false); return () => { active = false; }; }
    checkAdminAccess().then((allowed) => { if (active) setCanAccessAdmin(allowed); });
    return () => { active = false; };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  const toggleDropdown = useCallback((id: string) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  }, []);

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const currentPlan = profile?.plan ?? 'free';
  const badge = planBadge[currentPlan];

  return (
    <>
      <header
        ref={navRef}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'glass border-b border-slate-200/60 shadow-soft'
            : 'border-b border-transparent bg-transparent'
        }`}
        style={{ height: 'var(--header-h)' }}
      >
        <nav className="container-page flex h-full items-center justify-between">
          <Logo />

          {/* Desktop nav with dropdowns */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {navGroups.map((group) => (
              <DropdownTrigger
                key={group.id}
                group={group}
                path={path}
                openDropdown={openDropdown}
                onToggle={toggleDropdown}
              />
            ))}
          </div>

          {/* Right side: notifications + user */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeSelector />
            <LanguageSelector />
            <NotificationBell />
            {user ? (
              <div className="relative" data-user-menu>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:ring-slate-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className={`chip ${badge.color} px-2 py-0.5`}>
                    <badge.icon className="h-3 w-3" />
                    {badge.label}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-slate-200/60 animate-dropdown">
                    <div className="border-b border-slate-100 p-4">
                      <p className="text-sm font-bold text-slate-900">
                        {profile?.full_name || t('nav.myAccount')}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <UserMenuLink to="/profile" icon={User} label={t('nav.myDashboard')} />
                      <UserMenuLink to="/analytics" icon={BarChart3} label={t('nav.myAnalytics')} />
                      <UserMenuLink to="/achievements" icon={Award} label={t('nav.myBadges')} />
                      <UserMenuLink to="/leaderboards" icon={Trophy} label={t('nav.leaderboards')} />
                      <UserMenuLink to="/notifications" icon={Bell} label={t('nav.notifications')} />
                    </div>
                    <div className="my-0.5 h-px bg-slate-100" />
                    <div className="p-1.5">
                      {canAccessAdmin && (
                        <Link to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50">
                          <Shield className="h-4 w-4 text-indigo-500" />
                          {t('nav.adminConsole')}
                        </Link>
                      )}
                      <Link to="/pricing" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                        <Crown className="h-4 w-4 text-slate-400" />
                        {t('nav.managePlan')}
                      </Link>
                    </div>
                    <div className="my-0.5 h-px bg-slate-100" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-error-600 transition-colors hover:bg-error-500/5"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">{t('nav.signIn')}</Link>
                <Link to="/signup" className="btn-gradient">{t('nav.getStarted')}</Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={t('nav.toggleMenu')}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 ring-1 ring-slate-200 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        path={path}
        user={!!user}
        initials={initials}
        planBadge={badge}
        canAccessAdmin={canAccessAdmin}
        onSignOut={handleSignOut}
      />
    </>
  );
}

function ThemeSelector({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const activeTheme = themes.find(({ id }) => id === theme) ?? themes[0];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div ref={selectorRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('theme.label')}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-lift hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundImage: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})` }}
        >
          <Palette className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('theme.label')}
          className="absolute right-0 top-full z-[70] mt-2 w-64 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-slate-200/70 animate-dropdown"
        >
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {t('theme.label')}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {themes.map(({ id, primary, secondary }) => {
              const selected = id === theme;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setTheme(id);
                    setOpen(false);
                  }}
                  className={`rounded-xl p-2 text-left transition-all ${
                    selected ? 'bg-slate-100 ring-2 ring-slate-300' : 'hover:bg-slate-50 ring-1 ring-transparent'
                  }`}
                >
                  <span
                    className="mb-2 block h-8 rounded-lg shadow-sm"
                    style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                  />
                  <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    {t(`theme.${id}`)}
                    {selected && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: primary }} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageSelector({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const activeLanguage = languages.find(({ code }) => code === language) ?? languages[0];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  return (
    <div ref={selectorRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('language.label')}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center gap-2 rounded-2xl bg-white px-2.5 text-slate-700 shadow-soft ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-lift hover:ring-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-electric-500 text-white shadow-sm">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 text-left text-xs font-extrabold tracking-wide">{activeLanguage.shortLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.label')}
          className="absolute right-0 top-full z-[70] mt-2 w-48 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-slate-200/70 animate-dropdown"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {t('language.label')}
          </p>
          {languages.map(({ code, shortLabel, label }) => {
            const selected = code === language;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                  selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-extrabold ${
                  selected ? 'bg-gradient-to-br from-indigo-500 to-electric-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                }`}>
                  {shortLabel}
                </span>
                <span className="flex-1 text-xs font-bold">{label}</span>
                {selected && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ Desktop Dropdown Trigger ============ */

function DropdownTrigger({
  group, path, openDropdown, onToggle,
}: {
  group: NavEntry;
  path: string;
  openDropdown: string | null;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const isOpen = openDropdown === group.id;
  const active = isGroupActive(path, group);
  const GroupIcon = group.icon;

  return (
    <div
      className="relative"
      onMouseEnter={() => onToggle(group.id)}
    >
      <button
        onClick={() => onToggle(group.id)}
        className={`relative flex items-center gap-1 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
          active ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {t(`nav.${group.id}`)}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        {active && (
          <span className="absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 pt-2"
          onMouseLeave={() => onToggle(group.id)}
        >
          {group.megaMenu ? (
            <MegaMenuPanel sections={group.megaMenu.sections} path={path} />
          ) : group.items ? (
            <SimpleDropdownPanel items={group.items} path={path} />
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ============ Simple Dropdown Panel ============ */

function SimpleDropdownPanel({ items, path }: { items: NavItem[]; path: string }) {
  return (
    <div className="w-72 overflow-hidden rounded-3xl bg-white p-2 shadow-lift ring-1 ring-slate-200/60 animate-dropdown">
      {items.map((item, i) => {
        const Icon = item.icon;
        const active = isActive(path, item.to);
        return (
          <Link
            key={i}
            to={item.to}
            className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
              active ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
          >
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
              active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-slate-800'}`}>
                {item.label}
              </p>
              {item.description && (
                <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ============ Mega Menu Panel ============ */

function MegaMenuPanel({ sections, path }: { sections: { title: string; items: NavItem[] }[]; path: string }) {
  return (
    <div className="w-[640px] overflow-hidden rounded-3xl bg-white p-3 shadow-lift ring-1 ring-slate-200/60 animate-dropdown-mega">
      <div className={`grid gap-3 ${sections.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {sections.map((section, si) => (
          <div key={si} className="rounded-2xl bg-slate-50/50 p-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item, ii) => {
                const Icon = item.icon;
                const active = isActive(path, item.to);
                return (
                  <Link
                    key={ii}
                    to={item.to}
                    className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                      active ? 'bg-indigo-100/70' : 'hover:bg-white'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{item.description}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ User Menu Link ============ */

function UserMenuLink({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </Link>
  );
}

/* ============ Mobile Drawer ============ */

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  path: string;
  user: boolean;
  initials: string;
  planBadge: { icon: typeof Zap; label: string; color: string };
  canAccessAdmin: boolean;
  onSignOut: () => void;
};

function MobileDrawer({ open, onClose, path, user, initials, planBadge: badge, canAccessAdmin, onSignOut }: MobileDrawerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { t } = useTranslation();

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute right-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-white shadow-lift transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingTop: 'var(--header-h)' }}
      >
        <div className="flex flex-col p-4">
          {/* User header in drawer */}
          {user && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-sm font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <span className={`chip ${badge.color} px-2 py-0.5`}>
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </span>
              </div>
            </div>
          )}

          <div className="mb-3 border-b border-slate-100 pb-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500">{t('theme.label')}</p>
              <ThemeSelector />
            </div>
            <LanguageSelector className="w-full" />
          </div>

          {/* Grouped navigation */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = isGroupActive(path, group);
            const isExpanded = expandedSection === group.id;

            const subItems = 'items' in group
              ? group.items
              : 'megaMenu' in group && group.megaMenu
              ? group.megaMenu.sections.flatMap((s) => s.items)
              : [];

            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleSection(group.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
                    groupActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <GroupIcon className={`h-5 w-5 ${groupActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left">{t(`nav.${group.id}`)}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expandable sub-items */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-100 pl-3">
                    {subItems?.map((item, i) => {
                      const Icon = item.icon;
                      const active = isActive(path, item.to);
                      return (
                        <Link
                          key={i}
                          to={item.to}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                            active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div className="my-3 h-px bg-slate-100" />

          {/* Extra links */}
          <div className="space-y-1">
            <Link to="/notifications" onClick={onClose} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Bell className="h-5 w-5 text-slate-400" />
              {t('nav.notifications')}
            </Link>
            {canAccessAdmin && (
              <Link to="/admin" onClick={onClose} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                <Shield className="h-5 w-5 text-indigo-500" />
                {t('nav.adminConsole')}
              </Link>
            )}
          </div>

          {/* Auth actions */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            {user ? (
              <>
                <Link to="/profile" onClick={onClose} className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                  <User className="h-5 w-5" />
                  {t('nav.myDashboard')}
                </Link>
                <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-error-600 hover:bg-error-500/5">
                  <LogOut className="h-5 w-5" />
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Link to="/login" onClick={onClose} className="btn-ghost w-full">{t('nav.signIn')}</Link>
                <Link to="/signup" onClick={onClose} className="btn-gradient w-full">{t('footer.createAccount')}</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
