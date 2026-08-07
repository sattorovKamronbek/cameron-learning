import { useState } from 'react';
import {
  Star, Clock, BarChart3, Users, PlayCircle, Check, ChevronRight,
  Lock, ArrowLeft, Award, Globe, ThumbsUp,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { getCourse, getCoursesBySubject } from '@/data/courses';
import { getSubject } from '@/data/subjects';
import { CourseCard } from '@/components/CourseCard';
import { Reveal } from '@/components/Primitives';

const levelStyles: Record<string, string> = {
  Beginner: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Intermediate: 'bg-electric-50 text-electric-700 ring-1 ring-electric-200',
  Advanced: 'bg-error-500/10 text-error-600 ring-1 ring-error-500/20',
};

export function CourseDetailPage({ slug }: { slug: string }) {
  const course = getCourse(slug);
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'instructor'>('overview');

  if (!course) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
          <PlayCircle className="h-8 w-8 text-slate-300" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Course not found</h1>
        <p className="mt-2 text-slate-500">The course you are looking for does not exist or was moved.</p>
        <button onClick={() => navigate('/courses')} className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to courses
        </button>
      </div>
    );
  }

  const subject = getSubject(course.subjectSlug);
  const Icon = subject?.icon;
  const relatedCourses = getCoursesBySubject(course.subjectSlug)
    .filter((c) => c.slug !== course.slug)
    .slice(0, 3);
  const freeLessons = course.lessons.filter((l) => l.free).length;

  return (
    <>
      {/* Hero */}
      <section className="theme-dark-section relative overflow-hidden pt-28 text-white">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div
          className={`absolute inset-0 bg-gradient-to-br ${subject?.color ?? 'from-slate-700 to-slate-900'} opacity-20`}
        />
        <div className="theme-orb-primary absolute -left-40 top-10 h-80 w-80 rounded-full blur-3xl" />

        <div className="container-page relative pb-12 pt-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link to="/courses" className="hover:text-white">Courses</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to={`/subjects/${subject?.slug}`} className="hover:text-white">
              {subject?.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">{course.title}</span>
          </nav>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
            {/* Main info */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`chip bg-white/90 ${levelStyles[course.level]}`}>
                  {course.level}
                </span>
                {course.isNew && (
                  <span className="chip bg-indigo-500 text-white">New</span>
                )}
                {course.trending && (
                  <span className="chip bg-error-500 text-white">Trending</span>
                )}
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-balance">
                {course.title}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-300 text-pretty">{course.subtitle}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-sun-400 text-sun-400" />
                  <span className="font-bold text-white">{course.rating}</span>
                  <span className="text-slate-400">({course.reviewCount.toLocaleString()} reviews)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Users className="h-4 w-4" />
                  {course.learners.toLocaleString()} learners
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Clock className="h-4 w-4" />
                  {course.durationHours} hours
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <BarChart3 className="h-4 w-4" />
                  {course.lessonCount} lessons
                </span>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-electric-500 text-sm font-bold text-white">
                  {course.instructor.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Instructor</p>
                  <p className="text-sm font-bold text-white">{course.instructor}</p>
                  <p className="text-xs text-slate-400">{course.instructorTitle}</p>
                </div>
              </div>
            </div>

            {/* Sidebar card */}
            <div className="lg:order-last">
              <div className="card overflow-hidden lg:sticky lg:top-24">
                <div
                  className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`}
                >
                  <div className="absolute inset-0 bg-dots opacity-20" />
                  {Icon && <Icon className="h-14 w-14 text-white/90" />}
                </div>
                <div className="p-5">
                  <p className="text-3xl font-extrabold text-slate-900">Free</p>
                  <p className="text-sm text-slate-500">
                    {freeLessons} free preview lessons available
                  </p>

                  <div className="mt-5 space-y-3">
                    <Link to="/signup" className="btn-primary w-full">
                      <PlayCircle className="h-4 w-4" />
                      Start learning free
                    </Link>
                    <button className="btn-ghost w-full">Save for later</button>
                  </div>

                  <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
                    <SidebarRow icon={BarChart3} label="Level" value={course.level} />
                    <SidebarRow icon={Clock} label="Duration" value={`${course.durationHours} hours`} />
                    <SidebarRow icon={PlayCircle} label="Lessons" value={`${course.lessonCount}`} />
                    <SidebarRow icon={Users} label="Learners" value={course.learners.toLocaleString()} />
                    <SidebarRow icon={Globe} label="Language" value="English" />
                    <SidebarRow icon={Award} label="Certificate" value="Available" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-slate-100 bg-white">
        <div className="container-page">
          <div className="flex gap-1">
            {(['overview', 'curriculum', 'instructor'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-4 text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab content */}
      <section className="bg-white py-12">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              {activeTab === 'overview' && (
                <OverviewTab course={course} />
              )}
              {activeTab === 'curriculum' && (
                <CurriculumTab course={course} />
              )}
              {activeTab === 'instructor' && (
                <InstructorTab course={course} />
              )}
            </div>

            {/* Right rail */}
            <aside className="space-y-6">
              <div className="card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  What you'll learn
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {course.whatYouLearn.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 flex-shrslate-0 text-indigo-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Prerequisites
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {course.prerequisites.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrslate-0 text-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-slate-100 p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Tags
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 p-5">
                  {course.tags.map((tag) => (
                    <span key={tag} className="chip bg-slate-50 text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Related courses */}
      {relatedCourses.length > 0 && (
        <section className="bg-slate-50/50 py-16">
          <div className="container-page">
            <h2 className="text-2xl font-bold text-slate-900">More in {subject?.name}</h2>
            <p className="mt-1 text-slate-500">Continue exploring this subject.</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCourses.map((c, i) => (
                <Reveal key={c.slug} delay={i * 80}>
                  <CourseCard course={c} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function SidebarRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function OverviewTab({ course }: { course: ReturnType<typeof getCourse> }) {
  if (!course) return null;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">About this course</h2>
        <p className="mt-3 leading-relaxed text-slate-600 text-pretty">{course.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: PlayCircle, label: 'Video lessons', value: `${course.lessonCount}` },
          { icon: Clock, label: 'Total duration', value: `${course.durationHours}h` },
          { icon: ThumbsUp, label: 'Free preview', value: `${course.lessons.filter((l) => l.free).length} lessons` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-4">
            <Icon className="h-5 w-5 text-indigo-600" />
            <p className="mt-2 text-xs text-slate-400">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurriculumTab({ course }: { course: ReturnType<typeof getCourse> }) {
  if (!course) return null;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Course curriculum</h2>
        <span className="text-sm text-slate-500">
          {course.lessonCount} lessons · {course.durationHours}h
        </span>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-slate-100">
        {course.lessons.map((lesson, i) => (
          <div
            key={lesson.title}
            className={`flex items-center gap-4 px-5 py-4 transition-colors ${
              i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
            } hover:bg-indigo-50/40 ${i !== 0 ? 'border-t border-slate-100' : ''}`}
          >
            <span className="flex h-8 w-8 flex-shrslate-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{lesson.title}</p>
            </div>
            <span className="text-xs text-slate-400">{lesson.duration}</span>
            {lesson.free ? (
              <span className="chip bg-indigo-50 text-indigo-700">
                <PlayCircle className="h-3 w-3" />
                Free
              </span>
            ) : (
              <Lock className="h-4 w-4 text-slate-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructorTab({ course }: { course: ReturnType<typeof getCourse> }) {
  if (!course) return null;
  const initials = course.instructor.split(' ').map((n) => n[0]).join('');
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Your instructor</h2>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 flex-shrslate-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-electric-500 text-2xl font-bold text-white">
          {initials}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">{course.instructor}</h3>
          <p className="text-sm text-indigo-700">{course.instructorTitle}</p>
          <p className="mt-4 leading-relaxed text-slate-600 text-pretty">
            {course.instructor} brings years of real-world experience and a passion for teaching.
            Their approach focuses on building deep intuition alongside practical skills, so you
            do not just memorize — you truly understand. Lessons are concise, hands-on, and
            designed to keep you engaged from start to finish.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-sun-500 text-sun-500" />
              {course.rating} avg rating
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {course.learners.toLocaleString()} learners taught
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
