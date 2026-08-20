import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import { AppSelect } from '@/components/AppSelect';
import { useAuth } from '@/lib/auth';
import {
  adminAddAdminEmail,
  adminCreateAnnouncement,
  adminListAdminEmails,
  adminListAuditLogs,
  adminListUsers,
  adminRemoveAdminEmail,
  adminUpdateUserRole,
  adminUpdateUserStatus,
} from '@/lib/security';
import {
  fetchManagedContests,
  fetchContestAdminResults,
  fetchWritingSubmissions,
  gradeWritingSubmission,
  type ManagedContest,
  type ContestAdminResult,
  type WritingSubmission,
} from '@/lib/contests';
import type { AdminEmail, AdminUserView, AuditLog, Role, UserStatus } from '@/lib/supabase';

type Section = 'overview' | 'users' | 'audit' | 'allowlist' | 'announcements' | 'contests';

const roles: Role[] = ['user', 'judge', 'admin'];
const statuses: UserStatus[] = ['active', 'suspended', 'banned'];

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function displayName(person: Pick<AdminUserView, 'full_name' | 'email'>) {
  return person.full_name?.trim() || person.email;
}

function formatDetails(details: Record<string, unknown> | null | undefined) {
  if (!details || Object.keys(details).length === 0) return 'No additional details';
  return JSON.stringify(details);
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [section, setSection] = useState<Section>('overview');
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [contests, setContests] = useState<ManagedContest[]>([]);
  const [contestResults, setContestResults] = useState<Record<string, ContestAdminResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutation, setMutation] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRows, auditRows, emailRows, contestRows] = await Promise.all([
        adminListUsers(),
        adminListAuditLogs(100),
        adminListAdminEmails(),
        fetchManagedContests(),
      ]);
      setUsers(asList<AdminUserView>(userRows));
      setAuditLogs(asList<AuditLog>(auditRows));
      setAdminEmails(asList<AdminEmail>(emailRows));
      const managedContests = asList<ManagedContest>(contestRows);
      setContests(managedContests);
      
      // Fetch results for finished contests
      const resultsMap: Record<string, ContestAdminResult[]> = {};
      const finishedContests = managedContests.filter((c) => c.isPublished && c.status === 'Finished');
      
      for (const contest of finishedContests) {
        try {
          const results = await fetchContestAdminResults(contest.id);
          resultsMap[contest.id] = asList<ContestAdminResult>(results);
        } catch {
          // Individual contest result fetch errors are ignored to allow partial loading
          resultsMap[contest.id] = [];
        }
      }
      setContestResults(resultsMap);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshContestResult = useCallback(async (contestId: string) => {
    const rows = await fetchContestAdminResults(contestId);
    setContestResults((current) => ({
      ...current,
      [contestId]: asList<ContestAdminResult>(rows),
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeUsers = useMemo(
    () => users.filter((entry) => entry.status === 'active').length,
    [users],
  );
  const initialLoadFailed = Boolean(error) && users.length === 0 && auditLogs.length === 0 && adminEmails.length === 0;

  const runMutation = useCallback(async (
    key: string,
    operation: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setMutation(key);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(successMessage);
      await refresh();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'The requested change could not be completed.');
    } finally {
      setMutation(null);
    }
  }, [refresh]);

  const changeRole = async (target: AdminUserView, nextRole: Role) => {
    if (target.id === user?.id || target.role === nextRole) return;
    const confirmed = window.confirm(
      'Change ' + displayName(target) + '\'s role from ' + target.role + ' to ' + nextRole + '?',
    );
    if (!confirmed) return;
    await runMutation(
      'role:' + target.id,
      () => adminUpdateUserRole(target.id, nextRole),
      'Role updated for ' + displayName(target) + '.',
    );
  };

  const changeStatus = async (target: AdminUserView, nextStatus: UserStatus) => {
    if (target.id === user?.id || target.status === nextStatus) return;

    let reason: string | undefined;
    if (nextStatus !== 'active') {
      const enteredReason = window.prompt(
        'Provide a reason for changing ' + displayName(target) + '\'s status to ' + nextStatus + '.',
      );
      reason = enteredReason?.trim();
      if (!reason) return;
    }

    const confirmed = window.confirm(
      'Change ' + displayName(target) + '\'s status from ' + target.status + ' to ' + nextStatus + '?',
    );
    if (!confirmed) return;
    await runMutation(
      'status:' + target.id,
      () => adminUpdateUserStatus(target.id, nextStatus, reason),
      'Account status updated for ' + displayName(target) + '.',
    );
  };

  const addAdminEmail = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    const confirmed = window.confirm(
      'Add ' + normalized + ' to the admin allowlist? This can grant admin-console access to an active admin account.',
    );
    if (!confirmed) return;
    await runMutation(
      'allowlist:add',
      () => adminAddAdminEmail(normalized),
      normalized + ' was added to the admin allowlist.',
    );
  };

  const removeAdminEmail = async (entry: AdminEmail) => {
    if (entry.email.toLowerCase() === user?.email?.toLowerCase()) return;
    const confirmed = window.confirm(
      'Remove ' + entry.email + ' from the admin allowlist? Their next admin access check will fail unless another allowlist entry applies.',
    );
    if (!confirmed) return;
    await runMutation(
      'allowlist:remove:' + entry.id,
      () => adminRemoveAdminEmail(entry.email),
      entry.email + ' was removed from the admin allowlist.',
    );
  };

  const broadcastAnnouncement = useCallback(async (
    title: string,
    message: string,
    actionLabel: string,
    actionLink: string,
  ): Promise<boolean> => {
    const confirmed = window.confirm(
      'Send this announcement to every active account? This action cannot be undone.',
    );
    if (!confirmed) return false;

    setMutation('announcement');
    setError(null);
    setNotice(null);
    try {
      const recipientCount = await adminCreateAnnouncement(title, message, actionLabel || undefined, actionLink || undefined);
      setNotice(`Announcement sent to ${recipientCount} active ${recipientCount === 1 ? 'account' : 'accounts'}.`);
      await refresh();
      return true;
    } catch (announcementError) {
      setError(announcementError instanceof Error ? announcementError.message : 'The announcement could not be sent.');
      return false;
    } finally {
      setMutation(null);
    }
  }, [refresh]);

  const leaveAdmin = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Protected area</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Admin console</h1>
            <p className="mt-1 text-sm text-slate-500">Only records returned by protected server-side RPCs are shown here.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="btn-ghost px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </button>
            <Link to="/contest-management" className="btn-primary px-4 py-2 text-sm">
              Contest va imtihonlar
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => void leaveAdmin()} className="btn-ghost px-3 py-2 text-sm">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-8">
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Admin sections">
          <SectionButton active={section === 'overview'} onClick={() => setSection('overview')} icon={Activity}>
            Overview
          </SectionButton>
          <SectionButton active={section === 'users'} onClick={() => setSection('users')} icon={Users}>
            Users
          </SectionButton>
          <SectionButton active={section === 'contests'} onClick={() => setSection('contests')} icon={Trophy}>
            Contests
          </SectionButton>
          <SectionButton active={section === 'audit'} onClick={() => setSection('audit')} icon={Clock3}>
            Audit log
          </SectionButton>
          <SectionButton active={section === 'allowlist'} onClick={() => setSection('allowlist')} icon={ShieldCheck}>
            Admin allowlist
          </SectionButton>
          <SectionButton active={section === 'announcements'} onClick={() => setSection('announcements')} icon={Megaphone}>
            Announcements
          </SectionButton>
        </nav>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Unable to complete the request</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
            <button type="button" onClick={() => void refresh()} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-success-200 bg-success-500/10 p-4 text-sm text-success-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
            <p>{notice}</p>
          </div>
        )}

        {loading ? (
          <LoadingState className="card min-h-[280px]" message="Admin records are loading" />
        ) : initialLoadFailed ? (
          <div className="card p-10 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-error-500" />
            <h2 className="mt-4 text-base font-bold text-slate-800">Protected records are unavailable</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Nothing is shown until the protected RPC requests succeed, so this console never substitutes placeholder data.
            </p>
            <button type="button" onClick={() => void refresh()} className="btn-primary mt-5 px-4 py-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <Overview
                userCount={users.length}
                activeUserCount={activeUsers}
                auditCount={auditLogs.length}
                allowlistCount={adminEmails.length}
              />
            )}
            {section === 'users' && (
              <UsersPanel
                users={users}
                currentUserId={user?.id}
                mutation={mutation}
                onChangeRole={changeRole}
                onChangeStatus={changeStatus}
              />
            )}
            {section === 'contests' && (
              <ContestsPanel contests={contests} results={contestResults} onResultRefresh={refreshContestResult} />
            )}
            {section === 'audit' && <AuditPanel records={auditLogs} />}
            {section === 'allowlist' && (
              <AllowlistPanel
                entries={adminEmails}
                currentEmail={user?.email}
                mutation={mutation}
                onAdd={addAdminEmail}
                onRemove={removeAdminEmail}
              />
            )}
            {section === 'announcements' && (
              <AnnouncementPanel
                sending={mutation === 'announcement'}
                onSend={broadcastAnnouncement}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SectionButton({
  active,
  children,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? 'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-soft'
        : 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Overview({
  userCount,
  activeUserCount,
  auditCount,
  allowlistCount,
}: {
  userCount: number;
  activeUserCount: number;
  auditCount: number;
  allowlistCount: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users} label="Profiles loaded" value={String(userCount)} description="From the protected user list" />
        <Metric icon={CheckCircle2} label="Active profiles" value={String(activeUserCount)} description="Among loaded profiles" />
        <Metric icon={Activity} label="Audit records loaded" value={String(auditCount)} description="Most recent 100 records at most" />
        <Metric icon={ShieldCheck} label="Allowlisted emails" value={String(allowlistCount)} description="Current protected allowlist" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900">Real administration only</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            This console intentionally does not show demo contests, ratings, submission figures, or health percentages.
            It exposes only data supplied by the admin RPCs.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900">Contest operations</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Create, publish, and manage Science, IELTS, CEFR, and other real contests in the dedicated area.
          </p>
          <Link to="/contest-management" className="btn-ghost mt-4 px-0 text-sm text-indigo-700">
            Open contest management
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function UsersPanel({
  users,
  currentUserId,
  mutation,
  onChangeRole,
  onChangeStatus,
}: {
  users: AdminUserView[];
  currentUserId: string | undefined;
  mutation: string | null;
  onChangeRole: (target: AdminUserView, nextRole: Role) => Promise<void>;
  onChangeStatus: (target: AdminUserView, nextStatus: UserStatus) => Promise<void>;
}) {
  if (users.length === 0) {
    return <EmptyState icon={Users} title="No user profiles found" message="No profiles were returned by the protected admin user list." />;
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-bold text-slate-900">User management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Changes require confirmation and are enforced again by server-side RPC authorization. You cannot change your own role or status here.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((entry) => {
              const isCurrentUser = entry.id === currentUserId;
              const isRoleUpdating = mutation === 'role:' + entry.id;
              const isStatusUpdating = mutation === 'status:' + entry.id;
              const isLocked = isCurrentUser || Boolean(mutation);

              return (
                <tr key={entry.id} className="border-b border-slate-50 align-top last:border-b-0">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-800">{displayName(entry)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{entry.email}</p>
                    {(entry.country || entry.school) && (
                      <p className="mt-1 text-xs text-slate-500">{[entry.country, entry.school].filter(Boolean).join(' · ')}</p>
                    )}
                    {isCurrentUser && <p className="mt-1 text-xs font-semibold text-indigo-600">Current account</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{entry.plan}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(entry.created_at)}</td>
                  <td className="px-5 py-4">
                    <label className="sr-only" htmlFor={'role-' + entry.id}>Role for {entry.email}</label>
                    <AppSelect
                      id={'role-' + entry.id}
                      value={entry.role}
                      disabled={isLocked}
                      onChange={(value) => void onChangeRole(entry, value as Role)}
                      options={roles.map((role) => ({ value: role, label: role }))}
                      ariaLabel={`Role for ${entry.email}`}
                      className="min-w-[120px]"
                      triggerClassName="rounded-lg py-2"
                    />
                    {isRoleUpdating && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
                  </td>
                  <td className="px-5 py-4">
                    <label className="sr-only" htmlFor={'status-' + entry.id}>Status for {entry.email}</label>
                    <AppSelect
                      id={'status-' + entry.id}
                      value={entry.status}
                      disabled={isLocked}
                      onChange={(value) => void onChangeStatus(entry, value as UserStatus)}
                      options={statuses.map((status) => ({ value: status, label: status }))}
                      ariaLabel={`Status for ${entry.email}`}
                      className="min-w-[120px]"
                      triggerClassName="rounded-lg py-2"
                    />
                    {entry.suspended_reason && <p className="mt-1 max-w-xs text-xs text-slate-400">Reason: {entry.suspended_reason}</p>}
                    {isStatusUpdating && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditPanel({ records }: { records: AuditLog[] }) {
  if (records.length === 0) {
    return <EmptyState icon={Clock3} title="No audit records found" message="The protected audit log did not return any records yet." />;
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-bold text-slate-900">Recent audit log</h2>
        <p className="mt-1 text-sm text-slate-500">The latest records returned by the server, limited to 100.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {records.map((record) => (
          <article key={record.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{record.action}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {record.actor_email} · {record.actor_role}
                  {record.target_type ? ' · ' + record.target_type : ''}
                </p>
              </div>
              <time className="text-xs text-slate-400">{formatDate(record.created_at)}</time>
            </div>
            <p title={formatDetails(record.details)} className="mt-2 truncate font-mono text-xs text-slate-500">
              {formatDetails(record.details)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AllowlistPanel({
  entries,
  currentEmail,
  mutation,
  onAdd,
  onRemove,
}: {
  entries: AdminEmail[];
  currentEmail: string | undefined;
  mutation: string | null;
  onAdd: (email: string) => Promise<void>;
  onRemove: (entry: AdminEmail) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const adding = mutation === 'allowlist:add';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onAdd(email);
    setEmail('');
  };

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-indigo-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Admin allowlist</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Entries are managed through protected RPCs. Confirm every change carefully; allowlist access is checked in addition to the admin role.
            </p>
          </div>
        </div>
        <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="admin-email">Email address to allowlist</label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@your-domain.com"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button type="submit" disabled={adding} className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60">
            <Mail className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add email'}
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Current entries</h2>
        </div>
        {entries.length === 0 ? (
          <EmptyState icon={Mail} title="No allowlist entries found" message="No emails were returned by the protected allowlist RPC." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const isCurrentEmail = entry.email.toLowerCase() === currentEmail?.toLowerCase();
              const removing = mutation === 'allowlist:remove:' + entry.id;
              const cannotRemove = isCurrentEmail || entries.length <= 1 || Boolean(mutation);
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{entry.email}</p>
                    <p className="mt-1 text-xs text-slate-400">Added {formatDate(entry.created_at)}</p>
                    {isCurrentEmail && <p className="mt-1 text-xs font-semibold text-indigo-600">Your current email cannot be removed here.</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRemove(entry)}
                    disabled={cannotRemove}
                    className="btn-ghost px-3 py-2 text-sm text-error-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AnnouncementPanel({
  sending,
  onSend,
}: {
  sending: boolean;
  onSend: (title: string, message: string, actionLabel: string, actionLink: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanActionLabel = actionLabel.trim();
    const cleanActionLink = actionLink.trim();

    if (!cleanTitle || !cleanMessage) {
      setFormError('A title and message are required.');
      return;
    }
    if (Boolean(cleanActionLabel) !== Boolean(cleanActionLink)) {
      setFormError('Provide both the action label and its destination, or leave both blank.');
      return;
    }
    if (cleanActionLink && (
      !/^(?:https?:\/\/[^\s]+|\/[^\s]*)$/i.test(cleanActionLink)
      || cleanActionLink.startsWith('//')
      || (cleanActionLink.startsWith('/') && cleanActionLink.includes('\\'))
    )) {
      setFormError('The action destination must be an https URL or a site-relative path.');
      return;
    }

    setFormError(null);
    const sent = await onSend(cleanTitle, cleanMessage, cleanActionLabel, cleanActionLink);
    if (sent) {
      setTitle('');
      setMessage('');
      setActionLabel('');
      setActionLink('');
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 h-5 w-5 text-indigo-600" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Broadcast announcement</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Send a real in-app notification to every active account. Delivery and audit logging are performed by the protected server-side RPC.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
        {formError && <p role="alert" className="rounded-xl bg-error-50 p-3 text-sm text-error-700">{formError}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Title</span>
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="input"
            placeholder="Important platform update"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Message</span>
          <textarea
            required
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="input min-h-32 resize-y"
            placeholder="Write the announcement shown to active learners."
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Action label <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              maxLength={80}
              value={actionLabel}
              onChange={(event) => setActionLabel(event.target.value)}
              className="input"
              placeholder="View details"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Action destination <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              maxLength={500}
              value={actionLink}
              onChange={(event) => setActionLink(event.target.value)}
              className="input"
              placeholder="/contests or https://…"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60">
            <Megaphone className="h-4 w-4" />
            {sending ? 'Sending…' : 'Send announcement'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ContestsPanel({
  contests,
  results,
  onResultRefresh,
}: {
  contests: ManagedContest[];
  results: Record<string, ContestAdminResult[]>;
  onResultRefresh: (contestId: string) => Promise<void>;
}) {
  const [expandedContestId, setExpandedContestId] = useState<string | null>(null);
  const [expandedWritingKey, setExpandedWritingKey] = useState<string | null>(null);
  const [writingByContest, setWritingByContest] = useState<Record<string, WritingSubmission[]>>({});
  const [writingGrades, setWritingGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [writingLoadingContestId, setWritingLoadingContestId] = useState<string | null>(null);
  const [savingWritingId, setSavingWritingId] = useState<string | null>(null);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingNotice, setWritingNotice] = useState<string | null>(null);

  if (contests.length === 0) {
    return <EmptyState icon={Trophy} title="No managed contests found" message="You have not created any contests yet, or the protected list did not return any contests." />;
  }

  const finishedContests = contests.filter((contest) => contest.isPublished && contest.status === 'Finished');

  if (finishedContests.length === 0) {
    return <EmptyState icon={Trophy} title="No finished contests" message="Contests that have ended will appear here with their results." />;
  }

  const toggleContest = (contestId: string) => {
    setExpandedContestId((current) => current === contestId ? null : contestId);
    setExpandedWritingKey(null);
    setWritingError(null);
    setWritingNotice(null);
  };

  const toggleWriting = async (contestId: string, userId: string) => {
    const key = `${contestId}:${userId}`;
    if (expandedWritingKey === key) {
      setExpandedWritingKey(null);
      return;
    }

    setWritingError(null);
    setWritingNotice(null);
    setExpandedWritingKey(key);
    if (writingByContest[contestId]) return;

    setWritingLoadingContestId(contestId);
    try {
      const submissions = await fetchWritingSubmissions(contestId);
      setWritingByContest((current) => ({ ...current, [contestId]: submissions }));
      setWritingGrades((current) => {
        const next = { ...current };
        for (const submission of submissions) {
          next[submission.id] = {
            score: submission.score === null ? '' : String(submission.score),
            feedback: submission.feedback ?? '',
          };
        }
        return next;
      });
    } catch (reason) {
      setWritingError(reason instanceof Error ? reason.message : 'Writing javoblari yuklanmadi.');
    } finally {
      setWritingLoadingContestId(null);
    }
  };

  const saveWritingGrade = async (contestId: string, submission: WritingSubmission) => {
    const grade = writingGrades[submission.id] ?? {
      score: submission.score === null ? '' : String(submission.score),
      feedback: submission.feedback ?? '',
    };
    const score = Number(grade.score);
    if (!Number.isInteger(score) || score < 0 || score > submission.maxPoints) {
      setWritingNotice(null);
      setWritingError(`Ball 0 va ${submission.maxPoints} oralig‘idagi butun son bo‘lishi kerak.`);
      return;
    }

    setSavingWritingId(submission.id);
    setWritingError(null);
    setWritingNotice(null);
    try {
      await gradeWritingSubmission(submission.id, score, grade.feedback);
      const refreshed = await fetchWritingSubmissions(contestId);
      setWritingByContest((current) => ({ ...current, [contestId]: refreshed }));
      setWritingGrades((current) => {
        const next = { ...current };
        for (const item of refreshed) {
          next[item.id] = {
            score: item.score === null ? '' : String(item.score),
            feedback: item.feedback ?? '',
          };
        }
        return next;
      });
      await onResultRefresh(contestId);
      setWritingNotice(`${submission.partTitle} bahosi saqlandi.`);
    } catch (reason) {
      setWritingError(reason instanceof Error ? reason.message : 'Writing bahosini saqlab bo‘lmadi.');
    } finally {
      setSavingWritingId(null);
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-bold text-slate-900">Contest natijalari</h2>
        <p className="mt-1 text-sm text-slate-500">
          Tugagan contestlarning to‘liq natijalari shu yerda. Contestni oching, Listening, Reading va Writing natijalarini alohida ko‘ring.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {finishedContests.map((contest) => {
          const contestResults = results[contest.id] || [];
          const participantCount = contestResults.length;
          const topScore = contestResults[0]?.score ?? 0;
          const expanded = expandedContestId === contest.id;

          return (
            <article key={contest.id} className="bg-white">
              <button
                type="button"
                onClick={() => toggleContest(contest.id)}
                className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{contest.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{contest.subject}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(contest.startTime).toLocaleString()} – {new Date(contest.endTime).toLocaleString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-5">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{participantCount}</p>
                    <p className="text-xs text-slate-400">Participants</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{topScore}</p>
                    <p className="text-xs text-slate-400">Top score</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                    {expanded ? 'Yopish' : 'To‘liq natijalar'}
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  {participantCount === 0 ? (
                    <div className="p-6 text-sm text-slate-500">Bu contest uchun server natija qaytarmadi.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1120px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3">O‘rin</th>
                            <th className="px-4 py-3">Ishtirokchi</th>
                            <th className="px-4 py-3 text-center">Listening</th>
                            <th className="px-4 py-3 text-center">Reading</th>
                            <th className="px-4 py-3 text-center">Writing</th>
                            <th className="px-4 py-3 text-center">Umumiy</th>
                            <th className="px-4 py-3 text-right">Holat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {contestResults.map((result) => {
                            const writingKey = `${contest.id}:${result.userId}`;
                            const writingExpanded = expandedWritingKey === writingKey;
                            const participantWriting = (writingByContest[contest.id] ?? [])
                              .filter((submission) => submission.userId === result.userId)
                              .sort((left, right) => left.partPosition - right.partPosition);
                            const writingLoading = writingLoadingContestId === contest.id && writingExpanded;

                            return (
                              <Fragment key={result.userId}>
                                <tr className="align-top text-slate-700">
                                  <td className="px-4 py-4 font-bold text-indigo-700">#{result.rank}</td>
                                  <td className="px-4 py-4">
                                    <p className="font-bold text-slate-900">{result.displayName}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{result.answeredCount}/{result.totalQuestions} item saqlangan</p>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <p className="font-display text-lg font-extrabold text-slate-900">{result.listeningCorrectCount}/{result.listeningTotalQuestions}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{result.listeningAnsweredCount}/{result.listeningTotalQuestions} javob</p>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <p className="font-display text-lg font-extrabold text-slate-900">{result.readingCorrectCount}/{result.readingTotalQuestions}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{result.readingAnsweredCount}/{result.readingTotalQuestions} javob</p>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    {result.writingTotalCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => void toggleWriting(contest.id, result.userId)}
                                        className="mx-auto inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span>
                                          {result.writingSubmittedCount}/{result.writingTotalCount}
                                          {result.pendingWritingCount > 0
                                            ? ` · ${result.pendingWritingCount} baholanmagan`
                                            : ` · ${result.writingScore}/${result.writingMaxPoints}`}
                                        </span>
                                        {writingExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-400">Writing yo‘q</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <p className="font-display text-xl font-extrabold text-slate-900">{result.score}</p>
                                    {result.pendingWritingCount > 0 && <p className="mt-1 text-[11px] font-semibold text-sun-700">Writing hali qo‘shilmagan</p>}
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    {result.pendingWritingCount > 0 ? (
                                      <span className="text-xs font-bold text-sun-700">Writing kutilmoqda</span>
                                    ) : result.completedAt ? (
                                      <span className="text-xs font-bold text-success-700">Yakunlagan</span>
                                    ) : (
                                      <span className="text-xs font-semibold text-slate-500">Vaqt bilan yopilgan</span>
                                    )}
                                  </td>
                                </tr>

                                {writingExpanded && (
                                  <tr>
                                    <td colSpan={7} className="bg-indigo-50/40 px-4 py-4">
                                      <div className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Writing tekshiruvi</p>
                                            <h3 className="mt-1 text-base font-bold text-slate-900">{result.displayName}</h3>
                                            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">Task 1 va Task 2 javoblarini shu yerning o‘zida o‘qing, ball qo‘ying va kerak bo‘lsa feedback yozing. Saqlangan ball umumiy natijaga darhol qo‘shiladi.</p>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${contest.isFinalized ? 'bg-success-50 text-success-700' : result.pendingWritingCount > 0 ? 'bg-sun-50 text-sun-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                              {contest.isFinalized ? 'Natija yakunlangan' : result.pendingWritingCount > 0 ? `${result.pendingWritingCount} ta baholanmagan` : `Writing ${result.writingScore}/${result.writingMaxPoints}`}
                                            </span>
                                          </div>
                                        </div>

                                        {writingNotice && (
                                          <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-xs font-semibold text-success-700">
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            {writingNotice}
                                          </div>
                                        )}

                                        {writingLoading ? (
                                          <div className="py-8 text-center text-sm text-slate-500">Writinglar yuklanmoqda…</div>
                                        ) : writingError ? (
                                          <div className="mt-4 rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700">{writingError}</div>
                                        ) : participantWriting.length === 0 ? (
                                          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Bu participantning Writing submissioni topilmadi.</div>
                                        ) : (
                                          <div className="mt-4 space-y-5">
                                            {participantWriting.map((submission, index) => {
                                              const taskNumber = submission.partPosition >= 8 ? submission.partPosition - 7 : index + 1;
                                              const grade = writingGrades[submission.id] ?? {
                                                score: submission.score === null ? '' : String(submission.score),
                                                feedback: submission.feedback ?? '',
                                              };
                                              const saving = savingWritingId === submission.id;
                                              const wordCount = submission.content.trim() ? submission.content.trim().split(/\s+/).length : 0;
                                              const gradingLocked = contest.isFinalized || savingWritingId !== null;
                                              return (
                                                <article key={submission.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                                                    <div>
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">Writing Task {taskNumber}</p>
                                                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{wordCount} so‘z</span>
                                                      </div>
                                                      <p className="mt-1 text-sm font-bold text-slate-900">{submission.partTitle}</p>
                                                      <p className="mt-1 text-[11px] text-slate-400">Yuborilgan: {formatDate(submission.submittedAt)}</p>
                                                    </div>
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${submission.score === null ? 'bg-sun-50 text-sun-700' : 'bg-success-50 text-success-700'}`}>
                                                      {submission.score === null ? 'Baholanmagan' : `${submission.score}/${submission.maxPoints} ball`}
                                                    </span>
                                                  </div>

                                                  <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
                                                    <div className="min-w-0 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
                                                      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Participant javobi</p>
                                                      <div className="max-h-[420px] overflow-y-auto rounded-xl bg-slate-50 p-4">
                                                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{submission.content}</p>
                                                      </div>
                                                    </div>

                                                    <div className="bg-white p-5">
                                                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Baholash</p>
                                                      {contest.isFinalized && (
                                                        <div className="mt-3 rounded-xl border border-success-200 bg-success-50 p-3 text-xs leading-relaxed text-success-700">Natija yakunlangan. Writing bahosini endi o‘zgartirib bo‘lmaydi.</div>
                                                      )}

                                                      <label className="mt-4 block">
                                                        <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
                                                          <span>Ball</span>
                                                          <span className="font-normal text-slate-400">0 – {submission.maxPoints}</span>
                                                        </span>
                                                        <input
                                                          type="number"
                                                          min={0}
                                                          max={submission.maxPoints}
                                                          step={1}
                                                          value={grade.score}
                                                          disabled={gradingLocked}
                                                          onChange={(event) => setWritingGrades((current) => ({
                                                            ...current,
                                                            [submission.id]: { ...grade, score: event.target.value },
                                                          }))}
                                                          className="input text-center font-display text-lg font-extrabold tabular-nums"
                                                          placeholder={`0–${submission.maxPoints}`}
                                                        />
                                                      </label>

                                                      <label className="mt-4 block">
                                                        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Feedback <span className="font-normal text-slate-400">(ixtiyoriy)</span></span>
                                                        <textarea
                                                          value={grade.feedback}
                                                          disabled={gradingLocked}
                                                          onChange={(event) => setWritingGrades((current) => ({
                                                            ...current,
                                                            [submission.id]: { ...grade, feedback: event.target.value },
                                                          }))}
                                                          className="input min-h-28 resize-y text-sm"
                                                          placeholder="Masalan: structure yaxshi, lekin grammar xatolari bor…"
                                                        />
                                                      </label>

                                                      <button
                                                        type="button"
                                                        disabled={gradingLocked || !grade.score.trim()}
                                                        onClick={() => void saveWritingGrade(contest.id, submission)}
                                                        className="btn-primary mt-4 w-full justify-center px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                                      >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                        {saving ? 'Saqlanmoqda…' : submission.score === null ? 'Bahoni saqlash' : 'Bahoni yangilash'}
                                                      </button>

                                                      {submission.gradedAt && (
                                                        <p className="mt-3 text-center text-[11px] text-slate-400">Oxirgi baholash: {formatDate(submission.gradedAt)}</p>
                                                      )}
                                                    </div>
                                                  </div>
                                                </article>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="card p-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-slate-300" />
      <h2 className="mt-4 text-base font-bold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}
