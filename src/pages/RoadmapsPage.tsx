import { Target, ArrowRight, Clock } from 'lucide-react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Primitives';
import { roadmaps } from '@/data/roadmaps';

export function RoadmapsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Learning roadmaps"
        title="Step-by-step paths to your goals"
        description="Not sure what to learn first? Follow a guided roadmap that breaks down the journey into clear, ordered steps — from beginner to job-ready."
      />

      <section className="bg-white py-16">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-2">
            {roadmaps.map((rm, i) => {
              const Icon = rm.icon;
              return (
                <Reveal key={rm.slug} delay={(i % 2) * 100}>
                  <Link
                    to={`/roadmaps/${rm.slug}`}
                    className="card group flex h-full flex-col overflow-hidden hover:shadow-lift hover:ring-indigo-200"
                  >
                    <div className={`relative h-32 bg-gradient-to-br ${rm.color}`}>
                      <div className="absolute inset-0 bg-dots opacity-20" />
                      <div className="relative flex h-full items-center justify-between p-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                              {rm.steps.length} steps
                            </p>
                            <p className="text-sm font-bold text-white">{rm.goal}</p>
                          </div>
                        </div>
                        <Target className="h-8 w-8 text-white/30" />
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700">
                        {rm.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                        {rm.description}
                      </p>

                      <div className="mt-5 space-y-2.5">
                        {rm.steps.slice(0, 3).map((step, idx) => (
                          <div key={step.title} className="flex items-center gap-3 text-sm">
                            <span className="flex h-6 w-6 flex-shrslate-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {idx + 1}
                            </span>
                            <span className="text-slate-700">{step.title}</span>
                            <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {step.est}
                            </span>
                          </div>
                        ))}
                        {rm.steps.length > 3 && (
                          <p className="pl-9 text-xs font-semibold text-slate-400">
                            +{rm.steps.length - 3} more steps
                          </p>
                        )}
                      </div>

                      <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-indigo-700">
                        View full roadmap
                        <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
