import type { ReactNode } from 'react';
import { Reveal } from '@/components/Primitives';

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  variant = 'default',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'compact';
}) {
  return (
    <section
      className={`theme-page-header relative overflow-hidden border-b border-slate-100 ${
        variant === 'compact' ? 'pt-28 pb-12' : 'pt-32 pb-16'
      }`}
    >
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="theme-orb-primary absolute -right-32 -top-32 h-72 w-72 rounded-full blur-3xl" />
      <div className="theme-orb-secondary absolute -left-32 top-10 h-64 w-64 rounded-full blur-3xl" />
      <div className="container-page relative">
        <Reveal>
          {eyebrow && (
            <span className="eyebrow mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
              {eyebrow}
            </span>
          )}
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl text-balance">
            {title}
          </h1>
        </Reveal>
        {description && (
          <Reveal delay={160}>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-500 text-pretty">
              {description}
            </p>
          </Reveal>
        )}
        {children && (
          <Reveal delay={240}>
            <div className="mt-8">{children}</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
