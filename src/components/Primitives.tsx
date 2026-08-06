import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`eyebrow ${className}`}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={`${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}
    >
      {eyebrow && (
        <Reveal>
          <Eyebrow className={align === 'center' ? 'justify-center' : ''}>
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
            {eyebrow}
          </Eyebrow>
        </Reveal>
      )}
      <Reveal delay={80}>
        <h2 className="section-title mt-4 text-balance">{title}</h2>
      </Reveal>
      {description && (
        <Reveal delay={160}>
          <p className="mt-4 text-lg leading-relaxed text-slate-500 text-pretty">{description}</p>
        </Reveal>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  className = '',
  showLabel = false,
  size = 'md',
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative flex-1 overflow-hidden rounded-full bg-slate-200 ${heights[size]}`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            backgroundImage: 'linear-gradient(90deg, #6366f1 0%, #3b82f6 100%)',
          }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-bold tabular-nums text-slate-700">{Math.round(value)}%</span>
      )}
    </div>
  );
}

export function StatBlock({
  value,
  label,
  icon: Icon,
  accent = 'indigo',
}: {
  value: string | number;
  label: string;
  icon?: typeof import('lucide-react').Star;
  accent?: 'indigo' | 'electric' | 'slate' | 'sun' | 'success';
}) {
  const accents: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-600 text-indigo-600 bg-indigo-50',
    electric: 'from-electric-500 to-electric-600 text-electric-600 bg-electric-50',
    slate: 'from-slate-600 to-slate-800 text-slate-600 bg-slate-100',
    sun: 'from-sun-500 to-sun-600 text-sun-600 bg-sun-500/10',
    success: 'from-success-500 to-success-600 text-success-600 bg-success-500/10',
  };
  const a = accents[accent];
  return (
    <div className="card-hover p-6">
      {Icon && (
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${a.split(' ').slice(2).join(' ')}`}>
          <Icon className={`h-5 w-5 ${a.split(' ')[2]}`} />
        </div>
      )}
      <p className="font-display text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function BentoCard({
  children,
  className = '',
  delay = 0,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <div className={`group relative h-full ${hover ? 'card-hover' : 'card'} overflow-hidden`}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-100 to-electric-100 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60" />
        <div className="relative h-full">{children}</div>
      </div>
    </Reveal>
  );
}
