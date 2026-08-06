import { ArrowLeft, ArrowRight, Clock, User, Calendar, ChevronRight } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { Reveal } from '@/components/Primitives';
import { getArticle, articles } from '@/data/articles';

export function ArticleDetailPage({ slug }: { slug: string }) {
  const article = getArticle(slug);
  const { navigate } = useRouter();

  if (!article) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Article not found</h1>
        <p className="mt-2 text-slate-500">This article does not exist or was moved.</p>
        <button onClick={() => navigate('/resources')} className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to resources
        </button>
      </div>
    );
  }

  const related = articles.filter((a) => a.slug !== article.slug && a.category === article.category).slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden pt-28 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />

        <div className="container-page relative py-14">
          <nav className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link to="/resources" className="hover:text-white">Resources</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">{article.category}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white/70 line-clamp-1">{article.title}</span>
          </nav>

          <Reveal delay={80}>
            <span className="chip mt-6 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">
              {article.category}
            </span>
          </Reveal>
          <Reveal delay={160}>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl text-balance">
              {article.title}
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-4 max-w-2xl text-lg text-slate-300 text-pretty">{article.excerpt}</p>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {article.author}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(article.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {article.readTime}
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container-page">
          <div className="mx-auto max-w-3xl">
            <div className="prose-content space-y-6">
              <p className="text-lg leading-relaxed text-slate-700 text-pretty">
                {article.excerpt} In this article, we break down the key ideas step by step, with
                examples and practical takeaways you can apply immediately.
              </p>

              <h2 className="text-2xl font-bold text-slate-900">Why this matters</h2>
              <p className="leading-relaxed text-slate-600">
                Learning is most effective when you understand not just the "how" but the "why."
                Too many resources skip the intuition and jump straight to formulas or code snippets.
                We take a different approach: build understanding first, then layer on the technical
                details.
              </p>

              <div className="rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100">
                <p className="font-semibold text-indigo-800">Key takeaway</p>
                <p className="mt-2 text-indigo-900">
                  The best learners do not just consume content — they actively engage with it. Try
                  the exercises, ask questions, and connect new ideas to what you already know.
                </p>
              </div>

              <h2 className="text-2xl font-bold text-slate-900">Breaking it down</h2>
              <p className="leading-relaxed text-slate-600">
                Every complex topic becomes simpler when you break it into smaller pieces. Start
                with the core concept, practice it until it feels natural, then add the next layer.
                This is exactly how our courses are structured — each lesson builds on the last.
              </p>

              <ul className="space-y-3">
                {['Start with the fundamentals', 'Practice with real examples', 'Connect new concepts to old ones', 'Teach it back to solidify understanding'].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-shrslate-0 items-center justify-center rounded-full bg-indigo-100">
                      <ArrowRight className="h-3 w-3 text-indigo-700" />
                    </span>
                    <span className="text-slate-700">{point}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-bold text-slate-900">Next steps</h2>
              <p className="leading-relaxed text-slate-600">
                Ready to go deeper? Explore our structured courses and roadmaps to turn this
                knowledge into real skill. Each path is designed to take you from where you are
                to where you want to be, one step at a time.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to="/courses" className="btn-primary">
                  Explore courses
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/roadmaps" className="btn-ghost">
                  See learning paths
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-slate-50/50 py-16">
          <div className="container-page">
            <h2 className="text-2xl font-bold text-slate-900">Related articles</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {related.map((a, i) => (
                <Reveal key={a.slug} delay={i * 80}>
                  <Link
                    to={`/resources/${a.slug}`}
                    className="card group flex h-full flex-col p-6 hover:-translate-y-1 hover:shadow-lift hover:ring-indigo-200"
                  >
                    <span className="chip w-fit bg-indigo-50 text-indigo-700">{a.category}</span>
                    <h3 className="mt-4 text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-700 text-balance">
                      {a.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm text-slate-500 line-clamp-2">{a.excerpt}</p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {a.readTime}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
