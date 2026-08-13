import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
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
  fetchContestPreviewWorkspace,
  fetchContestWorkspace,
  formatContestDuration,
  saveCefrPreviewGapFillResponse,
  saveCefrPreviewMatchingResponse,
  saveCefrGapFillResponse,
  saveCefrMatchingResponse,
  saveContestPreviewWritingResponse,
  saveExamWritingResponse,
  submitContestPreviewAnswer,
  submitContestPreviewTextAnswer,
  submitContestAnswer,
  submitContestTextAnswer,
  fetchContestEditor,
  type ExamPart,
  type ExamSectionTimings,
  type ContestWorkspace,
  type GapFillResponse,
  type MatchingResponse,
  type MatchingWorkspaceConfig,
  type WritingResponse,
} from '@/lib/contests';

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function gapFillResponseKey(partId: string, blankNumber: number): string {
  return `${partId}:${blankNumber}`;
}

function gapFillBlankNumbers(content: string): number[] {
  return [...new Set(Array.from(content.matchAll(/\{\{([1-9]\d*)\}\}/g), (match) => Number(match[1])))]
    .sort((left, right) => left - right);
}

function matchingResponseKey(partId: string, speakerNumber: number): string {
  return `${partId}:${speakerNumber}`;
}

const PREVIEW_SESSION_KEY_PREFIX = 'exam-preview-session:';

function previewSessionStartedAt(contestId: string): number {
  const now = Date.now();
  try {
    const key = `${PREVIEW_SESSION_KEY_PREFIX}${contestId}`;
    const saved = Number(window.sessionStorage.getItem(key));
    if (Number.isFinite(saved) && saved > 0) return saved;
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // The preview remains usable when browser storage is unavailable.
  }
  return now;
}

function previewExamTiming(timings: ExamSectionTimings, startedAt: number, now: number) {
  const listeningStartsAt = startedAt;
  const readingStartsAt = listeningStartsAt + timings.listeningMinutes * 60_000;
  const writingStartsAt = readingStartsAt + timings.readingMinutes * 60_000;
  const activeSection = now < readingStartsAt ? 'listening' : now < writingStartsAt ? 'reading' : 'writing';
  const sectionStartsAt = activeSection === 'listening' ? listeningStartsAt : activeSection === 'reading' ? readingStartsAt : writingStartsAt;
  const sectionEndsAt = activeSection === 'listening'
    ? readingStartsAt
    : activeSection === 'reading'
      ? writingStartsAt
      : writingStartsAt + timings.writingMinutes * 60_000;

  return {
    ...timings,
    activeSection,
    sectionStartsAt: new Date(sectionStartsAt).toISOString(),
    sectionEndsAt: new Date(sectionEndsAt).toISOString(),
  };
}

export function QuizWorkspacePage({ slug, preview = false }: { slug: string; preview?: boolean }) {
  const [workspace, setWorkspace] = useState<ContestWorkspace | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [previewTiming, setPreviewTiming] = useState<ExamSectionTimings | null>(null);
  const [previewStartedAt, setPreviewStartedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreviewTiming(null);
    setPreviewStartedAt(null);
    try {
      const next = await (preview ? fetchContestPreviewWorkspace(slug) : fetchContestWorkspace(slug));
      const isEnglishExam = next.contest.subjectSlug === 'ielts' || next.contest.subjectSlug === 'cefr';
      const nextPreviewTiming = preview && isEnglishExam
        ? (await fetchContestEditor(next.contest.id)).sectionTimings
        : null;
      if (preview && isEnglishExam && !nextPreviewTiming) {
        throw new Error('Sinov rejimini ochishdan oldin Listening, Reading va Writing vaqtlarini saqlang.');
      }
      setWorkspace(next);
      setAnswers(next.answers);
      setCurrentIndex(0);
      setPreviewTiming(nextPreviewTiming);
      setPreviewStartedAt(nextPreviewTiming ? previewSessionStartedAt(next.contest.id) : null);
    } catch (reason) {
      setWorkspace(null);
      setError(reason instanceof Error ? reason.message : 'Contest ochilmadi.');
    } finally {
      setLoading(false);
    }
  }, [preview, slug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const question = workspace?.questions[currentIndex] ?? null;
  const remaining = !preview && workspace ? Math.max(0, new Date(workspace.contest.endTime).getTime() - now) : 0;
  const hasEnded = !preview && Boolean(workspace) && remaining <= 0;
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
      await (preview ? submitContestPreviewAnswer(questionId, selectedOption) : submitContestAnswer(questionId, selectedOption));
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
          <Link to={preview ? '/contest-management' : `/contests/${slug}`} className="btn-primary mt-6">{preview ? 'Contest boshqaruviga qaytish' : 'Contest sahifasiga qaytish'}</Link>
        </div>
      </div>
    );
  }

  if ((workspace.contest.subjectSlug === 'ielts' || workspace.contest.subjectSlug === 'cefr') && workspace.parts.length > 0) {
    return <EnglishExamWorkspace workspace={workspace} now={now} onRefresh={load} preview={preview} previewTiming={previewTiming} previewStartedAt={previewStartedAt} />;
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="card max-w-lg p-8 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Savollar mavjud emas</h1>
          <p className="mt-2 text-sm text-slate-500">Bu contest uchun savollar e’lon qilinmagan.</p>
          <Link to={preview ? '/contest-management' : `/contests/${slug}`} className="btn-primary mt-6">{preview ? 'Contest boshqaruviga qaytish' : 'Contest sahifasiga qaytish'}</Link>
        </div>
      </div>
    );
  }

  const progress = workspace.questions.length ? Math.round((answeredCount / workspace.questions.length) * 100) : 0;
  const urgent = remaining > 0 && remaining < 30 * 60 * 1000;

  return (
    <div className="workspace-viewport flex flex-col overflow-hidden bg-slate-100">
      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={preview ? '/contest-management' : `/contests/${workspace.contest.slug}`} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Chiqish</span>
          </Link>
          <div className="hidden h-5 w-px bg-slate-700 sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{workspace.contest.title}</p>
            <p className="truncate text-[10px] text-slate-400">{workspace.contest.subject} · {workspace.questions.length} ta savol</p>
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${preview ? 'bg-sun-400/20 text-sun-100' : urgent || hasEnded ? 'bg-error-500/20 text-error-200' : 'bg-slate-800 text-slate-200'}`}>
          {preview ? <ClipboardList className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {preview ? 'Sinov rejimi' : hasEnded ? 'Vaqt tugadi' : formatRemaining(remaining)}
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

            {preview && <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-sun-200 bg-sun-50 p-4 text-sm text-sun-900"><ClipboardList className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Sinov rejimi</p><p className="mt-1">Bu faqat sizning draft tekshiruvingiz. Contest e’lon qilinmaydi va ratingga ta’sir qilmaydi.</p></div></div>}
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
            <div className="flex h-full min-h-0 flex-col p-5">
              <div className="border-b border-slate-100 pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Contest navigatsiyasi</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{answeredCount} / {workspace.questions.length} javob saqlangan</p>
              </div>
              <div className="mt-5 grid min-h-0 flex-1 grid-cols-5 content-start gap-2 overflow-y-auto pr-1">
                {workspace.questions.map((item, index) => {
                  const selected = index === currentIndex;
                  const answered = answers[item.id] !== undefined;
                  return <button key={item.id} type="button" onClick={() => setCurrentIndex(index)} className={`flex h-9 items-center justify-center rounded-lg text-xs font-bold transition-colors ${selected ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : answered ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} aria-label={`Savol ${index + 1}`}>{item.position}</button>;
                })}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500"><p className="font-bold text-slate-700">Natija haqida</p><p className="mt-1">Ball va rating faqat contest tugagach, judge yoki admin yakunlaganidan keyin serverda hisoblanadi.</p></div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function EnglishExamWorkspace({ workspace, now, onRefresh, preview = false, previewTiming = null, previewStartedAt = null }: { workspace: ContestWorkspace; now: number; onRefresh: () => Promise<void>; preview?: boolean; previewTiming?: ExamSectionTimings | null; previewStartedAt?: number | null }) {
  const [answers, setAnswers] = useState<Record<string, number>>(workspace.answers);
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(workspace.textAnswers);
  const [gapFillResponses, setGapFillResponses] = useState<Record<string, GapFillResponse>>(workspace.gapFillResponses);
  const [matchingResponses, setMatchingResponses] = useState<Record<string, MatchingResponse>>(workspace.matchingResponses);
  const [writingResponses, setWritingResponses] = useState<Record<string, WritingResponse>>(workspace.writingResponses);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(workspace.parts.filter((part) => part.section === 'writing').map((part) => [part.id, workspace.writingResponses[part.id]?.content ?? ''])));
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(Boolean(workspace.contest.completedAt));
  const [completing, setCompleting] = useState(false);

  const sectionTiming = preview
    ? previewTiming && previewStartedAt ? previewExamTiming(previewTiming, previewStartedAt, now) : null
    : workspace.examTiming;
  const activeSection = sectionTiming?.activeSection;
  const visibleParts = useMemo(
    () => activeSection ? workspace.parts.filter((item) => item.section === activeSection) : workspace.parts,
    [activeSection, workspace.parts],
  );
  const visiblePartSignature = visibleParts.map((item) => item.id).join(':');
  useEffect(() => {
    // The server deliberately reveals one IELTS section at a time. Reset the
    // part navigator when its data changes so Part 4 of Listening cannot point
    // at a non-existent Reading passage after the automatic section switch.
    setCurrentPartIndex(0);
    setAnswers(workspace.answers);
    setTextAnswers(workspace.textAnswers);
    setGapFillResponses(workspace.gapFillResponses);
    setMatchingResponses(workspace.matchingResponses);
    setWritingResponses(workspace.writingResponses);
    setDrafts(Object.fromEntries(visibleParts.filter((item) => item.section === 'writing').map((item) => [item.id, workspace.writingResponses[item.id]?.content ?? ''])));
  }, [visiblePartSignature, visibleParts, workspace.answers, workspace.gapFillResponses, workspace.matchingResponses, workspace.textAnswers, workspace.writingResponses]);

  const part = visibleParts[currentPartIndex] ?? null;
  const previewEndsAt = preview && previewTiming && previewStartedAt
    ? previewStartedAt + (previewTiming.listeningMinutes + previewTiming.readingMinutes + previewTiming.writingMinutes) * 60_000
    : null;
  const contestRemaining = Math.max(0, (previewEndsAt ?? new Date(workspace.contest.endTime).getTime()) - now);
  const sectionRemaining = sectionTiming
    ? Math.max(0, new Date(sectionTiming.sectionEndsAt).getTime() - now)
    : contestRemaining;
  const contestEnded = contestRemaining <= 0;
  const sectionEnded = sectionRemaining <= 0;
  const locked = sectionEnded || contestEnded || completed;
  const partQuestions = useMemo(() => part ? workspace.questions.filter((question) => question.partId === part.id) : [], [part, workspace.questions]);
  const visibleQuestionIds = useMemo(() => new Set(visibleParts.flatMap((item) => workspace.questions.filter((question) => question.partId === item.id).map((question) => question.id))), [visibleParts, workspace.questions]);
  const answeredCount = useMemo(() => workspace.questions.filter((question) => visibleQuestionIds.has(question.id)).filter((question) => question.answerType === 'text' ? Boolean(textAnswers[question.id]?.trim()) : answers[question.id] !== undefined).length + Object.values(gapFillResponses).filter((response) => visibleParts.some((item) => item.id === response.partId)).length + Object.values(matchingResponses).filter((response) => visibleParts.some((item) => item.id === response.partId)).length, [answers, gapFillResponses, matchingResponses, textAnswers, visibleParts, visibleQuestionIds, workspace.questions]);
  const submittedWritingCount = useMemo(() => visibleParts.filter((item) => item.section === 'writing' && writingResponses[item.id]?.submittedAt).length, [visibleParts, writingResponses]);
  const completedPartCount = useMemo(() => visibleParts.filter((item) => isPartComplete(item, workspace.questions, answers, textAnswers, gapFillResponses, workspace.matchingConfigs[item.id], matchingResponses, writingResponses)).length, [answers, gapFillResponses, matchingResponses, textAnswers, visibleParts, workspace.matchingConfigs, workspace.questions, writingResponses]);
  const allComplete = completedPartCount === visibleParts.length;
  const progress = visibleParts.length ? Math.round((completedPartCount / visibleParts.length) * 100) : 0;
  const urgent = sectionRemaining > 0 && sectionRemaining < 5 * 60 * 1000;
  const isWritingSection = sectionTiming?.activeSection === 'writing' || part?.section === 'writing';

  useEffect(() => {
    if (preview || !sectionTiming || !sectionEnded || contestEnded || completed) return;
    const timeout = window.setTimeout(() => { void onRefresh(); }, 800);
    return () => window.clearTimeout(timeout);
  }, [completed, contestEnded, onRefresh, preview, sectionEnded, sectionTiming]);

  const saveAnswer = async (questionId: string, selectedOption: number) => {
    if (locked || savingKey) return;
    const previous = answers[questionId];
    setAnswers((current) => ({ ...current, [questionId]: selectedOption }));
    setSavingKey(`answer:${questionId}`);
    setError(null);
    try {
      await (preview ? submitContestPreviewAnswer(questionId, selectedOption) : submitContestAnswer(questionId, selectedOption));
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

  const saveTextAnswer = async (questionId: string, value: string) => {
    if (locked || savingKey) return;
    const previous = textAnswers[questionId];
    const answer = value.trim();
    setTextAnswers((current) => {
      const next = { ...current };
      if (answer) next[questionId] = answer;
      else delete next[questionId];
      return next;
    });
    setSavingKey(`text:${questionId}`);
    setError(null);
    try {
      await (preview ? submitContestPreviewTextAnswer(questionId, answer) : submitContestTextAnswer(questionId, answer));
    } catch (reason) {
      setTextAnswers((current) => {
        const next = { ...current };
        if (previous) next[questionId] = previous;
        else delete next[questionId];
        return next;
      });
      setError(reason instanceof Error ? reason.message : 'Javob saqlanmadi.');
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
      const response = await (preview
        ? saveContestPreviewWritingResponse(examPart.id, content, submit)
        : saveExamWritingResponse(examPart.id, content, submit));
      setWritingResponses((current) => ({ ...current, [examPart.id]: response }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Writing javobi saqlanmadi.');
    } finally {
      setSavingKey(null);
    }
  };

  const saveGapFill = async (examPart: ExamPart, blankNumber: number, answer: string) => {
    if (locked || savingKey) return;
    const key = gapFillResponseKey(examPart.id, blankNumber);
    const previous = gapFillResponses[key];
    const trimmed = answer.trim();
    setGapFillResponses((current) => {
      const next = { ...current };
      if (trimmed) next[key] = { partId: examPart.id, blankNumber, answer: trimmed };
      else delete next[key];
      return next;
    });
    setSavingKey(`gap-fill:${key}`);
    setError(null);
    try {
      await (preview
        ? saveCefrPreviewGapFillResponse(examPart.id, blankNumber, trimmed)
        : saveCefrGapFillResponse(examPart.id, blankNumber, trimmed));
    } catch (reason) {
      setGapFillResponses((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setError(reason instanceof Error ? reason.message : 'Javob saqlanmadi.');
    } finally {
      setSavingKey(null);
    }
  };

  const saveMatching = async (examPart: ExamPart, speakerNumber: number, optionPosition: number) => {
    if (locked || savingKey) return;
    const key = matchingResponseKey(examPart.id, speakerNumber);
    const previous = matchingResponses[key];
    setMatchingResponses((current) => ({ ...current, [key]: { partId: examPart.id, speakerNumber, optionPosition } }));
    setSavingKey(`matching:${key}`);
    setError(null);
    try {
      await (preview
        ? saveCefrPreviewMatchingResponse(examPart.id, speakerNumber, optionPosition)
        : saveCefrMatchingResponse(examPart.id, speakerNumber, optionPosition));
    } catch (reason) {
      setMatchingResponses((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setError(reason instanceof Error ? reason.message : 'Speaker javobi saqlanmadi.');
    } finally {
      setSavingKey(null);
    }
  };

  const completeExam = async () => {
    if (preview || locked || completing) return;
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
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="card max-w-lg p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Exam partlari topilmadi</h1><Link to={preview ? '/contest-management' : `/contests/${workspace.contest.slug}`} className="btn-primary mt-6">{preview ? 'Contest boshqaruviga qaytish' : 'Contest sahifasiga qaytish'}</Link></div></div>;
  }

  return (
    <div className="workspace-viewport flex flex-col overflow-hidden bg-slate-100">
      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3"><Link to={preview ? '/contest-management' : `/contests/${workspace.contest.slug}`} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Chiqish</span></Link><div className="hidden h-5 w-px bg-slate-700 sm:block" /><div className="min-w-0"><p className="truncate text-sm font-bold">{workspace.contest.title}</p><p className="truncate text-[10px] text-slate-400">{workspace.contest.subject} · {visibleParts.length} ta part</p></div></div>
        <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${preview ? 'bg-sun-400/20 text-sun-100' : urgent || sectionEnded ? 'bg-error-500/20 text-error-200' : 'bg-slate-800 text-slate-200'}`}>{preview ? <ClipboardList className="h-4 w-4" /> : <Clock className="h-4 w-4" />}{preview ? <>Sinov · {sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} · ` : ''}{sectionEnded ? 'Vaqt tugadi' : formatRemaining(sectionRemaining)}</> : <>{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} · ` : ''}{sectionEnded ? 'Vaqt tugadi' : formatRemaining(sectionRemaining)}</>}</div>
        <button type="button" onClick={() => setShowNavigator((current) => !current)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">{showNavigator ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}<span className="hidden lg:inline">Partlar</span></button>
      </header>

      <div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-y-auto bg-white"><div className="mx-auto max-w-4xl p-5 sm:p-8"><div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{preview ? 'Sinov rejimi' : 'Hozirgi bo‘lim'}</p><p className="mt-1 text-sm font-bold text-slate-900">{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} uchun ${sectionMinutes(sectionTiming)} minut` : `${examSectionLabel(part.section)} bo‘limi`}</p></div><p className="text-xs leading-relaxed text-slate-600">{preview ? 'Bu test faqat sizning akkauntingizda saqlanadi. Bo‘limlar va vaqt limiti haqiqiy imtihon oqimidek ishlaydi, lekin contest e’lon qilinmaydi va ratingga kirmaydi.' : 'Bo‘lim vaqti tugashi bilan keyingi bo‘lim avtomatik ochiladi. Oldingi bo‘limga qaytib bo‘lmaydi.'}</p></div></div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">{part.position}</span><div><p className="text-sm font-bold text-slate-900">{examSectionLabel(part.section)} · Part {ieltsPartNumber(workspace.contest.subjectSlug, part)} / {visibleParts.length}</p><p className="text-xs text-slate-400">{answeredCount} ta test javobi · {submittedWritingCount} ta writing yuborilgan</p></div></div><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>{progress}%</div></div>

        {preview && <ExamNotice kind="success" title="Sinov rejimi faol">Bu test faqat sizning akkauntingizda saqlanadi. Contest e’lon qilinmaydi va ratingga kirmaydi.</ExamNotice>}
        {contestEnded && <ExamNotice kind="error" title="Imtihon vaqti tugadi">Yangi javob qabul qilinmaydi. Saqlangan javoblar organizer tomonidan yakunlanadi.</ExamNotice>}
        {sectionEnded && !contestEnded && <ExamNotice kind="success" title={`${examSectionLabel(part.section)} vaqti tugadi`}>Keyingi bo‘lim ochilmoqda. Bu bo‘limga endi qaytib bo‘lmaydi.</ExamNotice>}
        {completed && <ExamNotice kind="success" title="Imtihon yuborildi">Barcha bo‘limlar yakunlandi. Writing javoblari tekshirilgach, organizer natija va reytingni e’lon qiladi.</ExamNotice>}
        {error && <ExamNotice kind="error" title="Amal bajarilmadi">{error}</ExamNotice>}

        <section className="card overflow-hidden"><div className="border-b border-slate-100 p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">{part.section === 'listening' ? <Mic2 className="h-5 w-5" /> : part.section === 'reading' ? <BookOpen className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}</span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{examSectionLabel(part.section)}</p><h1 className="mt-1 text-xl font-bold text-slate-900">{part.title}</h1>{part.instructions && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.instructions}</p>}</div></div></div>
          <div className="p-6 sm:p-8">{part.section === 'listening' ? <ListeningPart part={part} questions={partQuestions} answers={answers} textAnswers={textAnswers} gapFillResponses={gapFillResponses} matchingConfig={workspace.matchingConfigs[part.id]} matchingResponses={matchingResponses} locked={locked} savingKey={savingKey} audioOnly={workspace.contest.subjectSlug === 'cefr' && part.position === 1} gapFill={workspace.contest.subjectSlug === 'cefr' && (part.position === 2 || part.position === 6)} matching={workspace.contest.subjectSlug === 'cefr' && (part.position === 3 || part.position === 4)} mapMatching={workspace.contest.subjectSlug === 'cefr' && part.position === 4} extractQuestions={workspace.contest.subjectSlug === 'cefr' && part.position === 5} onAnswer={saveAnswer} onTextSave={saveTextAnswer} onGapFillSave={saveGapFill} onMatchingSave={saveMatching} /> : part.section === 'reading' ? <ReadingPart part={part} questions={partQuestions} answers={answers} textAnswers={textAnswers} gapFillResponses={gapFillResponses} matchingConfig={workspace.matchingConfigs[part.id]} matchingResponses={matchingResponses} cefrExam={workspace.contest.subjectSlug === 'cefr'} locked={locked} savingKey={savingKey} onAnswer={saveAnswer} onTextSave={saveTextAnswer} onGapFillSave={saveGapFill} onMatchingSave={saveMatching} /> : <WritingPart part={part} draft={drafts[part.id] ?? ''} response={writingResponses[part.id]} locked={locked} saving={savingKey === `writing:${part.id}`} ieltsTask={workspace.contest.subjectSlug === 'ielts' ? (part.position === 8 ? 1 : 2) : null} onChange={(value) => setDrafts((current) => ({ ...current, [part.id]: value }))} onSave={() => void saveWriting(part, false)} onSubmit={() => void saveWriting(part, true)} />}</div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={currentPartIndex === 0 || sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.max(0, index - 1))} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Oldingi part</button>{currentPartIndex < visibleParts.length - 1 ? <button type="button" disabled={sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.min(visibleParts.length - 1, index + 1))} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">Keyingi part<ChevronRight className="h-4 w-4" /></button> : preview ? <Link to="/contest-management" className="btn-primary px-5 py-2.5 text-sm"><CheckCircle2 className="h-4 w-4" />Sinovni yakunlash</Link> : isWritingSection ? <button type="button" disabled={locked || !allComplete || completing} onClick={() => void completeExam()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{completed ? 'Yuborilgan' : 'Imtihonni yakunlash'}</button> : <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">Keyingi bo‘lim vaqt tugaganda ochiladi</div>}</div>
      </div></main>
        {showNavigator && <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white lg:block"><div className="flex h-full min-h-0 flex-col p-5"><div className="border-b border-slate-100 pb-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} navigatsiyasi` : 'Exam navigatsiyasi'}</p><p className="mt-2 text-sm font-semibold text-slate-700">{completedPartCount} / {visibleParts.length} part tayyor</p></div><div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{visibleParts.map((item, index) => { const selected = index === currentPartIndex; const done = isPartComplete(item, workspace.questions, answers, textAnswers, gapFillResponses, workspace.matchingConfigs[item.id], matchingResponses, writingResponses); return <button key={item.id} type="button" disabled={sectionEnded} onClick={() => setCurrentPartIndex(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${selected ? 'bg-indigo-600 text-white' : done ? 'bg-success-50 text-success-800 hover:bg-success-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-white/20 text-white' : done ? 'bg-success-100 text-success-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{ieltsPartNumber(workspace.contest.subjectSlug, item)}</span><span className="min-w-0"><span className="block truncate font-bold">{examSectionLabel(item.section)} · Part {ieltsPartNumber(workspace.contest.subjectSlug, item)}</span><span className={`block truncate text-[11px] ${selected ? 'text-white/70' : 'text-slate-400'}`}>{item.title}</span></span></button>; })}</div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500"><p className="font-bold text-slate-700">Natijalar haqida</p><p className="mt-1">Listening va Reading avtomatik hisoblanadi. Writing esa tekshiruvdan keyin qo‘shiladi; shundan keyingina final natija va rating yangilanadi.</p></div></div></aside>}
      </div>
    </div>
  );
}

function isPartComplete(part: ExamPart, questions: ContestWorkspace['questions'], answers: Record<string, number>, textAnswers: Record<string, string>, gapFillResponses: Record<string, GapFillResponse>, matchingConfig: MatchingWorkspaceConfig | undefined, matchingResponses: Record<string, MatchingResponse>, writingResponses: Record<string, WritingResponse>): boolean {
  if (part.section === 'writing') return Boolean(writingResponses[part.id]?.submittedAt);
  const gapFillBlanks = part.section === 'reading' && part.position === 5 ? [] : gapFillBlankNumbers(part.content);
  if (gapFillBlanks.length > 0) return gapFillBlanks.every((blankNumber) => Boolean(gapFillResponses[gapFillResponseKey(part.id, blankNumber)]?.answer));
  if (matchingConfig) return matchingConfig.speakers.length > 0 && matchingConfig.speakers.every((speaker) => matchingResponses[matchingResponseKey(part.id, speaker.speakerNumber)] !== undefined);
  const partQuestions = questions.filter((question) => question.partId === part.id);
  return partQuestions.length > 0 && partQuestions.every((question) => question.answerType === 'text' ? Boolean(textAnswers[question.id]?.trim()) : answers[question.id] !== undefined);
}

function ieltsPartNumber(subjectSlug: string, part: ExamPart): number {
  if (subjectSlug !== 'ielts') return part.position;
  if (part.section === 'reading') return part.position - 4;
  if (part.section === 'writing') return part.position - 7;
  return part.position;
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

function ObjectiveQuestionRows({ questions, answers, textAnswers, locked, savingKey, onAnswer, onTextSave, audioOnly, useStoredPosition = false }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; audioOnly: boolean; useStoredPosition?: boolean }) {
  return <>{questions.map((question, index) => {
    const number = useStoredPosition ? question.position : index + 1;
    const textResponse = question.answerType === 'text';
    const saving = savingKey === `${textResponse ? 'text' : 'answer'}:${question.id}`;
    return <div key={question.id} className="border-t border-slate-100 pt-7 first:border-t-0 first:pt-0">{audioOnly ? <p className="sr-only">Audio ichidagi savol {number}</p> : <div className="flex items-start justify-between gap-4"><h2 className="whitespace-pre-wrap text-base font-bold leading-relaxed text-slate-900">{number}. {question.prompt}</h2><span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{question.points} ball</span></div>}{textResponse ? <TextAnswerInput questionId={question.id} number={number} initialValue={textAnswers[question.id] ?? ''} wordLimit={question.wordLimit} locked={locked} saving={saving} onSave={onTextSave} /> : <div className={audioOnly ? 'space-y-3' : 'mt-4 space-y-3'} role="radiogroup" aria-label={audioOnly ? `Audio savoli ${number} uchun variantlar` : `Savol ${number}`}>{question.options.map((option, optionIndex) => { const selected = answers[question.id] === optionIndex; return <button key={`${question.id}-${optionIndex}`} type="button" role="radio" aria-checked={selected} disabled={locked || saving} onClick={() => onAnswer(question.id, optionIndex)} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + optionIndex)}</span><span className="flex-1 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-slate-700">{option}</span>{saving && selected && <Loader2 className="mt-1 h-4 w-4 animate-spin text-indigo-600" />}{!saving && selected && <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-600" />}</button>; })}</div>}</div>;
  })}</>;
}

function TextAnswerInput({ questionId, number, initialValue, wordLimit, locked, saving, onSave }: { questionId: string; number: number; initialValue: string; wordLimit: number; locked: boolean; saving: boolean; onSave: (questionId: string, value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue, questionId]);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const overLimit = wordLimit > 0 && words > wordLimit;
  return <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Javobni yozing</p><p className={`text-xs font-semibold ${overLimit ? 'text-error-700' : 'text-slate-500'}`}>{wordLimit > 0 ? `Ko‘pi bilan ${wordLimit} so‘z yoki son · ` : ''}{words} so‘z</p></div><label className="sr-only" htmlFor={`text-answer-${questionId}`}>Savol {number} javobi</label><input id={`text-answer-${questionId}`} value={value} disabled={locked || saving} onChange={(event) => setValue(event.target.value)} onBlur={() => !overLimit && onSave(questionId, value)} className="input mt-3 bg-white disabled:bg-slate-50" placeholder="Javobni kiriting" />{overLimit ? <p className="mt-2 text-xs font-semibold text-error-700">Javob so‘z limitidan oshib ketdi; qisqartiring.</p> : <p className="mt-2 text-xs text-slate-500">Maydonni tark etganingizda javob saqlanadi.{saving ? ' Saqlanmoqda…' : ''}</p>}</div>;
}

function CefrSharedTextBlank({ question, initialValue, locked, saving, onSave }: { question: ContestWorkspace['questions'][number]; initialValue: string; locked: boolean; saving: boolean; onSave: (questionId: string, value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue, question.id]);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const overLimit = question.wordLimit > 0 && words > question.wordLimit;
  return <span className="inline-flex align-middle"><label className="sr-only" htmlFor={`shared-mini-text-${question.id}`}>Savol {question.position} javobi</label><input id={`shared-mini-text-${question.id}`} value={value} disabled={locked || saving} onChange={(event) => setValue(event.target.value)} onBlur={() => !overLimit && onSave(question.id, value)} className={`mx-1 inline-block w-32 border-b-2 bg-white px-2 py-0.5 text-center font-semibold text-slate-900 outline-none transition-colors focus:border-violet-700 disabled:bg-slate-100 ${overLimit ? 'border-error-500' : 'border-violet-400'}`} placeholder={`${question.position}`} /><span className="sr-only">Savol {question.position}, {question.points} ball</span></span>;
}

function CefrReadingPartFiveMiniTexts({ questions, answers, textAnswers, locked, savingKey, onAnswer, onTextSave }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void }) {
  const miniTexts = questions.filter((question) => question.position >= 30 && question.position <= 33).sort((left, right) => left.position - right.position);
  const choices = questions.filter((question) => question.position >= 34 && question.position <= 35).sort((left, right) => left.position - right.position);
  const sharedText = miniTexts.find((question) => question.position === 30);
  const questionByPosition = new Map(miniTexts.map((question) => [question.position, question]));
  const pieces = sharedText?.prompt.split(/(\{\{(?:30|31|32|33)\}\})/g) ?? [];
  return <div className="mt-6 space-y-7"><section><div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">30–33 · Bitta kichik text</p><p className="mt-1 text-xs">Quyidagi bitta kichik textdagi barcha bo‘sh joylarni bitta so‘z bilan to‘ldiring.</p></div>{sharedText && pieces.length > 1 ? <article className="rounded-2xl border border-violet-100 bg-violet-50/35 p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Questions 30–33</p><span className="text-xs font-semibold text-slate-500">Har biri bitta so‘z</span></div><p className="whitespace-pre-wrap text-sm leading-8 text-slate-800">{pieces.map((piece, index) => { const match = /^\{\{(30|31|32|33)\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = questionByPosition.get(Number(match[1])); return question ? <CefrSharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : <span key={index} className="mx-1 rounded bg-error-100 px-2 py-1 text-xs font-bold text-error-700">{piece}</span>; })}</p><p className="mt-4 text-xs text-slate-500">Maydonni tark etganingizda javob saqlanadi.</p></article> : <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-800"><p className="font-bold">Kichik text hali sozlanmagan</p><p className="mt-1 text-xs leading-relaxed">Organizer 30-savolda <code>{'{{30}}'}</code> dan <code>{'{{33}}'}</code> gacha bo‘lgan barcha markerli umumiy textni saqlashi kerak.</p></div>}</section><section><div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">34–35 · Multiple choice</p><p className="mt-1 text-xs">Har savol uchun A, B, C yoki D variantlaridan birini tanlang.</p></div><ObjectiveQuestions questions={choices} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition /></section></div>;
}

function ObjectiveQuestions({ questions, answers, textAnswers, locked, savingKey, onAnswer, onTextSave, audioOnly = false, groupByExtract = false, useStoredPosition = false }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; audioOnly?: boolean; groupByExtract?: boolean; useStoredPosition?: boolean }) {
  if (groupByExtract) return <div className="mt-7 grid gap-5">{[1, 2, 3].map((extractNumber) => {
    const from = 24 + ((extractNumber - 1) * 2);
    const items = questions.filter((question) => question.position === from || question.position === from + 1);
    return <section key={extractNumber} className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-fuchsia-100 bg-fuchsia-50/70 px-5 py-3"><div><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">Extract {extractNumber}</p><p className="mt-1 text-sm font-bold text-slate-800">Savol {from} va {from + 1}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-100">{items.length}/2</span></div><div className="p-5"><ObjectiveQuestionRows questions={items} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} audioOnly={false} useStoredPosition /></div></section>;
  })}</div>;
  return <div className="mt-7 space-y-8"><ObjectiveQuestionRows questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} audioOnly={audioOnly} useStoredPosition={audioOnly || useStoredPosition} /></div>;
}

function ListeningPart({ part, questions, answers, textAnswers, gapFillResponses, matchingConfig, matchingResponses, locked, savingKey, audioOnly, gapFill, matching, mapMatching, extractQuestions, onAnswer, onTextSave, onGapFillSave, onMatchingSave }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; gapFillResponses: Record<string, GapFillResponse>; matchingConfig: MatchingWorkspaceConfig | undefined; matchingResponses: Record<string, MatchingResponse>; locked: boolean; savingKey: string | null; audioOnly: boolean; gapFill: boolean; matching: boolean; mapMatching: boolean; extractQuestions: boolean; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; onGapFillSave: (part: ExamPart, blankNumber: number, answer: string) => void; onMatchingSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void }) {
  return <><ListeningAudio source={part.audioUrl} locked={locked} />{gapFill ? <GapFillListeningText part={part} responses={gapFillResponses} locked={locked} savingKey={savingKey} onSave={onGapFillSave} /> : matching ? <SpeakerMatchingListening part={part} config={matchingConfig} responses={matchingResponses} locked={locked} savingKey={savingKey} mapMode={mapMatching} onSave={onMatchingSave} /> : <>{part.content && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.content}</p>}{audioOnly && <p className="mt-5 rounded-xl bg-cyan-50 px-4 py-3 text-sm leading-relaxed text-cyan-900">1–8-savollar audio yozuvda beriladi. To‘g‘ri deb bilgan 3 variantdan birini tanlang.</p>}{extractQuestions && <div className="mt-5 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 text-sm leading-relaxed text-fuchsia-900"><p className="font-bold">3 ta extract · 24–29-savollar</p><p className="mt-1 text-xs">Har extractni tinglab, uning ostidagi 2 ta savolga javob bering.</p></div>}<ObjectiveQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} audioOnly={audioOnly} groupByExtract={extractQuestions} onAnswer={onAnswer} onTextSave={onTextSave} /></>}</>;
}

function ListeningAudio({ source, locked }: { source: string | null; locked: boolean }) {
  const player = useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setStarted(false); setFinished(false); setError(null); }, [source]);
  const start = async () => {
    if (!player.current || started || locked) return;
    setStarted(true);
    try { await player.current.play(); } catch { setStarted(false); setError('Audio ishga tushmadi. Brauzeringizda ovozga ruxsat berilganini tekshiring.'); }
  };
  return <div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Listening audio</p>{source ? <><audio ref={player} src={source} preload="auto" onEnded={() => setFinished(true)}>Brauzeringiz audio tinglashni qo‘llamaydi.</audio><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-200">Audio faqat bir marta eshittiriladi.</p><button type="button" disabled={locked || started} onClick={() => void start()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300">{finished ? 'Audio tugadi' : started ? 'Audio ijro etilmoqda…' : 'Audioni boshlash'}</button></div>{error && <p className="mt-3 text-xs font-semibold text-error-200">{error}</p>}</> : <p className="mt-3 text-sm text-error-200">Audio mavjud emas.</p>}</div>;
}

function GapFillListeningText({ part, responses, locked, savingKey, onSave }: { part: ExamPart; responses: Record<string, GapFillResponse>; locked: boolean; savingKey: string | null; onSave: (part: ExamPart, blankNumber: number, answer: string) => void }) {
  const [drafts, setDrafts] = useState<Record<number, string>>(() => Object.fromEntries(gapFillBlankNumbers(part.content).map((blankNumber) => [blankNumber, responses[gapFillResponseKey(part.id, blankNumber)]?.answer ?? ''])));
  const blankNumbers = gapFillBlankNumbers(part.content);

  useEffect(() => {
    setDrafts(Object.fromEntries(blankNumbers.map((blankNumber) => [blankNumber, responses[gapFillResponseKey(part.id, blankNumber)]?.answer ?? ''])));
  }, [part.id, part.content, responses]);

  const chunks = part.content.split(/(\{\{[1-9]\d*\}\})/g);
  return <div className="mt-6"><div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Bo‘sh joylarni to‘ldiring</p><p className="mt-1 text-xs">Har javob bitta so‘z yoki son bo‘lishi kerak. Maydonni tark etganingizda javob avtomatik saqlanadi.</p></div><article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] leading-8 text-slate-800 shadow-sm sm:p-7">{chunks.map((chunk, index) => {
    const match = chunk.match(/^\{\{([1-9]\d*)\}\}$/);
    if (!match) return <span key={`${index}-${chunk}`} className="whitespace-pre-wrap">{chunk}</span>;
    const blankNumber = Number(match[1]);
    const saving = savingKey === `gap-fill:${gapFillResponseKey(part.id, blankNumber)}`;
    return <span key={chunk} className="mx-1 inline-flex align-middle"><label className="sr-only" htmlFor={`gap-fill-${part.id}-${blankNumber}`}>({blankNumber}) javob</label><span className="flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 shadow-sm"><span className="mr-1 text-xs font-extrabold text-indigo-600">{blankNumber}</span><input id={`gap-fill-${part.id}-${blankNumber}`} value={drafts[blankNumber] ?? ''} disabled={locked || saving} onChange={(event) => setDrafts((current) => ({ ...current, [blankNumber]: event.target.value }))} onBlur={() => onSave(part, blankNumber, drafts[blankNumber] ?? '')} className="w-28 border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-indigo-300 focus:ring-0 disabled:opacity-60 sm:w-36" placeholder="javob" />{saving && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-indigo-600" />}</span></span>;
  })}</article><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{blankNumbers.map((blankNumber) => <div key={blankNumber} className={`rounded-xl px-3 py-2 text-xs font-semibold ${responses[gapFillResponseKey(part.id, blankNumber)]?.answer ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>({blankNumber}) {responses[gapFillResponseKey(part.id, blankNumber)]?.answer ? 'saqlandi' : 'kutilmoqda'}</div>)}</div></div>;
}

function SpeakerMatchingListening({ part, config, responses, locked, savingKey, mapMode, readingMode = null, onSave }: { part: ExamPart; config: MatchingWorkspaceConfig | undefined; responses: Record<string, MatchingResponse>; locked: boolean; savingKey: string | null; mapMode: boolean; readingMode?: 'headings' | 'situations' | null; onSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void }) {
  const [activeSpeaker, setActiveSpeaker] = useState<number | null>(config?.speakers.find((speaker) => !responses[matchingResponseKey(part.id, speaker.speakerNumber)])?.speakerNumber ?? config?.speakers[0]?.speakerNumber ?? null);
  useEffect(() => {
    setActiveSpeaker((current) => current && config?.speakers.some((speaker) => speaker.speakerNumber === current) ? current : (config?.speakers.find((speaker) => !responses[matchingResponseKey(part.id, speaker.speakerNumber)])?.speakerNumber ?? config?.speakers[0]?.speakerNumber ?? null));
  }, [config, part.id, responses]);
  if (!config || config.speakers.length === 0 || config.options.length < 2) return <div className="mt-5 rounded-2xl border border-sun-200 bg-sun-50 p-4 text-sm leading-relaxed text-sun-800">{mapMode ? 'Map letter matching' : 'Speaker matching'} hali sozlanmagan.</div>;
  const selected = activeSpeaker ? responses[matchingResponseKey(part.id, activeSpeaker)]?.optionPosition : undefined;
  const accent = mapMode ? 'sky' : 'emerald';
  const entryLabel = mapMode ? 'joy' : readingMode === 'headings' ? 'paragraf' : readingMode === 'situations' ? 'statement' : 'speaker';
  const entryHeading = mapMode ? 'Joylar' : readingMode === 'headings' ? 'Paragraflar' : readingMode === 'situations' ? 'Statementlar' : 'Speakerlar';
  const helperTitle = mapMode
    ? 'Har bir joy uchun xaritadagi harfni tanlang'
    : readingMode === 'headings'
      ? 'Har bir paragraf uchun mos headingni tanlang'
      : readingMode === 'situations'
        ? 'Har bir statement uchun mos situationni tanlang'
        : 'Har bir speaker uchun mos javobni tanlang';

  return (
    <div className="mt-6">
      <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${mapMode ? 'border-sky-100 bg-sky-50/70 text-sky-900' : 'border-emerald-100 bg-emerald-50/70 text-emerald-900'}`}>
        <p className="font-bold">{helperTitle}</p>
        <p className="mt-1 text-xs">Avval {entryLabel} kartasini tanlang, keyin o‘ng tomondagi umumiy javob bankidan A/B/C… variantni bosing. Ayrim variantlar ishlatilmasligi mumkin.</p>
      </div>
      {mapMode && <div className="mt-5 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-2 sm:p-3">{part.imageUrl ? <><img src={part.imageUrl} alt={`${part.title} xaritasi`} className="h-auto w-full object-contain" /><div className="mt-2 flex justify-end"><a href={part.imageUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50">Xaritani original o‘lchamda ochish</a></div></> : <p className="p-5 text-sm text-sun-800">Xarita rasmi mavjud emas.</p>}</div>}
      {part.content && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.content}</p>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{entryHeading}</p>
          {config.speakers.map((speaker) => {
            const response = responses[matchingResponseKey(part.id, speaker.speakerNumber)];
            const isActive = activeSpeaker === speaker.speakerNumber;
            return <button key={speaker.speakerNumber} type="button" disabled={locked} onClick={() => setActiveSpeaker(speaker.speakerNumber)} className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed ${isActive ? mapMode ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : response ? 'border-success-200 bg-success-50/70 hover:border-success-300' : mapMode ? 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${isActive ? mapMode ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{speaker.speakerNumber}</span><span className="truncate text-sm font-bold text-slate-800">{speaker.label || (speaker.imageUrl ? 'Rasmli statement' : 'Statement')}</span></span><span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${response ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-400'}`}>{response ? String.fromCharCode(65 + response.optionPosition) : '—'}</span></div>{speaker.imageUrl && <img src={speaker.imageUrl} alt={`${speaker.speakerNumber}-statement rasmi`} className="mt-3 max-h-64 w-full rounded-xl border border-slate-200 bg-white object-contain" />}</button>;
          })}
        </div>
        <div>
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{mapMode ? 'Xarita harflari' : 'Javob banki'}</p>{activeSpeaker && <p className={`text-xs font-semibold ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>{entryLabel[0].toUpperCase() + entryLabel.slice(1)} {activeSpeaker} tanlangan</p>}</div>
          <div className="mt-3 space-y-2">
            {config.options.map((option) => {
              const chosen = selected === option.position;
              const saving = activeSpeaker !== null && savingKey === `matching:${matchingResponseKey(part.id, activeSpeaker)}`;
              const optionTitle = mapMode ? `Xaritadagi ${String.fromCharCode(65 + option.position)} nuqta` : option.label;
              return <button key={option.position} type="button" disabled={locked || activeSpeaker === null || saving} onClick={() => activeSpeaker !== null && onSave(part, activeSpeaker, option.position)} className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${chosen ? mapMode ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200' : mapMode ? 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/30' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'}`}><div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${chosen ? mapMode ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{String.fromCharCode(65 + option.position)}</span><span className="flex-1 text-sm font-medium leading-relaxed text-slate-700">{optionTitle}</span>{saving && chosen && <Loader2 className={`h-4 w-4 animate-spin ${accent === 'sky' ? 'text-sky-600' : 'text-emerald-600'}`} />}</div></button>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingPart({ part, questions, answers, textAnswers, gapFillResponses, matchingConfig, matchingResponses, cefrExam, locked, savingKey, onAnswer, onTextSave, onGapFillSave, onMatchingSave }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; gapFillResponses: Record<string, GapFillResponse>; matchingConfig: MatchingWorkspaceConfig | undefined; matchingResponses: Record<string, MatchingResponse>; cefrExam: boolean; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; onGapFillSave: (part: ExamPart, blankNumber: number, answer: string) => void; onMatchingSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void }) {
  const gapFill = cefrExam && part.position === 1;
  const matching = cefrExam && (part.position === 2 || part.position === 3);
  const miniTextCompletion = cefrExam && part.position === 5;
  const matchingMode = part.position === 2 ? 'situations' as const : 'headings' as const;
  const objectiveQuestions = <ObjectiveQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition={cefrExam} />;
  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Reading passage</p><div className="whitespace-pre-wrap">{part.content}</div></article>{gapFill ? <GapFillListeningText part={part} responses={gapFillResponses} locked={locked} savingKey={savingKey} onSave={onGapFillSave} /> : matching ? <><div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">{matchingMode === 'headings' ? 'Matching headings' : 'Statement → Situation matching'}</p><p className="mt-1 text-xs">{matchingMode === 'headings' ? '15–20-paragraf uchun mos headingni tanlang. 8 headingdan 2 tasi ortiqcha bo‘ladi.' : '7–14 — statementlar. O‘ngdagi A/B/C… javob banki — situationlar; har statement uchun mos situationni tanlang.'}</p></div><SpeakerMatchingListening part={part} config={matchingConfig} responses={matchingResponses} locked={locked} savingKey={savingKey} mapMode={false} readingMode={matchingMode} onSave={onMatchingSave} /></> : miniTextCompletion ? <CefrReadingPartFiveMiniTexts questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} /> : objectiveQuestions}</>;
}

function WritingPart({ part, draft, response, locked, saving, ieltsTask, onChange, onSave, onSubmit }: { part: ExamPart; draft: string; response: WritingResponse | undefined; locked: boolean; saving: boolean; ieltsTask: 1 | 2 | null; onChange: (value: string) => void; onSave: () => void; onSubmit: () => void }) {
  const submitted = Boolean(response?.submittedAt);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const minimumWords = ieltsTask === 1 ? 150 : ieltsTask === 2 ? 250 : 1;
  const enoughWords = wordCount >= minimumWords;
  const taskLabel = ieltsTask ? `IELTS Writing Task ${ieltsTask}` : 'Writing topic';
  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{taskLabel}{ieltsTask === 2 ? ' · weight ×2' : ''}</p>{ieltsTask && <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-900">{ieltsTask === 1 ? 'Task 1: kamida 150 so‘z yozing. Grafik, jadval, chart yoki diagramdagi asosiy xususiyatlarni tasvirlang.' : 'Task 2: kamida 250 so‘z yozing. Pozitsiya, argument yoki muammoni to‘liq muhokama qiling; bu task Writing bahosida ikki baravar og‘irlikka ega.'}</div>}{part.imageUrl && <img src={part.imageUrl} alt={`${taskLabel} visual`} className="mb-5 h-auto w-full rounded-xl border border-slate-200 bg-white object-contain" />}<div className="whitespace-pre-wrap">{part.content}</div></article><div className="mt-6"><div className="mb-2 flex items-center justify-between"><label htmlFor={`writing-${part.id}`} className="text-sm font-bold text-slate-800">Javobingiz</label><span className={`text-xs font-semibold ${enoughWords ? 'text-success-700' : 'text-sun-700'}`}>{wordCount} / {minimumWords} so‘z</span></div><textarea id={`writing-${part.id}`} value={draft} disabled={locked || submitted} onChange={(event) => onChange(event.target.value)} className="input min-h-72 resize-y leading-relaxed disabled:bg-slate-50" placeholder="Javobingizni shu yerga yozing…" />{!submitted && ieltsTask && !enoughWords && <p className="mt-2 text-xs font-semibold text-sun-700">Yuborishdan oldin kamida {minimumWords} so‘z yozing.</p>}{submitted ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-4 text-sm text-success-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Writing yuborilgan</p><p className="mt-1">Bu javob organizer tekshirganidan keyin yakuniy natijaga qo‘shiladi.</p></div></div> : <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={locked || saving || !draft.trim()} onClick={onSave} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Draftni saqlash</button><button type="button" disabled={locked || saving || !draft.trim() || !enoughWords} onClick={onSubmit} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Writingni yuborish</button></div>}</div></>;
}
