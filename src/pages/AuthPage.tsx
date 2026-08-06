import { useState } from 'react';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, AlertCircle, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAuth } from '@/lib/auth';
import { LoadingDots } from '@/components/LoadingState';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp, verifySignUpCode, resendSignUpCode } = useAuth();
  const { navigate } = useRouter();
  const isSignup = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (isSignup) {
      const { error, requiresEmailConfirmation } = await signUp(email, password, fullName || undefined);
      setLoading(false);
      if (error) {
        setError(error);
      } else if (requiresEmailConfirmation) {
        setPendingVerification(true);
      } else {
        navigate('/profile');
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        setError(error);
      } else {
        navigate('/profile');
      }
    }
  };

  const handleCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await verifySignUpCode(email, verificationCode.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate('/profile');
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await resendSignUpCode(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setNotice('Yangi tasdiqlash kodi emailingizga yuborildi.');
    }
  };

  if (pendingVerification) {
    return (
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-20">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mt-6 card overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-center text-white">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="mt-4 text-2xl font-bold">Emailingizni tasdiqlang</h1>
              <p className="mt-2 text-sm text-indigo-100">Cameron Learning Center sizga yuborgan 6 xonali kodni kiriting.</p>
            </div>
            <form onSubmit={handleCodeVerification} className="p-8">
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-error-500/10 p-4 ring-1 ring-error-500/20">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-500" />
                  <p className="text-sm text-error-600">{error}</p>
                </div>
              )}
              {notice && (
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-700">{notice}</p>
                </div>
              )}
              <p className="mb-5 text-center text-sm text-slate-500"><span className="font-semibold text-slate-700">{email}</span> manziliga kod yuborildi.</p>
              <label htmlFor="verification-code" className="mb-1.5 block text-sm font-semibold text-slate-700">Tasdiqlash kodi</label>
              <input
                id="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.5em] text-slate-900 ring-1 ring-slate-200 placeholder:tracking-[0.5em] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button type="submit" disabled={loading || verificationCode.length !== 6} className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <><LoadingDots /> Tekshirilmoqda...</> : 'Kodni tasdiqlash'}
              </button>
              <button type="button" onClick={handleResendCode} disabled={loading} className="btn-ghost mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCw className="h-4 w-4" /> Kodni qayta yuborish
              </button>
              <button type="button" onClick={() => { setPendingVerification(false); setVerificationCode(''); setError(null); setNotice(null); }} className="mt-4 w-full text-sm font-semibold text-slate-500 hover:text-slate-700">
                Email manzilini o‘zgartirish
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-20">
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-electric-600/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mt-6 card overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              {isSignup ? <User className="h-7 w-7 text-white" /> : <Mail className="h-7 w-7 text-white" />}
            </div>
            <h1 className="mt-4 text-2xl font-bold">
              {isSignup ? 'Create your free account' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm text-indigo-100">
              {isSignup
                ? 'Join 850,000+ learners exploring programming and academic subjects.'
                : 'Sign in to track your progress and access your saved courses.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-error-500/10 p-4 ring-1 ring-error-500/20">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrslate-0 text-error-500" />
                <p className="text-sm text-error-600">{error}</p>
              </div>
            )}

            {notice && (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-700">{notice}</p>
              </div>
            )}

            {isSignup && (
              <div className="mb-4">
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Full name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                  className="w-full rounded-xl border-0 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoadingDots />
                  {isSignup ? 'Creating account...' : 'Signing in...'}
                </>
              ) : isSignup ? (
                'Create free account'
              ) : (
                'Sign in'
              )}
            </button>

            {isSignup && (
              <div className="mt-5 space-y-2.5">
                {['Track your learning progress', 'Save courses and roadmaps', 'Personalized recommendations'].map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-slate-500">
                    <Check className="h-4 w-4 text-indigo-600" />
                    {f}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-6 text-center text-sm text-slate-500">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                to={isSignup ? '/login' : '/signup'}
                className="font-semibold text-indigo-700 hover:text-indigo-800"
              >
                {isSignup ? 'Sign in' : 'Sign up free'}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
