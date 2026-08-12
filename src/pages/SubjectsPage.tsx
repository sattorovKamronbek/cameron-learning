import { ArrowRight, Code2, GraduationCap } from 'lucide-react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Primitives';
import { programmingSubjects, academicSubjects } from '@/data/subjects';
import { getCoursesBySubject } from '@/data/courses';

export function SubjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Subjects"
        title="Explore all subjects"
        description="From coding to calculus, chemistry to history — explore the subject areas represented in the current curated catalogue."
      />

      <section className="bg-white py-16">
        <div className="container-page">
          <SubjectGroup
            title="Programming & Technology"
            description="Build real-world skills in software development, data, and AI."
            icon={Code2}
            color="text-indigo-600"
            bg="bg-indigo-50"
            subjects={programmingSubjects}
          />

          <div className="mt-20">
            <SubjectGroup
              title="Academic Subjects"
              description="Strengthen your foundation in science, math, humanities, and more."
              icon={GraduationCap}
              color="text-electric-600"
              bg="bg-electric-50"
              subjects={academicSubjects}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function SubjectGroup({
  title,
  description,
  icon: Icon,
  color,
  bg,
  subjects,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  subjects: typeof programmingSubjects;
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject, i) => {
          const SubjectIcon = subject.icon;
          const outlineCount = getCoursesBySubject(subject.slug).length;
          return (
            <Reveal key={subject.slug} delay={(i % 3) * 80}>
              <Link
                to={`/subjects/${subject.slug}`}
                className="card group flex h-full flex-col p-6 hover:-translate-y-1 hover:shadow-lift hover:ring-indigo-200"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${subject.color}`}
                >
                  <SubjectIcon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-indigo-700">
                  {subject.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{subject.blurb}</p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {subject.topics.slice(0, 4).map((topic) => (
                    <span key={topic} className="chip bg-slate-50 text-slate-500">
                      {topic}
                    </span>
                  ))}
                  {subject.topics.length > 4 && (
                    <span className="chip bg-slate-50 text-slate-400">
                      +{subject.topics.length - 4}
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-slate-400">
                    {outlineCount} listed {outlineCount === 1 ? 'outline' : 'outlines'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-600" />
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
