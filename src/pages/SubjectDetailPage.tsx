import { ArrowLeft, ArrowRight, BookOpen, Users, Check } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { CourseCard } from '@/components/CourseCard';
import { Reveal, SectionHeading } from '@/components/Primitives';
import { getSubject } from '@/data/subjects';
import { getCoursesBySubject } from '@/data/courses';
import { roadmaps } from '@/data/roadmaps';

export function SubjectDetailPage({ slug }: { slug: string }) {
  const subject = getSubject(slug);
  const { navigate } = useRouter();

  if (!subject) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
          <BookOpen className="h-8 w-8 text-slate-300" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Subject not found</h1>
        <p className="mt-2 text-slate-500">This subject does not exist or was moved.</p>
        <button onClick={() => navigate('/subjects')} className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to subjects
        </button>
      </div>
    );
  }

  const Icon = subject.icon;
  const subjectCourses = getCoursesBySubject(slug);
  const relatedRoadmaps = roadmaps.filter((r) =>
    r.steps.some((s) => s.topics.some((t) => subject.topics.includes(t)))
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 text-white">
        <div className={`absolute inset-0 bg-gradient-to-br ${subject.color}`} />
        <div className="absolute inset-0 bg-dots opacity-15" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="container-page relative py-14">
          <nav className="flex items-center gap-1.5 text-sm text-white/70">
            <Link to="/subjects" className="hover:text-white">Subjects</Link>
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-white">{subject.name}</span>
          </nav>

          <div className="mt-8 flex items-start gap-5">
            <div className="flex h-16 w-16 flex-shrslate-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <Icon className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="chip bg-white/15 text-white ring-1 ring-white/20">
                {subject.category === 'programming' ? 'Programming' : 'Academic'}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {subject.name}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-white/80 text-pretty">
                {subject.description}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-6">
            <div className="inline-flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-white/70" />
              <span className="text-sm">
                <span className="font-bold">{subject.courseCount}</span> courses
              </span>
            </div>
            <div className="inline-flex items-center gap-2">
              <Users className="h-5 w-5 text-white/70" />
              <span className="text-sm">
                <span className="font-bold">{subject.learnerCount}</span> learners
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeading
                eyebrow="What you'll cover"
                title={`Topics in ${subject.shortName}`}
                description="Core concepts you will master as you work through the courses."
              />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {subject.topics.map((topic, i) => (
                  <Reveal key={topic} delay={(i % 2) * 80}>
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 p-4 ring-1 ring-slate-100">
                      <div
                        className="flex h-8 w-8 flex-shrslate-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: subject.accent }}
                      >
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{topic}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading
                eyebrow="Why learn this"
                title="What this subject unlocks"
                description="The practical skills and understanding you gain from this subject."
              />
              <div className="mt-8 card p-6">
                <p className="leading-relaxed text-slate-600 text-pretty">
                  {subject.description}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{subject.courseCount}</p>
                    <p className="text-xs text-slate-400">Courses</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{subject.topics.length}</p>
                    <p className="text-xs text-slate-400">Core topics</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{subject.learnerCount}</p>
                    <p className="text-xs text-slate-400">Learners</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="bg-slate-50/50 py-16">
        <div className="container-page">
          <SectionHeading
            eyebrow="Courses"
            title={`Courses in ${subject.name}`}
            description="Browse all available courses in this subject, from beginner to advanced."
          />
          {subjectCourses.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {subjectCourses.map((course, i) => (
                <Reveal key={course.slug} delay={(i % 3) * 80}>
                  <CourseCard course={course} />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="mt-10 card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-bold text-slate-900">Courses coming soon</h3>
              <p className="mt-1 text-sm text-slate-500">
                We are working on adding courses for this subject.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Related roadmaps */}
      {relatedRoadmaps.length > 0 && (
        <section className="bg-white py-16">
          <div className="container-page">
            <SectionHeading
              eyebrow="Learning paths"
              title="Recommended roadmaps"
              description="Structured paths that include this subject."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {relatedRoadmaps.map((rm, i) => {
                const RmIcon = rm.icon;
                return (
                  <Reveal key={rm.slug} delay={i * 80}>
                    <Link
                      to={`/roadmaps/${rm.slug}`}
                      className="card group flex items-start gap-5 p-6 hover:-translate-y-1 hover:shadow-lift hover:ring-indigo-200"
                    >
                      <div
                        className={`flex h-14 w-14 flex-shrslate-0 items-center justify-center rounded-2xl bg-gradient-to-br ${rm.color}`}
                      >
                        <RmIcon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700">
                          {rm.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">{rm.description}</p>
                        <span className="mt-3 inline-block text-xs font-semibold text-indigo-700">
                          {rm.steps.length} steps · {rm.goal}
                        </span>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 flex-shrslate-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
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
