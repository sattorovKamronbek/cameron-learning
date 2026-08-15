import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Highlighter,
  ListChecks,
  Loader2,
  Maximize2,
  Mic2,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Save,
  Send,
  ShieldAlert,
  StickyNote,
  X,
} from 'lucide-react';
import { Link } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import {
  completeEnglishExam,
  completeExamSection,
  clearContestAnswer,
  clearContestPreviewAnswer,
  endContestAttempt,
  fetchContestPreviewWorkspace,
  fetchContestWorkspace,
  fetchReadingAnnotations,
  formatContestDuration,
  saveCefrPreviewGapFillResponse,
  saveCefrPreviewMatchingResponse,
  saveCefrGapFillResponse,
  saveCefrMatchingResponse,
  saveContestPreviewWritingResponse,
  saveExamWritingResponse,
  saveReadingAnnotation,
  submitContestPreviewAnswer,
  submitContestPreviewTextAnswer,
  submitContestAnswer,
  submitContestTextAnswer,
  fetchContestEditor,
  type ExamPart,
  type ExamSection,
  type ExamSectionTimings,
  type ActiveExamTiming,
  type ContestWorkspace,
  type GapFillResponse,
  type MatchingResponse,
  type MatchingWorkspaceConfig,
  type ReadingAnnotation,
  type ReadingHighlight,
  type WritingResponse,
} from '@/lib/contests';
import { requestContestFullscreen } from '@/lib/contest-integrity';

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

const IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] as const;
// Reading restarts at 1 independently from Listening. Each question is
// attached to a part, so matching 1–40 sequences cannot collide.
const IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS = [8, 9, 10, 11, 12, 13] as const;
const IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS = [14, 15, 16, 17, 18, 19, 20] as const;
const IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS = [21, 22, 23, 24] as const;
const IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS = [25, 26] as const;
const IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX = 'IELTS_READING_PASSAGE_TWO_STRUCTURED\n';
const IELTS_READING_PASSAGE_THREE_TFNG_POSITIONS = [27, 28, 29, 30, 31] as const;
const IELTS_READING_PASSAGE_THREE_SUMMARY_POSITIONS = [32, 33, 34] as const;
const IELTS_READING_PASSAGE_THREE_A_TO_F_POSITIONS = [35, 36, 37] as const;
const IELTS_READING_PASSAGE_THREE_PARAGRAPH_POSITIONS = [38, 39, 40] as const;
const IELTS_READING_PASSAGE_THREE_STRUCTURED_PREFIX = 'IELTS_READING_PASSAGE_THREE_STRUCTURED\n';
const IELTS_ROMAN_HEADINGS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'] as const;
const IELTS_READING_PASSAGE_THREE_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const IELTS_READING_PASSAGE_THREE_PARAGRAPH_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS = [13, 14] as const;
const IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS = [15, 16, 17, 18] as const;
const IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS = [19, 20] as const;
const IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT = 'IELTS_LISTENING_PART_TWO_STRUCTURED';
const IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS = [21, 22] as const;
const IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS = [23, 24] as const;
const IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS = [25, 26, 27, 28, 29, 30] as const;
const IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT = 'IELTS_LISTENING_PART_THREE_STRUCTURED';

function hasIeltsListeningPartOneGapFillMarkers(content: string): boolean {
  const markers = gapFillBlankNumbers(content);
  const markerCount = Array.from(content.matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return markerCount === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.length
    && markers.length === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.length
    && markers.every((marker, index) => marker === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS[index]);
}

function hasIeltsListeningPartFourGapFillMarkers(content: string): boolean {
  const markers = gapFillBlankNumbers(content);
  const markerCount = Array.from(content.matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return markerCount === IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.length
    && markers.length === IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.length
    && markers.every((marker, index) => marker === IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[index]);
}

function hasIeltsReadingPassageOneSharedTextMarkers(content: string): boolean {
  const markers = gapFillBlankNumbers(content);
  const markerCount = Array.from(content.matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return markerCount === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.length
    && markers.length === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.length
    && markers.every((marker, index) => marker === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[index]);
}

function isIeltsReadingPassageTwoStructured(content: string): boolean {
  return content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX);
}

function isIeltsReadingPassageThreeStructured(content: string): boolean {
  return content.startsWith(IELTS_READING_PASSAGE_THREE_STRUCTURED_PREFIX);
}

function ieltsReadingPassageContent(content: string): string {
  if (isIeltsReadingPassageTwoStructured(content)) return content.slice(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX.length);
  if (isIeltsReadingPassageThreeStructured(content)) return content.slice(IELTS_READING_PASSAGE_THREE_STRUCTURED_PREFIX.length);
  return content;
}

const IELTS_READING_PASSAGE_ONE_SPLIT_PREFIX = 'IELTS_READING_PASSAGE_ONE_SPLIT\n';
const IELTS_READING_PASSAGE_ONE_QUESTIONS_SEPARATOR = '\n---IELTS_READING_PASSAGE_ONE_QUESTIONS---\n';

function splitIeltsReadingPassageOneContent(content: string): { passage: string; questionText: string; legacyQuestionTextOnly: boolean } {
  if (content.startsWith(IELTS_READING_PASSAGE_ONE_SPLIT_PREFIX)) {
    const body = content.slice(IELTS_READING_PASSAGE_ONE_SPLIT_PREFIX.length);
    const separatorIndex = body.indexOf(IELTS_READING_PASSAGE_ONE_QUESTIONS_SEPARATOR);
    if (separatorIndex >= 0) {
      return {
        passage: body.slice(0, separatorIndex),
        questionText: body.slice(separatorIndex + IELTS_READING_PASSAGE_ONE_QUESTIONS_SEPARATOR.length),
        legacyQuestionTextOnly: false,
      };
    }
  }
  if (hasIeltsReadingPassageOneSharedTextMarkers(content)) {
    return { passage: '', questionText: content, legacyQuestionTextOnly: true };
  }
  return { passage: content, questionText: '', legacyQuestionTextOnly: false };
}

function matchingResponseKey(partId: string, speakerNumber: number): string {
  return `${partId}:${speakerNumber}`;
}

const PREVIEW_SESSION_KEY_PREFIX = 'exam-preview-session:';
const PREVIEW_SECTION_COMPLETIONS_KEY_PREFIX = 'exam-preview-section-completions:';

type PreviewSectionCompletions = Partial<Record<ExamSection, number>>;

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

function previewSectionCompletions(contestId: string): PreviewSectionCompletions {
  try {
    const raw = window.sessionStorage.getItem(`${PREVIEW_SECTION_COMPLETIONS_KEY_PREFIX}${contestId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      (['listening', 'reading', 'writing'] as const)
        .filter((section) => typeof parsed[section] === 'number' && Number.isFinite(parsed[section]))
        .map((section) => [section, parsed[section] as number]),
    ) as PreviewSectionCompletions;
  } catch {
    return {};
  }
}

function previewExamTiming(timings: ExamSectionTimings, startedAt: number, now: number, completions: PreviewSectionCompletions = {}): ActiveExamTiming {
  const listeningStartsAt = startedAt;
  const listeningEndsAt = completions.listening ?? listeningStartsAt + timings.listeningMinutes * 60_000;
  const readingStartsAt = listeningEndsAt;
  const readingEndsAt = completions.reading ?? readingStartsAt + timings.readingMinutes * 60_000;
  const writingStartsAt = readingEndsAt;
  const activeSection: ExamSection = now < readingStartsAt ? 'listening' : now < writingStartsAt ? 'reading' : 'writing';
  const sectionStartsAt = activeSection === 'listening' ? listeningStartsAt : activeSection === 'reading' ? readingStartsAt : writingStartsAt;
  const sectionEndsAt = activeSection === 'listening'
    ? listeningEndsAt
    : activeSection === 'reading'
      ? readingEndsAt
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
  const [attemptEnded, setAttemptEnded] = useState(false);

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
      setAttemptEnded(Boolean(next.contest.completedAt));
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
  const hasEnded = !preview && Boolean(workspace) && (remaining <= 0 || attemptEnded);
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
    if (!preview && /contest has finished/i.test(error ?? '')) {
      return <ContestFinishedScreen contestTitle={slug} />;
    }
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
    const contestHasNotStarted = Boolean(workspace) && new Date(workspace.contest.startTime).getTime() > now;
    const contestHasNoQuestions = Boolean(workspace) && workspace.questions.length === 0;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="card max-w-lg p-8 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">{contestHasNotStarted ? 'Contest hali boshlanmagan' : 'Savollar mavjud emas'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {contestHasNotStarted
              ? 'Bu contestning boshlanish vaqti kelmagan. Savollar vaqt kelganda paydo bo‘ladi.'
              : contestHasNoQuestions
                ? 'Bu contest uchun savollar saqlanmagan yoki ma’lumotlar to‘liq kelmagan. Adminga murojaat qiling.'
                : 'Bu contest uchun savollar e’lon qilinmagan.'}
          </p>
          <Link to={preview ? '/contest-management' : `/contests/${slug}`} className="btn-primary mt-6">{preview ? 'Contest boshqaruviga qaytish' : 'Contest sahifasiga qaytish'}</Link>
        </div>
      </div>
    );
  }

  const progress = workspace.questions.length ? Math.round((answeredCount / workspace.questions.length) * 100) : 0;
  const urgent = remaining > 0 && remaining < 30 * 60 * 1000;

  return (
    <div className="workspace-viewport flex flex-col overflow-hidden bg-slate-100">
      <ContestIntegrityGuard
        active={!preview && !hasEnded}
        contestId={workspace.contest.id}
        onAttemptEnded={() => setAttemptEnded(true)}
      />
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
          {preview ? 'Sinov rejimi' : hasEnded ? (attemptEnded ? 'Contest yakunlandi' : 'Vaqt tugadi') : formatRemaining(remaining)}
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
            {hasEnded && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-800"><Clock className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">{attemptEnded ? 'Contest yakunlandi' : 'Contest vaqti tugadi'}</p><p className="mt-1">Yangi javob qabul qilinmaydi. Saqlangan javoblar organizer tomonidan yakunlangach hisoblanadi.</p></div></div>}
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
  const [readingAnnotations, setReadingAnnotations] = useState<Record<string, ReadingAnnotation>>({});
  const [readingAnnotationsLoading, setReadingAnnotationsLoading] = useState(false);
  const [savingReadingAnnotationPartId, setSavingReadingAnnotationPartId] = useState<string | null>(null);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewCompletions, setPreviewCompletions] = useState<PreviewSectionCompletions>(() => preview ? previewSectionCompletions(workspace.contest.id) : {});
  const [completed, setCompleted] = useState(() => Boolean(workspace.contest.completedAt) || Boolean(preview && previewCompletions.writing));
  const [completing, setCompleting] = useState(false);

  const sectionTiming = preview
    ? previewTiming && previewStartedAt ? previewExamTiming(previewTiming, previewStartedAt, now, previewCompletions) : null
    : workspace.examTiming;
  const activeSection = sectionTiming?.activeSection;
  const visibleParts = useMemo(
    () => activeSection ? workspace.parts.filter((item) => item.section === activeSection) : workspace.parts,
    [activeSection, workspace.parts],
  );
  const visiblePartSignature = visibleParts.map((item) => item.id).join(':');
  useEffect(() => {
    if (!preview) return;
    try {
      window.sessionStorage.setItem(
        `${PREVIEW_SECTION_COMPLETIONS_KEY_PREFIX}${workspace.contest.id}`,
        JSON.stringify(previewCompletions),
      );
    } catch {
      // A preview remains functional when session storage is unavailable.
    }
  }, [preview, previewCompletions, workspace.contest.id]);
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
  const sharedIeltsListeningAudio = useMemo(() => {
    if (workspace.contest.subjectSlug !== 'ielts') return null;
    return workspace.parts
      .filter((item) => item.section === 'listening')
      .sort((left, right) => left.position - right.position)
      .find((item) => Boolean(item.audioUrl?.trim()))?.audioUrl ?? null;
  }, [workspace.contest.subjectSlug, workspace.parts]);
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
  const isListeningSection = sectionTiming?.activeSection === 'listening' || part?.section === 'listening';
  const isReadingSection = sectionTiming?.activeSection === 'reading' || part?.section === 'reading';

  useEffect(() => {
    if (preview || !sectionTiming || !sectionEnded || contestEnded || completed) return;
    const timeout = window.setTimeout(() => { void onRefresh(); }, 800);
    return () => window.clearTimeout(timeout);
  }, [completed, contestEnded, onRefresh, preview, sectionEnded, sectionTiming]);

  useEffect(() => {
    if (!isReadingSection || sectionEnded || contestEnded || completed) return;
    let cancelled = false;
    setReadingAnnotationsLoading(true);
    void fetchReadingAnnotations(workspace.contest.id)
      .then((next) => {
        if (!cancelled) setReadingAnnotations(next);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Reading eslatmalari yuklanmadi.');
      })
      .finally(() => {
        if (!cancelled) setReadingAnnotationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [completed, contestEnded, isReadingSection, sectionEnded, workspace.contest.id]);

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

  const clearAnswer = async (questionId: string) => {
    if (locked || savingKey) return;
    const previous = answers[questionId];
    if (previous === undefined) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setSavingKey(`answer:${questionId}`);
    setError(null);
    try {
      await (preview ? clearContestPreviewAnswer(questionId) : clearContestAnswer(questionId));
    } catch (reason) {
      setAnswers((current) => ({ ...current, [questionId]: previous }));
      setError(reason instanceof Error ? reason.message : 'Javob o‘chirilmadi. Qayta urinib ko‘ring.');
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

  const persistReadingAnnotation = async (examPart: ExamPart, note: string, highlights: ReadingHighlight[]) => {
    if (locked || savingReadingAnnotationPartId) return;
    const previous = readingAnnotations[examPart.id];
    const next: ReadingAnnotation = {
      partId: examPart.id,
      note,
      highlights,
      updatedAt: new Date().toISOString(),
    };
    setReadingAnnotations((current) => ({ ...current, [examPart.id]: next }));
    setSavingReadingAnnotationPartId(examPart.id);
    setError(null);
    try {
      const saved = await saveReadingAnnotation(examPart.id, note, highlights);
      setReadingAnnotations((current) => {
        const updated = { ...current };
        if (!saved.note && saved.highlights.length === 0) delete updated[examPart.id];
        else updated[examPart.id] = saved.partId ? saved : next;
        return updated;
      });
    } catch (reason) {
      setReadingAnnotations((current) => {
        const restored = { ...current };
        if (previous) restored[examPart.id] = previous;
        else delete restored[examPart.id];
        return restored;
      });
      setError(reason instanceof Error ? reason.message : 'Reading eslatmasi saqlanmadi.');
    } finally {
      setSavingReadingAnnotationPartId(null);
    }
  };

  const completeWriting = async () => {
    if (locked || completing) return;
    if (!isWritingSection || !allComplete) {
      setError('Writing bo‘limidagi barcha javoblarni yuboring. Oldingi bo‘limlardagi javoblar ham serverda saqlangan bo‘lishi kerak.');
      return;
    }
    if (!window.confirm('Imtihonni yakunlab yuborasizmi? Keyin javoblarni o‘zgartirib bo‘lmaydi.')) return;
    setCompleting(true);
    setError(null);
    try {
      if (preview) {
        setPreviewCompletions((current) => ({ ...current, writing: Date.now() }));
      } else {
        await completeEnglishExam(workspace.contest.id);
      }
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Imtihonni yakunlab bo‘lmadi.');
    } finally {
      setCompleting(false);
    }
  };

  const completeSection = async (section: 'listening' | 'reading') => {
    if (locked || completing || (section === 'listening' ? !isListeningSection : !isReadingSection)) return;
    const nextSection = section === 'listening' ? 'Reading' : 'Writing';
    if (!window.confirm(`${section === 'listening' ? 'Listening' : 'Reading'} bo‘limini hozir yakunlaysizmi? ${nextSection} ochiladi va bu bo‘limga qaytib bo‘lmaydi.`)) return;
    setCompleting(true);
    setError(null);
    try {
      if (preview) {
        setPreviewCompletions((current) => ({ ...current, [section]: Date.now() }));
      } else {
        await completeExamSection(workspace.contest.id, section);
        await onRefresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${section === 'listening' ? 'Listening' : 'Reading'} bo‘limini yakunlab bo‘lmadi.`);
    } finally {
      setCompleting(false);
    }
  };

  if (completed || contestEnded) {
    return <EnglishExamFinishedScreen
      preview={preview}
      contestTitle={workspace.contest.title}
      completed={completed}
    />;
  }

  if (!part) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="card max-w-lg p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-error-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Exam partlari topilmadi</h1><Link to={preview ? '/contest-management' : `/contests/${workspace.contest.slug}`} className="btn-primary mt-6">{preview ? 'Contest boshqaruviga qaytish' : 'Contest sahifasiga qaytish'}</Link></div></div>;
  }

  return (
    <div className="workspace-viewport flex flex-col overflow-hidden bg-slate-100">
      <ContestIntegrityGuard
        active={!preview && !contestEnded && !completed}
        contestId={workspace.contest.id}
        onAttemptEnded={() => setCompleted(true)}
      />
      <header className="relative z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-3"><Link to={preview ? '/contest-management' : `/contests/${workspace.contest.slug}`} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Chiqish</span></Link><div className="hidden h-5 w-px bg-slate-700 sm:block" /><div className="min-w-0"><p className="truncate text-sm font-bold">{workspace.contest.title}</p><p className="truncate text-[10px] text-slate-400">{workspace.contest.subject} · {visibleParts.length} ta part</p></div></div>
        <div className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${preview ? 'bg-sun-400/20 text-sun-100' : urgent || sectionEnded ? 'bg-error-500/20 text-error-200' : 'bg-slate-800 text-slate-200'}`}>{preview ? <ClipboardList className="h-4 w-4" /> : <Clock className="h-4 w-4" />}{preview ? <>Sinov · {sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} · ` : ''}{sectionEnded ? 'Vaqt tugadi' : formatRemaining(sectionRemaining)}</> : <>{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} · ` : ''}{sectionEnded ? 'Vaqt tugadi' : formatRemaining(sectionRemaining)}</>}</div>
        <button type="button" onClick={() => setShowNavigator((current) => !current)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">{showNavigator ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}<span className="hidden lg:inline">Partlar</span></button>
      </header>

      <div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-y-auto bg-white"><div className={`mx-auto w-full p-5 sm:p-8 ${isReadingSection ? 'max-w-[1600px]' : 'max-w-4xl'}`}><div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{preview ? 'Sinov rejimi' : 'Hozirgi bo‘lim'}</p><p className="mt-1 text-sm font-bold text-slate-900">{sectionTiming ? `${examSectionLabel(sectionTiming.activeSection)} uchun ${sectionMinutes(sectionTiming)} minut` : `${examSectionLabel(part.section)} bo‘limi`}</p></div><p className="text-xs leading-relaxed text-slate-600">{preview ? 'Listening tugagach Reading, Reading tugagach Writing avtomatik ochiladi. Writing vaqti yakunlanganda sinov ham yakunlanadi.' : isListeningSection ? 'Listeningni vaqt tugashini kutmasdan yakunlashingiz mumkin. Yakunlangandan keyin Reading ochiladi va Listening qayta ochilmaydi.' : isReadingSection ? 'Reading vaqti tugashi bilan Writing avtomatik ochiladi. Oldingi bo‘limga qaytib bo‘lmaydi.' : 'Writing vaqti tugashi bilan imtihon yopiladi. Saqlangan javoblarni faqat organizer tekshiradi.'}</p></div></div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">{part.position}</span><div><p className="text-sm font-bold text-slate-900">{examSectionLabel(part.section)} · Part {ieltsPartNumber(workspace.contest.subjectSlug, part)} / {visibleParts.length}</p><p className="text-xs text-slate-400">{answeredCount} ta test javobi · {submittedWritingCount} ta writing yuborilgan</p></div></div><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>{progress}%</div></div>

        {preview && <ExamNotice kind="success" title="Sinov rejimi faol">Bu test faqat sizning akkauntingizda saqlanadi. Contest e’lon qilinmaydi va ratingga kirmaydi.</ExamNotice>}
        {contestEnded && <ExamNotice kind="error" title="Imtihon vaqti tugadi">Yangi javob qabul qilinmaydi. Saqlangan javoblar organizer tomonidan yakunlanadi.</ExamNotice>}
        {sectionEnded && !contestEnded && <ExamNotice kind="success" title={`${examSectionLabel(part.section)} vaqti tugadi`}>Keyingi bo‘lim ochilmoqda. Bu bo‘limga endi qaytib bo‘lmaydi.</ExamNotice>}
        {completed && <ExamNotice kind="success" title="Contest yakunlandi">Javoblar endi o‘zgarmaydi. Writing javoblari tekshirilgach, organizer natija va reytingni e’lon qiladi.</ExamNotice>}
        {error && <ExamNotice kind="error" title="Amal bajarilmadi">{error}</ExamNotice>}

        <section className="card overflow-hidden"><div className="border-b border-slate-100 p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">{part.section === 'listening' ? <Mic2 className="h-5 w-5" /> : part.section === 'reading' ? <BookOpen className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}</span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{examSectionLabel(part.section)}</p><h1 className="mt-1 text-xl font-bold text-slate-900">{part.title}</h1>{part.instructions && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.instructions}</p>}</div></div></div>
          <div className="p-6 sm:p-8">{part.section === 'listening' ? <ListeningPart part={part} audioSource={workspace.contest.subjectSlug === 'ielts' ? sharedIeltsListeningAudio : part.audioUrl} questions={partQuestions} answers={answers} textAnswers={textAnswers} gapFillResponses={gapFillResponses} matchingConfig={workspace.matchingConfigs[part.id]} matchingResponses={matchingResponses} locked={locked} savingKey={savingKey} audioOnly={workspace.contest.subjectSlug === 'cefr' && part.position === 1} gapFill={workspace.contest.subjectSlug === 'cefr' && (part.position === 2 || part.position === 6)} matching={workspace.contest.subjectSlug === 'cefr' && (part.position === 3 || part.position === 4)} mapMatching={workspace.contest.subjectSlug === 'cefr' && part.position === 4} extractQuestions={workspace.contest.subjectSlug === 'cefr' && part.position === 5} ieltsExam={workspace.contest.subjectSlug === 'ielts'} ieltsSharedGapFill={workspace.contest.subjectSlug === 'ielts' && part.position === 1} ieltsSharedGapFillPartFour={workspace.contest.subjectSlug === 'ielts' && part.position === 4} ieltsStructuredPartTwo={workspace.contest.subjectSlug === 'ielts' && part.position === 2} ieltsStructuredPartThree={workspace.contest.subjectSlug === 'ielts' && part.position === 3} showAudio onAnswer={saveAnswer} onClearAnswer={clearAnswer} onTextSave={saveTextAnswer} onGapFillSave={saveGapFill} onMatchingSave={saveMatching} /> : part.section === 'reading' ? <ReadingPart part={part} questions={partQuestions} answers={answers} textAnswers={textAnswers} gapFillResponses={gapFillResponses} matchingConfig={workspace.matchingConfigs[part.id]} matchingResponses={matchingResponses} annotation={readingAnnotations[part.id]} annotationsLoading={readingAnnotationsLoading} annotationSaving={savingReadingAnnotationPartId === part.id} cefrExam={workspace.contest.subjectSlug === 'cefr'} locked={locked} savingKey={savingKey} onAnswer={saveAnswer} onClearAnswer={clearAnswer} onTextSave={saveTextAnswer} onGapFillSave={saveGapFill} onMatchingSave={saveMatching} onSaveAnnotation={persistReadingAnnotation} /> : <WritingPart part={part} draft={drafts[part.id] ?? ''} response={writingResponses[part.id]} locked={locked} saving={savingKey === `writing:${part.id}`} ieltsTask={workspace.contest.subjectSlug === 'ielts' ? (part.position === 8 ? 1 : 2) : null} onChange={(value) => setDrafts((current) => ({ ...current, [part.id]: value }))} onSave={() => void saveWriting(part, false)} onSubmit={() => void saveWriting(part, true)} />}</div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={currentPartIndex === 0 || sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.max(0, index - 1))} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Oldingi part</button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {(isListeningSection || isReadingSection) && <button type="button" disabled={locked || !allComplete || Boolean(savingKey) || completing} onClick={() => void completeSection(isListeningSection ? 'listening' : 'reading')} className="btn-ghost border border-indigo-200 px-5 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isListeningSection ? 'Listeningni yakunlash' : 'Readingni yakunlash'}</button>}
            {currentPartIndex < visibleParts.length - 1
              ? <button type="button" disabled={sectionEnded} onClick={() => setCurrentPartIndex((index) => Math.min(visibleParts.length - 1, index + 1))} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">Keyingi part<ChevronRight className="h-4 w-4" /></button>
              : isWritingSection
                ? <button type="button" disabled={locked || !allComplete || completing} onClick={() => void completeWriting()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{preview ? 'Writingni yakunlash' : completed ? 'Yuborilgan' : 'Writingni yakunlash'}</button>
                : <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">Bo‘limni yakunlasangiz, keyingisi ochiladi</div>}
          </div>
        </div>
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

function EnglishExamFinishedScreen({ preview, contestTitle, completed }: { preview: boolean; contestTitle?: string; completed: boolean }) {
  const title = preview ? 'Sinov yakunlandi' : completed ? 'Imtihon topshirildi' : 'Imtihon vaqti tugadi';
  const description = preview
    ? 'Listening → Reading → Writing oqimi yakunlandi. Bu sinovdagi javoblar faqat preview uchun saqlanadi; contest e’lon qilinmaydi va ratingga ta’sir qilmaydi.'
    : completed
      ? 'Javoblaringiz qabul qilindi va endi o‘zgarmaydi. Sizga ball yoki to‘g‘ri javoblar ko‘rsatilmaydi.'
      : 'Vaqt tugaguncha saqlangan javoblar yopildi. Sizga ball yoki to‘g‘ri javoblar ko‘rsatilmaydi.';

  return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5 sm:p-8">
    <div className="card w-full max-w-2xl overflow-hidden text-center">
      <div className={`px-6 py-8 sm:px-10 ${preview ? 'bg-sun-50' : 'bg-success-50'}`}>
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${preview ? 'bg-sun-100 text-sun-700' : 'bg-success-100 text-success-700'}`}><CheckCircle2 className="h-7 w-7" /></span>
        <p className={`mt-5 text-xs font-bold uppercase tracking-wider ${preview ? 'text-sun-700' : 'text-success-700'}`}>{contestTitle ?? 'English exam'}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      <div className="p-6 text-left sm:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {(['Listening', 'Reading', 'Writing'] as const).map((section) => <div key={section} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700"><CheckCircle2 className="h-4 w-4 text-success-600" />{section}</div>)}
        </div>
        {!preview && <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed text-indigo-950"><p className="font-bold">Natijalar tekshiruvdan keyin e’lon qilinadi</p><p className="mt-1">Listening va Reading serverda saqlangan. Writing javoblarini admin tekshiradi; faqat administrator yakuniy baholashni tugatgach, natija va reyting paydo bo‘ladi.</p></div>}
        <div className="mt-6 flex justify-center"><Link to={preview ? '/contest-management' : '/contests'} className="btn-primary px-5 py-2.5 text-sm">{preview ? 'Contest boshqaruviga qaytish' : 'Contestlar sahifasiga qaytish'}</Link></div>
      </div>
    </div>
  </div>;
}

function ContestFinishedScreen({ contestTitle }: { contestTitle: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5 sm:p-8"><div className="card w-full max-w-xl p-8 text-center sm:p-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-700"><CheckCircle2 className="h-7 w-7" /></span><p className="mt-5 text-xs font-bold uppercase tracking-wider text-success-700">{contestTitle}</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Contest vaqti tugadi</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Saqlangan javoblar yopildi. Ball va to‘g‘ri javoblar qatnashchiga ko‘rsatilmaydi; organizer yakuniy tekshiruvni tugatgach natija e’lon qilinadi.</p><Link to="/contests" className="btn-primary mt-6 px-5 py-2.5 text-sm">Contestlar sahifasiga qaytish</Link></div></div>;
}

/**
 * Browser APIs cannot prevent an OS-level app switch, but this guard detects
 * it as soon as the contest tab is hidden or focused again. We intentionally
 * avoid the native beforeunload blocker here because it produces the browser's
 * "leave this page?" prompt during normal fullscreen exits, while the server-side
 * end-contest RPC still makes the resulting lock durable across refreshes.
 */
function ContestIntegrityGuard({ active, contestId, onAttemptEnded }: { active: boolean; contestId: string; onAttemptEnded: () => void }) {
  const [notice, setNotice] = useState<'fullscreen' | 'away' | null>(null);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(active);
  const leftWindowRef = useRef(false);

  useEffect(() => { activeRef.current = active; }, [active]);

  const enterFullscreen = useCallback(async () => {
    setError(null);
    const entered = await requestContestFullscreen();
    if (!activeRef.current) return;
    if (entered) {
      leftWindowRef.current = false;
      setNotice(null);
    }
    else {
      setNotice('fullscreen');
      setError('Brauzer to‘liq ekran rejimini yoqmadi. Davom etish uchun quyidagi tugmani bosing.');
    }
  }, []);

  const endAttempt = async () => {
    if (ending) return;
    setEnding(true);
    setError(null);
    try {
      await endContestAttempt(contestId);
      activeRef.current = false;
      setNotice(null);
      onAttemptEnded();
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Contestni yakunlab bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setEnding(false);
    }
  };

  useEffect(() => {
    if (!active) {
      setNotice(null);
      return;
    }

    void enterFullscreen();
    const onFullscreenChange = () => {
      if (activeRef.current && !document.fullscreenElement) setNotice('fullscreen');
    };
    const markWindowLeft = () => {
      if (activeRef.current) leftWindowRef.current = true;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markWindowLeft();
      else if (leftWindowRef.current && activeRef.current) {
        leftWindowRef.current = false;
        setNotice('away');
      }
    };
    const onFocus = () => {
      if (leftWindowRef.current && activeRef.current) {
        leftWindowRef.current = false;
        setNotice('away');
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', markWindowLeft);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', markWindowLeft);
      window.removeEventListener('focus', onFocus);
    };
  }, [active, enterFullscreen]);

  if (!active || !notice) return null;
  const leftContestWindow = notice === 'away';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="contest-integrity-title">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-6 shadow-2xl sm:p-7">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${leftContestWindow ? 'bg-error-50 text-error-600' : 'bg-indigo-50 text-indigo-600'}`}>
          {leftContestWindow ? <ShieldAlert className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
        </div>
        <h2 id="contest-integrity-title" className="mt-5 text-xl font-bold text-slate-900">
          {leftContestWindow ? 'Contest oynasidan chiqdingiz' : 'To‘liq ekran rejimi kerak'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {leftContestWindow
            ? 'Contestni yakunlashni hohlaysizmi? Davom etsangiz, to‘liq ekran rejimida qolishingiz kerak bo‘ladi.'
            : 'Contest faqat to‘liq ekran rejimida davom etadi. Esc tugmasi bilan chiqsangiz ham shu tasdiqlash oynasi ochiladi.'}
        </p>
        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-error-50 p-3 text-xs leading-relaxed text-error-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={ending} onClick={() => void endAttempt()} className="btn-ghost border border-error-200 px-4 py-2.5 text-sm text-error-700 hover:bg-error-50 disabled:opacity-50">
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}Contestni yakunlash
          </button>
          <button type="button" disabled={ending} onClick={() => void enterFullscreen()} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Maximize2 className="h-4 w-4" />To‘liq ekranda davom etish</button>
        </div>
      </div>
    </div>
  );
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

function SharedTextBlank({ question, initialValue, locked, saving, onSave }: { question: ContestWorkspace['questions'][number]; initialValue: string; locked: boolean; saving: boolean; onSave: (questionId: string, value: string) => void }) {
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
  return <div className="mt-6 space-y-7"><section><div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">30–33 · Bitta kichik text</p><p className="mt-1 text-xs">Quyidagi bitta kichik textdagi barcha bo‘sh joylarni bitta so‘z bilan to‘ldiring.</p></div>{sharedText && pieces.length > 1 ? <article className="rounded-2xl border border-violet-100 bg-violet-50/35 p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Questions 30–33</p><span className="text-xs font-semibold text-slate-500">Har biri bitta so‘z</span></div><p className="whitespace-pre-wrap text-sm leading-8 text-slate-800">{pieces.map((piece, index) => { const match = /^\{\{(30|31|32|33)\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = questionByPosition.get(Number(match[1])); return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : <span key={index} className="mx-1 rounded bg-error-100 px-2 py-1 text-xs font-bold text-error-700">{piece}</span>; })}</p><p className="mt-4 text-xs text-slate-500">Maydonni tark etganingizda javob saqlanadi.</p></article> : <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-800"><p className="font-bold">Kichik text hali sozlanmagan</p><p className="mt-1 text-xs leading-relaxed">Organizer 30-savolda <code>{'{{30}}'}</code> dan <code>{'{{33}}'}</code> gacha bo‘lgan barcha markerli umumiy textni saqlashi kerak.</p></div>}</section><section><div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">34–35 · Multiple choice</p><p className="mt-1 text-xs">Har savol uchun A, B, C yoki D variantlaridan birini tanlang.</p></div><ObjectiveQuestions questions={choices} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition /></section></div>;
}

function InlineGapFillPassage({ content, highlights, locked, loading, saving, renderMarker, onAddHighlight }: { content: string; highlights: ReadingHighlight[]; locked: boolean; loading: boolean; saving: boolean; renderMarker: (marker: string, index: number) => ReactNode; onAddHighlight: (highlight: ReadingHighlight) => void }) {
  const passageRef = useRef<HTMLDivElement>(null);
  const [pendingHighlight, setPendingHighlight] = useState<ReadingHighlight | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  useEffect(() => { setPendingHighlight(null); setSelectionMessage(null); }, [content]);

  const captureSelection = () => {
    if (locked || loading || saving) return;
    const root = passageRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const sourceElement = (node: Node): HTMLElement | null => {
      const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
      return element?.closest<HTMLElement>('[data-reading-literal]') ?? null;
    };
    const startLiteral = sourceElement(range.startContainer);
    const endLiteral = sourceElement(range.endContainer);
    if (!startLiteral || startLiteral !== endLiteral) {
      setSelectionMessage('Javob maydonini kesib o‘tuvchi belgi qo‘yib bo‘lmaydi. Bitta matn bo‘lagini tanlang.');
      return;
    }
    const sourceStart = Number(startLiteral.dataset.readingStart);
    if (!Number.isSafeInteger(sourceStart)) return;
    const beforeStart = range.cloneRange();
    beforeStart.selectNodeContents(startLiteral);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange();
    beforeEnd.selectNodeContents(startLiteral);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    const rawStart = sourceStart + beforeStart.toString().length;
    const rawEnd = sourceStart + beforeEnd.toString().length;
    const rawQuote = content.slice(rawStart, rawEnd);
    const leadingWhitespace = rawQuote.length - rawQuote.trimStart().length;
    const trailingWhitespace = rawQuote.length - rawQuote.trimEnd().length;
    const start = rawStart + leadingWhitespace;
    const end = rawEnd - trailingWhitespace;
    const quote = content.slice(start, end);
    if (!quote) return;
    if (quote.length > 800) {
      setSelectionMessage('Bir martada 800 belgigacha bo‘lgan matnni belgilang.');
      return;
    }
    if (highlights.length >= 80) {
      setSelectionMessage('Bir passage uchun 80 tagacha belgi qo‘yish mumkin.');
      return;
    }
    if (highlights.some((highlight) => start < highlight.end && end > highlight.start)) {
      setSelectionMessage('Bu bo‘lak avvalgi belgi bilan ustma-ust keladi. Avval eski belgini o‘chiring.');
      return;
    }
    setPendingHighlight({ id: createReadingHighlightId(), start, end, quote });
    setSelectionMessage(null);
    selection.removeAllRanges();
  };

  const chunks = content.split(/(\{\{[1-9]\d*\}\})/g);
  let sourceOffset = 0;
  const renderedChunks = chunks.map((chunk, index) => {
    const start = sourceOffset;
    sourceOffset += chunk.length;
    if (/^\{\{[1-9]\d*\}\}$/.test(chunk)) return <span key={`marker-${index}`}>{renderMarker(chunk, index)}</span>;
    const chunkEnd = start + chunk.length;
    const localHighlights = highlights.filter((highlight) => highlight.start >= start && highlight.end <= chunkEnd);
    const segments: Array<{ key: string; text: string; highlight?: ReadingHighlight }> = [];
    let cursor = start;
    localHighlights.forEach((highlight) => {
      if (highlight.start > cursor) segments.push({ key: `text-${cursor}`, text: content.slice(cursor, highlight.start) });
      segments.push({ key: highlight.id, text: highlight.quote, highlight });
      cursor = highlight.end;
    });
    if (cursor < chunkEnd || segments.length === 0) segments.push({ key: `text-${cursor}`, text: content.slice(cursor, chunkEnd) });
    return <span key={`text-${index}`} data-reading-literal data-reading-start={start} className="whitespace-pre-wrap">{segments.map((segment) => segment.highlight ? <mark key={segment.key} className="rounded bg-amber-200 px-0.5 text-inherit decoration-amber-500 decoration-2 underline-offset-2">{segment.text}</mark> : <span key={segment.key}>{segment.text}</span>)}</span>;
  });

  return <><div ref={passageRef} tabIndex={0} onMouseUp={captureSelection} onKeyUp={captureSelection} className="whitespace-pre-wrap rounded-lg outline-none focus:ring-2 focus:ring-amber-200">{renderedChunks}</div>{selectionMessage && <p className="mt-3 text-xs font-semibold text-error-700">{selectionMessage}</p>}{pendingHighlight && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><p className="min-w-0 flex-1 leading-relaxed text-amber-950"><span className="font-bold">Tanlangan:</span> {pendingHighlight.quote.length > 180 ? `${pendingHighlight.quote.slice(0, 180)}…` : pendingHighlight.quote}</p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setPendingHighlight(null)} className="btn-ghost bg-white px-3 py-2 text-xs">Bekor qilish</button><button type="button" disabled={saving || loading} onClick={() => { if (pendingHighlight) { onAddHighlight(pendingHighlight); setPendingHighlight(null); } }} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"><Highlighter className="h-3.5 w-3.5" />Belgi qo‘yish</button></div></div>}</>;
}

function IeltsReadingPassageOneSharedText({ part, questions, answers, textAnswers, annotation, annotationsLoading, annotationSaving, locked, savingKey, onAnswer, onTextSave, onSaveAnnotation }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; annotation: ReadingAnnotation | undefined; annotationsLoading: boolean; annotationSaving: boolean; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; onSaveAnnotation: (part: ExamPart, note: string, highlights: ReadingHighlight[]) => void }) {
  const { passage, questionText, legacyQuestionTextOnly } = splitIeltsReadingPassageOneContent(part.content);
  const sharedQuestions = questions.filter((question) => IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number])).sort((left, right) => left.position - right.position);
  const otherQuestions = questions.filter((question) => !IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number])).sort((left, right) => left.position - right.position);
  const questionByPosition = new Map(sharedQuestions.map((question) => [question.position, question]));
  const configured = hasIeltsReadingPassageOneSharedTextMarkers(questionText)
    && sharedQuestions.length === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.length
    && sharedQuestions.every((question) => question.answerType === 'text');
  const questionChunks = configured ? questionText.split(/(\{\{(?:8|9|10|11|12|13)\}\})/g) : [];

  const passagePanel = passage.trim()
    ? <AnnotatableReadingPassage part={part} content={passage} annotation={annotation} loading={annotationsLoading} saving={annotationSaving} locked={locked} onSave={onSaveAnnotation} />
    : <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-sm leading-relaxed text-error-800"><p className="font-bold">Passage 1 matni tiklanishi kerak</p><p className="mt-2 text-xs">Oldingi builder Questions 8–13 gap-fill matnini Passage 1 o‘rniga saqlab yuborgan. Gap-fill savollari o‘ng panelga ko‘chirildi, lekin asl passage matni bu fayllarda saqlanmagan. Admin panelda haqiqiy Passage 1 matnini qayta kiriting.</p>{legacyQuestionTextOnly && <p className="mt-2 text-xs font-semibold">Eski gap-fill matni yo‘qolmagan — u o‘ng tomonda ko‘rsatiladi.</p>}</div>;

  const sharedPanel = configured ? <article className="rounded-2xl border border-violet-100 bg-violet-50/55 p-5 text-sm leading-7 text-slate-700 sm:p-6"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Questions 8–13</p><p className="mt-1 text-sm font-bold text-slate-900">Complete the text below.</p></div><div className="whitespace-pre-wrap">{questionChunks.map((chunk, index) => {
    const match = /^\{\{(8|9|10|11|12|13)\}\}$/.exec(chunk);
    if (!match) return <span key={`reading-p1-text-${index}`}>{chunk}</span>;
    const question = questionByPosition.get(Number(match[1]));
    return question
      ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} />
      : <span key={`reading-p1-missing-${index}`} className="mx-1 rounded bg-error-100 px-2 py-1 text-xs font-bold text-error-700">{chunk}</span>;
  })}</div><p className="mt-4 text-xs text-slate-500">Javob maydonidan chiqqaningizda javob avtomatik saqlanadi.</p></article> : <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Questions 8–13 umumiy gap-fill matni to‘liq sozlanmagan</p><p className="mt-1 text-xs">Savollar panelidagi matnda <code>{'{{8}}'}</code> dan <code>{'{{13}}'}</code> gacha markerlar va 6 ta yozma javob kaliti bo‘lishi kerak.</p></div>;

  return <ReadingTwoColumnLayout partId={part.id} passage={passagePanel} questions={<div className="space-y-6">{otherQuestions.length > 0 && <ObjectiveQuestions questions={otherQuestions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition />}{sharedPanel}</div>} />;
}

function IeltsReadingPassageTwoStructuredQuestions({ questions, answers, textAnswers, locked, savingKey, onAnswer, onClearAnswer, onTextSave }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void; onTextSave: (questionId: string, value: string) => void }) {
  const byPosition = new Map(questions.map((question) => [question.position, question]));
  const headings = IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const gapFillQuestions = IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const twoAnswerQuestions = IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const headingOptions = headings[0]?.options ?? [];
  const summary = byPosition.get(21);
  const firstTwoAnswer = byPosition.get(25);
  const configured = headings.length === 7
    && headings.every((question) => question.answerType === 'choice' && question.options.length === 9)
    && gapFillQuestions.length === 4
    && gapFillQuestions.every((question) => question.answerType === 'text')
    && summary?.prompt
    && IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.every((position) => summary.prompt.includes(`{{${position}}}`))
    && twoAnswerQuestions.length === 2
    && twoAnswerQuestions.every((question) => question.answerType === 'choice' && question.options.length === 5)
    && firstTwoAnswer?.prompt;
  if (!configured || !summary || !firstTwoAnswer) return <div className="mt-6 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Passage 2 hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">14–20 uchun 9 ta heading, 21–24 markerli bitta summary va 25–26 uchun 5 ta A–E variant kerak.</p></div>;

  const summaryPieces = summary.prompt.split(/(\{\{(?:21|22|23|24)\}\})/g);
  const usedTwoAnswerOptions = new Map<number, string>();
  twoAnswerQuestions.forEach((question) => {
    const selected = answers[question.id];
    if (selected !== undefined) usedTwoAnswerOptions.set(selected, question.id);
  });
  return <div className="mt-7 space-y-8">
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 14–20</p>
      <p className="mt-2 text-sm text-slate-800">Reading Passage 2 has seven paragraphs, A–G.</p>
      <p className="mt-1 text-sm text-slate-800">Choose the correct heading for each paragraph from the list below.</p>
      <div className="mt-5 max-w-2xl rounded-lg border border-slate-300 bg-slate-50/60 p-4 text-sm leading-6 text-slate-900"><p className="font-bold">List of Headings</p>{headingOptions.map((option, index) => <p key={index}><span className="mr-2 font-bold">{['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][index]}</span>{option}</p>)}</div>
      <div className="mt-5 max-w-xl space-y-2">{headings.map((question, index) => <label key={question.id} className="grid grid-cols-[2rem_9rem_minmax(0,1fr)] items-center gap-2 text-sm text-slate-900"><span className="font-bold">{question.position}</span><select value={answers[question.id] ?? ''} disabled={locked || Boolean(savingKey)} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="input h-10 py-1 text-center font-semibold"><option value="">{question.position}</option>{headingOptions.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>{['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][optionIndex]}</option>)}</select><span>Paragraph {String.fromCharCode(65 + index)}</span></label>)}</div>
    </section>
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 21–24</p>
      <p className="mt-2 text-sm text-slate-800">Complete the summary below. Choose ONE WORD ONLY from the passage for each answer.</p>
      <article className="mt-5 rounded-lg border border-slate-300 bg-slate-50/50 p-5 text-sm leading-8 text-slate-900 sm:p-6"><p className="whitespace-pre-wrap">{summaryPieces.map((piece, index) => { const match = /^\{\{(21|22|23|24)\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = byPosition.get(Number(match[1])); return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : null; })}</p></article>
    </section>
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 25 and 26</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Choose TWO letters, A–E.</p>
      <div className="mt-5 max-w-2xl space-y-2 text-sm text-slate-900"><p>{firstTwoAnswer.prompt}</p>{firstTwoAnswer.options.map((option, index) => <p key={index}><span className="mr-3 inline-block w-4 font-bold">{String.fromCharCode(65 + index)}</span>{option}</p>)}</div>
      <div className="mt-5 max-w-xl space-y-3">{twoAnswerQuestions.map((question, index) => <label key={question.id} className="grid grid-cols-[2rem_9rem_minmax(0,1fr)] items-center gap-2 text-sm text-slate-900"><span className="font-bold">{question.position}</span><select value={answers[question.id] ?? ''} disabled={locked || Boolean(savingKey)} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="input h-10 py-1 text-center font-semibold"><option value="">{question.position}</option>{firstTwoAnswer.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex} disabled={usedTwoAnswerOptions.has(optionIndex) && usedTwoAnswerOptions.get(optionIndex) !== question.id}>{String.fromCharCode(65 + optionIndex)}</option>)}</select><span>{index === 0 ? 'Choose the first correct letter.' : 'Choose the second correct letter.'}</span></label>)}</div>
    </section>
  </div>;
}

function IeltsReadingPassageThreeStructuredQuestions({ questions, answers, textAnswers, locked, savingKey, onAnswer, onClearAnswer, onTextSave }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void; onTextSave: (questionId: string, value: string) => void }) {
  const byPosition = new Map(questions.map((question) => [question.position, question]));
  const trueFalseNotGiven = IELTS_READING_PASSAGE_THREE_TFNG_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const summaryQuestions = IELTS_READING_PASSAGE_THREE_SUMMARY_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const legacyChoiceQuestions = [...IELTS_READING_PASSAGE_THREE_A_TO_F_POSITIONS, ...IELTS_READING_PASSAGE_THREE_PARAGRAPH_POSITIONS].map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const aToFQuestions = IELTS_READING_PASSAGE_THREE_A_TO_F_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const paragraphQuestions = IELTS_READING_PASSAGE_THREE_PARAGRAPH_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const summary = byPosition.get(32);
  const legacyChoiceOptions = legacyChoiceQuestions[0]?.options ?? [];
  const aToFOptions = aToFQuestions[0]?.options ?? [];
  const legacyRomanChoiceBank = legacyChoiceQuestions.length === 6
    && legacyChoiceQuestions.every((question) => question.answerType === 'choice' && question.options.length === 9);
  const aToFChoiceBank = aToFQuestions.length === 3
    && aToFQuestions.every((question) => question.answerType === 'choice' && question.options.length === 6);
  const paragraphChoiceBank = paragraphQuestions.length === 3
    && paragraphQuestions.every((question) => question.answerType === 'choice' && question.options.length === 8 && question.options.every((option, index) => option === IELTS_READING_PASSAGE_THREE_PARAGRAPH_LABELS[index]));
  const configured = trueFalseNotGiven.length === 5
    && trueFalseNotGiven.every((question) => question.answerType === 'choice' && question.options.length === 3 && question.options.every((option, index) => option === ['True', 'False', 'Not Given'][index]))
    && summaryQuestions.length === 3
    && summaryQuestions.every((question) => question.answerType === 'text' && question.wordLimit === 2)
    && summary?.prompt
    && IELTS_READING_PASSAGE_THREE_SUMMARY_POSITIONS.every((position) => summary.prompt.includes(`{{${position}}}`))
    && (legacyRomanChoiceBank || (aToFChoiceBank && paragraphChoiceBank));
  if (!configured || !summary) return <div className="mt-6 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Passage 3 hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">27–31 uchun True / False / Not Given, 32–34 uchun markerli summary, 35–37 uchun A–F va 38–40 uchun A–H paragraph tanlovi kerak.</p></div>;

  const summaryPieces = summary.prompt.split(/(\{\{(?:32|33|34)\}\})/g);
  const choiceRows = (items: ContestWorkspace['questions'], options: string[], labels: readonly string[], offset = 0) => <div className="mt-5 max-w-3xl space-y-3">{items.map((question, index) => {
    const saving = savingKey === `answer:${question.id}`;
    return <label key={question.id} className="grid grid-cols-[2rem_minmax(0,1fr)_8rem] items-center gap-3 text-sm text-slate-900 sm:grid-cols-[2.5rem_minmax(0,1fr)_10rem]"><span className="flex h-8 w-8 items-center justify-center border border-slate-500 font-bold">{question.position}</span><span className="leading-6">{question.prompt.trim() || (legacyRomanChoiceBank ? `Paragraph ${String.fromCharCode(65 + offset + index)}` : `Item ${question.position}`)}</span><select value={answers[question.id] ?? ''} disabled={locked || saving} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="h-10 border border-indigo-500 bg-white px-2 text-center font-semibold outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"><option value="">--</option>{options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>{labels[optionIndex]}</option>)}</select></label>;
  })}</div>;

  return <div className="mt-7 space-y-9">
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 27–31</p>
      <p className="mt-1 text-sm text-slate-800">Do the following statements agree with the claims of the writer in Reading Passage 3?</p>
      <p className="mt-2 text-sm text-slate-800">In boxes 27–31, write:</p>
      <div className="mt-1 text-sm leading-5 text-slate-900"><p><span className="font-bold">TRUE</span> if the statement agrees with the claims of the writer</p><p><span className="font-bold">FALSE</span> if the statement contradicts the claims of the writer</p><p><span className="font-bold">NOT GIVEN</span> if it is impossible to say what the writer thinks about this</p></div>
      <div className="mt-5 max-w-4xl space-y-5">{trueFalseNotGiven.map((question) => {
        const saving = savingKey === `answer:${question.id}`;
        return <label key={question.id} className="grid grid-cols-[2rem_minmax(0,1fr)_8rem] items-center gap-3 text-sm text-slate-900 sm:grid-cols-[2.5rem_minmax(0,1fr)_10rem]"><span className="flex h-8 w-8 items-center justify-center border border-slate-500 font-bold">{question.position}</span><span className="leading-6">{question.prompt}</span><select value={answers[question.id] ?? ''} disabled={locked || saving} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="h-10 border border-indigo-500 bg-white px-2 text-center font-semibold outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"><option value="">--</option>{question.options.map((option, optionIndex) => <option key={optionIndex} value={optionIndex}>{option}</option>)}</select></label>;
      })}</div>
    </section>
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 32–34</p>
      <p className="mt-2 text-sm text-slate-800">Complete the summary below.</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">Choose NO MORE THAN TWO WORDS from the passage for each answer.</p>
      <article className="mt-5 max-w-4xl rounded-lg border border-slate-300 bg-slate-50/50 p-5 text-sm leading-8 text-slate-900 sm:p-6"><p className="whitespace-pre-wrap">{summaryPieces.map((piece, index) => { const match = /^\{\{(32|33|34)\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = byPosition.get(Number(match[1])); return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : null; })}</p></article>
    </section>
    {legacyRomanChoiceBank ? <><section>
      <p className="text-sm font-bold text-slate-900">Questions 35–37</p>
      <p className="mt-2 text-sm text-slate-800">Choose the correct heading for each item from the list of headings below.</p>
      <div className="mt-5 max-w-3xl rounded-lg border border-slate-300 bg-slate-50/60 p-4 text-sm leading-6 text-slate-900"><p className="font-bold">List of Headings</p>{legacyChoiceOptions.map((option, index) => <p key={index}><span className="mr-2 font-bold">{IELTS_ROMAN_HEADINGS[index]}</span>{option}</p>)}</div>
      {choiceRows(legacyChoiceQuestions.slice(0, 3), legacyChoiceOptions, IELTS_ROMAN_HEADINGS, 0)}
    </section><section>
      <p className="text-sm font-bold text-slate-900">Questions 38–40</p>
      <p className="mt-2 text-sm text-slate-800">Choose the correct heading for each item from the list of headings above.</p>
      {choiceRows(legacyChoiceQuestions.slice(3), legacyChoiceOptions, IELTS_ROMAN_HEADINGS, 3)}
    </section></> : <><section>
      <p className="text-sm font-bold text-slate-900">Questions 35–37</p>
      <p className="mt-2 text-sm text-slate-800">Choose the correct letter, A–F, for each item from the options below.</p>
      <div className="mt-5 max-w-3xl rounded-lg border border-slate-300 bg-slate-50/60 p-4 text-sm leading-6 text-slate-900"><p className="font-bold">Options</p>{aToFOptions.map((option, index) => <p key={index}><span className="mr-2 font-bold">{IELTS_READING_PASSAGE_THREE_OPTION_LABELS[index]}</span>{option}</p>)}</div>
      {choiceRows(aToFQuestions, aToFOptions, IELTS_READING_PASSAGE_THREE_OPTION_LABELS)}
    </section><section>
      <p className="text-sm font-bold text-slate-900">Questions 38–40</p>
      <p className="mt-2 text-sm text-slate-800">Which paragraph contains the following information?</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">Write the correct letter, A–H, in boxes 38–40.</p>
      {choiceRows(paragraphQuestions, [...IELTS_READING_PASSAGE_THREE_PARAGRAPH_LABELS], IELTS_READING_PASSAGE_THREE_PARAGRAPH_LABELS)}
    </section></>}
  </div>;
}

function ObjectiveQuestions({ questions, answers, textAnswers, locked, savingKey, onAnswer, onTextSave, audioOnly = false, groupByExtract = false, useStoredPosition = false }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onTextSave: (questionId: string, value: string) => void; audioOnly?: boolean; groupByExtract?: boolean; useStoredPosition?: boolean }) {
  if (groupByExtract) return <div className="mt-7 grid gap-5">{[1, 2, 3].map((extractNumber) => {
    const from = 24 + ((extractNumber - 1) * 2);
    const items = questions.filter((question) => question.position === from || question.position === from + 1);
    return <section key={extractNumber} className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-fuchsia-100 bg-fuchsia-50/70 px-5 py-3"><div><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">Extract {extractNumber}</p><p className="mt-1 text-sm font-bold text-slate-800">Savol {from} va {from + 1}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-100">{items.length}/2</span></div><div className="p-5"><ObjectiveQuestionRows questions={items} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} audioOnly={false} useStoredPosition /></div></section>;
  })}</div>;
  return <div className="mt-7 space-y-8"><ObjectiveQuestionRows questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} audioOnly={audioOnly} useStoredPosition={audioOnly || useStoredPosition} /></div>;
}

function IeltsListeningPartOneSharedGapFill({ part, questions, textAnswers, locked, savingKey, onTextSave }: { part: ExamPart; questions: ContestWorkspace['questions']; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onTextSave: (questionId: string, value: string) => void }) {
  const gapFillQuestions = questions.filter((question) => IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS[number])).sort((left, right) => left.position - right.position);
  const questionByPosition = new Map(gapFillQuestions.map((question) => [question.position, question]));
  const configured = gapFillQuestions.length === 10 && gapFillQuestions.every((question) => question.answerType === 'text');
  const pieces = part.content.split(/(\{\{(?:10|[1-9])\}\})/g);
  return <div className="mt-6"><div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Questions 1–10 · Bitta filling gap text</p><p className="mt-1 text-xs">Audio asosida barcha bo‘sh joylarni shu bitta form, note yoki jadval ichida to‘ldiring.</p></div>{configured ? <article className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/35 p-5 sm:p-7"><p className="whitespace-pre-wrap text-sm leading-8 text-slate-800">{pieces.map((piece, index) => { const match = /^\{\{(10|[1-9])\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = questionByPosition.get(Number(match[1])); return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : <span key={index} className="mx-1 rounded bg-error-100 px-2 py-1 text-xs font-bold text-error-700">{piece}</span>; })}</p><p className="mt-4 text-xs text-slate-500">Maydonni tark etganingizda javob saqlanadi.</p></article> : <div className="mt-5 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Filling gap hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">Part 1 umumiy textida <code>{'{{1}}'}</code> dan <code>{'{{10}}'}</code> gacha bo‘lgan markerlar va ular uchun 10 ta yozma javob kaliti kerak.</p></div>}</div>;
}

function IeltsListeningPartFourSharedGapFill({ part, questions, textAnswers, locked, savingKey, onTextSave }: { part: ExamPart; questions: ContestWorkspace['questions']; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onTextSave: (questionId: string, value: string) => void }) {
  const gapFillQuestions = questions.filter((question) => IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number])).sort((left, right) => left.position - right.position);
  const questionByPosition = new Map(gapFillQuestions.map((question) => [question.position, question]));
  const configured = gapFillQuestions.length === 10 && gapFillQuestions.every((question) => question.answerType === 'text');
  const pieces = part.content.split(/(\{\{(?:3[1-9]|40)\}\})/g);
  return <div className="mt-6"><div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Questions 31–40 · Bitta gap filling text</p><p className="mt-1 text-xs">Audio asosida barcha bo‘sh joylarni shu bitta note-completion matni ichida to‘ldiring.</p></div>{configured ? <article className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/35 p-5 sm:p-7"><p className="whitespace-pre-wrap text-sm leading-8 text-slate-800">{pieces.map((piece, index) => { const match = /^\{\{(3[1-9]|40)\}\}$/.exec(piece); if (!match) return <span key={index}>{piece}</span>; const question = questionByPosition.get(Number(match[1])); return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : <span key={index} className="mx-1 rounded bg-error-100 px-2 py-1 text-xs font-bold text-error-700">{piece}</span>; })}</p><p className="mt-4 text-xs text-slate-500">Maydonni tark etganingizda javob saqlanadi.</p></article> : <div className="mt-5 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Gap filling hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">Part 4 umumiy textida <code>{'{{31}}'}</code> dan <code>{'{{40}}'}</code> gacha bo‘lgan markerlar va ular uchun 10 ta yozma javob kaliti kerak.</p></div>}</div>;
}

function IeltsListeningPartTwoStructuredQuestions({ questions, answers, textAnswers, locked, savingKey, onAnswer, onClearAnswer, onTextSave }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void; onTextSave: (questionId: string, value: string) => void }) {
  const byPosition = new Map(questions.map((question) => [question.position, question]));
  const preludeQuestions = questions.filter((question) => question.position === 11 || question.position === 12).sort((left, right) => left.position - right.position);
  const summaryQuestions = IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const activityQuestions = IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const twoAnswerQuestions = IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const summary = byPosition.get(13);
  const configured = summaryQuestions.length === 2
    && summaryQuestions.every((question) => question.answerType === 'text')
    && summary?.prompt.includes('{{13}}')
    && summary.prompt.includes('{{14}}')
    && activityQuestions.length === 4
    && activityQuestions.every((question) => question.answerType === 'choice')
    && activityQuestions[0]?.options.length === 3
    && twoAnswerQuestions.length === 2
    && twoAnswerQuestions.every((question) => question.answerType === 'choice')
    && twoAnswerQuestions[0]?.options.length === 5;
  if (!configured || !summary) return <div className="mt-6 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Part 2 hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">13–14 summary, 15–18 uchun A/B/C javob banki va 19–20 uchun 5 variantli ikki javob kaliti kerak.</p></div>;

  const summaryPieces = summary.prompt.split(/(\{\{(?:13|14)\}\})/g);
  const activityOptions = activityQuestions[0].options;
  const twoAnswerOptions = twoAnswerQuestions[0].options;
  const selectedQuestionIds = twoAnswerQuestions.filter((question) => answers[question.id] !== undefined).map((question) => question.id);

  const toggleTwoAnswerOption = (optionIndex: number) => {
    const selectedQuestion = twoAnswerQuestions.find((question) => answers[question.id] === optionIndex);
    if (selectedQuestion) return onClearAnswer(selectedQuestion.id);
    const openQuestion = twoAnswerQuestions.find((question) => answers[question.id] === undefined);
    if (openQuestion) onAnswer(openQuestion.id, optionIndex);
  };

  return <div className="mt-6 space-y-8">
    {preludeQuestions.length > 0 && <ObjectiveQuestions questions={preludeQuestions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition />}
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 13 and 14</p>
      <p className="mt-2 text-sm text-slate-800">Complete the summary below.</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Write ONE WORD AND/OR A NUMBER for each answer.</p>
      <article className="mt-5 rounded-lg border border-slate-300 bg-slate-50/50 p-5 text-sm leading-8 text-slate-900 sm:p-6"><p className="whitespace-pre-wrap">{summaryPieces.map((piece, index) => {
        const match = /^\{\{(13|14)\}\}$/.exec(piece);
        if (!match) return <span key={index}>{piece}</span>;
        const question = byPosition.get(Number(match[1]));
        return question ? <SharedTextBlank key={question.id} question={question} initialValue={textAnswers[question.id] ?? ''} locked={locked} saving={savingKey === `text:${question.id}`} onSave={onTextSave} /> : null;
      })}</p></article>
    </section>
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 15–18</p>
      <p className="mt-2 text-sm text-slate-800">How much does the speaker like doing each of the following activities?</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Choose the correct letter, A, B or C, next to questions 15–18.</p>
      <div className="mt-5 max-w-sm rounded-lg border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-900">{activityOptions.map((option, index) => <p key={index}><span className="mr-3 inline-block w-4 font-bold">{String.fromCharCode(65 + index)}</span>{option}</p>)}</div>
      <div className="mt-5 max-w-xl space-y-2">{activityQuestions.map((question) => <label key={question.id} className="grid grid-cols-[2rem_minmax(0,1fr)_9rem] items-center gap-2 text-sm text-slate-900"><span className="font-bold">{question.position}</span><span>{question.prompt}</span><select value={answers[question.id] ?? ''} disabled={locked || Boolean(savingKey)} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="input h-10 py-1 text-center font-semibold"><option value="">{question.position}</option>{activityOptions.map((_, index) => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}</select></label>)}</div>
    </section>
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 19 and 20</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Choose TWO correct answers.</p>
      <p className="mt-4 text-sm text-slate-900">{twoAnswerQuestions[0].prompt}</p>
      <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">{twoAnswerOptions.map((option, optionIndex) => {
        const selected = twoAnswerQuestions.some((question) => answers[question.id] === optionIndex);
        const disabled = locked || Boolean(savingKey) || (selectedQuestionIds.length >= 2 && !selected);
        return <label key={optionIndex} className={`flex items-center gap-4 px-2 py-3 text-sm text-slate-900 ${disabled && !selected ? 'opacity-55' : 'cursor-pointer'}`}><input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleTwoAnswerOption(optionIndex)} className="h-4 w-4 rounded border-slate-400 accent-indigo-600" /><span className="w-4 font-bold">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></label>;
      })}</div>
    </section>
  </div>;
}

function IeltsTwoAnswerCheckboxBlock({ title, questions, answers, locked, savingKey, onAnswer, onClearAnswer }: { title: string; questions: ContestWorkspace['questions']; answers: Record<string, number>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void }) {
  const options = questions[0]?.options ?? [];
  const selectedQuestionIds = questions.filter((question) => answers[question.id] !== undefined).map((question) => question.id);
  const toggleOption = (optionIndex: number) => {
    const selectedQuestion = questions.find((question) => answers[question.id] === optionIndex);
    if (selectedQuestion) return onClearAnswer(selectedQuestion.id);
    const openQuestion = questions.find((question) => answers[question.id] === undefined);
    if (openQuestion) onAnswer(openQuestion.id, optionIndex);
  };
  return <section><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-2 text-sm font-semibold text-slate-900">Choose TWO correct answers.</p><p className="mt-4 text-sm text-slate-900">{questions[0]?.prompt}</p><div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">{options.map((option, optionIndex) => {
    const selected = questions.some((question) => answers[question.id] === optionIndex);
    const disabled = locked || Boolean(savingKey) || (selectedQuestionIds.length >= 2 && !selected);
    return <label key={optionIndex} className={`flex items-center gap-4 px-2 py-3 text-sm text-slate-900 ${disabled && !selected ? 'opacity-55' : 'cursor-pointer'}`}><input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleOption(optionIndex)} className="h-4 w-4 rounded border-slate-400 accent-indigo-600" /><span className="w-4 font-bold">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></label>;
  })}</div></section>;
}

function IeltsListeningPartThreeStructuredQuestions({ questions, answers, locked, savingKey, onAnswer, onClearAnswer }: { questions: ContestWorkspace['questions']; answers: Record<string, number>; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void }) {
  const byPosition = new Map(questions.map((question) => [question.position, question]));
  const firstPair = IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const secondPair = IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const flowQuestions = IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.map((position) => byPosition.get(position)).filter((question): question is ContestWorkspace['questions'][number] => Boolean(question));
  const flowChart = byPosition.get(25);
  const flowSteps = flowChart?.prompt.split(/\n---\n/).map((step) => step.trim()).filter(Boolean) ?? [];
  const configured = firstPair.length === 2
    && firstPair.every((question) => question.answerType === 'choice' && question.options.length === 5)
    && secondPair.length === 2
    && secondPair.every((question) => question.answerType === 'choice' && question.options.length === 5)
    && flowQuestions.length === 6
    && flowQuestions.every((question) => question.answerType === 'choice' && question.options.length === 8)
    && flowChart?.prompt
    && IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.every((position) => flowChart.prompt.includes(`{{${position}}}`))
    && flowSteps.length >= 8;
  if (!configured || !flowChart) return <div className="mt-6 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm leading-relaxed text-error-800"><p className="font-bold">Part 3 hali to‘liq sozlanmagan</p><p className="mt-1 text-xs">21–22 va 23–24 uchun ikkita A–E checkbox juftligi, 25–30 uchun A–H javob banki va markerli flow-chart kerak.</p></div>;

  const flowOptions = flowChart.options;
  const flowQuestionByPosition = new Map(flowQuestions.map((question) => [question.position, question]));
  const usedFlowOptions = new Map<number, string>();
  flowQuestions.forEach((question) => {
    const selected = answers[question.id];
    if (selected !== undefined) usedFlowOptions.set(selected, question.id);
  });

  return <div className="mt-6 space-y-8">
    <IeltsTwoAnswerCheckboxBlock title="Questions 21 and 22" questions={firstPair} answers={answers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} />
    <IeltsTwoAnswerCheckboxBlock title="Questions 23 and 24" questions={secondPair} answers={answers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} />
    <section>
      <p className="text-sm font-bold text-slate-900">Questions 25–30</p>
      <p className="mt-2 text-sm text-slate-800">Complete the flow-chart below.</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">Choose SIX correct answers, A–H, next to questions 25–30.</p>
      <div className="mt-5 max-w-sm rounded-lg border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-900">{flowOptions.map((option, index) => <p key={index}><span className="mr-3 inline-block w-4 font-bold">{String.fromCharCode(65 + index)}</span>{option}</p>)}</div>
      <div className="mt-7"><h3 className="border border-slate-700 px-4 py-2 text-center text-sm font-bold text-slate-900">{flowSteps[0]}</h3><div className="space-y-1">{flowSteps.slice(1).map((step, index) => <div key={`${index}-${step}`}><div className="py-2 text-center text-sm font-bold text-slate-700">↓</div><div className="border border-slate-700 px-4 py-3 text-center text-sm leading-7 text-slate-900">{step.split(/(\{\{(?:25|26|27|28|29|30)\}\})/g).map((piece, pieceIndex) => {
        const match = /^\{\{(25|26|27|28|29|30)\}\}$/.exec(piece);
        if (!match) return <span key={pieceIndex}>{piece}</span>;
        const question = flowQuestionByPosition.get(Number(match[1]));
        if (!question) return null;
        const selected = answers[question.id];
        return <span key={question.id} className="mx-1 inline-flex align-middle"><label className="sr-only" htmlFor={`flow-chart-${question.id}`}>Savol {question.position} javobi</label><select id={`flow-chart-${question.id}`} value={selected ?? ''} disabled={locked || Boolean(savingKey)} onChange={(event) => event.target.value === '' ? onClearAnswer(question.id) : onAnswer(question.id, Number(event.target.value))} className="h-8 min-w-24 border-b-2 border-indigo-400 bg-white px-2 text-center text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-100"><option value="">{question.position}</option>{flowOptions.map((_, optionIndex) => <option key={optionIndex} value={optionIndex} disabled={usedFlowOptions.has(optionIndex) && usedFlowOptions.get(optionIndex) !== question.id}>{String.fromCharCode(65 + optionIndex)}</option>)}</select></span>;
      })}</div></div>)}</div></div>
    </section>
  </div>;
}

function ListeningPart({ part, audioSource, questions, answers, textAnswers, gapFillResponses, matchingConfig, matchingResponses, locked, savingKey, audioOnly, gapFill, matching, mapMatching, extractQuestions, ieltsExam, ieltsSharedGapFill, ieltsSharedGapFillPartFour, ieltsStructuredPartTwo, ieltsStructuredPartThree, showAudio, onAnswer, onClearAnswer, onTextSave, onGapFillSave, onMatchingSave }: { part: ExamPart; audioSource: string | null; questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; gapFillResponses: Record<string, GapFillResponse>; matchingConfig: MatchingWorkspaceConfig | undefined; matchingResponses: Record<string, MatchingResponse>; locked: boolean; savingKey: string | null; audioOnly: boolean; gapFill: boolean; matching: boolean; mapMatching: boolean; extractQuestions: boolean; ieltsExam: boolean; ieltsSharedGapFill: boolean; ieltsSharedGapFillPartFour: boolean; ieltsStructuredPartTwo: boolean; ieltsStructuredPartThree: boolean; showAudio: boolean; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void; onTextSave: (questionId: string, value: string) => void; onGapFillSave: (part: ExamPart, blankNumber: number, answer: string) => void; onMatchingSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void }) {
  const useIeltsSharedGapFill = ieltsSharedGapFill && hasIeltsListeningPartOneGapFillMarkers(part.content);
  const useIeltsSharedGapFillPartFour = ieltsSharedGapFillPartFour && hasIeltsListeningPartFourGapFillMarkers(part.content);
  const useIeltsStructuredPartTwo = ieltsStructuredPartTwo && part.content === IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT;
  const useIeltsStructuredPartThree = ieltsStructuredPartThree && part.content === IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT;
  return <>{showAudio && <ListeningAudio source={audioSource} locked={locked} />}{gapFill ? <GapFillListeningText part={part} responses={gapFillResponses} locked={locked} savingKey={savingKey} onSave={onGapFillSave} /> : matching ? <SpeakerMatchingListening part={part} config={matchingConfig} responses={matchingResponses} locked={locked} savingKey={savingKey} mapMode={mapMatching} onSave={onMatchingSave} /> : useIeltsSharedGapFill ? <IeltsListeningPartOneSharedGapFill part={part} questions={questions} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onTextSave={onTextSave} /> : useIeltsSharedGapFillPartFour ? <IeltsListeningPartFourSharedGapFill part={part} questions={questions} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onTextSave={onTextSave} /> : useIeltsStructuredPartTwo ? <IeltsListeningPartTwoStructuredQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} onTextSave={onTextSave} /> : useIeltsStructuredPartThree ? <IeltsListeningPartThreeStructuredQuestions questions={questions} answers={answers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} /> : <>{part.content && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.content}</p>}{audioOnly && <p className="mt-5 rounded-xl bg-cyan-50 px-4 py-3 text-sm leading-relaxed text-cyan-900">1–8-savollar audio yozuvda beriladi. To‘g‘ri deb bilgan 3 variantdan birini tanlang.</p>}{extractQuestions && <div className="mt-5 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 text-sm leading-relaxed text-fuchsia-900"><p className="font-bold">3 ta extract · 24–29-savollar</p><p className="mt-1 text-xs">Har extractni tinglab, uning ostidagi 2 ta savolga javob bering.</p></div>}<ObjectiveQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} audioOnly={audioOnly} groupByExtract={extractQuestions} useStoredPosition={ieltsExam} onAnswer={onAnswer} onTextSave={onTextSave} /></>}</>;
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

function GapFillListeningText({ part, responses, locked, savingKey, highlights = [], annotationLoading = false, annotationSaving = false, onSave, onAddHighlight }: { part: ExamPart; responses: Record<string, GapFillResponse>; locked: boolean; savingKey: string | null; highlights?: ReadingHighlight[]; annotationLoading?: boolean; annotationSaving?: boolean; onSave: (part: ExamPart, blankNumber: number, answer: string) => void; onAddHighlight?: (highlight: ReadingHighlight) => void }) {
  const [drafts, setDrafts] = useState<Record<number, string>>(() => Object.fromEntries(gapFillBlankNumbers(part.content).map((blankNumber) => [blankNumber, responses[gapFillResponseKey(part.id, blankNumber)]?.answer ?? ''])));
  const blankNumbers = useMemo(() => gapFillBlankNumbers(part.content), [part.content]);

  useEffect(() => {
    setDrafts(Object.fromEntries(blankNumbers.map((blankNumber) => [blankNumber, responses[gapFillResponseKey(part.id, blankNumber)]?.answer ?? ''])));
  }, [blankNumbers, part.id, responses]);

  const chunks = part.content.split(/(\{\{[1-9]\d*\}\})/g);
  const renderBlank = (chunk: string, index: number) => {
    const match = chunk.match(/^\{\{([1-9]\d*)\}\}$/);
    if (!match) return <span key={`${index}-${chunk}`} className="whitespace-pre-wrap">{chunk}</span>;
    const blankNumber = Number(match[1]);
    const saving = savingKey === `gap-fill:${gapFillResponseKey(part.id, blankNumber)}`;
    return <span key={chunk} className="mx-1 inline-flex align-middle"><label className="sr-only" htmlFor={`gap-fill-${part.id}-${blankNumber}`}>({blankNumber}) javob</label><span className="flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 shadow-sm"><span className="mr-1 text-xs font-extrabold text-indigo-600">{blankNumber}</span><input id={`gap-fill-${part.id}-${blankNumber}`} value={drafts[blankNumber] ?? ''} disabled={locked || saving} onChange={(event) => setDrafts((current) => ({ ...current, [blankNumber]: event.target.value }))} onBlur={() => onSave(part, blankNumber, drafts[blankNumber] ?? '')} className="w-28 border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-indigo-300 focus:ring-0 disabled:opacity-60 sm:w-36" placeholder="javob" />{saving && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-indigo-600" />}</span></span>;
  };
  return <div className="mt-6"><div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Bo‘sh joylarni to‘ldiring</p><p className="mt-1 text-xs">Har javob bitta so‘z yoki son bo‘lishi kerak. Maydonni tark etganingizda javob avtomatik saqlanadi.</p></div><article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] leading-8 text-slate-800 shadow-sm sm:p-7">{onAddHighlight ? <InlineGapFillPassage content={part.content} highlights={highlights} locked={locked} loading={annotationLoading} saving={annotationSaving} renderMarker={renderBlank} onAddHighlight={onAddHighlight} /> : chunks.map(renderBlank)}</article><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{blankNumbers.map((blankNumber) => <div key={blankNumber} className={`rounded-xl px-3 py-2 text-xs font-semibold ${responses[gapFillResponseKey(part.id, blankNumber)]?.answer ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>({blankNumber}) {responses[gapFillResponseKey(part.id, blankNumber)]?.answer ? 'saqlandi' : 'kutilmoqda'}</div>)}</div></div>;
}

function SpeakerMatchingListening({ part, config, responses, locked, savingKey, mapMode, readingMode = null, showPartContent = true, onSave }: { part: ExamPart; config: MatchingWorkspaceConfig | undefined; responses: Record<string, MatchingResponse>; locked: boolean; savingKey: string | null; mapMode: boolean; readingMode?: 'headings' | 'situations' | null; showPartContent?: boolean; onSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void }) {
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
      {showPartContent && part.content && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{part.content}</p>}
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

function createReadingHighlightId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function usableReadingHighlights(content: string, highlights: ReadingHighlight[]): ReadingHighlight[] {
  let previousEnd = 0;
  return highlights
    .filter((highlight) => highlight.start >= 0 && highlight.end > highlight.start && highlight.end <= content.length && content.slice(highlight.start, highlight.end) === highlight.quote)
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .filter((highlight) => {
      if (highlight.start < previousEnd) return false;
      previousEnd = highlight.end;
      return true;
    });
}

function ReadingNoteEditor({ part, annotation, highlights, loading, saving, locked, canHighlight, onSave, onRemoveHighlight, onNoteChange }: { part: ExamPart; annotation: ReadingAnnotation | undefined; highlights: ReadingHighlight[]; loading: boolean; saving: boolean; locked: boolean; canHighlight: boolean; onSave: (part: ExamPart, note: string, highlights: ReadingHighlight[]) => void; onRemoveHighlight?: (highlightId: string, note: string) => void; onNoteChange?: (note: string) => void }) {
  const storedNote = annotation?.note ?? '';
  const [note, setNote] = useState(storedNote);
  useEffect(() => { setNote(storedNote); onNoteChange?.(storedNote); }, [onNoteChange, part.id, storedNote]);
  const save = () => {
    if (!locked && !saving) onSave(part, note, highlights);
  };
  const changed = note.trim() !== storedNote;
  return <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><StickyNote className="h-4.5 w-4.5" /></span><div><p className="text-sm font-bold text-amber-950">Shaxsiy eslatmalar</p><p className="mt-1 text-xs leading-relaxed text-amber-900/75">Bu yozuvlar va belgilaringiz faqat sizga ko‘rinadi, baholashga ta’sir qilmaydi.</p></div></div><span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200"><Highlighter className="h-3.5 w-3.5" />{highlights.length} belgi</span></div>
    {loading ? <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />Eslatmalar yuklanmoqda…</div> : <>
      <label className="sr-only" htmlFor={`reading-note-${part.id}`}>Reading Passage uchun shaxsiy eslatma</label>
      <textarea id={`reading-note-${part.id}`} value={note} disabled={locked || saving} onChange={(event) => { setNote(event.target.value); onNoteChange?.(event.target.value); }} onBlur={() => changed && save()} maxLength={4000} className="input mt-4 min-h-28 resize-y bg-white text-sm leading-relaxed disabled:bg-slate-50" placeholder="Muhim fikr, kalit so‘z yoki keyin tekshiriladigan joyni yozing…" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><p className="text-amber-900/70">{locked ? 'Bo‘lim yopilgan; eslatmalar endi o‘zgarmaydi.' : canHighlight ? 'Matndan bo‘lak tanlang, keyin “Belgi qo‘yish”ni bosing.' : 'Inline javob maydonlari bo‘lgan bu passage uchun eslatma yozishingiz mumkin.'}</p><button type="button" disabled={locked || saving || !changed} onClick={save} className="btn-ghost border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{saving ? 'Saqlanmoqda…' : 'Eslatmani saqlash'}</button></div>
      {highlights.length > 0 && <div className="mt-4 space-y-2 border-t border-amber-200/80 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Belgilangani</p>{highlights.map((highlight) => <div key={highlight.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-700 ring-1 ring-amber-100"><p className="min-w-0 flex-1 break-words leading-relaxed"><mark className="rounded bg-amber-200 px-1 text-slate-800">{highlight.quote}</mark></p>{onRemoveHighlight && <button type="button" disabled={locked || saving} onClick={() => onRemoveHighlight(highlight.id, note)} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-error-50 hover:text-error-700 disabled:opacity-50" aria-label="Belgini o‘chirish" title="Belgini o‘chirish"><X className="h-4 w-4" /></button>}</div>)}</div>}
    </>}
  </section>;
}

function AnnotatableReadingPassage({ part, content, annotation, loading, saving, locked, onSave }: { part: ExamPart; content: string; annotation: ReadingAnnotation | undefined; loading: boolean; saving: boolean; locked: boolean; onSave: (part: ExamPart, note: string, highlights: ReadingHighlight[]) => void }) {
  const passageRef = useRef<HTMLDivElement>(null);
  const noteDraftRef = useRef(annotation?.note ?? '');
  const setNoteDraft = useCallback((note: string) => { noteDraftRef.current = note; }, []);
  const highlights = useMemo(() => usableReadingHighlights(content, annotation?.highlights ?? []), [annotation?.highlights, content]);
  const [pendingHighlight, setPendingHighlight] = useState<ReadingHighlight | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  useEffect(() => { setPendingHighlight(null); setSelectionMessage(null); }, [content, part.id]);
  useEffect(() => { noteDraftRef.current = annotation?.note ?? ''; }, [annotation?.note, part.id]);

  const captureSelection = () => {
    if (locked || saving || loading) return;
    const root = passageRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const beforeStart = range.cloneRange();
    beforeStart.selectNodeContents(root);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange();
    beforeEnd.selectNodeContents(root);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    const rawStart = beforeStart.toString().length;
    const rawEnd = beforeEnd.toString().length;
    const rawQuote = content.slice(rawStart, rawEnd);
    const leadingWhitespace = rawQuote.length - rawQuote.trimStart().length;
    const trailingWhitespace = rawQuote.length - rawQuote.trimEnd().length;
    const start = rawStart + leadingWhitespace;
    const end = rawEnd - trailingWhitespace;
    const quote = content.slice(start, end);
    if (!quote) return;
    if (quote.length > 800) {
      setSelectionMessage('Bir martada 800 belgigacha bo‘lgan matnni belgilang.');
      return;
    }
    if (highlights.length >= 80) {
      setSelectionMessage('Bir passage uchun 80 tagacha belgi qo‘yish mumkin.');
      return;
    }
    if (highlights.some((highlight) => start < highlight.end && end > highlight.start)) {
      setSelectionMessage('Bu bo‘lak avvalgi belgi bilan ustma-ust keladi. Avval eski belgini o‘chiring.');
      return;
    }
    setPendingHighlight({ id: createReadingHighlightId(), start, end, quote });
    setSelectionMessage(null);
    selection.removeAllRanges();
  };

  const addHighlight = () => {
    if (!pendingHighlight || locked || saving || loading) return;
    onSave(part, noteDraftRef.current, [...highlights, pendingHighlight]);
    setPendingHighlight(null);
  };

  const removeHighlight = (highlightId: string, note: string) => {
    if (!locked && !saving) onSave(part, note, highlights.filter((highlight) => highlight.id !== highlightId));
  };

  const segments: Array<{ key: string; text: string; highlight?: ReadingHighlight }> = [];
  let cursor = 0;
  highlights.forEach((highlight) => {
    if (highlight.start > cursor) segments.push({ key: `text-${cursor}`, text: content.slice(cursor, highlight.start) });
    segments.push({ key: highlight.id, text: highlight.quote, highlight });
    cursor = highlight.end;
  });
  if (cursor < content.length || segments.length === 0) segments.push({ key: `text-${cursor}`, text: content.slice(cursor) });

  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reading passage</p>{!locked && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><Highlighter className="h-3.5 w-3.5" />{loading ? 'Eslatmalar yuklanmoqda' : 'Matnni tanlab belgilang'}</span>}</div><div ref={passageRef} tabIndex={0} onMouseUp={captureSelection} onKeyUp={captureSelection} className="whitespace-pre-wrap rounded-lg outline-none focus:ring-2 focus:ring-amber-200">{segments.map((segment) => segment.highlight ? <mark key={segment.key} className="rounded bg-amber-200 px-0.5 text-inherit decoration-amber-500 decoration-2 underline-offset-2">{segment.text}</mark> : <span key={segment.key}>{segment.text}</span>)}</div>{selectionMessage && <p className="mt-3 text-xs font-semibold text-error-700">{selectionMessage}</p>}{pendingHighlight && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><p className="min-w-0 flex-1 leading-relaxed text-amber-950"><span className="font-bold">Tanlangan:</span> {pendingHighlight.quote.length > 180 ? `${pendingHighlight.quote.slice(0, 180)}…` : pendingHighlight.quote}</p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setPendingHighlight(null)} className="btn-ghost bg-white px-3 py-2 text-xs">Bekor qilish</button><button type="button" disabled={saving || loading} onClick={addHighlight} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"><Highlighter className="h-3.5 w-3.5" />Belgi qo‘yish</button></div></div>}</article><ReadingNoteEditor part={part} annotation={annotation} highlights={highlights} loading={loading} saving={saving} locked={locked} canHighlight onSave={onSave} onRemoveHighlight={removeHighlight} onNoteChange={setNoteDraft} /></>;
}

function ReadingTwoColumnLayout({ partId, passage, questions }: { partId: string; passage: ReactNode; questions: ReactNode }) {
  const passageScrollRef = useRef<HTMLElement>(null);
  const questionsScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    passageScrollRef.current?.scrollTo({ top: 0 });
    questionsScrollRef.current?.scrollTo({ top: 0 });
  }, [partId]);

  return <div className="grid min-h-0 gap-5 lg:h-[calc(100dvh-25rem)] lg:grid-cols-2 lg:overflow-hidden lg:gap-0">
    <aside
      ref={passageScrollRef}
      className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:border-slate-200 lg:pr-6 xl:pr-8"
      style={{ scrollbarGutter: 'stable' }}
    >
      {passage}
    </aside>
    <section
      ref={questionsScrollRef}
      className="min-w-0 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-none lg:border-0 lg:bg-transparent lg:pl-6 lg:shadow-none xl:pl-8"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="mb-5 flex items-center gap-3 border-b border-indigo-100 pb-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><ClipboardList className="h-4.5 w-4.5" /></span><div><p className="text-sm font-bold text-slate-900">Savollar</p><p className="mt-0.5 text-xs text-slate-500">Passage chap tomonda qoladi. Savollarni o‘ng panelda alohida aylantiring.</p></div></div>
      {questions}
    </section>
  </div>;
}

function ReadingPart({ part, questions, answers, textAnswers, gapFillResponses, matchingConfig, matchingResponses, annotation, annotationsLoading, annotationSaving, cefrExam, locked, savingKey, onAnswer, onClearAnswer, onTextSave, onGapFillSave, onMatchingSave, onSaveAnnotation }: { part: ExamPart; questions: ContestWorkspace['questions']; answers: Record<string, number>; textAnswers: Record<string, string>; gapFillResponses: Record<string, GapFillResponse>; matchingConfig: MatchingWorkspaceConfig | undefined; matchingResponses: Record<string, MatchingResponse>; annotation: ReadingAnnotation | undefined; annotationsLoading: boolean; annotationSaving: boolean; cefrExam: boolean; locked: boolean; savingKey: string | null; onAnswer: (questionId: string, option: number) => void; onClearAnswer: (questionId: string) => void; onTextSave: (questionId: string, value: string) => void; onGapFillSave: (part: ExamPart, blankNumber: number, answer: string) => void; onMatchingSave: (part: ExamPart, speakerNumber: number, optionPosition: number) => void; onSaveAnnotation: (part: ExamPart, note: string, highlights: ReadingHighlight[]) => void }) {
  const gapFill = cefrExam && part.position === 1;
  const matching = cefrExam && (part.position === 2 || part.position === 3);
  const miniTextCompletion = cefrExam && part.position === 5;
  const ieltsPassageOneSplit = !cefrExam && part.position === 5 ? splitIeltsReadingPassageOneContent(part.content) : null;
  const ieltsPassageOneSharedText = Boolean(ieltsPassageOneSplit && hasIeltsReadingPassageOneSharedTextMarkers(ieltsPassageOneSplit.questionText));
  const ieltsPassageTwoStructured = !cefrExam && part.position === 6 && isIeltsReadingPassageTwoStructured(part.content);
  const ieltsPassageThreeStructured = !cefrExam && part.position === 7 && isIeltsReadingPassageThreeStructured(part.content);
  const ieltsStructuredReading = ieltsPassageTwoStructured || ieltsPassageThreeStructured;
  const matchingMode = part.position === 2 ? 'situations' as const : 'headings' as const;
  const objectiveQuestions = <ObjectiveQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} useStoredPosition />;
  const noteDraftRef = useRef(annotation?.note ?? '');
  const setNoteDraft = useCallback((note: string) => { noteDraftRef.current = note; }, []);
  useEffect(() => { noteDraftRef.current = annotation?.note ?? ''; }, [annotation?.note, part.id]);
  if (!cefrExam && part.position === 5 && (ieltsPassageOneSharedText || ieltsPassageOneSplit?.legacyQuestionTextOnly)) return <IeltsReadingPassageOneSharedText part={part} questions={questions} answers={answers} textAnswers={textAnswers} annotation={annotation} annotationsLoading={annotationsLoading} annotationSaving={annotationSaving} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} onSaveAnnotation={onSaveAnnotation} />;
  const annotationHighlights = usableReadingHighlights(part.content, annotation?.highlights ?? []);
  if (gapFill) return <ReadingTwoColumnLayout partId={part.id} passage={<><GapFillListeningText part={part} responses={gapFillResponses} locked={locked} savingKey={savingKey} highlights={annotationHighlights} annotationLoading={annotationsLoading} annotationSaving={annotationSaving} onSave={onGapFillSave} onAddHighlight={(highlight) => onSaveAnnotation(part, noteDraftRef.current, [...annotationHighlights, highlight])} /><ReadingNoteEditor part={part} annotation={annotation} highlights={annotationHighlights} loading={annotationsLoading} saving={annotationSaving} locked={locked} canHighlight onSave={onSaveAnnotation} onRemoveHighlight={(highlightId, note) => onSaveAnnotation(part, note, annotationHighlights.filter((highlight) => highlight.id !== highlightId))} onNoteChange={setNoteDraft} /></>} questions={<div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Javoblar matn ichida</p><p className="mt-1 text-xs">Chapdagi bo‘sh maydonlarni to‘ldiring; savollar passage ichiga joylashtirilgan.</p></div>} />;
  const questionPanel = ieltsPassageTwoStructured ? <IeltsReadingPassageTwoStructuredQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} onTextSave={onTextSave} /> : ieltsPassageThreeStructured ? <IeltsReadingPassageThreeStructuredQuestions questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onClearAnswer={onClearAnswer} onTextSave={onTextSave} /> : matching ? <><div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">{matchingMode === 'headings' ? 'Matching headings' : 'Statement → Situation matching'}</p><p className="mt-1 text-xs">{matchingMode === 'headings' ? '15–20-paragraf uchun mos headingni tanlang. 8 headingdan 2 tasi ortiqcha bo‘ladi.' : '7–14 — statementlar. Quyidagi javob bankidan mos situationni tanlang.'}</p></div><SpeakerMatchingListening part={part} config={matchingConfig} responses={matchingResponses} locked={locked} savingKey={savingKey} mapMode={false} readingMode={matchingMode} showPartContent={false} onSave={onMatchingSave} /></> : miniTextCompletion ? <CefrReadingPartFiveMiniTexts questions={questions} answers={answers} textAnswers={textAnswers} locked={locked} savingKey={savingKey} onAnswer={onAnswer} onTextSave={onTextSave} /> : objectiveQuestions;
  return <ReadingTwoColumnLayout partId={part.id} passage={<AnnotatableReadingPassage part={part} content={ieltsStructuredReading ? ieltsReadingPassageContent(part.content) : part.content} annotation={annotation} loading={annotationsLoading} saving={annotationSaving} locked={locked} onSave={onSaveAnnotation} />} questions={questionPanel} />;
}

function WritingPart({ part, draft, response, locked, saving, ieltsTask, onChange, onSave, onSubmit }: { part: ExamPart; draft: string; response: WritingResponse | undefined; locked: boolean; saving: boolean; ieltsTask: 1 | 2 | null; onChange: (value: string) => void; onSave: () => void; onSubmit: () => void }) {
  const submitted = Boolean(response?.submittedAt);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const minimumWords = ieltsTask === 1 ? 150 : ieltsTask === 2 ? 250 : 1;
  const enoughWords = wordCount >= minimumWords;
  const wordProgress = Math.min(100, Math.round((wordCount / minimumWords) * 100));
  const taskLabel = ieltsTask ? `IELTS Writing Task ${ieltsTask}` : 'Writing topic';
  return <><article className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700 sm:p-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{taskLabel}{ieltsTask === 2 ? ' · weight ×2' : ''}</p>{ieltsTask && <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-900">{ieltsTask === 1 ? 'Task 1: kamida 150 so‘z yozing. Grafik, jadval, chart yoki diagramdagi asosiy xususiyatlarni tasvirlang.' : 'Task 2: kamida 250 so‘z yozing. Pozitsiya, argument yoki muammoni to‘liq muhokama qiling; bu task Writing bahosida ikki baravar og‘irlikka ega.'}</div>}{part.imageUrl && <img src={part.imageUrl} alt={`${taskLabel} visual`} className="mb-5 h-auto w-full rounded-xl border border-slate-200 bg-white object-contain" />}<div className="whitespace-pre-wrap">{part.content}</div></article><div className="mt-6"><div className="mb-3 flex items-center justify-between gap-3"><label htmlFor={`writing-${part.id}`} className="text-sm font-bold text-slate-800">Javobingiz</label><span className={`shrink-0 text-xs font-semibold ${enoughWords ? 'text-success-700' : 'text-sun-700'}`}>{wordCount} / {minimumWords} so‘z</span></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Writing so‘zlar soni" aria-valuemin={0} aria-valuemax={minimumWords} aria-valuenow={Math.min(wordCount, minimumWords)}><div className={`h-full rounded-full transition-all ${enoughWords ? 'bg-success-500' : 'bg-sun-500'}`} style={{ width: `${wordProgress}%` }} /></div><textarea id={`writing-${part.id}`} value={draft} disabled={locked || submitted} onChange={(event) => onChange(event.target.value)} className="input min-h-72 resize-y leading-relaxed disabled:bg-slate-50" placeholder="Javobingizni shu yerga yozing…" />{!submitted && ieltsTask && !enoughWords && <p className="mt-2 text-xs font-semibold text-sun-700">Yuborishdan oldin kamida {minimumWords} so‘z yozing.</p>}{submitted ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-4 text-sm text-success-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Writing yuborilgan</p><p className="mt-1">Bu javob organizer tekshirganidan keyin yakuniy natijaga qo‘shiladi.</p></div></div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-relaxed text-slate-500">Draftni saqlang, tayyor bo‘lganda yuboring. Yuborilgach matn o‘zgarmaydi.</p><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={locked || saving || !draft.trim()} onClick={onSave} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Draftni saqlash</button><button type="button" disabled={locked || saving || !draft.trim() || !enoughWords} onClick={onSubmit} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Writingni yuborish</button></div></div>}</div></>;
}
