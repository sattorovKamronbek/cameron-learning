import {
  ArrowLeft, ArrowRight, Clock, Users, Calendar, Trophy, Star, Check,
  Gamepad2, Zap, Crown, Flame, ChevronRight, Shield, BookOpen, Target, Code2, ClipboardList,
} from 'lucide-react';
import { Link } from '@/router';
import { Reveal, SectionHeading, Eyebrow, ProgressBar } from '@/components/Primitives';
import {
  DifficultyBadge, StatusBadge, TypeBadge, CountdownTimer,
} from '@/components/ContestCard';
import {
  getContest, getContestCategory, getContestsBySubject,
  formatDuration, formatDateTime,
} from '@/data/contests';
import { ContestCard } from '@/components/ContestCard';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function ContestDetailPage({ slug }: { slug: string }) {
  const contest = getContest(slug);
  if (!contest) return <NotFoundPage />;

  const cat = getContestCategory(contest.subjectSlug);
  const Icon = cat?.icon;
  const startFmt = formatDateTime(contest.startTime);
  const endFmt = formatDateTime(contest.endTime);
  const fillPercent = Math.round((contest.participants / contest.maxParticipants) * 100);
  const related = getContestsBySubject(contest.subjectSlug)
    .filter((c) => c.slug !== contest.slug)
    .slice(0, 3);

  return (
    <>
      {/* Hero / Header */}
      <section className="relative overflow-hidden pt-28 text-white">
        <div className={`absolute inset-0 bg-gradient-to-br ${cat?.color ?? 'from-slate-700 to-slate-900'}`} />
        <div className="absolute inset-0 bg-slate-950/40" />
        <div className="absolute inset-0 bg-grid-dark opacity-[0.08]" />
        <div className="absolute -right-32 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="container-page relative pb-16 pt-8">
          <Reveal>
            <Link
              to="/contests"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All contests
            </Link>
          </Reveal>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <Reveal delay={80}>
                <div className="flex flex-wrap items-center gap-2">
                  {Icon && (
                    <span className="chip bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                      <Icon className="h-3.5 w-3.5" />
                      {contest.subject}
                    </span>
                  )}
                  <TypeBadge type={contest.type} />
                  <DifficultyBadge difficulty={contest.difficulty} />
                  <StatusBadge status={contest.status} />
                </div>
              </Reveal>
              <Reveal delay={160}>
                <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-balance">
                  {contest.name}
                </h1>
              </Reveal>
              <Reveal delay={240}>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/80 text-pretty">
                  {contest.description}
                </p>
              </Reveal>
              <Reveal delay={320}>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/70">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {startFmt.date} at {startFmt.time}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {formatDuration(contest.durationMinutes)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {contest.participants.toLocaleString()} registered
                  </span>
                  {contest.rating && (
                    <span className="inline-flex items-center gap-2 font-semibold text-white">
                      <Star className="h-4 w-4 fill-white text-white" />
                      Rating {contest.rating}
                    </span>
                  )}
                </div>
              </Reveal>
            </div>

            {/* Join card */}
            <Reveal delay={300}>
              <div className="glass-dark w-full rounded-3xl p-6 ring-1 ring-white/15 lg:w-80">
                {contest.status === 'Upcoming' && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">
                      Starts in
                    </p>
                    <CountdownTimer targetIso={contest.startTime} />
                  </div>
                )}
                {contest.status === 'Live' && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl bg-success-500/20 p-4 ring-1 ring-success-500/30">
                    <Flame className="h-6 w-6 text-success-400" />
                    <div>
                      <p className="text-sm font-bold text-white">Contest is live!</p>
                      <p className="text-xs text-white/70">Join now before it ends</p>
                    </div>
                  </div>
                )}
                {contest.status === 'Finished' && (
                  <div className="mb-4 rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/10">
                    <Trophy className="mx-auto h-6 w-6 text-sun-400" />
                    <p className="mt-2 text-sm font-bold text-white">Contest finished</p>
                    <p className="text-xs text-white/60">View final results</p>
                  </div>
                )}

                {contest.subjectSlug === 'programming' && contest.status !== 'Upcoming' && (
                  <Link
                    to={`/contests/${contest.slug}/workspace`}
                    className="btn w-full bg-gradient-to-r from-indigo-500 to-electric-500 py-3.5 text-base text-white shadow-glow hover:shadow-glow-blue"
                  >
                    <Code2 className="h-5 w-5" />
                    Enter workspace
                  </Link>
                )}
                {contest.subjectSlug !== 'programming' && contest.status !== 'Upcoming' && (
                  <Link
                    to={`/contests/${contest.slug}/quiz`}
                    className="btn w-full bg-gradient-to-r from-indigo-500 to-electric-500 py-3.5 text-base text-white shadow-glow hover:shadow-glow-blue"
                  >
                    <ClipboardList className="h-5 w-5" />
                    Enter quiz
                  </Link>
                )}
                {contest.status === 'Upcoming' && (
                  <button
                    className="btn w-full py-3.5 text-base bg-white text-indigo-700 shadow-lift hover:bg-indigo-50"
                  >
                    <Zap className="h-5 w-5" />
                    Register now
                  </button>
                )}
                {contest.status === 'Finished' && (
                  <button
                    className="btn w-full py-3.5 text-base bg-white/10 text-white/60 ring-1 ring-white/15 cursor-not-allowed"
                    disabled
                  >
                    <Trophy className="h-5 w-5" />
                    View results
                  </button>
                )}

                {contest.prize && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-sun-500/15 p-3 ring-1 ring-sun-500/25">
                    <Trophy className="h-5 w-5 flex-shrink-0 text-sun-400" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-sun-400">Prize</p>
                      <p className="text-sm font-bold text-white">{contest.prize}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2 text-xs text-white/60">
                  <div className="flex items-center justify-between">
                    <span>Capacity</span>
                    <span className="font-semibold text-white/80">
                      {contest.participants.toLocaleString()} / {contest.maxParticipants.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={fillPercent} size="sm" className="opacity-80" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </section>

      {/* Content body */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Main column */}
            <div className="space-y-12">
              {/* Overview */}
              <Reveal>
                <div>
                  <Eyebrow>
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
                    Overview
                  </Eyebrow>
                  <h2 className="section-title mt-3">About this contest</h2>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InfoTile icon={Clock} label="Duration" value={formatDuration(contest.durationMinutes)} />
                  <InfoTile icon={Calendar} label="Start" value={`${startFmt.date} · ${startFmt.time}`} />
                  <InfoTile icon={Calendar} label="End" value={`${endFmt.date} · ${endFmt.time}`} />
                  <InfoTile icon={Users} label="Participants" value={contest.participants.toLocaleString()} />
                  <InfoTile icon={Target} label="Difficulty" value={contest.difficulty} />
                  <InfoTile icon={BookOpen} label="Type" value={contest.type} />
                </div>
              </Reveal>

              {/* Rules */}
              <Reveal delay={80}>
                <div>
                  <Eyebrow>
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
                    Rules
                  </Eyebrow>
                  <h2 className="section-title mt-3">Contest rules</h2>
                  <p className="mt-3 text-slate-500">
                    Please read carefully. Violating any rule may result in disqualification.
                  </p>
                </div>
                <div className="mt-6 card p-6">
                  <ul className="space-y-4">
                    {contest.rules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                          {i + 1}
                        </span>
                        <span className="text-sm leading-relaxed text-slate-700">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              {/* Tags */}
              <Reveal delay={160}>
                <div>
                  <Eyebrow>
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
                    Topics
                  </Eyebrow>
                  <h2 className="section-title mt-3">What this contest covers</h2>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {contest.tags.map((tag) => (
                    <span key={tag} className="chip bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </Reveal>

              {/* Participants preview */}
              <Reveal delay={200}>
                <div>
                  <Eyebrow>
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
                    Leaderboard
                  </Eyebrow>
                  <h2 className="section-title mt-3">Top participants</h2>
                </div>
                <div className="mt-6 card overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {sampleLeaderboard.map((p, i) => (
                      <div
                        key={p.name}
                        className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50"
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                          i === 0 ? 'bg-sun-500/15 text-sun-600' :
                          i === 1 ? 'bg-slate-300/50 text-slate-600' :
                          i === 2 ? 'bg-sun-600/10 text-sun-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {i + 1}
                        </span>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-electric-600 text-xs font-bold text-white">
                          {p.initials}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Star className="h-4 w-4 fill-indigo-500 text-indigo-500" />
                          <span className="text-sm font-bold tabular-nums text-slate-700">{p.rating}</span>
                        </div>
                        {i === 0 && <Crown className="h-4 w-4 text-sun-500" />}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 p-4 text-center">
                    <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                      View full leaderboard
                      <ChevronRight className="ml-1 inline h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Organizer */}
              <Reveal>
                <div className="card p-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Organizer</h3>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-electric-600 text-sm font-bold text-white">
                      {contest.organizer.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{contest.organizer}</p>
                      <p className="text-xs text-slate-500">{contest.organizerTitle}</p>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Quick facts */}
              <Reveal delay={80}>
                <div className="card p-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">At a glance</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Format</dt>
                      <dd className="font-semibold text-slate-900">{contest.type}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Difficulty</dt>
                      <dd><DifficultyBadge difficulty={contest.difficulty} /></dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Duration</dt>
                      <dd className="font-semibold text-slate-900">{formatDuration(contest.durationMinutes)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Capacity</dt>
                      <dd className="font-semibold text-slate-900">
                        {contest.participants.toLocaleString()} / {contest.maxParticipants.toLocaleString()}
                      </dd>
                    </div>
                    {contest.prize && (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">Prize</dt>
                        <dd className="inline-flex items-center gap-1 font-semibold text-sun-600">
                          <Trophy className="h-3.5 w-3.5" />
                          {contest.prize}
                        </dd>
                      </div>
                    )}
                    {contest.rating && (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">Rating weight</dt>
                        <dd className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                          <Star className="h-3.5 w-3.5 fill-indigo-500 text-indigo-500" />
                          {contest.rating}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </Reveal>

              {/* CTA */}
              <Reveal delay={160}>
                <div className="card overflow-hidden">
                  <div className="bg-gradient-to-br from-indigo-600 to-electric-700 p-6 text-center text-white">
                    <Shield className="mx-auto h-8 w-8 text-white/80" />
                    <h3 className="mt-3 font-display text-lg font-bold">Fair play guaranteed</h3>
                    <p className="mt-1 text-xs text-indigo-100">
                      All contests are monitored for integrity. Cheating results in permanent bans.
                    </p>
                  </div>
                  <div className="p-6">
                    <Link to="/contests" className="btn-ghost w-full">
                      <ArrowLeft className="h-4 w-4" />
                      Back to all contests
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Related contests */}
      {related.length > 0 && (
        <section className="bg-slate-50/50 py-16">
          <div className="container-page">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <SectionHeading
                eyebrow="More in this subject"
                title={`Other ${contest.subject} contests`}
              />
              <Link to={`/contests?subject=${contest.subjectSlug}`} className="btn-ghost flex-shrink-0">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((c, i) => (
                <Reveal key={c.slug} delay={i * 80}>
                  <ContestCard contest={c} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function InfoTile({
  icon: Icon, label, value,
}: {
  icon: typeof Clock; label: string; value: string;
}) {
  return (
    <div className="card-hover flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
        <Icon className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

const sampleLeaderboard = [
  { name: 'alex_code', title: 'Grandmaster · 2847', initials: 'AC', rating: 2847 },
  { name: 'neural_net', title: 'Master · 2710', initials: 'NN', rating: 2710 },
  { name: 'data_miner', title: 'Master · 2760', initials: 'DM', rating: 2760 },
  { name: 'white_hat', title: 'Expert · 2640', initials: 'WH', rating: 2640 },
  { name: 'math_wiz', title: 'Expert · 2654', initials: 'MW', rating: 2654 },
];
