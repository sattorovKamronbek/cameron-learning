import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, Sparkles, Play, Star, Users, BookOpen, Award, Zap, Target,
  TrendingUp, Check, Quote, Code2, Brain, Trophy, Flame, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Link } from '@/router';
import { Reveal, SectionHeading, Eyebrow, BentoCard, ProgressBar } from '@/components/Primitives';
import { CourseCard, CourseFeatureCard } from '@/components/CourseCard';
import { subjects, programmingSubjects, academicSubjects } from '@/data/subjects';
import { featuredCourses, trendingCourses } from '@/data/courses';
import { roadmaps } from '@/data/roadmaps';
import { testimonials, stats } from '@/data/testimonials';
import { useTranslation } from '@/lib/i18n';

const heroImage =
  'https://images.pexels.com/photos/2004161/pexels-photo-2004161.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const trustLogos = ['MIT OCW', 'Stanford', 'freeCodeCamp', 'Khan Academy', 'Coursera', 'edX'];

export function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <StatsBand />
      <BentoFeaturesSection />
      <SubjectsSection />
      <FeaturedCoursesSection />
      <HowItWorksSection />
      <RoadmapsSection />
      <TrendingSection />
      <TestimonialsSection />
      <CtaSection />
    </>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  const { t } = useTranslation();
  const benefits = [t('home.noCard'), t('home.freePreview'), t('home.learnPace')];

  return (
    <section className="relative overflow-hidden pt-28 text-white">
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0">
        <img src={heroImage} alt="Code on a computer screen" className="h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950" />
      </div>
      <div className="absolute inset-0 bg-grid-dark opacity-[0.08]" />
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl animate-pulse-glow" />
      <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-electric-600/20 blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="container-page relative pb-24 pt-12 lg:pb-32 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="chip bg-white/10 text-indigo-300 ring-1 ring-white/15 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                {t('home.eyebrow')}
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl text-balance">
                {t('home.titleStart')}
                <span className="block gradient-text-light">
                  {t('home.titleHighlight')}
                </span>
                {t('home.titleEnd')}
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 text-pretty">
                {t('home.description')}
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/courses" className="btn-gradient px-6 py-3.5 text-base">
                  {t('home.exploreCourses')}
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  to="/roadmaps"
                  className="btn bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15 px-6 py-3.5 text-base"
                >
                  <Play className="h-4 w-4" />
                  {t('home.learningPaths')}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                {benefits.map((benefit) => (
                  <span key={benefit} className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-indigo-400" />
                    {benefit}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Floating preview card with glassmorphism */}
          <Reveal delay={300} className="hidden lg:block">
            <div className="relative">
              <div className="animate-float rounded-4xl bg-white/5 p-2 ring-1 ring-white/10 backdrop-blur-md shadow-lift">
                <div className="overflow-hidden rounded-3xl">
                  <img
                    src="https://images.pexels.com/photos/7972959/pexels-photo-7972959.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                    alt="Students learning together"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  {[
                    { icon: BookOpen, label: '172 Courses', color: 'text-indigo-400' },
                    { icon: Users, label: '850K Learners', color: 'text-electric-400' },
                    { icon: Award, label: '12 Subjects', color: 'text-sun-400' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 p-3 text-center ring-1 ring-white/5">
                      <Icon className={`h-5 w-5 ${color}`} />
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 animate-float rounded-3xl bg-white p-4 shadow-lift" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">This week</p>
                    <p className="text-sm font-bold text-slate-900">+2,340 new learners</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 top-1/3 animate-float rounded-3xl bg-white p-3 shadow-lift" style={{ animationDelay: '0.8s' }}>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['bg-indigo-500', 'bg-electric-500', 'bg-sun-500'].map((c) => (
                      <span key={c} className={`h-7 w-7 rounded-full ${c} ring-2 ring-white`} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-700">Active now</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </section>
  );
}

/* ---------- Trust bar ---------- */
function TrustBar() {
  return (
    <section className="border-b border-slate-100 bg-white py-8">
      <div className="container-page">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Trusted by learners from top institutions worldwide
        </p>
        <div className="mask-fade-r mt-6 overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-12">
            {[...trustLogos, ...trustLogos].map((name) => (
              <span key={name} className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-slate-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats band ---------- */
function StatsBand() {
  const items = [
    { value: stats.learners, label: 'Active learners', icon: Users, accent: 'indigo' as const },
    { value: stats.courses, label: 'Free courses', icon: BookOpen, accent: 'electric' as const },
    { value: stats.subjects, label: 'Subjects covered', icon: Award, accent: 'slate' as const },
    { value: stats.countries, label: 'Countries', icon: Target, accent: 'sun' as const },
  ];
  return (
    <section className="bg-white py-16">
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

/* ---------- Bento Features ---------- */
function BentoFeaturesSection() {
  return (
    <section className="bg-slate-50/50 py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Why Cameron"
          title="Everything you need to learn, in one platform"
          description="A practice-first approach with structured paths, instant feedback, and a community that has your back."
        />

        {/* Bento grid */}
        <div className="mt-12 grid gap-5 sm:auto-rows-[180px] sm:grid-cols-2 lg:grid-cols-4">
          {/* Large card — Practice-first */}
          <BentoCard className="min-h-[360px] sm:col-span-2 sm:row-span-2 sm:min-h-0 lg:col-span-2" delay={0}>
            <div className="flex h-full flex-col justify-between p-7">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-glow">
                  <Code2 className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-slate-900">
                  Practice-first learning
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Every programming lesson includes a hands-on exercise. Learn a concept, apply it
                  immediately, and get instant feedback. No more tutorial hell.
                </p>
              </div>
              {/* Mini code editor mockup */}
              <div className="mt-4 rounded-2xl bg-slate-900 p-4 font-mono text-xs text-slate-300 ring-1 ring-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sun-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
                </div>
                <pre className="mt-3 leading-relaxed">
<span className="text-indigo-400">function</span> <span className="text-electric-400">greet</span>(name) {'{'}
  <span className="text-indigo-400">return</span> <span className="text-sun-400">{`Hello, ${name}!`}</span>
{'}'}
<span className="text-success-400">{'✓'} All 5 tests passed</span>
                </pre>
              </div>
            </div>
          </BentoCard>

          {/* Medium card — Structured roadmaps */}
          <BentoCard className="sm:col-span-2 lg:col-span-2" delay={100}>
            <div className="flex h-full items-center gap-5 p-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-electric-700">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">Guided roadmaps</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Follow step-by-step paths from beginner to job-ready. Always know what comes next.
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Small cards */}
          <BentoCard delay={150}>
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Trophy className="h-5 w-5 text-sun-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Earn XP & badges</h3>
                <p className="mt-1 text-xs text-slate-500">Stay motivated with gamified progress.</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard delay={200}>
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Flame className="h-5 w-5 text-error-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Build streaks</h3>
                <p className="mt-1 text-xs text-slate-500">Daily practice habits that stick.</p>
              </div>
            </div>
          </BentoCard>

          {/* Medium — Community */}
          <BentoCard className="sm:col-span-2" delay={250}>
            <div className="flex h-full items-center gap-5 p-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">Community support</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Forums, study groups, and peer help — you are never learning alone.
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Small — AI feedback */}
          <BentoCard delay={300}>
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Brain className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Smart feedback</h3>
                <p className="mt-1 text-xs text-slate-500">AI-powered explanations when you are stuck.</p>
              </div>
            </div>
          </BentoCard>

          {/* Small — Multi-subject */}
          <BentoCard delay={350}>
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-50">
                <BookOpen className="h-5 w-5 text-electric-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">12+ subjects</h3>
                <p className="mt-1 text-xs text-slate-500">Programming, math, physics, and more.</p>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/* ---------- Subjects ---------- */
function SubjectsSection() {
  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Explore by subject"
            title="Twelve subjects. One platform."
            description="Whether you are writing your first function or diving into quantum mechanics, find a structured path that meets you where you are."
          />
          <Link to="/subjects" className="btn-ghost flex-shrink-0">
            All subjects
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Programming subjects */}
        <div className="mt-10">
          <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Programming</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programmingSubjects.map((subject, i) => (
              <SubjectCard key={subject.slug} subject={subject} delay={(i % 3) * 80} />
            ))}
          </div>
        </div>

        {/* Academic subjects */}
        <div className="mt-10">
          <p className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Academic</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {academicSubjects.map((subject, i) => (
              <SubjectCard key={subject.slug} subject={subject} delay={(i % 3) * 80} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubjectCard({ subject, delay }: { subject: typeof subjects[number]; delay: number }) {
  const Icon = subject.icon;
  return (
    <Reveal delay={delay}>
      <Link
        to={`/subjects/${subject.slug}`}
        className="card-hover group flex h-full flex-col p-6"
      >
        <div className="flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${subject.color} shadow-soft`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <span className={`chip ${subject.category === 'programming' ? 'bg-indigo-50 text-indigo-700' : 'bg-electric-50 text-electric-700'}`}>
            {subject.category === 'programming' ? 'Programming' : 'Academic'}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-indigo-700">{subject.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{subject.blurb}</p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold text-slate-400">
            {subject.courseCount} courses · {subject.learnerCount} learners
          </span>
          <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
        </div>
      </Link>
    </Reveal>
  );
}

/* ---------- Featured courses ---------- */
function FeaturedCoursesSection() {
  return (
    <section className="bg-slate-50/50 py-20">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Hand-picked"
            title="Featured courses this month"
            description="High-quality, instructor-led courses loved by the community. Start with free preview lessons — no sign-up needed."
          />
          <Link to="/courses" className="btn-ghost flex-shrink-0">
            View all courses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-6">
          {featuredCourses.slice(0, 3).map((course, i) => (
            <Reveal key={course.slug} delay={i * 100}>
              <CourseFeatureCard course={course} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function HowItWorksSection() {
  const steps = [
    { icon: Target, title: 'Pick your goal', description: 'Choose a subject or follow a guided roadmap tailored to where you want to go.', color: 'from-indigo-500 to-indigo-700' },
    { icon: BookOpen, title: 'Learn by doing', description: 'Watch concise lessons and apply what you learn with exercises and projects.', color: 'from-electric-500 to-electric-700' },
    { icon: Zap, title: 'Track progress', description: 'Mark lessons complete, see your streak, and stay motivated as you advance.', color: 'from-slate-600 to-slate-800' },
    { icon: Award, title: 'Achieve mastery', description: 'Complete courses, build a portfolio, and reach your learning goals.', color: 'from-sun-500 to-sun-600' },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
      <div className="absolute inset-0 bg-grid-dark opacity-[0.08]" />
      <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute -left-32 -bottom-32 h-72 w-72 rounded-full bg-electric-600/15 blur-3xl" />

      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            How it works
          </Eyebrow>
          <h2 className="section-title mt-4 text-white">Learning that fits your life</h2>
          <p className="mt-4 text-lg text-slate-400 text-pretty">
            No rigid schedules. No pressure. Just a clear path from where you are to where you want to be.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, description, color }, i) => (
            <Reveal key={title} delay={i * 100}>
              <div className="group relative h-full overflow-hidden rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:ring-white/20">
                <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-opacity group-hover:opacity-80" />
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} shadow-glow`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Roadmaps ---------- */
function RoadmapsSection() {
  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Guided paths"
            title="Don't know where to start?"
            description="Follow a step-by-step roadmap that tells you exactly what to learn and in what order — from beginner to job-ready."
          />
          <Link to="/roadmaps" className="btn-ghost flex-shrink-0">
            All roadmaps
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {roadmaps.map((rm, i) => {
            const Icon = rm.icon;
            return (
              <Reveal key={rm.slug} delay={i * 100}>
                <Link to={`/roadmaps/${rm.slug}`} className="card-hover group flex h-full items-start gap-5 p-6">
                  <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${rm.color} shadow-soft`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-indigo-700">{rm.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{rm.description}</p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-indigo-600" />
                        {rm.steps.length} steps
                      </span>
                      <span className="font-semibold text-indigo-700">{rm.goal}</span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Trending ---------- */
function TrendingSection() {
  return (
    <section className="bg-slate-50/50 py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Popular right now"
          title="Trending courses"
          description="What thousands of learners are diving into this week."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trendingCourses.slice(0, 4).map((course, i) => (
            <Reveal key={course.slug} delay={(i % 4) * 80}>
              <CourseCard course={course} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials carousel ---------- */
function TestimonialsSection() {
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(3);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setPerView(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const maxIndex = Math.max(0, testimonials.length - perView);

  useEffect(() => {
    if (index > maxIndex) setIndex(maxIndex);
  }, [maxIndex, index]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, maxIndex)), [maxIndex]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, 6000);
    return () => clearInterval(id);
  }, [maxIndex]);

  return (
    <section className="relative overflow-hidden bg-white py-20">
      <div className="absolute inset-0 bg-dots opacity-30" />
      <div className="container-page relative">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Learner stories"
            title="Real people. Real progress."
            description="Join a global community of learners who turned curiosity into capability."
          />
          <div className="flex gap-2">
            <button onClick={prev} disabled={index === 0} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} disabled={index >= maxIndex} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-12 overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${index * (100 / perView)}%)` }}
          >
            {testimonials.map((t) => (
              <div key={t.name} className="flex-shrink-0 px-3" style={{ width: `${100 / perView}%` }}>
                <figure className="card-hover flex h-full flex-col p-6">
                  <Quote className="h-7 w-7 text-indigo-200" />
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700 text-pretty">
                    "{t.quote}"
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-sm font-bold text-white`}>
                      {t.initials}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */
function CtaSection() {
  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-5xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-electric-700 px-6 py-16 text-center shadow-lift sm:px-16">
          <div className="absolute inset-0 bg-grid-dark opacity-10" />
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-electric-400/20 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex w-fit items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-white text-white" />
              Rated 4.8/5 by 850,000+ learners
            </div>
            <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
              Your learning journey starts with a single step
            </h2>
            <p className="mt-4 text-lg text-indigo-100 text-pretty">
              Create a free account to track your progress, save courses, and unlock personalized
              recommendations. No credit card needed.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="btn bg-white text-indigo-700 shadow-lift hover:bg-indigo-50 px-6 py-3.5 text-base">
                Create free account
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/courses" className="btn bg-white/10 text-white ring-1 ring-white/30 backdrop-blur-md hover:bg-white/15 px-6 py-3.5 text-base">
                Browse all courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
