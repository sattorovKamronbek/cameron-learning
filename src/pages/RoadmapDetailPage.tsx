import { Target, Clock, ArrowLeft, ArrowRight, Check, BookOpen } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { Reveal, SectionHeading } from '@/components/Primitives';
import { getRoadmap } from '@/data/roadmaps';
import { courses } from '@/data/courses';
import { getSubject } from '@/data/subjects';

export function RoadmapDetailPage({ slug }: { slug: string }) {
  const roadmap = getRoadmap(slug);
  const { navigate } = useRouter();

  if (!roadmap) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
          <Target className="h-8 w-8 text-slate-300" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Roadmap not found</h1>
        <p className="mt-2 text-slate-500">This roadmap does not exist or was moved.</p>
        <button onClick={() => navigate('/roadmaps')} className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to roadmaps
        </button>
      </div>
    );
  }

  const Icon = roadmap.icon;
  const relatedCourses = courses.filter((c) =>
    roadmap.steps.some((s) => s.topics.some((t) => c.tags.includes(t) || c.title.includes(t)))
  ).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 text-white">
        <div className={`absolute inset-0 bg-gradient-to-br ${roadmap.color}`} />
        <div className="absolute inset-0 bg-dots opacity-15" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="container-page relative py-14">
          <nav className="flex items-center gap-1.5 text-sm text-white/70">
            <Link to="/roadmaps" className="hover:text-white">Roadmaps</Link>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-white">{roadmap.title}</span>
          </nav>

          <div className="mt-8 flex items-start gap-5">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <Icon className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="chip bg-white/15 text-white ring-1 ring-white/20">
                <Target className="h-3 w-3" />
                Suggested focus: {roadmap.goal}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-balance">
                {roadmap.title}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-white/80 text-pretty">
                {roadmap.description}
              </p>
            </div>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm ring-1 ring-white/20 backdrop-blur-sm">
            <Clock className="h-4 w-4" />
            <span>Step-by-step estimates are listed below.</span>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-white py-16">
        <div className="container-page">
          <SectionHeading
            eyebrow="Reference sequence"
            title="Suggested study steps"
            description="Use these steps as a flexible planning reference. They do not unlock hosted lessons or guarantee an outcome."
          />

          <div className="mt-12 relative">
            {/* Vertical line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-indigo-300 via-indigo-200 to-transparent sm:left-[31px]" />

            <div className="space-y-6">
              {roadmap.steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 80}>
                  <div className="relative flex gap-5">
                    {/* Step number */}
                    <div className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
                      <span className="text-lg font-extrabold text-indigo-600">{i + 1}</span>
                    </div>

                    {/* Content */}
                    <div className="card flex-1 p-6 hover:shadow-card">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                            <span className="chip bg-indigo-50 text-indigo-700">
                              <Clock className="h-3 w-3" />
                              {step.est}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {step.topics.map((topic) => (
                          <span
                            key={topic}
                            className="chip bg-slate-50 text-slate-600"
                          >
                            <Check className="h-3 w-3 text-indigo-600" />
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link to="/courses" className="btn-primary px-6 py-3.5 text-base">
              Browse course outlines
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Related courses */}
      {relatedCourses.length > 0 && (
        <section className="bg-slate-50/50 py-16">
          <div className="container-page">
            <SectionHeading
              eyebrow="Related catalogue entries"
              title="Course outlines for this study plan"
              description="These static entries are matched from their listed topics; they are not hosted lessons."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedCourses.map((course, i) => {
                const subject = getSubject(course.subjectSlug);
                const SubjectIcon = subject?.icon;
                return (
                  <Reveal key={course.slug} delay={(i % 4) * 80}>
                    <Link
                      to={`/courses/${course.slug}`}
                      className="card group flex h-full flex-col p-5 hover:-translate-y-1 hover:shadow-lift hover:ring-indigo-200"
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${subject?.color ?? 'from-slate-600 to-slate-800'}`}
                      >
                        {SubjectIcon && <SubjectIcon className="h-5 w-5 text-white" />}
                      </div>
                      <h4 className="mt-4 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                        {course.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{course.subtitle}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                        <BookOpen className="h-3 w-3" />
                        {course.lessons.length} outline items
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
