import { useEffect, useState, type FormEvent } from 'react';
import {
  LayoutDashboard, Trophy, Users, Megaphone, FileText,
  Star, Award, TrendingUp, ClipboardList, CheckCircle2, AlertCircle,
  Plus, Edit2, Trash2, Eye, MoreVertical, X, ChevronRight, Flame,
  Clock, Lock, Activity, Fingerprint, FileSearch, CheckSquare,
  Search, Filter, Pin, Calendar,
} from 'lucide-react';
import {
  adminSections, adminStats, adminUsers, adminSubmissions,
  adminAnnouncements, userStatusColors, submissionStatusColors,
  announcementStatusColors, planColors,
  type AdminSection,
} from '@/data/admin';
import {
  securityFeatures, securityEvents, deviceLogs,
  severityColors, statusMeta, securityCategoryMeta,
} from '@/lib/security';
import { contests, contestCategories, formatDuration, formatDateTime,
  type Contest, statusColors, difficultyColors, typeColors } from '@/data/contests';
import { subjectRatings, getRatingColorData } from '@/data/ratings';
import { achievements, badgeTiers, seasonalBadges, badgeTierOrder } from '@/data/achievements';
import { ContestForm } from '@/components/admin/ContestForm';
import { Link } from '@/router';
import { adminAddAdminEmail, adminListAdminEmails, adminRemoveAdminEmail } from '@/lib/security';
import type { AdminEmail } from '@/lib/supabase';
import { LoadingState } from '@/components/LoadingState';

export function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection['id']>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        onSelect={(s) => { setActiveSection(s); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-slate-200 lg:hidden"
            >
              <LayoutDashboard className="h-4 w-4 text-slate-600" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                {adminSections.find((s) => s.id === activeSection)?.label}
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                {adminSections.find((s) => s.id === activeSection)?.description}
              </p>
            </div>
          </div>
          <Link to="/" className="btn-ghost px-3 py-2 text-xs">
            <X className="h-3.5 w-3.5" />
            Exit admin
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'contests' && <ContestsSection />}
          {activeSection === 'subjects' && <SubjectsSection />}
          {activeSection === 'problems' && <ProblemsSection />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'ratings' && <RatingsSection />}
          {activeSection === 'announcements' && <AnnouncementsSection />}
          {activeSection === 'submissions' && <SubmissionsSection />}
          {activeSection === 'analytics' && <AdminAnalyticsSection />}
          {activeSection === 'badges' && <BadgesSection />}
          {activeSection === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}

/* ============ Sidebar ============ */

function AdminSidebar({
  activeSection, onSelect, open, onClose,
}: {
  activeSection: string;
  onSelect: (s: AdminSection['id']) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 transform border-r border-slate-200 bg-slate-950 transition-transform duration-300 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-slate-800 p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white px-1.5 py-1">
                <img src="/logo.png" alt="Cameron Learning" className="h-10 w-auto object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Admin Console</p>
                <p className="text-[10px] text-slate-400">Cameron Contest Platform</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Management</p>
            {adminSections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => onSelect(section.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500/20 to-electric-500/10 text-white ring-1 ring-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                  {section.label}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-xs font-bold text-white">
                AD
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">Admin User</p>
                <p className="truncate text-[10px] text-slate-400">admin@cameron.io</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ============ Overview Section ============ */

function OverviewSection() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.color} shadow-soft`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className={`chip text-[10px] ${stat.trend === 'up' ? 'bg-success-500/10 text-success-600' : 'bg-slate-100 text-slate-500'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-900">{stat.value}</p>
              <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Two column: recent activity + quick actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent submissions */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Submissions</h3>
            <Link to="/admin" className="text-xs font-semibold text-indigo-600">View all</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {adminSubmissions.slice(0, 5).map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{sub.problem}</p>
                  <p className="text-xs text-slate-400">{sub.user} · {sub.contest}</p>
                </div>
                <span className={`chip text-[10px] ${submissionStatusColors[sub.status]}`}>{sub.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAction icon={Plus} label="New Contest" color="from-indigo-500 to-indigo-700" />
            <QuickAction icon={Megaphone} label="Announcement" color="from-purple-500 to-pink-600" />
            <QuickAction icon={Users} label="Add User" color="from-electric-500 to-electric-700" />
            <QuickAction icon={Award} label="Add Badge" color="from-sun-500 to-sun-600" />
          </div>

          {/* Platform health */}
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Health</p>
            <div className="mt-3 space-y-2">
              <HealthBar label="API Response" value={98} color="bg-success-500" />
              <HealthBar label="Judge Queue" value={85} color="bg-electric-500" />
              <HealthBar label="Database" value={99} color="bg-success-500" />
              <HealthBar label="Security Alerts" value={12} color="bg-sun-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, color }: { icon: typeof Plus; label: string; color: string }) {
  return (
    <button className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </button>
  );
}

function HealthBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className="font-bold text-slate-700">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ============ Contests Section ============ */

function ContestsSection() {
  const [showForm, setShowForm] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [search, setSearch] = useState('');

  const filtered = contests.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = () => {
    setShowForm(false);
    setEditingContest(null);
  };

  if (showForm || editingContest) {
    return (
      <div className="card max-w-3xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {editingContest ? 'Edit Contest' : 'Create New Contest'}
          </h2>
          <button
            onClick={() => { setShowForm(false); setEditingContest(null); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ContestForm
          isEdit={!!editingContest}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingContest(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contests..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          New Contest
        </button>
      </div>

      {/* Contest table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">Contest</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Subject</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Type</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Difficulty</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Participants</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-700">{c.name}</p>
                    <p className="text-xs text-slate-400">{formatDuration(c.durationMinutes)}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">{c.subject}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`chip text-[10px] ${typeColors[c.type]}`}>{c.type}</span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`chip text-[10px] ${difficultyColors[c.difficulty]}`}>{c.difficulty}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`chip text-[10px] ${statusColors[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-700 lg:table-cell">
                    {c.participants}/{c.maxParticipants}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingContest(c)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-electric-50 hover:text-electric-600">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-error-50 hover:text-error-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ Subjects Section ============ */

function SubjectsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{contestCategories.length} subjects</p>
        <button className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          Add Subject
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contestCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.slug} className="card p-5">
              <div className="flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${cat.color} shadow-soft`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex gap-1">
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-error-50 hover:text-error-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{cat.name}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-sm font-bold text-slate-700">{cat.contestCount}</p>
                  <p className="text-[10px] text-slate-400">Contests</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-sm font-bold text-slate-700">{cat.activeUsers.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">Users</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-sm font-bold text-slate-700">{cat.topPlayerRating}</p>
                  <p className="text-[10px] text-slate-400">Top</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Problems Section ============ */

function ProblemsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage problem bank across all subjects</p>
        <button className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          Add Problem
        </button>
      </div>
      <div className="card p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-400">Problem bank management</p>
        <p className="mt-1 text-xs text-slate-400">Create, edit, and organize problems by subject, difficulty, and topic. Import from CSV or create individually.</p>
      </div>
    </div>
  );
}

/* ============ Users Section ============ */

function UsersSection() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = adminUsers.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <AdminEmailAllowlist />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* User table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">User</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Country</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Plan</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Rating</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Solved</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
                        {u.username.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-700">{u.username}</p>
                        <p className="truncate text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell">{u.country}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={`chip text-[10px] ${planColors[u.plan]}`}>{u.plan}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right font-bold tabular-nums text-slate-700 lg:table-cell">{u.rating}</td>
                  <td className="hidden px-4 py-3 text-right font-bold tabular-nums text-slate-700 lg:table-cell">{u.totalSolved}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`chip text-[10px] ${userStatusColors[u.status]}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-sun-50 hover:text-sun-600">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminEmailAllowlist() {
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setEmails((await adminListAdminEmails()) as AdminEmail[]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ruxsat berilgan Gmail manzillari yuklanmadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const addEmail = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@gmail.com')) {
      setError('Faqat @gmail.com manzillari ruxsat etiladi.');
      return;
    }
    setSubmitting(true);
    try {
      await adminAddAdminEmail(normalized);
      setEmail('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gmail manzili qo‘shilmadi.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeEmail = async (target: string) => {
    if (!window.confirm(`${target} manzilining admin ruxsatini olib tashlaysizmi?`)) return;
    try {
      await adminRemoveAdminEmail(target);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gmail manzili o‘chirilmadi.');
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Admin panel uchun ruxsat berilgan Gmail manzillari</h2>
          <p className="mt-1 text-xs text-slate-500">Kirish uchun foydalanuvchi admin rolida va ushbu ro‘yxatda bo‘lishi shart.</p>
        </div>
        <span className="chip bg-indigo-50 text-indigo-700">{emails.length} ta manzil</span>
      </div>
      <form onSubmit={addEmail} className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" placeholder="admin@gmail.com" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
        <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">{submitting ? 'Qo‘shilmoqda…' : 'Gmail qo‘shish'}</button>
      </form>
      {error && <p role="alert" className="mx-4 mt-4 rounded-lg bg-error-50 px-3 py-2 text-xs font-semibold text-error-600">{error}</p>}
      <div className="divide-y divide-slate-100">
        {loading ? <LoadingState className="min-h-[9rem] rounded-none" message="Gmail manzillari yuklanmoqda" /> : emails.length === 0 ? <p className="p-5 text-sm text-slate-500">Hozircha ruxsat berilgan Gmail manzili yo‘q.</p> : emails.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{entry.email}</p><p className="text-xs text-slate-400">Qo‘shilgan: {new Date(entry.created_at).toLocaleString()}</p></div>
            <button onClick={() => void removeEmail(entry.email)} className="btn-ghost shrink-0 px-3 py-2 text-xs text-error-600 hover:bg-error-50">Olib tashlash</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ Ratings Section ============ */

function RatingsSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Review and recalculate ratings across all subjects</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjectRatings.map((r) => {
          const colorData = getRatingColorData(r.currentRating);
          const Icon = r.icon;
          return (
            <div key={r.subjectSlug} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${r.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.subjectName}</p>
                    <p className="text-xs text-slate-400">{r.contestCount} contests</p>
                  </div>
                </div>
                <p className="font-display text-xl font-extrabold tabular-nums" style={{ color: colorData.hex }}>
                  {r.currentRating}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1 px-3 py-2 text-xs">
                  <Eye className="h-3 w-3" />
                  History
                </button>
                <button className="btn-ghost flex-1 px-3 py-2 text-xs">
                  <Edit2 className="h-3 w-3" />
                  Adjust
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Announcements Section ============ */

function AnnouncementsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{adminAnnouncements.length} announcements</p>
        <button className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          New Announcement
        </button>
      </div>
      <div className="space-y-3">
        {adminAnnouncements.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-indigo-500" />}
                  <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">{a.body}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                  <span>By {a.author}</span>
                  <span>·</span>
                  <span>{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>·</span>
                  <span>{a.views.toLocaleString()} views</span>
                  <span>·</span>
                  <span className="font-semibold capitalize">{a.audience}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <span className={`chip text-[10px] ${announcementStatusColors[a.status]}`}>{a.status}</span>
                <div className="flex gap-1">
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-error-50 hover:text-error-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Submissions Section ============ */

function SubmissionsSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Review flagged and pending submissions</p>
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 outline-none">
          <option>All Submissions</option>
          <option>Flagged Only</option>
          <option>Pending Review</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">Submission</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Contest</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Language</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Similarity</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminSubmissions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-700">{s.problem}</p>
                    <p className="text-xs text-slate-400">{s.user} · {s.submittedAt}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell">{s.contest}</td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">{s.language}</td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    {s.similarityScore !== undefined ? (
                      <span className={`font-bold tabular-nums ${s.similarityScore > 70 ? 'text-error-600' : s.similarityScore > 50 ? 'text-sun-600' : 'text-slate-500'}`}>
                        {s.similarityScore}%
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`chip text-[10px] ${submissionStatusColors[s.status]}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-electric-50 hover:text-electric-600">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {s.status === 'flagged' && (
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-success-50 hover:text-success-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ Admin Analytics Section ============ */

function AdminAnalyticsSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard icon={TrendingUp} label="Avg Session" value="24m" color="from-indigo-500 to-indigo-700" />
        <AdminStatCard icon={Users} label="DAU" value="12,400" color="from-electric-500 to-electric-700" />
        <AdminStatCard icon={Trophy} label="Contest Fill" value="87%" color="from-success-500 to-electric-600" />
        <AdminStatCard icon={Flame} label="Retention" value="68%" color="from-sun-500 to-sun-600" />
      </div>
      <div className="card p-6">
        <h3 className="text-sm font-bold text-slate-900">Platform Analytics</h3>
        <p className="mt-1 text-sm text-slate-500">Detailed platform-wide analytics including user growth, contest participation, revenue tracking, and engagement metrics.</p>
        <Link to="/analytics" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
          View full analytics dashboard
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function AdminStatCard({ icon: Icon, label, value, color }: { icon: typeof TrendingUp; label: string; value: string; color: string }) {
  return (
    <div className="card p-5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-soft`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

/* ============ Badges Section ============ */

function BadgesSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage achievement definitions and badge tiers</p>
        <button className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="h-4 w-4" />
          New Achievement
        </button>
      </div>

      {/* Badge tiers */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-900">Badge Tiers</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {badgeTierOrder.map((tier) => {
            const meta = badgeTiers[tier];
            const Icon = meta.icon;
            return (
              <div key={tier} className={`flex items-center gap-2 rounded-2xl ${meta.bg} px-4 py-2.5 ring-1 ${meta.ring}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} ${meta.glow}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className={`text-sm font-bold ${meta.text}`}>{meta.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">Achievement</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Category</th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="hidden px-4 py-3 text-center md:table-cell">Unlocked</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => {
                const tier = badgeTiers[a.tier];
                const Icon = a.icon;
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${tier.gradient}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-sm capitalize text-slate-500 sm:table-cell">{a.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`chip text-[10px] ${tier.bg} ${tier.text} ring-1 ${tier.ring}`}>{tier.name}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-center text-sm font-bold text-slate-700 md:table-cell">
                      {a.unlocked ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-error-50 hover:text-error-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal badges */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-900">Seasonal Event Badges</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seasonalBadges.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.id} className="card flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${b.gradient} ${b.glow}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-700">{b.name}</p>
                  <p className="truncate text-xs text-slate-400">{b.season}</p>
                </div>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Security Section ============ */

function SecuritySection() {
  return (
    <div className="space-y-6">
      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {securityFeatures.map((feature) => {
          const Icon = feature.icon;
          const sMeta = statusMeta[feature.status];
          const StatusIcon = sMeta.icon;
          return (
            <div key={feature.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 shadow-soft">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className={`chip text-[10px] ${sMeta.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {sMeta.label}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{feature.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{feature.description}</p>
              <ul className="mt-3 space-y-1.5">
                {feature.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-success-500" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Security events */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="h-4 w-4 text-error-500" />
            Security Events
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {securityEvents.map((event) => {
            const sevColor = severityColors[event.severity];
            return (
              <div key={event.id} className="flex items-start gap-3 p-4">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${sevColor.bg} ${sevColor.text} ring-1 ${sevColor.ring}`}>
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{event.type}</p>
                    <span className={`chip text-[10px] ${sevColor.bg} ${sevColor.text} ring-1 ${sevColor.ring}`}>{event.severity}</span>
                    {event.resolved && <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{event.description}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{event.user}</span>
                    <span>·</span>
                    <span>{event.contest}</span>
                    <span>·</span>
                    <span>{new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                </div>
                <span className={`chip flex-shrink-0 text-[10px] ${event.resolved ? 'bg-success-500/10 text-success-600' : 'bg-sun-500/10 text-sun-600'}`}>
                  {event.action}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Device logs */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Fingerprint className="h-4 w-4 text-indigo-500" />
            Device Logs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left">User</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Device</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Browser</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Location</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">IP</th>
                <th className="px-4 py-3 text-center">Trusted</th>
              </tr>
            </thead>
            <tbody>
              {deviceLogs.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-700">{d.user}</p>
                    <p className="text-xs text-slate-400">{d.lastActive}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell">{d.device}</td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 lg:table-cell">{d.browser}</td>
                  <td className="hidden px-4 py-3 text-sm text-slate-500 sm:table-cell">{d.location}</td>
                  <td className="hidden px-4 py-3 text-sm font-mono text-slate-500 lg:table-cell">{d.ipAddress}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`chip text-[10px] ${d.trusted ? 'bg-success-500/10 text-success-600' : 'bg-sun-500/10 text-sun-600'}`}>
                      {d.trusted ? 'Trusted' : 'Unverified'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
