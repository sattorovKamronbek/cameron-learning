import { Check, Zap, Crown, Sparkles, ArrowRight, Star } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { PageHeader } from '@/components/PageHeader';
import { Reveal } from '@/components/Primitives';
import { useAuth } from '@/lib/auth';
import type { Plan } from '@/lib/supabase';
import { useState } from 'react';

type PlanInfo = {
  id: Plan;
  name: string;
  price: number | null;
  period?: string;
  tagline: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  borderColor: string;
  features: string[];
  highlight: boolean;
  badge?: string;
};

const plans: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    tagline: 'The account features currently available.',
    icon: Sparkles,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'ring-slate-200',
    features: [
      'Create a free account',
      'Save catalogue entries',
      'Browse course outlines',
      'Browse study roadmaps',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: null,
    tagline: 'Reserved for future paid plan details.',
    icon: Zap,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'ring-indigo-300',
    features: [
      'Paid checkout is not available yet',
      'Benefits will be published with secure checkout',
      'No account is upgraded from this page',
    ],
    highlight: false,
    badge: 'Coming soon',
  },
  {
    id: 'max',
    name: 'Max',
    price: null,
    tagline: 'Reserved for future paid plan details.',
    icon: Crown,
    color: 'text-electric-700',
    bgColor: 'bg-electric-50',
    borderColor: 'ring-electric-300',
    features: [
      'Paid checkout is not available yet',
      'Benefits will be published with secure checkout',
      'No account is upgraded from this page',
    ],
    highlight: false,
    badge: 'Coming soon',
  },
];

const faqs = [
  {
    q: 'Can I switch plans today?',
    a: 'The Free plan is available now. Paid checkout is not enabled yet, so the site will never charge you or change your plan from this page.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan is available forever with no credit card required.',
  },
  {
    q: 'Will I be billed from this page?',
    a: 'No. There is no payment provider connected to this page yet.',
  },
  {
    q: 'When will paid plans be available?',
    a: 'They will be announced only after secure checkout and billing management are connected.',
  },
];

export function PricingPage() {
  const { user, profile } = useAuth();
  const { navigate } = useRouter();
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const handleSelect = (planId: Plan) => {
    if (!user) {
      navigate('/signup');
      return;
    }
    if (planId === 'free' || profile?.plan === planId) return;
    // A paid plan can only be activated by a verified payment-provider webhook.
    // Do not mutate profile.plan from the browser.
    setCheckoutMessage('Online checkout is not configured yet. Your plan has not been changed.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        description="The Free account is currently available. Paid plans are placeholders until secure checkout and their benefits are published."
      />

      {/* Plans */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => {
              const Icon = plan.icon;
              const isCurrent = plan.price === 0 && profile?.plan === plan.id;
              return (
                <Reveal key={plan.id} delay={i * 100}>
                  <div
                    className={`card relative flex h-full flex-col p-8 ${
                      plan.highlight ? 'ring-2 ring-indigo-400 shadow-lift' : 'ring-1 ring-slate-100'
                    }`}
                  >
                    {plan.badge && (
                      <span
                        className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-bold text-white shadow-soft ${
                          plan.highlight ? 'bg-indigo-600' : 'bg-electric-600'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}

                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${plan.bgColor}`}>
                      <Icon className={`h-6 w-6 ${plan.color}`} />
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>

                    {plan.price == null ? (
                      <div className="mt-6 text-2xl font-extrabold tracking-tight text-slate-500">Not available yet</div>
                    ) : (
                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold tracking-tight text-slate-900">${plan.price}</span>
                        <span className="text-sm text-slate-400">{plan.period}</span>
                      </div>
                    )}

                    <button
                      onClick={() => handleSelect(plan.id)}
                      disabled={isCurrent}
                      className={`mt-6 w-full disabled:cursor-default ${
                        plan.highlight ? 'btn-primary' : 'btn-ghost'
                      } ${isCurrent ? 'opacity-60' : ''}`}
                    >
                      {isCurrent ? (
                        'Current plan'
                      ) : plan.price === 0 ? (
                        user ? 'Free plan' : 'Get started free'
                      ) : (
                        'Not available yet'
                      )}
                    </button>

                    <div className="mt-8 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2.5">
                          <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${plan.bgColor}`}>
                            <Check className={`h-3 w-3 ${plan.color}`} />
                          </span>
                          <span className="text-sm text-slate-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {checkoutMessage && (
            <p role="status" className="mx-auto mt-6 max-w-xl rounded-xl bg-sun-500/10 px-4 py-3 text-center text-sm font-semibold text-sun-700">
              {checkoutMessage}
            </p>
          )}

          <p className="mt-8 text-center text-sm text-slate-400">
            No paid price is active until secure checkout is configured. No credit card is required for the available Free account.
          </p>
        </div>
      </section>

      {/* Comparison highlight */}
      <section className="bg-slate-50/50 py-16">
        <div className="container-page">
          <Reveal>
            <div className="card overflow-hidden">
              <div className="grid lg:grid-cols-3">
                {[
                  { icon: Star, title: 'Catalogue browsing', desc: 'Course outlines and roadmaps can be explored without an account.', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { icon: Check, title: 'Free account tools', desc: 'Create an account to save catalogue entries. No card is required.', color: 'text-electric-600', bg: 'bg-electric-50' },
                  { icon: Zap, title: 'No surprise billing', desc: 'Paid checkout is disabled until it is securely connected.', color: 'text-sun-600', bg: 'bg-sun-500/10' },
                ].map(({ icon: Icon, title, desc, color, bg }, i) => (
                  <div
                    key={title}
                    className={`flex items-center gap-4 p-6 ${i < 2 ? 'lg:border-r lg:border-slate-100' : ''} ${
                      i === 0 ? 'border-b lg:border-b-0' : i === 1 ? 'border-b lg:border-b-0' : ''
                    }`}
                  >
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{title}</p>
                      <p className="text-sm text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mt-10 space-y-4">
              {faqs.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 80}>
                  <div className="card p-6">
                    <h3 className="font-bold text-slate-900">{faq.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white pb-20">
        <div className="container-page">
          <div className="theme-cta relative overflow-hidden rounded-3xl px-6 py-14 text-center shadow-lift sm:px-16">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="relative mx-auto max-w-xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-white text-balance">
                Still have questions?
              </h2>
              <p className="mt-3 text-indigo-100">
                Start with the available Free account to save useful catalogue entries. No credit card or commitment is required.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="btn bg-white text-indigo-700 shadow-lift hover:bg-indigo-50 px-6 py-3.5">
                  Create free account
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link to="/courses" className="btn bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/15 px-6 py-3.5">
                  Browse courses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
