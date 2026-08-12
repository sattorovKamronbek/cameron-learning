import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { CourseCard } from '@/components/CourseCard';
import { AppSelect } from '@/components/AppSelect';
import { Reveal } from '@/components/Primitives';
import { courses, type Course } from '@/data/courses';
import { subjects } from '@/data/subjects';

const levels: Course['level'][] = ['Beginner', 'Intermediate', 'Advanced'];
const categories = ['all', 'programming', 'academic'] as const;
const sortOptions = [
  { value: 'catalogue', label: 'Catalogue order' },
  { value: 'duration', label: 'Shortest estimated time' },
  { value: 'outlines', label: 'Most outline items' },
] as const;

type SortValue = (typeof sortOptions)[number]['value'];

export function CoursesPage() {
  const [query, setQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<(typeof categories)[number]>('all');
  const [sort, setSort] = useState<SortValue>('catalogue');

  const filtered = useMemo(() => {
    let result = [...courses];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedSubject !== 'all') {
      result = result.filter((c) => c.subjectSlug === selectedSubject);
    } else if (selectedCategory !== 'all') {
      const subjectSlugs = subjects
        .filter((s) => s.category === selectedCategory)
        .map((s) => s.slug);
      result = result.filter((c) => subjectSlugs.includes(c.subjectSlug));
    }

    if (selectedLevel !== 'all') {
      result = result.filter((c) => c.level === selectedLevel);
    }

    switch (sort) {
      case 'duration':
        result.sort((a, b) => a.durationHours - b.durationHours);
        break;
      case 'outlines':
        result.sort((a, b) => b.lessons.length - a.lessons.length);
        break;
      default:
        break;
    }

    return result;
  }, [query, selectedSubject, selectedLevel, selectedCategory, sort]);

  const activeFilterCount =
    (selectedSubject !== 'all' ? 1 : 0) +
    (selectedLevel !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setSelectedSubject('all');
    setSelectedLevel('all');
    setSelectedCategory('all');
    setQuery('');
  };

  return (
    <>
      <PageHeader
        eyebrow="Course library"
        title="Browse course outlines"
        description="Browse the current curated catalogue of course outlines across programming and academic subjects. Filter by topic, level, and category."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search course outlines or topics..."
              className="w-full rounded-xl border-0 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-soft ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <AppSelect
              value={sort}
              onChange={(value) => setSort(value as SortValue)}
              options={sortOptions.map((option) => ({ ...option }))}
              ariaLabel="Saralash"
              className="min-w-[190px]"
              triggerClassName="shadow-soft"
            />
          </div>
        </div>
      </PageHeader>

      <section className="bg-white py-12">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            {/* Filters sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Filters</h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800"
                    >
                      <X className="h-3 w-3" />
                      Clear ({activeFilterCount})
                    </button>
                  )}
                </div>

                <FilterGroup label="Category">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <FilterChip
                        key={cat}
                        active={selectedCategory === cat && selectedSubject === 'all'}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedSubject('all');
                        }}
                      >
                        {cat === 'all' ? 'All' : cat === 'programming' ? 'Programming' : 'Academic'}
                      </FilterChip>
                    ))}
                  </div>
                </FilterGroup>

                <FilterGroup label="Subject">
                  <div className="space-y-1.5">
                    <FilterRadio
                      label="All subjects"
                      checked={selectedSubject === 'all'}
                      onChange={() => setSelectedSubject('all')}
                    />
                    {subjects.map((s) => (
                      <FilterRadio
                        key={s.slug}
                        label={s.shortName}
                        checked={selectedSubject === s.slug}
                        onChange={() => setSelectedSubject(s.slug)}
                      />
                    ))}
                  </div>
                </FilterGroup>

                <FilterGroup label="Level">
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={selectedLevel === 'all'}
                      onClick={() => setSelectedLevel('all')}
                    >
                      All
                    </FilterChip>
                    {levels.map((lvl) => (
                      <FilterChip
                        key={lvl}
                        active={selectedLevel === lvl}
                        onClick={() => setSelectedLevel(lvl)}
                      >
                        {lvl}
                      </FilterChip>
                    ))}
                  </div>
                </FilterGroup>
              </div>
            </aside>

            {/* Results */}
            <div>
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-bold text-slate-900">{filtered.length}</span>{' '}
                  {filtered.length === 1 ? 'catalogue entry' : 'catalogue entries'}
                </p>
              </div>

              {filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                    <Search className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">No courses found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Try adjusting your search or filters.
                  </p>
                  <button onClick={clearFilters} className="btn-ghost mt-4">
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((course, i) => (
                    <Reveal key={course.slug} delay={(i % 6) * 60}>
                      <CourseCard course={course} />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-soft'
          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function FilterRadio({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        checked ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 electric-indigo-600"
      />
      {label}
    </label>
  );
}
