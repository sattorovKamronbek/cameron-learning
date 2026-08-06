import { Star, Clock, Users, BookOpen, Check, ArrowRight } from 'lucide-react';
import { Link } from '@/router';
import type { Course } from '@/data/courses';
import { getSubject } from '@/data/subjects';
import { ProgressBar } from '@/components/Primitives';

function formatLearners(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

const levelStyles: Record<Course['level'], string> = {
  Beginner: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  Intermediate: 'bg-electric-50 text-electric-700 ring-1 ring-electric-200',
  Advanced: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

export function CourseCard({ course, className = '' }: { course: Course; className?: string }) {
  const subject = getSubject(course.subjectSlug);
  const Icon = subject?.icon;

  return (
    <Link
      to={`/courses/${course.slug}`}
      className={`card-hover group flex h-full flex-col overflow-hidden ${className}`}
    >
      <div className="relative h-32 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="absolute inset-0 flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Icon className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {subject?.shortName}
              </p>
              <p className="text-sm font-bold text-white">{course.level}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {course.isNew && (
              <span className="chip bg-white text-indigo-700 shadow-soft">New</span>
            )}
            {course.trending && !course.isNew && (
              <span className="chip bg-white/90 text-electric-600 shadow-soft">Trending</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
          {course.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{course.subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {course.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="chip bg-slate-100 text-slate-600">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold text-sun-600">
            <Star className="h-3.5 w-3.5 fill-sun-500 text-sun-500" />
            {course.rating}
            <span className="font-normal text-slate-400">({formatLearners(course.reviewCount)})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {course.durationHours}h
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {formatLearners(course.learners)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CourseCardCompact({ course }: { course: Course }) {
  const subject = getSubject(course.subjectSlug);
  const Icon = subject?.icon;

  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group flex items-start gap-4 rounded-2xl p-3 transition-colors hover:bg-slate-50"
    >
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`}>
        {Icon && <Icon className="h-6 w-6 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
          {course.title}
        </p>
        <p className="line-clamp-1 text-xs text-slate-500">{course.subtitle}</p>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
          <span className={`chip ${levelStyles[course.level]} px-2 py-0.5`}>{course.level}</span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-sun-500 text-sun-500" />
            {course.rating}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CourseFeatureCard({ course }: { course: Course }) {
  const subject = getSubject(course.subjectSlug);
  const Icon = subject?.icon;
  const freeLessons = course.lessons.filter((l) => l.free).length;

  return (
    <div className="card-hover group flex flex-col overflow-hidden lg:flex-row">
      <div className="relative h-56 overflow-hidden lg:h-auto lg:w-2/5">
        <div className={`absolute inset-0 bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                {subject?.name}
              </p>
              <span className={`chip mt-1 ${levelStyles[course.level]} bg-white/90`}>
                {course.level}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-white">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-white text-white" />
              <span className="font-bold">{course.rating}</span>
            </div>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="font-semibold">{formatLearners(course.learners)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl font-bold text-slate-900">{course.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{course.description}</p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <BookOpen className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-xs text-slate-400">Lessons</p>
            <p className="text-sm font-bold text-slate-900">{course.lessonCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <Clock className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-xs text-slate-400">Duration</p>
            <p className="text-sm font-bold text-slate-900">{course.durationHours}h</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <Star className="mx-auto h-4 w-4 text-slate-400" />
            <p className="mt-1.5 text-xs text-slate-400">Free preview</p>
            <p className="text-sm font-bold text-slate-900">{freeLessons} lessons</p>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {course.whatYouLearn.slice(0, 4).map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-400">By </span>
            <span className="font-semibold text-slate-900">{course.instructor}</span>
          </div>
          <Link to={`/courses/${course.slug}`} className="btn-primary">
            View Course
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CourseProgressCard({ course, progress }: { course: Course; progress: number }) {
  const subject = getSubject(course.subjectSlug);
  const Icon = subject?.icon;
  const completed = Math.round((progress / 100) * course.lessonCount);

  return (
    <Link
      to={`/courses/${course.slug}`}
      className="card-hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative h-28 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`} />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="absolute inset-0 flex items-center justify-between p-4">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              <Icon className="h-5 w-5 text-white" />
            </div>
          )}
          <span className="chip bg-white/90 text-slate-700 shadow-soft">
            {progress === 100 ? 'Completed' : 'In progress'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700">
          {course.title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{completed} of {course.lessonCount} lessons</p>
        <ProgressBar value={progress} showLabel className="mt-4" size="sm" />
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600">
          {progress === 100 ? 'Review course' : 'Continue learning'}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
