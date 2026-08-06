import { useState, useEffect } from 'react';
import {
  User, Mail, LogOut, Edit2, Save, X, Crown, Zap, Sparkles, Clock,
  BookOpen, Award, TrendingUp, Target, ArrowRight, Check, Calendar,
  Trophy,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import type { Plan } from '@/lib/supabase';
import { courses } from '@/data/courses';
import { roadmaps } from '@/data/roadmaps';
import { subjectRatings, getOverallStats } from '@/data/ratings';
import { RatingCard, RatingOverviewCard } from '@/components/RatingCard';
import { getAnalyticsSummary, subjectPerformance, strongTopics, weakTopics, contestHistory } from '@/data/analytics';
import { achievements, getAchievementStats, badgeTiers, seasonalBadges } from '@/data/achievements';
import { getRatingColorData } from '@/data/ratings';
import { BarChart3, Flame, ChevronUp, ChevronDown, Minus, Lock, CheckCircle2, Activity } from 'lucide-react';
import { LoadingDots, LoadingState } from '@/components/LoadingState';

const planInfo: Record<Plan, { name: string; icon: typeof Zap; color: string; bg: string; ring: string }> = {
  free: { name: 'Free', icon: Sparkles, color: 'text-slate-700', bg: 'bg-slate-50', ring: 'ring-slate-200' },
  pro: { name: 'Pro', icon: Zap, color: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
  max: { name: 'Max', icon: Crown, color: 'text-electric-700', bg: 'bg-electric-50', ring: 'ring-electric-200' },
};

export function ProfilePage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  if (loading || !user) {
    return <LoadingState className="min-h-[60vh] rounded-none" message="Profilingiz yuklanmoqda" />;
  }

  const currentPlan = profile?.plan ?? 'free';
  const planData = planInfo[currentPlan];
  const PlanIcon = planData.icon;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await updateProfile({ full_name: fullName || null });
    setSaving(false);
    if (error) {
      setSaveError(error);
    } else {
      setEditing(false);
    }
  };

  const initials = (profile?.full_name || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <>
      {/* Hero header */}
      <section className="relative overflow-hidden pt-28 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />

        <div className="container-page relative py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 flex-shrslate-0 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-400 to-electric-500 text-2xl font-extrabold text-white shadow-lift">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {profile?.full_name || 'Welcome back'}
                </h1>
                <p className="mt-1 text-slate-400">{user.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`chip ${planData.bg} ${planData.color} ring-1 ${planData.ring}`}>
                    <PlanIcon className="h-3.5 w-3.5" />
                    {planData.name} plan
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut().then(() => navigate('/'))}
              className="btn bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-white/15"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard content */}
      <section className="bg-slate-50/50 py-12">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column — profile editing */}
            <div className="lg:col-span-1">
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Profile</h2>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditing(false); setFullName(profile?.full_name ?? ''); setSaveError(null); }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  )}
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Full name
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-xl border-0 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">
                        {profile?.full_name || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <Mail className="h-3 w-3" />
                      Email
                    </label>
                    <p className="text-sm font-semibold text-slate-900 break-all">{user.email}</p>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <Crown className="h-3 w-3" />
                      Current plan
                    </label>
                    <div className="flex items-center justify-between">
                      <span className={`chip ${planData.bg} ${planData.color} ring-1 ${planData.ring}`}>
                        <PlanIcon className="h-3.5 w-3.5" />
                        {planData.name}
                      </span>
                      <Link to="/pricing" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                        Upgrade
                      </Link>
                    </div>
                  </div>
                </div>

                {editing && (
                  <div className="mt-6">
                    {saveError && (
                      <p className="mb-3 text-sm text-error-600">{saveError}</p>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary w-full"
                    >
                      {saving ? (
                        <>
                          <LoadingDots />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Plan card */}
              <div className="card mt-6 overflow-hidden">
                <div className={`bg-gradient-to-br ${currentPlan === 'free' ? 'from-slate-600 to-slate-800' : currentPlan === 'pro' ? 'from-indigo-600 to-indigo-800' : 'from-electric-600 to-electric-800'} p-6 text-white`}>
                  <PlanIcon className="h-8 w-8 text-white/90" />
                  <h3 className="mt-3 text-xl font-bold">{planData.name} Plan</h3>
                  <p className="mt-1 text-sm text-white/80">
                    {currentPlan === 'free' && 'Upgrade to unlock unlimited access and certificates.'}
                    {currentPlan === 'pro' && 'You have unlimited access and certificates.'}
                    {currentPlan === 'max' && 'You have the complete learning experience.'}
                  </p>
                </div>
                <div className="p-6">
                  <Link to="/pricing" className="btn-ghost w-full">
                    {currentPlan === 'max' ? 'Manage plan' : 'View all plans'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right column — stats + recommended */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { icon: BookOpen, label: 'Courses', value: '0', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { icon: Clock, label: 'Hours learned', value: '0', color: 'text-electric-600', bg: 'bg-electric-50' },
                  { icon: Award, label: 'Certificates', value: '0', color: 'text-sun-600', bg: 'bg-sun-500/10' },
                  { icon: Target, label: 'Day streak', value: '0', color: 'text-error-600', bg: 'bg-error-500/10' },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="card p-4 text-center">
                    <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Contest Ratings Dashboard */}
              <RatingOverviewCard ratings={subjectRatings} />

              {/* Rating cards grid */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Trophy className="h-5 w-5 text-indigo-600" />
                    Subject Ratings
                  </h3>
                  <Link to="/contests" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                    Find contests
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {subjectRatings.map((rating, i) => (
                    <RatingCard key={rating.subjectSlug} rating={rating} delay={i * 50} />
                  ))}
                </div>
              </div>

              {/* Analytics + Achievements preview */}
              <ProfileAnalyticsPreview />
              <ProfileAchievementsPreview />

              {/* Welcome message */}
              <div className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrslate-0 items-center justify-center rounded-xl bg-indigo-50">
                    <TrendingUp className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Welcome to your dashboard
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      This is where you will track your learning journey. Start a course or follow
                      a roadmap to see your progress here. Your stats will update as you complete lessons.
                    </p>
                    <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                      <Link to="/courses" className="btn-primary px-5 py-2.5 text-sm">
                        <BookOpen className="h-4 w-4" />
                        Browse courses
                      </Link>
                      <Link to="/roadmaps" className="btn-ghost px-5 py-2.5 text-sm">
                        <Target className="h-4 w-4" />
                        View roadmaps
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended courses */}
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Recommended for you</h3>
                  <Link to="/courses" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                    See all
                  </Link>
                </div>
                <div className="mt-4 space-y-2">
                  {courses.slice(0, 4).map((course) => (
                    <Link
                      key={course.slug}
                      to={`/courses/${course.slug}`}
                      className="group flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 flex-shrslate-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                          {course.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-slate-500">{course.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrslate-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recommended roadmaps */}
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Learning paths</h3>
                  <Link to="/roadmaps" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
                    See all
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {roadmaps.slice(0, 2).map((rm) => {
                    const RmIcon = rm.icon;
                    return (
                      <Link
                        key={rm.slug}
                        to={`/roadmaps/${rm.slug}`}
                        className="group flex items-start gap-3 rounded-xl p-4 ring-1 ring-slate-100 transition-all hover:ring-indigo-200 hover:bg-indigo-50/30"
                      >
                        <div className={`flex h-10 w-10 flex-shrslate-0 items-center justify-center rounded-xl bg-gradient-to-br ${rm.color}`}>
                          <RmIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                            {rm.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{rm.steps.length} steps</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Plan features */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900">Your plan includes</h3>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {(currentPlan === 'free'
                    ? ['All 172 courses', 'Free preview lessons', 'Community access', 'Basic progress tracking']
                    : currentPlan === 'pro'
                    ? ['Unlimited course access', 'Certificates', 'Downloadable resources', 'Advanced analytics', 'Priority support', 'Ad-free']
                    : ['1-on-1 sessions', 'Personalized paths', 'Project reviews', 'Early access', 'Mentor matching', 'Career guidance']
                  ).map((feat) => (
                    <div key={feat} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <span className="flex h-5 w-5 flex-shrslate-0 items-center justify-center rounded-full bg-indigo-100">
                        <Check className="h-3 w-3 text-indigo-700" />
                      </span>
                      {feat}
                    </div>
                  ))}
                </div>
                {currentPlan !== 'max' && (
                  <Link to="/pricing" className="btn-primary mt-5 w-full">
                    <Crown className="h-4 w-4" />
                    Upgrade to {currentPlan === 'free' ? 'Pro or Max' : 'Max'}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ============ Analytics Preview ============ */

function ProfileAnalyticsPreview() {
  const summary = getAnalyticsSummary();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Analytics Overview
        </h3>
        <Link to="/analytics" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
          Full dashboard
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold text-slate-400">Total Solved</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-slate-900">{summary.totalSolved}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-success-500" />
            <span className="text-xs font-semibold text-slate-400">Avg Accuracy</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-slate-900">{summary.avgAccuracy}%</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-sun-500" />
            <span className="text-xs font-semibold text-slate-400">Streak</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-slate-900">{summary.currentStreak}<span className="text-sm text-slate-400"> days</span></p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-semibold text-slate-400">Avg Rank</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-slate-900">#{summary.avgRank}</p>
        </div>
      </div>

      {/* Mini subject performance bars */}
      <div className="card mt-4 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Performance by Subject</p>
        <div className="mt-3 space-y-2">
          {subjectPerformance.slice(0, 5).map((s) => {
            const colorData = getRatingColorData(s.rating);
            return (
              <div key={s.slug} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 truncate text-xs font-semibold text-slate-600">{s.subject}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.accuracy}%`, background: `linear-gradient(90deg, ${colorData.hex}80, ${colorData.hex})` }}
                  />
                </div>
                <span className="w-10 flex-shrink-0 text-right text-xs font-bold tabular-nums text-slate-700">{s.accuracy}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent contests */}
      <div className="card mt-4 overflow-hidden">
        <p className="border-b border-slate-100 p-4 text-xs font-bold uppercase tracking-wider text-slate-400">Recent Contests</p>
        <div className="divide-y divide-slate-50">
          {contestHistory.slice(0, 4).map((c) => {
            const colorData = getRatingColorData(c.newRating);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.subject} · #{c.rank}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-extrabold tabular-nums" style={{ color: colorData.hex }}>{c.newRating}</span>
                  <span className={`flex items-center gap-0.5 text-xs font-bold ${c.delta > 0 ? 'text-success-600' : c.delta < 0 ? 'text-error-600' : 'text-slate-400'}`}>
                    {c.delta > 0 ? <ChevronUp className="h-3 w-3" /> : c.delta < 0 ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(c.delta)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Achievements Preview ============ */

function ProfileAchievementsPreview() {
  const stats = getAchievementStats();
  const recentUnlocked = achievements.filter((a) => a.unlocked).slice(-6);
  const recentSeasonal = seasonalBadges.filter((b) => b.earned).slice(0, 3);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Award className="h-5 w-5 text-purple-600" />
          Achievements
        </h3>
        <Link to="/achievements" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">
          View all
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white">
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-purple-600/20 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="font-display text-2xl font-extrabold">{stats.unlocked}<span className="text-lg text-slate-400">/{stats.total}</span></p>
              <p className="text-xs text-slate-400">Achievements unlocked</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold">{stats.seasonalEarned}<span className="text-lg text-slate-400">/{stats.seasonalTotal}</span></p>
              <p className="text-xs text-slate-400">Seasonal badges</p>
            </div>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-sun-500 transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
          </div>
        </div>

        {/* Badge grid */}
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-6">
          {recentUnlocked.map((a) => {
            const tier = badgeTiers[a.tier];
            const Icon = a.icon;
            return (
              <div key={a.id} className={`group flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all hover:-translate-y-0.5`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tier.gradient} ${tier.glow}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="truncate text-[10px] font-semibold text-slate-500">{a.name}</span>
              </div>
            );
          })}
        </div>

        {/* Seasonal badges row */}
        {recentSeasonal.length > 0 && (
          <div className="border-t border-slate-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seasonal Badges</p>
            <div className="mt-2 flex gap-3">
              {recentSeasonal.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${b.gradient} ${b.glow}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{b.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
