import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Link } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import {
  fetchContestWorkspace,
  formatContestDuration,
  submitContestAnswer,
  type ContestWorkspace,
} from '@/lib/contests';

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function QuizWorkspacePage({ slug }: { slug: string }) {
  const [workspace, setWorkspace] = useState<ContestWorkspace | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchContestWorkspace(slug);
      setWorkspace(next);
      setAnswers(next.answers);
      setCurrentIndex(0);
    } catch (reason) {
      setWorkspace(null);
      setError(reason instanceof Error ? reason.message : 'Contest ochilmadi.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const question = workspace?.questions[currentIndex] ?? null;
  const remaining = workspace ? Math.max(0, new Date(workspace.contest.endTime).getTime() - now) : 0;
  const hasEnded = workspace ? remaining <= 0 : false;
  const answeredCount = useMemo(
    () => workspace?.questions.filter((item) => answers[item.id] !== undefined).length ?? 0,
    [answers, workspace],
  );

  const saveAnswer = async (questionId: string, selectedOption: number) => {
    if (hasEnded || savingQuestionId) return;

    const previous = answers[questionId];
    setAnswers((current) => ({ ...current, [questionId]: selectedOption }));
    setSavingQuestionId(questionId);
    setSaveError(null);
    try {
      await submitContestAnswer(questionId, selectedOption);
    } catch (reason) {
      setAnswers((current) => {
        const restored = { ...current };
        if (previous === undefined) delete restored[questionId];
        else restored[questionId] = previous;
        return restored;
      });
      setSaveError(reason instanceof Error ? reason.message : 'Javob serverga saqlanmadi. Qayta urinib ko‘ring.');
    } finally {
      setSavingQuestionId(null);
    }
  };

  if (loading) return <LoadingState className="min-h-screen" message="Contest yuklanmoqda" />;
  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="card max-w-lg p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-error-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Contestga kirib bo‘lmadi</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{error ?? 'Siz ro‘yxatdan o‘tmagan bo‘lishingiz yoki contest hali boshlanmagan bo‘lishi mumkin.'}</p>
          <Link to={`/contests/${slug}`} className="btn-primary mt-6">Contest sahifasiga qaytish</Link>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="card max-w-lg p-8 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Savollar mavjud emas</h1>
          <p className="mt-2 text-sm text-slate-500">Bu contest uchun savollar e’lon qilinmagan.</p>
          <Link to={`/contests/${slug}`} className="btn-primary mt-6">Contest sahifasiga qaytish</Link>
        </div>
      </div>
    );
  }

  const progress = workspace.questions.length ? Math.round((answeredCount / workspace.questions.length) * 100) : 0;
  const urgent = remaining > 0 && remaining < 30 * 60 * 1000;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/contests/${workspace.contest.slug}`} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Chiqish</span>
          </Link>
          <div className="hidden h-5 w-px bg-slate-700 sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{workspace.contest.title}</p>
            <p className="truncate text-[10px] text-slate-400">{workspace.contest.subject} · {workspace.questions.length} ta savol</p>
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums ${urgent || hasEnded ? 'bg-error-500/20 text-error-200' : 'bg-slate-800 text-slate-200'}`}>
          <Clock className="h-4 w-4" />
          {hasEnded ? 'Vaqt tugadi' : formatRemaining(remaining)}
        </div>
        <button type="button" onClick={() => setShowNavigator((current) => !current)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">
          {showNavigator ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          <span className="hidden lg:inline">Savollar</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto bg-white">
          <div className="mx-auto max-w-3xl p-5 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">{question.position}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Savol {currentIndex + 1} / {workspace.questions.length}</p>
                  <p className="text-xs text-slate-400">{answeredCount} ta javob saqlangan · {formatContestDuration(Math.max(0, Math.round((new Date(workspace.contest.endTime).getTime() - new Date(workspace.contest.startTime).getTime()) / 60000)))} contest</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>
                {progress}%
              </div>
            </div>

            {hasEnded && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-800"><Clock className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Contest vaqti tugadi</p><p className="mt-1">Yangi javob qabul qilinmaydi. Saqlangan javoblar organizer tomonidan yakunlangach hisoblanadi.</p></div></div>}
            {saveError && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="font-bold">Javob saqlanmadi</p><p className="mt-1">{saveError}</p></div></div>}

            <section className="card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <h1 className="whitespace-pre-wrap text-lg font-bold leading-relaxed text-slate-900 sm:text-xl">{question.prompt}</h1>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{question.points} ball</span>
              </div>
              <div className="mt-7 space-y-3" role="radiogroup" aria-label="Javob variantlari">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === optionIndex;
                  const saving = savingQuestionId === question.id;
                  return (
                    <button
                      key={`${question.id}-${optionIndex}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={hasEnded || saving}
                      onClick={() => void saveAnswer(question.id, optionIndex)}
                      className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                      <span className="flex-1 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-slate-700">{option}</span>
                      {saving && selected && <Loader2 className="mt-1 h-4 w-4 animate-spin text-indigo-600" />}
                      {!saving && selected && <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-600" aria-label="Javob saqlandi" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-slate-400">Javob tanlanganda u darhol serverga saqlanadi. To‘g‘ri yoki noto‘g‘riligi contest yakunlanmaguncha ko‘rsatilmaydi.</p>
            </section>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Oldingi</button>
              {currentIndex < workspace.questions.length - 1 ? (
                <button type="button" onClick={() => setCurrentIndex((index) => Math.min(workspace.questions.length - 1, index + 1))} className="btn-primary px-5 py-2.5 text-sm">Keyingi<ChevronRight className="h-4 w-4" /></button>
              ) : (
                <Link to={`/contests/${workspace.contest.slug}`} className="btn-primary px-5 py-2.5 text-sm">Javoblarni yakunlash<CheckCircle2 className="h-4 w-4" /></Link>
              )}
            </div>
          </div>
        </main>

        {showNavigator && (
          <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white lg:block">
            <div className="flex h-full flex-col p-5">
              <div className="border-b border-slate-100 pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Contest navigatsiyasi</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{answeredCount} / {workspace.questions.length} javob saqlangan</p>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {workspace.questions.map((item, index) => {
                  const selected = index === currentIndex;
                  const answered = answers[item.id] !== undefined;
                  return <button key={item.id} type="button" onClick={() => setCurrentIndex(index)} className={`flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-colors ${selected ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : answered ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} aria-label={`Savol ${index + 1}`}>{item.position}</button>;
                })}
              </div>
              <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500"><p className="font-bold text-slate-700">Natija haqida</p><p className="mt-1">Ball va rating faqat contest tugagach, judge yoki admin yakunlaganidan keyin serverda hisoblanadi.</p></div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
