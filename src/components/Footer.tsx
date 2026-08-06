import { Twitter, Github, Youtube, Linkedin, Mail, ArrowRight, Send } from 'lucide-react';
import { Link } from '@/router';
import { subjects } from '@/data/subjects';

const exploreLinks = [
  { to: '/courses', label: 'All Courses' },
  { to: '/subjects', label: 'Subjects' },
  { to: '/roadmaps', label: 'Learning Roadmaps' },
  { to: '/resources', label: 'Articles & Resources' },
  { to: '/pricing', label: 'Pricing Plans' },
];

const companyLinks = [
  { to: '/about', label: 'About Us' },
  { to: '/about#mission', label: 'Our Mission' },
  { to: '/about#instructors', label: 'Instructors' },
  { to: '/about#contact', label: 'Contact' },
];

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-slate-950 text-slate-400">
      <div className="absolute inset-0 bg-grid-dark opacity-[0.07]" />
      <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-electric-600/10 blur-3xl" />

      <div className="container-page relative">
        {/* CTA banner */}
        <div className="grid gap-8 border-b border-white/10 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="font-display text-2xl font-extrabold text-white sm:text-3xl text-balance">
              Start learning today — for free.
            </h3>
            <p className="mt-3 max-w-md text-slate-400">
              Join over 850,000 learners exploring programming and academic subjects at their own pace.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link to="/signup" className="btn-gradient">
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/courses" className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15">
              Browse courses
            </Link>
          </div>
        </div>

        {/* Link columns + newsletter */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="rounded-lg bg-white px-2 py-1.5">
                <img src="/logo.png" alt="Cameron Learning" className="h-10 w-auto object-contain" />
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Free, structured learning for programming and academic subjects. Built for curious minds.
            </p>

            {/* Newsletter */}
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Newsletter
              </p>
              <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border-0 bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button type="submit" className="btn-gradient flex-shrink-0 px-4 py-2.5">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            <div className="mt-6 flex items-center gap-2">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Github, label: 'GitHub' },
                { icon: Youtube, label: 'YouTube' },
                { icon: Linkedin, label: 'LinkedIn' },
                { icon: Mail, label: 'Email' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10 transition-all hover:bg-indigo-600 hover:text-white hover:ring-indigo-600"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Explore</h4>
            <ul className="mt-4 space-y-2.5">
              {exploreLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-indigo-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Subjects</h4>
            <ul className="mt-4 space-y-2.5">
              {subjects.slice(0, 5).map((s) => (
                <li key={s.slug}>
                  <Link to={`/subjects/${s.slug}`} className="text-sm text-slate-400 transition-colors hover:text-indigo-400">
                    {s.shortName}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/subjects" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                  View all
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Company</h4>
            <ul className="mt-4 space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-indigo-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Cameron Learning. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <a href="#" className="transition-colors hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-slate-300">Terms of Service</a>
            <a href="#" className="transition-colors hover:text-slate-300">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
