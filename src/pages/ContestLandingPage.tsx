import { useState, useMemo, useEffect } from 'react';
import {
  ArrowRight, Trophy, Users, Flame, Star, Calendar, Sparkles, Search,
  ChevronRight, Zap, Gamepad2, Award, Target,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { Reveal, SectionHeading, Eyebrow, BentoCard } from '@/components/Primitives';
import {
  ContestCard, FeaturedContestCard, CategoryCard, ContestTypeCard,
} from '@/components/ContestCard';
import {
  ContestFilterBar, defaultFilters, type FilterState,
} from '@/components/ContestFilters';
import {
  contestCategories, contestTypes, contests, type Contest,
} from '@/data/contests';

export function ContestLandingPage() {
  const { query } = useRouter();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...defaultFilters,
    subject: query.get('subject') || 'all',
  }));

  useEffect(() => {
    const s = query.get('subject');
    if (s) setFilters((f) => ({ ...f, subject: s }));
  }, [query]);

  const filtered = useMemo(() => {
    let list = contests.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.subject !== 'all' && c.subjectSlug !== filters.subject) return false;
      if (filters.difficulty !== 'all' && c.difficulty !== filters.difficulty) return false;
      if (filters.status !== 'all' && c.status !== filters.status) return false;
      if (filters.type !== 'all' && c.type !== filters.type) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case 'participants': return b.participants - a.participants;
        case 'rating': return (b.rating ?? 0) - (a.rating ?? 0);
        case 'duration': return a.durationMinutes - b.durationMinutes;
        default:
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
    });

    return list;
  }, [filters]);

  const featured = contests.filter((c) => c.status === 'Live' || c.status === 'Upcoming').slice(0, 3);
  const liveCount = contests.filter((c) => c.status === 'Live').length;

  return (
    <>
      <ContestHero liveCount={liveCount} />
      <ContestStatsBand />
      <ContestCategoriesSection />
      <FeaturedContestsSection contests={featured} />
      <ContestTypesSection />
      <AllContestsSection
        contests={filtered}
        filters={filters}
        onFiltersChange={setFilters}
      />
      <ContestCTASection />
    </>
  );
}

/* ---------- Hero ---------- */
function ContestHero({ liveCount }: { liveCount: number }) {
  return (
    <section className="relative overflow-hidden pt-28 text-white">
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-grid-dark opacity-[0.08]" />
      <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl animate-pulse-glow" />
      <div className="absolute -right-40 top-32 h-96 w-96 rounded-full bg-electric-600/20 blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }} />
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 blur-3xl" />

      <div className="container-page relative pb-20 pt-12 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="chip bg-white/10 text-indigo-300 ring-1 ring-white/15 backdrop-blur-md">
              <Flame className="h-3.5 w-3.5" />
              {liveCount > 0 ? `${liveCount} contest${liveCount > 1 ? 's' : ''} live right now` : 'New contests every week'}
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl text-balance">
              Compete. Learn. <span className="gradient-text-light">Climb the ranks.</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-xl mx-auto text-lg leading-relaxed text-slate-300 text-pretty">
              Join timed contests across programming, math, science, and languages. Test your
              skills, earn ratings, and challenge learners worldwide.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="#all-contests" className="btn-gradient px-6 py-3.5 text-base">
                Browse all contests
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="#categories"
                className="btn bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15 px-6 py-3.5 text-base"
              >
                <Gamepad2 className="h-4 w-4" />
                Explore categories
              </Link>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              {['Free to join', 'Real-time leaderboards', 'Earn ratings & prizes'].map((t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </section>
  );
}

/* ---------- Stats Band ---------- */
function ContestStatsBand() {
  const items = [
    { value: '280+', label: 'Active contests', icon: Trophy, accent: 'indigo' as const },
    { value: '95K+', label: 'Participants', icon: Users, accent: 'electric' as const },
    { value: '16', label: 'Subjects', icon: Target, accent: 'slate' as const },
    { value: '$12K+', label: 'Prizes awarded', icon: Award, accent: 'sun' as const },
  ];
  return (
    <section className="bg-white py-14">
      <div className="container-page">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {items.map(({ value, label, icon: Icon, accent }, i) => (
            <Reveal key={label} delay={i * 80}>
              <div className="card-hover flex flex-col items-center p-6 text-center">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  accent === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                  accent === 'electric' ? 'bg-electric-50 text-electric-600' :
                  accent === 'slate' ? 'bg-slate-100 text-slate-600' :
                  'bg-sun-500/10 text-sun-600'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */
function ContestCategoriesSection() {
  return (
    <section id="categories" className="bg-slate-50/50 py-20 scroll-mt-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Contest categories"
          title="Find your arena"
          description="Sixteen subjects, each with its own leaderboard, community, and contest calendar. Pick your domain and start climbing."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {contestCategories.map((cat, i) => (
            <Reveal key={cat.slug} delay={(i % 4) * 60}>
              <CategoryCard category={cat} delay={(i % 4) * 60} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Featured ---------- */
function FeaturedContestsSection({ contests }: { contests: Contest[] }) {
  if (contests.length === 0) return null;
  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Featured"
            title="Hot contests right now"
            description="Premium competitions with prizes, ratings, and bragging rights on the line."
          />
          <Link to="#all-contests" className="btn-ghost flex-shrink-0">
            See all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {contests.map((c, i) => (
            <Reveal key={c.slug} delay={i * 100}>
              <FeaturedContestCard contest={c} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Contest Types ---------- */
function ContestTypesSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div className="absolute inset-0 bg-grid-dark opacity-[0.08]" />
      <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute -left-32 -bottom-32 h-72 w-72 rounded-full bg-electric-600/15 blur-3xl" />

      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Contest formats
          </Eyebrow>
          <h2 className="section-title mt-4 text-white">Eight ways to compete</h2>
          <p className="mt-4 text-lg text-slate-400 text-pretty">
            From quick weekly warmups to seasonal championships, there is a format for every
            goal and skill level.
          </p>
        </div>

        {/* Bento grid for types */}
        <div className="mt-12 grid auto-rows-[120px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contestTypes.map(({ type, description, icon }, i) => (
            <BentoCard
              key={type}
              delay={i * 60}
              className={type === 'Championship' ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2' : ''}
            >
              <div className="flex h-full flex-col justify-between p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  type === 'Championship'
                    ? 'bg-gradient-to-br from-sun-500 to-sun-600 shadow-glow'
                    : 'bg-gradient-to-br from-indigo-500 to-electric-600'
                }`}>
                  {(() => {
                    const Icon = icon;
                    return <Icon className="h-5 w-5 text-white" />;
                  })()}
                </div>
                <div>
                  <h3 className={`font-bold text-white ${type === 'Championship' ? 'text-xl' : 'text-sm'}`}>
                    {type}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">{description}</p>
                </div>
              </div>
            </BentoCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- All Contests with Filters ---------- */
function AllContestsSection({
  contests: filtered,
  filters,
  onFiltersChange,
}: {
  contests: Contest[];
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}) {
  return (
    <section id="all-contests" className="scroll-mt-0">
      <ContestFilterBar
        filters={filters}
        onChange={onFiltersChange}
        resultCount={filtered.length}
      />
      <div className="bg-slate-50/50 py-12">
        <div className="container-page">
          {filtered.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((c, i) => (
                <Reveal key={c.slug} delay={(i % 4) * 60}>
                  <ContestCard contest={c} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState onReset={() => onFiltersChange(defaultFilters)} />
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
        <Search className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="mt-5 font-display text-lg font-bold text-slate-900">No contests found</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Try adjusting your filters or search query to find what you are looking for.
      </p>
      <button onClick={onReset} className="btn-ghost mt-6">
        Reset filters
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- CTA ---------- */
function ContestCTASection() {
  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-5xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-electric-700 px-6 py-16 text-center shadow-lift sm:px-16">
          <div className="absolute inset-0 bg-grid-dark opacity-10" />
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-electric-400/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex w-fit items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
              <Zap className="h-3.5 w-3.5 fill-white" />
              New contests added weekly
            </div>
            <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
              Ready to test your skills?
            </h2>
            <p className="mt-4 text-lg text-indigo-100 text-pretty">
              Create a free account to register for contests, track your rating, and climb the
              global leaderboard.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="btn bg-white text-indigo-700 shadow-lift hover:bg-indigo-50 px-6 py-3.5 text-base">
                Create free account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/courses" className="btn bg-white/10 text-white ring-1 ring-white/30 backdrop-blur-md hover:bg-white/15 px-6 py-3.5 text-base">
                Browse courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
