import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Loader2,
  Mic2,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Save,
  Send,
} from 'lucide-react';
import { Link } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import {
  completeEnglishExam,
  fetchContestWorkspace,
  formatContestDuration,
  saveExamWritingResponse,
  submitContestAnswer,
  type ExamPart,
  type ContestWorkspace,
  type WritingResponse,
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

  if ((workspace.contest.subjectSlug === 'ielts' || workspace.contest.subjectSlug === 'cefr') && workspace.parts.length > 0) {
    return <EnglishExamWorkspace workspace={workspace} now={now} onRefresh={load} />;
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

function EnglishExamWorkspace({ workspace, now, onRefresh }: { workspace: ContestWorkspace; now: number; onRefresh: () => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, number>>(workspace.answers);
  const [writingResponses, setWritingResponses] = useState<Record<string, WritingResponse>>(workspace.writingResponses);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(workspace.parts.filter((part) => part.section === 'writing').map((part) => [part.id, workspace.writingResponses[part.id]?.content ?? ''])));
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(Boolean(workspace.contest.completedAt));
  const [completing, setCompleting] = useState(false);

  const part = workspace.parts[currentPartIndex] ?? null;
  const sectionTiming = workspace.examTiming;
  const contestRemaining = Math.max(0, new Date(workspace.contest.endTime).getTime() - now);
  const sectionRemaining = sectionTiming
    ? Math.max(0, new Date(sectionTiming.sectionEndsAt).getTime() - now)
    : contestRemaining;
  const contestEnded = contestRemaining <= 0;
  const sectionEnded = sectionRemaining <= 0;
  const locked = sectionEnded || contestEnded || completed;
  const partQuestions = useMemo(() => part ? workspace.questions.filter((question) => question.partId === part.id) : [], [part, workspace.questions]);
  const answeredCount = useMemo(() => workspace.questions.filter((question) => answers[question.id] !== undefined).length, [answers, workspace.questions]);
  const submittedWritingCount = useMemo(() => workspace.parts.filter((item) => item.section === 'writing' && writingResponses[item.id]?.submittedAt).length, [workspace.parts, writingResponses]);
  const completedPartCount = useMemo(() => workspace.parts.filter((item) => isPartComplete(item, workspace.questions, answers, writingResponses)).length, [answers, workspace.parts, workspace.questions, writingResponses]);
  const allComplete = completedPartCount === workspace.parts.length;
  const progress = workspace.parts.length ? Math.round((completedPartCount / workspace.parts.length) * 100) : 0;
  const urgent = sectionRemaining > 0 && sectionRemaining < 5 * 60 * 1000;
  const isWritingSection = sectionTiming?.activeSection === 'writing' || part?.section === 'writing';

  useEffect(() => {
    if (!sectionTiming || !sectionEnded || contestEnded || completed) return;
    const timeout = window.setTimeout(() => { void onRefresh(); }, 800);
    return () => window.clearTimeout(timeout);
  }, [completed, contestEnded, onRefresh, sectionEnded, sectionTiming]);

  const saveAnswer = async (questionId: string, selectedOption: number) => {
    if (locked || savingKey) return;
    const previous = answers[questionId];
    setAnswers((current) => ({ ...current, [questionId]: selectedOption }));
    setSavingKey(`answer:${questionId}`);
    setError(null);
    try {
      await submitContestAnswer(questionId, selectedOption);
    } catch (reason) {
      setAnswers((current) => {
        const restored = { ...current };
        if (previous === undefined) delete restored[questionId];
        else restored[questionId] = previous;
        return restored;
      });
      setError(reason instanceof Error ? reason.message : 'Javob saqlanmadi. Qayta urinib ko‘ring.');
    } finally {
      setSavingKey(null);
    }
  };

  const saveWriting = async (examPart: ExamPart, submit: boolean) => {
    if (locked || savingKey) return;
    const content = drafts[examPart.id]?.trim() ?? '';
    if (!content) return setError('Writing javobini yozing.');
    setSavingKey(`writing:${examPart.id}`);
    setError(null);
    try {
      const response = await saveExamWritingResponse(examPart.id, content, submit);
      setWritingResponses((current) => ({ ...current, [examPart.id]: response }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Writing javobi saqlanmadi.');
    } finally {
      setSavingKey(null);
    }
  };

  const completeExam = async () => {
    if (locked || completing) return;
    if (!isWritingSection || !allComplete) {
      setError('Writing bo‘limidagi barcha javoblarni yuboring. Oldingi bo‘limlardagi javoblar ham serverda saqlangan bo‘lishi kerak.');
      return;
    }
    if (!window.confirm('Imtihonni yakunlab yuborasizmi? Keyin javoblarni o‘zgartirib bo‘lmaydi.')) return;
    setCompleting(true);
    setError(null);
    try {
      await completeEnglishExam(workspace.contest.id);
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Imtihonni yakunlab bo‘lmadi.');
    } finally {
      setCompleting(false);
    }
  };

  if (!part) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="card max-w-lg p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Exam partlari topilmadi</h1><Link to={`/contests/${workspace.contest.slug}`} className="btn-primary mt-6">Contest sahifasiga qaytish</Link></div></div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3"><Link to={`/contests/${workspace.contest.slug}`} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Chiqish</span></Link><div className="hidden h-5 w-px bg-slate-700 sm:block" /><div className="min-w-0"><p className="truncate text-sm font-bold">{workspace.contest.title}</p><p className="truncate text-[10px] text-slate-400">{workspace.contest.subject} · {workspace.parts.length} ta part</p></div></div>
        <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums ${urgent || sectionEnded ? 'bg-error-500/20 text-error-200' : 'bg-slate-800 text-slate-200'}`}><Clock className="h-4 w-4" />{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} · ` : ''}{sectionEnded ? 'Vaqt tugadi' : formatRemaining(sectionRemaining)}</div>
        <button type="button" onClick={() => setShowNavigator((current) => !current)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">{showNavigator ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}<span className="hidden lg:inline">Partlar</span></button>
      </header>

      <div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-y-auto bg-white"><div className="mx-auto max-w-4xl p-5 sm:p-8"><div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Hozirgi bo‘lim</p><p className="mt-1 text-sm font-bold text-slate-900">{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} uchun ${sectionMinutes(sectionTiming)} minut` : `${examSectionLabel(part.section)} bo‘limi`}</p></div><p className="text-xs leading-relaxed text-slate-600">Bo‘lim vaqti tugashi bilan keyingi bo‘lim avtomatik ochiladi. Oldingi bo‘limga qaytib bo‘lmaydi.</p></div></div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">{part.position}</span><div><p className="text-sm font-bold text-slate-900">{examSectionLabel(part.section)} · Part {currentPartIndex + 1} / {workspace.parts.length}</p><p className="text-xs text-slate-400">{answeredCount} ta test javobi · {submittedWritingCount} ta writing yuborilgan</p></div></div><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>{progress}%</div></div>

        {contestEnded && <ExamNotice kind="error" title="Imtihon vaqti tugadi">Yangi javob qabul qilinmaydi. Saqlangan javoblar organizer tomonidan yakunlanadi.</ExamNotice>}
        {sectionEnded && !contestEnded && <ExamNotice kind="success" title={`${examSectionLabel(part.section)} vaqti tugadi`}>Keyingi bo‘lim ochilmoqda. Bu bo‘limga endi qaytib bo‘lmaydi.</ExamNotice>}
        {completed && <ExamNotice kind="success" title="Imtihon yuborildi">Barcha bo‘limlar yakunlandi. Writing javoblari tekshirilgach, organizer natija va reytingni e’lon qiladi.</ExamNotice>}
        {error && <ExamNotice kind="error" title="Amal bajarilmadi">{error}</ExamNotice>}

        <section className="card overflow-hidden"><div className="border-b border-slate-100 p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">{part.section === 'listening' ? <Mic2 className="h-5 w-5" /> : part.section === 'reading' ? <BookOpen className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}</span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{examSectionLabel(part.section)}</p><h1 className="mt-1 text-xl font-bold text-slate-900">{part.title}</h1>{part.instructions && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.instructions}</p>}</div></div></div>
          <div className="p-6 sm:p-8">{part.section === 'listening' ? <ListeningPart part={part} questions={partQuestions} answers={answers} locked={locked} savingKey={savingKey} onAnswer={saveAnswer} /> : part.section === 'reading' ? <ReadingPart part={part} questions={partQuestions} answers={answers} locked={locked} savingKey={savingKey} onAnswer={saveAnswer} /> : <WritingPart part={part} draft={drafts[part.id] ?? ''} response={writingResponses[part.id]} locked={locked} saving={savingKey === `writing:${part.id}`} onChange={(value) => setDrafts((current) => ({ ...current, [part.id]: value }))} onSave={() => void saveWriting(part, false)} onSubmit={() => void saveWriting(part, true)} />}</div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={currentPartIndex === 0 || sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.max(0, index - 1))} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Oldingi part</button>{currentPartIndex < workspace.parts.length - 1 ? <button type="button" disabled={sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.min(workspace.parts.length - 1, index + 1))} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">Keyingi part<ChevronRight className="h-4 w-4" /></button> : isWritingSection ? <button type="button" disabled={locked || !allComplete || completing} onClick={() => void completeExam()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{completed ? 'Yuborilgan' : 'Imtihonni yakunlash'}</button> : <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">Keyingi bo‘lim vaqt tugaganda ochiladi</div>}</div>
      </div></main>
        {showNavigator && <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white lg:block"><div className="flex h-full flex-col p-5"><div className="border-b border-slate-100 pb-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} navigatsiyasi` : 'Exam navigatsiyasi'}</p><p className="mt-2 text-sm font-semibold text-slate-700">{completedPartCount} / {workspace.parts.length} part tayyor</p></div><div className="mt-5 space-y-2">{workspace.parts.map((item, index) => { const selected = index === currentPartIndex; const done = isPartComplete(item, workspace.questions, answers, writingResponses); return <button key={item.id} type="button" disabled={sectionEnded} onClick={() => setCurrentPartIndex(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${selected ? 'bg-indigo-600 text-white' : done ? 'bg-success-50 text-success-800 hover:bg-success-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-white/20 text-white' : done ? 'bg-success-100 text-success-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{item.position}</span><span className="min-w-0"><span className="block truncate font-bold">Part {item.position}</span><span className={`block truncate text-[11px] ${selected ? 'text-white/70' : 'text-slate-400'}`}>{item.title}</span></span></button>; })}</div><div className="mt-auto rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500"><p className="font-bold text-slate-700">Natijalar haqida</p><p className="mt-1">Listening va Reading avtomatik hisoblanadi. Writing esa tekshiruvdan keyin qo‘shiladi; shundan keyingina final natija va rating yangilanadi.</p></div></div></aside>}
      </div>
    </div>
  );
}

function isPartComplete(part: ExamPart, questions: ContestWorkspace['questions'], answers: Record<string, number>, writingResponses: Record<string, WritingResponse>): boolean {
  if (part.section === 'writing') return Boolean(writingResponses[part.id]?.submittedAt);
  const partQuestions = questions.filter((question) => question.partId === part.id);
  return partQuestions.length > 0 && partQuestions.every((question) => answers[question.id] !== undefined);
}

function examSectionLabel(section: ExamPart['section']): string {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function sectionMinutes(timing: NonNullable<ContestWorkspace['examTiming']>): number {
  if (timing.activeSection === 'listening') return timing.listeningMinutes;
  if (timing.activeSection === 'reading') return timing.readingMinutes;
  return timing.writingMinutes;
}

function ExamNotice({ kind, title, children }: { kind: 'error' | 'success'; title: string; children: string }) {
  const Icon = kind === 'error' ? AlertCircle : CheckCircle2;
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-error-200 bg-error-50 text-error-800' : 'border-success-200 bg-success-50 text-success-800'}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">{title}</p><p className="mt-1">{children}</p></div></div>;
}

function ObjectiveQuestions({ questions, answers, locked, savingKey, onAnswer }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void }) {
  return <div className="mt-7 space-y-8">{questions.map((question, index) => <div key={question.id} className="border-t border-slate-100 pt-7 first:border-t-0 first:pt-0"><div className="flex items-start justify-between gap-4"><h2 className="whitespace-pre-wrap text-base font-bold leading-relaxed text-slate-900">{index + 1}. {question.prompt}</h2><span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{question.points} ball</span></div><div className="mt-4 space-y-3" role="radiogroup" aria-label={`Savol ${index + 1}`}>{question.options.map((option, optionIndex) => { const selected = answers[question.id] === optionIndex; const saving = savingKey === `answer:${question.id}`; return <button key={`${question.id}-${optionIndex}`} type="button" role="radio" aria-checked={selected} disabled={locked || saving} onClick={() => onAnswer(question.id, optionIndex)} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="flex-1 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-slate-700">{option}</span>{saving && selected && <Loader2 className="mt-1 h-4 w-4 animate-spin text-indigo-600" />}{!saving && selected && <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-600" />}</button>; })}</div></div>)}</div>;
}

function ListeningPart({ part, questions, answers, locked, savingKey, onAnswer }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void }) {
  return <><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Audio</p>{part.audioUrl ? <audio controls controlsList="nodownload" className="mt-3 w-full" src={part.audioUrl}>Brauzeringiz audio tinglashni qo‘llamaydi.</audio> : <p className="mt-3 text-sm text-error-200">Audio mavjud emas.</p>}</div>{part.content && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.content}</p>}<ObjectiveQuestions questions={questions} answers={answers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} /></>;
}

function ReadingPart({ part, questions, answers, locked, savingKey, onAnswer }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void }) {
  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Reading passage</p><div className="whitespace-pre-wrap">{part.content}</div></article><ObjectiveQuestions questions={questions} answers={answers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} /></>;
}

function WritingPart({ part, draft, response, locked, saving, onChange, onSave, onSubmit }: { part: ExamPart; draft: string; response: WritingResponse | undefined; locked: boolean; saving: boolean; onChange: (value: string) => void; onSave: () => void; onSubmit: () => void }) {
  const submitted = Boolean(response?.submittedAt);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Writing topic · {part.maxPoints} ball</p><div className="whitespace-pre-wrap">{part.content}</div></article><div className="mt-6"><div className="mb-2 flex items-center justify-between"><label htmlFor={`writing-${part.id}`} className="text-sm font-bold text-slate-800">Javobingiz</label><span className="text-xs font-semibold text-slate-400">{wordCount} so‘z</span></div><textarea id={`writing-${part.id}`} value={draft} disabled={locked || submitted} onChange={(event) => onChange(event.target.value)} className="input min-h-72 resize-y leading-relaxed disabled:bg-slate-50" placeholder="Javobingizni shu yerga yozing…" />{submitted ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-4 text-sm text-success-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Writing yuborilgan</p><p className="mt-1">Bu javob organizer tekshirganidan keyin yakuniy natijaga qo‘shiladi.</p></div></div> : <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={locked || saving || !draft.trim()} onClick={onSave} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Draftni saqlash</button><button type="button" disabled={locked || saving || !draft.trim()} onClick={onSubmit} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Writingni yuborish</button></div>}</div></>;
}
