import { BadgeCheck, CalendarClock, ShieldCheck, Trophy } from 'lucide-react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';

export function AchievementsPage() {
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Achievements"
        title="Achievements are being prepared"
        description="Badges, progress, and seasonal awards will appear only after they can be tracked and verified by the server."
      />

      <section className="card mt-8 overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-6 py-10 text-center text-white sm:px-12">
          <div className="absolute inset-0 bg-grid opacity-5" />
          <div className="relative mx-auto max-w-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <Trophy className="h-7 w-7 text-sun-400" />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">No achievements to show yet</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              We do not display sample badges or estimated progress. Your real achievements will appear here once completed activity can be verified.
            </p>
          </div>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-3">
          <TrackingStep icon={ShieldCheck} title="Verified activity" description="Only server-recorded learning and contest activity will count." />
          <TrackingStep icon={BadgeCheck} title="Earned badges" description="Badges will be granted from completed, auditable requirements." />
          <TrackingStep icon={CalendarClock} title="Seasonal awards" description="Event badges will appear after verified event results are finalized." />
        </div>

        <div className="border-t border-slate-100 p-5 text-center">
          <Link to="/contests" className="btn-primary px-5 py-2.5 text-sm">
            <Trophy className="h-4 w-4" />
            Browse contests
          </Link>
        </div>
      </section>
    </div>
  );
}

function TrackingStep({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
        <Icon className="h-5 w-5 text-indigo-600" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}
