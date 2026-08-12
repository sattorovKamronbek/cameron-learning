import {
  Target, Heart, Users, Sparkles, ArrowRight, Mail, MapPin, Lightbulb,
} from 'lucide-react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal, SectionHeading } from '@/components/Primitives';

const values = [
  {
    icon: Heart,
    title: 'Clear availability',
    description: 'We distinguish what can be used today from features that are still being prepared.',
    color: 'bg-error-500',
  },
  {
    icon: Lightbulb,
    title: 'Clarity over hype',
    description: 'The catalogue does not use fabricated learner counts, ratings, or feature claims.',
    color: 'bg-sun-500',
  },
  {
    icon: Target,
    title: 'Structure, not promises',
    description: 'Roadmaps are planning references, not guarantees of a credential or job outcome.',
    color: 'bg-indigo-500',
  },
  {
    icon: Users,
    title: 'Respectful of your data',
    description: 'Account features are limited to what the app can actually store and show.',
    color: 'bg-electric-500',
  },
];

const catalogueNotes = [
  { icon: Target, title: 'Static outlines', description: 'Course pages currently provide curated topic and outline information, not a lesson player.' },
  { icon: Lightbulb, title: 'Planning references', description: 'Roadmaps are flexible study guides with listed estimates, not automatic programmes.' },
  { icon: Users, title: 'No simulated community', description: 'Forums, badges, AI feedback, and instructor profiles are not published until they are real.' },
];

export function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About Cameron"
        title="A transparent learning catalogue"
        description="Cameron currently presents curated course outlines, roadmaps, and resources for programming and academic subjects. Features are labelled by their real availability."
      />

      {/* Mission */}
      <section id="mission" className="bg-white py-20">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                eyebrow="What this version provides"
                title="A practical catalogue for choosing what to study"
                description="The current app helps you browse subject areas, compare course outlines, and use roadmaps as planning references. It does not present unfinished tools as live learning services."
              />
              <div className="mt-8 space-y-4">
                {[
                  'Browse course outlines, roadmaps, and resources without an account.',
                  'Save catalogue entries to your account when the database is connected.',
                  'See real contest activity only after a contest is created and finalized.',
                  'Interactive lessons, badges, forums, and AI feedback are clearly marked as unavailable.',
                ].map((point) => (
                  <Reveal key={point}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
                        <Sparkles className="h-3 w-3 text-indigo-700" />
                      </span>
                      <p className="text-slate-700 text-pretty">{point}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal delay={200}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, title: 'Browse entries', description: 'Explore the current catalogue without a social feed.', color: 'text-indigo-600' },
                  { icon: Lightbulb, title: 'Compare topics', description: 'Review listed subjects, tags, and outlines.', color: 'text-electric-600' },
                  { icon: Sparkles, title: 'See clear status', description: 'Unavailable features are not simulated.', color: 'text-sun-600' },
                  { icon: Target, title: 'Plan your study', description: 'Use roadmaps as flexible references.', color: 'text-error-600' },
                ].map(({ icon: Icon, title, description, color }) => (
                  <div key={title} className="card p-6 text-center">
                    <Icon className={'mx-auto h-8 w-8 ' + color} />
                    <p className="mt-3 text-base font-bold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-slate-50/50 py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="What we believe"
            title="Our values"
            description="The principles that guide everything we build."
            align="center"
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, description, color }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="card h-full p-6 text-center hover:shadow-card">
                  <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${color}`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Catalogue notes */}
      <section id="instructors" className="bg-white py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Catalogue notes"
            title="Instructor profiles are not published"
            description="The names and credentials behind a course are not presented as verified instructors until that information can be sourced and maintained."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {catalogueNotes.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={(i % 3) * 80}>
                <div className="card h-full p-6">
                  <Icon className="h-7 w-7 text-indigo-600" />
                  <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-50/50 py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl">
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-center text-white">
                <Mail className="mx-auto h-10 w-10 text-white/80" />
                <h2 className="mt-4 text-2xl font-bold">Get in touch</h2>
                <p className="mt-2 text-indigo-100">
                  Questions, feedback, or a correction to a catalogue entry? You can reach us by email.
                </p>
              </div>
              <div className="p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                    <Mail className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-xs text-slate-400">Email</p>
                      <p className="text-sm font-semibold text-slate-900">hello@cameron.learning</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-xs text-slate-400">Location</p>
                      <p className="text-sm font-semibold text-slate-900">Contact by email</p>
                    </div>
                  </div>
                </div>
                <Link to="/courses" className="btn-primary mt-6 w-full">
                  Browse the catalogue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
