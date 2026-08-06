import { Home, ArrowLeft, Compass } from 'lucide-react';
import { Link } from '@/router';
import { subjects } from '@/data/subjects';

export function NotFoundPage() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-20">
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="absolute -left-40 top-20 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="relative max-w-lg text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-card">
          <Compass className="h-10 w-10 text-indigo-600 animate-spin-slow" />
        </div>
        <p className="mt-8 text-7xl font-extrabold tracking-tight text-indigo-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-500 text-pretty">
          The page you are looking for might have been moved, deleted, or never existed. Let's
          get you back on track.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary">
            <Home className="h-4 w-4" />
            Back to home
          </Link>
          <Link to="/courses" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Browse courses
          </Link>
        </div>

        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Or explore a subject
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {subjects.slice(0, 6).map((s) => (
              <Link
                key={s.slug}
                to={`/subjects/${s.slug}`}
                className="chip bg-white text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200"
              >
                {s.shortName}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
