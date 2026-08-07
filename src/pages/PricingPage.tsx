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
  price: number;
  period: string;
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
    tagline: 'Everything you need to start learning.',
    icon: Sparkles,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'ring-slate-200',
    features: [
      'Access to all 172 courses',
      'Free preview lessons',
      'Community discussion access',
      'Basic progress tracking',
      'Browse all roadmaps',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    period: 'per month',
    tagline: 'For serious learners who want more.',
    icon: Zap,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'ring-indigo-300',
    features: [
      'Everything in Free',
      'Unlimited full course access',
      'Downloadable course resources',
      'Certificates of completion',
      'Advanced progress analytics',
      'Priority community support',
      'Ad-free experience',
    ],
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'max',
    name: 'Max',
    price: 70,
    period: 'per month',
    tagline: 'The complete learning experience.',
    icon: Crown,
    color: 'text-electric-700',
    bgColor: 'bg-electric-50',
    borderColor: 'ring-electric-300',
    features: [
      'Everything in Pro',
      '1-on-1 instructor sessions',
      'Personalized learning paths',
      'Project reviews & feedback',
      'Early access to new courses',
      'Mentor matching program',
      'Lifetime course access',
      'Career guidance & interview prep',
    ],
    highlight: false,
    badge: 'Best value',
  },
];

const faqs = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. You can upgrade or downgrade your plan whenever you want. Changes take effect immediately and are prorated.',
  },
  {
    q: 'Is there a free trial for paid plans?',
    a: 'Your Free plan is available forever with no credit card required. You can upgrade to Pro or Max anytime to unlock premium features.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Absolutely. Cancel anytime from your profile page. You will keep access until the end of your billing period.',
  },
  {
    q: 'Do you offer student discounts?',
    a: 'Yes. Students with a valid .edu email can get 50% off any paid plan. Contact us for details.',
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
        description="Start free forever. Upgrade when you are ready for more. No hidden fees, cancel anytime."
      />

      {/* Plans */}
      <section className="bg-white py-16">
        <div className="container-page">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => {
              const Icon = plan.icon;
              const isCurrent = profile?.plan === plan.id;
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

                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-slate-400">
                        {plan.price === 0 ? plan.period : `/${plan.period.replace('per ', '')}`}
                      </span>
                    </div>

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
                        `Continue to payment`
                      )}
                    </button>

                    <div className="mt-8 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2.5">
                          <span className={`mt-0.5 flex h-5 w-5 flex-shrslate-0 items-center justify-center rounded-full ${plan.bgColor}`}>
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
            All plans include access to our community. Prices in USD. No credit card required for Free.
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
                  { icon: Star, title: '850K+ learners', desc: 'A growing community of curious minds.', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { icon: Check, title: 'No risk', desc: 'Cancel anytime, no questions asked.', color: 'text-electric-600', bg: 'bg-electric-50' },
                  { icon: Zap, title: 'Instant access', desc: 'Start learning the moment you sign up.', color: 'text-sun-600', bg: 'bg-sun-500/10' },
                ].map(({ icon: Icon, title, desc, color, bg }, i) => (
                  <div
                    key={title}
                    className={`flex items-center gap-4 p-6 ${i < 2 ? 'lg:border-r lg:border-slate-100' : ''} ${
                      i === 0 ? 'border-b lg:border-b-0' : i === 1 ? 'border-b lg:border-b-0' : ''
                    }`}
                  >
                    <div className={`flex h-11 w-11 flex-shrslate-0 items-center justify-center rounded-xl ${bg}`}>
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
                Start with our free plan — no credit card, no commitment. Upgrade only when you are ready.
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
