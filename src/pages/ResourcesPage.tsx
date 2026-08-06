import { ArrowRight, Clock, Calendar, User, Search, BookOpen, Lightbulb, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Primitives';
import { articles } from '@/data/articles';

const categories = ['All', 'Programming', 'Computer Science', 'Mathematics', 'Data Science', 'Databases', 'Learning'];

export function ResourcesPage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = articles.filter((a) => {
    const matchesQuery =
      !query.trim() ||
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(query.toLowerCase());
    const matchesCat = activeCategory === 'All' || a.category === activeCategory;
    return matchesQuery && matchesCat;
  });

  const featured = articles[0];

  return (
    <>
      <PageHeader
        eyebrow="Articles & resources"
        title="Learn beyond the lessons"
        description="Guides, tutorials, and deep dives to complement your courses. Written by our instructors and experts."
      />

      {/* Featured article */}
      <section className="bg-white py-16">
        <div className="container-page">
          <Reveal>
            <Link
              to={`/resources/${featured.slug}`}
              className="card group grid overflow-hidden lg:grid-cols-2 hover:shadow-lift"
            >
              <div className="relative h-64 overflow-hidden bg-gradient-to-br from-indigo-500 to-electric-600 lg:h-auto">
                <div className="absolute inset-0 bg-dots opacity-20" />
                <div className="relative flex h-full flex-col justify-between p-8">
                  <span className="chip w-fit bg-white/20 text-white backdrop-blur-sm">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Featured article
                  </span>
                  <FileText className="h-20 w-20 text-white/30" />
                </div>
              </div>
              <div className="flex flex-col justify-center p-8">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="chip bg-indigo-50 text-indigo-700">{featured.category}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {featured.readTime}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-slate-900 group-hover:text-indigo-700 text-balance">
                  {featured.title}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600 text-pretty">{featured.excerpt}</p>
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <User className="h-4 w-4" />
                    {featured.author}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
                    Read article
                    <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Article list with filters */}
      <section className="bg-slate-50/50 py-16">
        <div className="container-page">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-2xl font-bold text-slate-900">All articles</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full rounded-xl bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-soft'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Articles grid */}
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article, i) => (
              <Reveal key={article.slug} delay={(i % 3) * 80}>
                <Link
                  to={`/resources/${article.slug}`}
                  className="card group flex h-full flex-col p-6 hover:-translate-y-1 hover:shadow-lift hover:ring-indigo-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="chip bg-indigo-50 text-indigo-700">{article.category}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-slate-900 group-hover:text-indigo-700 text-balance">
                    {article.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{article.excerpt}</p>

                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {article.tags.map((tag) => (
                      <span key={tag} className="chip bg-slate-50 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {article.author}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {article.readTime}
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="mt-8 card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-lg font-bold text-slate-900">No articles found</h3>
              <p className="mt-1 text-sm text-slate-500">Try a different search or category.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
