import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import {
  contestCategories, type Difficulty, type ContestStatus, type ContestType,
} from '@/data/contests';

export type FilterState = {
  search: string;
  subject: string | 'all';
  difficulty: Difficulty | 'all';
  status: ContestStatus | 'all';
  type: ContestType | 'all';
  sortBy: 'start' | 'participants' | 'rating' | 'duration';
};

export const defaultFilters: FilterState = {
  search: '',
  subject: 'all',
  difficulty: 'all',
  status: 'all',
  type: 'all',
  sortBy: 'start',
};

const difficulties: (Difficulty | 'all')[] = ['all', 'Easy', 'Medium', 'Hard', 'Expert'];
const statuses: (ContestStatus | 'all')[] = ['all', 'Live', 'Upcoming', 'Finished'];
const types: (ContestType | 'all')[] = [
  'all', 'Rated', 'Unrated', 'Practice', 'Virtual', 'Team', 'Weekly', 'Monthly', 'Championship',
];
const sortOptions: { value: FilterState['sortBy']; label: string }[] = [
  { value: 'start', label: 'Start time' },
  { value: 'participants', label: 'Participants' },
  { value: 'rating', label: 'Rating' },
  { value: 'duration', label: 'Duration' },
];

function Select({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-2xl border-0 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

export function ContestFilterBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.subject !== 'all') n++;
    if (filters.difficulty !== 'all') n++;
    if (filters.status !== 'all') n++;
    if (filters.type !== 'all') n++;
    if (filters.sortBy !== 'start') n++;
    return n;
  }, [filters]);

  const reset = () => onChange(defaultFilters);

  return (
    <div className="sticky top-[var(--header-h)] z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="container-page py-4">
        {/* Search row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search contests by name, subject, or tag..."
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="w-full rounded-2xl border-0 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {filters.search && (
              <button
                onClick={() => update({ search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-50 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop filters */}
        <div className="mt-4 hidden items-end gap-3 lg:flex">
          <div className="flex-1">
            <Select
              label="Subject"
              value={filters.subject}
              onChange={(v) => update({ subject: v as FilterState['subject'] })}
              options={[
                { value: 'all', label: 'All subjects' },
                ...contestCategories.map((c) => ({ value: c.slug, label: c.name })),
              ]}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Difficulty"
              value={filters.difficulty}
              onChange={(v) => update({ difficulty: v as FilterState['difficulty'] })}
              options={difficulties.map((d) => ({ value: d, label: d === 'all' ? 'All levels' : d }))}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Status"
              value={filters.status}
              onChange={(v) => update({ status: v as FilterState['status'] })}
              options={statuses.map((s) => ({ value: s, label: s === 'all' ? 'All statuses' : s }))}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Type"
              value={filters.type}
              onChange={(v) => update({ type: v as FilterState['type'] })}
              options={types.map((t) => ({ value: t, label: t === 'all' ? 'All types' : t }))}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Sort by"
              value={filters.sortBy}
              onChange={(v) => update({ sortBy: v as FilterState['sortBy'] })}
              options={sortOptions}
            />
          </div>
          {activeCount > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 transition-all hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          )}
        </div>

        {/* Mobile collapsible filters */}
        {mobileOpen && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:hidden">
            <Select
              label="Subject"
              value={filters.subject}
              onChange={(v) => update({ subject: v as FilterState['subject'] })}
              options={[
                { value: 'all', label: 'All subjects' },
                ...contestCategories.map((c) => ({ value: c.slug, label: c.name })),
              ]}
            />
            <Select
              label="Difficulty"
              value={filters.difficulty}
              onChange={(v) => update({ difficulty: v as FilterState['difficulty'] })}
              options={difficulties.map((d) => ({ value: d, label: d === 'all' ? 'All levels' : d }))}
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(v) => update({ status: v as FilterState['status'] })}
              options={statuses.map((s) => ({ value: s, label: s === 'all' ? 'All statuses' : s }))}
            />
            <Select
              label="Type"
              value={filters.type}
              onChange={(v) => update({ type: v as FilterState['type'] })}
              options={types.map((t) => ({ value: t, label: t === 'all' ? 'All types' : t }))}
            />
            <div className="col-span-2">
              <Select
                label="Sort by"
                value={filters.sortBy}
                onChange={(v) => update({ sortBy: v as FilterState['sortBy'] })}
                options={sortOptions}
              />
            </div>
            {activeCount > 0 && (
              <button
                onClick={reset}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200"
              >
                <X className="h-4 w-4" />
                Reset filters ({activeCount})
              </button>
            )}
          </div>
        )}

        {/* Result count */}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-bold text-slate-700">{resultCount}</span>
          contest{resultCount !== 1 ? 's' : ''} found
          {activeCount > 0 && <span>· {activeCount} filter{activeCount !== 1 ? 's' : ''} active</span>}
        </div>
      </div>
    </div>
  );
}
