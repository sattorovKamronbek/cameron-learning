import {
  Target, Heart, Users, Award, Globe, Sparkles, ArrowRight, Mail, MapPin, Lightbulb,
} from 'lucide-react';
import { Link } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal, SectionHeading, Eyebrow } from '@/components/Primitives';
import { stats } from '@/data/testimonials';

const values = [
  {
    icon: Heart,
    title: 'Education for all',
    description: 'Knowledge should not be locked behind paywalls. Our core content is free, forever.',
    color: 'bg-error-500',
  },
  {
    icon: Lightbulb,
    title: 'Clarity over jargon',
    description: 'We explain hard things in plain language. If you do not understand, that is on us.',
    color: 'bg-sun-500',
  },
  {
    icon: Target,
    title: 'Structure, not chaos',
    description: 'Random tutorials do not make you job-ready. Clear, ordered paths do.',
    color: 'bg-indigo-500',
  },
  {
    icon: Users,
    title: 'Community-driven',
    description: 'Hundreds of thousands of learners help each other grow every day.',
    color: 'bg-electric-500',
  },
];

const team = [
  { name: 'Maya Chen', role: 'Lead Instructor, Web Dev', initials: 'MC', color: 'from-indigo-400 to-indigo-600' },
  { name: 'David Okoro', role: 'Full-Stack Educator', initials: 'DO', color: 'from-electric-400 to-electric-600' },
  { name: 'Dr. Amara Okafor', role: 'Data Science Lead', initials: 'AO', color: 'from-error-400 to-error-600' },
  { name: 'Prof. Elena Rossi', role: 'CS & Mathematics', initials: 'ER', color: 'from-sun-400 to-sun-600' },
  { name: 'Prof. James Whitfield', role: 'Mathematics', initials: 'JW', color: 'from-electric-500 to-indigo-500' },
  { name: 'Dr. Yuki Tanaka', role: 'ML Research Engineer', initials: 'YT', color: 'from-indigo-500 to-electric-600' },
];

export function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About Cameron"
        title="We make learning clear"
        description="Cameron Learning is on a mission to make high-quality education in programming and academic subjects accessible to everyone — free, structured, and genuinely understandable."
      />

      {/* Mission */}
      <section id="mission" className="bg-white py-20">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Our mission"
                title="Great teaching should not be a privilege"
                description="We started Cameron because we were frustrated. The internet has more learning material than ever, but it is scattered, inconsistent, and often confusing. We set out to build the resource we wished we had: one place with clear paths, expert instructors, and content that respects your time."
              />
              <div className="mt-8 space-y-4">
                {[
                  'Free core content — no subscriptions to start learning.',
                  'Structured roadmaps so you always know what comes next.',
                  'Real instructors with real-world experience, not just video personalities.',
                  'A community that supports you when you get stuck.',
                ].map((point) => (
                  <Reveal key={point}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex h-5 w-5 flex-shrslate-0 items-center justify-center rounded-full bg-indigo-100">
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
                <div className="card p-6 text-center">
                  <Users className="mx-auto h-8 w-8 text-indigo-600" />
                  <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.learners}</p>
                  <p className="text-sm text-slate-500">Learners</p>
                </div>
                <div className="card p-6 text-center">
                  <Award className="mx-auto h-8 w-8 text-electric-600" />
                  <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.courses}</p>
                  <p className="text-sm text-slate-500">Courses</p>
                </div>
                <div className="card p-6 text-center">
                  <Globe className="mx-auto h-8 w-8 text-sun-600" />
                  <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.countries}</p>
                  <p className="text-sm text-slate-500">Countries</p>
                </div>
                <div className="card p-6 text-center">
                  <Target className="mx-auto h-8 w-8 text-error-600" />
                  <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.subjects}</p>
                  <p className="text-sm text-slate-500">Subjects</p>
                </div>
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

      {/* Instructors */}
      <section id="instructors" className="bg-white py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Our team"
            title="Learn from experts who teach"
            description="Our instructors are practitioners and academics who care deeply about making complex topics click."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member, i) => (
              <Reveal key={member.name} delay={(i % 3) * 80}>
                <div className="card flex items-center gap-4 p-6 hover:shadow-card">
                  <div
                    className={`flex h-16 w-16 flex-shrslate-0 items-center justify-center rounded-2xl bg-gradient-to-br ${member.color} text-xl font-bold text-white`}
                  >
                    {member.initials}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{member.name}</h3>
                    <p className="text-sm text-slate-500">{member.role}</p>
                  </div>
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
                  Questions, feedback, or partnership ideas? We would love to hear from you.
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
                      <p className="text-sm font-semibold text-slate-900">Remote · Worldwide</p>
                    </div>
                  </div>
                </div>
                <Link to="/signup" className="btn-primary mt-6 w-full">
                  Join the community
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
