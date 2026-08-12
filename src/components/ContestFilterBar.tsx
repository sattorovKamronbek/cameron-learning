import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { contestSubjects, type ContestDifficulty, type ContestStatus, type ContestType } from '@/lib/contests';
import { AppSelect } from '@/components/AppSelect';
import { defaultFilters, type FilterState } from './contest-filter-state';

const difficulties: Array<ContestDifficulty | 'all'> = ['all', 'Easy', 'Medium', 'Hard', 'Expert'];
const statuses: Array<ContestStatus | 'all'> = ['all', 'Live', 'Upcoming', 'Finished'];
const types: Array<ContestType | 'all'> = ['all', 'Rated', 'Unrated'];

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="block min-w-0 flex-1">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <AppSelect value={value} options={options} onChange={onChange} ariaLabel={label} triggerClassName="border-0 py-2.5 shadow-none ring-1 ring-slate-200 hover:ring-slate-300" />
    </div>
  );
}

export function ContestFilterBar({ filters, onChange, resultCount }: { filters: FilterState; onChange: (filters: FilterState) => void; resultCount: number }) {
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const activeCount = useMemo(() => [filters.subject !== 'all', filters.difficulty !== 'all', filters.status !== 'all', filters.type !== 'all', filters.sortBy !== 'start'].filter(Boolean).length, [filters]);
  const reset = () => onChange(defaultFilters);
  const controls = (
    <>
      <Select label="Subject" value={filters.subject} onChange={(subject) => update({ subject })} options={[{ value: 'all', label: 'All subjects' }, ...contestSubjects.map(([value, label]) => ({ value, label }))]} />
      <Select label="Difficulty" value={filters.difficulty} onChange={(difficulty) => update({ difficulty: difficulty as FilterState['difficulty'] })} options={difficulties.map((value) => ({ value, label: value === 'all' ? 'All levels' : value }))} />
      <Select label="Status" value={filters.status} onChange={(status) => update({ status: status as FilterState['status'] })} options={statuses.map((value) => ({ value, label: value === 'all' ? 'All statuses' : value }))} />
      <Select label="Type" value={filters.type} onChange={(type) => update({ type: type as FilterState['type'] })} options={types.map((value) => ({ value, label: value === 'all' ? 'All types' : value }))} />
      <Select label="Sort" value={filters.sortBy} onChange={(sortBy) => update({ sortBy: sortBy as FilterState['sortBy'] })} options={[{ value: 'start', label: 'Start time' }, { value: 'participants', label: 'Participants' }, { value: 'duration', label: 'Duration' }]} />
    </>
  );

  return (
    <div className="border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="container-page py-4">
        <div className="flex gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Search contests</span>
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search real contests…" className="w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-10 text-sm text-slate-700 ring-1 ring-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-300" />
            {filters.search && <button type="button" onClick={() => update({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
          </label>
          <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>
        <div className="mt-4 hidden items-end gap-3 lg:flex">{controls}{activeCount > 0 && <button type="button" onClick={reset} className="mb-0.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200"><X className="h-4 w-4" />Reset</button>}</div>
        {open && <div className="mt-4 grid grid-cols-2 gap-3 lg:hidden">{controls}{activeCount > 0 && <button type="button" onClick={reset} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200"><X className="h-4 w-4" />Reset filters</button>}</div>}
        <p className="mt-3 text-xs text-slate-500"><strong className="text-slate-700">{resultCount}</strong> real contest{resultCount === 1 ? '' : 's'} found</p>
      </div>
    </div>
  );
}
