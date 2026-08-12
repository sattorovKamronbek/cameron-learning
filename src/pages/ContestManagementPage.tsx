import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  Archive,
  ClipboardList,
  Clock,
  Code2,
  Compass,
  FileAudio,
  Headphones,
  Loader2,
  Pencil,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { Link, useRouter } from '@/router';
import { useAccessControl } from '@/lib/access';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { AppSelect } from '@/components/AppSelect';
import { ManagementToast } from '@/components/ManagementToast';
import {
  archiveContest,
  contestSubjects,
  createContest,
  deleteContest,
  deleteExamPart,
  deleteContestQuestion,
  fetchContestEditor,
  fetchManagedContests,
  fetchWritingSubmissions,
  finalizeContest,
  formatContestDate,
  generatePrivateAccessCode,
  gradeWritingSubmission,
  publishContest,
  saveExamPart,
  saveContestQuestion,
  saveCefrGapFillAnswerKeys,
  saveCefrMatchingConfig,
  saveCefrMapImage,
  saveExamSectionTimings,
  uploadContestAudio,
  uploadContestImage,
  updateContest,
  type ContestDifficulty,
  type ContestEditor,
  type ContestInput,
  type ContestQuestionInput,
  type ContestType,
  type ContestVisibility,
  type ExamPart,
  type ExamPartInput,
  type ExamSectionTimings,
  type ExamSection,
  type GapFillAnswerKey,
  type MatchingEditorConfig,
  type EditorQuestion,
  type ManagedContest,
  type WritingSubmission,
} from '@/lib/contests';

type ContestForm = {
  title: string;
  description: string;
  subjectSlug: string;
  difficulty: ContestDifficulty;
  type: ContestType;
  visibility: ContestVisibility;
  privateAccessCode: string;
  startTime: string;
  endTime: string;
  maxParticipants: string;
  rulesText: string;
  tagsText: string;
  prize: string;
};

type QuestionForm = {
  id: string | null;
  partId: string | null;
  position: number;
  prompt: string;
  options: string[];
  correctOption: number | null;
  points: string;
  explanation: string;
};

type ExamPartForm = {
  id: string | null;
  position: number;
  section: ExamSection;
  title: string;
  instructions: string;
  content: string;
  audioUrl: string;
  imageUrl: string;
  maxPoints: string;
};

type WritingGradeForm = {
  score: string;
  feedback: string;
};

type ExamTimingForm = {
  listeningMinutes: string;
  readingMinutes: string;
  writingMinutes: string;
};

type CefrAudioCsvQuestion = {
  position: number;
  options: [string, string, string];
  correctOption: null;
  points: number;
  explanation: string;
};

// Programming contests use a separate problem-set and judge workflow. This
// page is deliberately for multiple-choice academic contests and exams.
const academicContestSubjects = contestSubjects.filter(([slug]) => slug !== 'programming');

function isEnglishExam(contest: Pick<ManagedContest, 'subjectSlug'> | null | undefined): boolean {
  return contest?.subjectSlug === 'ielts' || contest?.subjectSlug === 'cefr';
}

function localDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultContestForm(): ContestForm {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return {
    title: '',
    description: '',
    subjectSlug: 'science',
    difficulty: 'Medium',
    type: 'Unrated',
    visibility: 'Public',
    privateAccessCode: '',
    startTime: localDateTime(start),
    endTime: localDateTime(end),
    maxParticipants: '100',
    rulesText: '',
    tagsText: '',
    prize: '',
  };
}

function contestFormFrom(contest: ManagedContest): ContestForm {
  return {
    title: contest.title,
    description: contest.description,
    subjectSlug: contest.subjectSlug,
    difficulty: contest.difficulty,
    type: contest.type,
    visibility: contest.visibility,
    privateAccessCode: '',
    startTime: localDateTime(new Date(contest.startTime)),
    endTime: localDateTime(new Date(contest.endTime)),
    maxParticipants: String(contest.maxParticipants),
    rulesText: contest.rules.join('\n'),
    tagsText: contest.tags.join(', '),
    prize: contest.prize ?? '',
  };
}

function contestInput(form: ContestForm): ContestInput {
  return {
    title: form.title,
    description: form.description,
    subjectSlug: form.subjectSlug,
    difficulty: form.difficulty,
    type: form.type,
    visibility: form.visibility,
    privateAccessCode: form.privateAccessCode || null,
    startTime: form.startTime,
    endTime: form.endTime,
    maxParticipants: Number(form.maxParticipants),
    rules: form.rulesText.split('\n').map((item) => item.trim()).filter(Boolean),
    tags: form.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
    prize: form.prize,
  };
}

function emptyQuestion(position: number, partId: string | null = null): QuestionForm {
  return { id: null, partId, position, prompt: '', options: ['', '', '', ''], correctOption: 0, points: '1', explanation: '' };
}

function questionFormFrom(question: EditorQuestion): QuestionForm {
  return {
    id: question.id,
    partId: question.partId,
    position: question.position,
    prompt: question.prompt,
    options: question.options,
    correctOption: question.correctOption,
    points: String(question.points),
    explanation: question.explanation ?? '',
  };
}

function questionInput(form: QuestionForm, audioOnly = false): ContestQuestionInput {
  return {
    id: form.id,
    partId: form.partId,
    position: form.position,
    // CEFR Listening Part 1 asks the question in the recording. A short,
    // internal marker keeps the database audit trail intact while the
    // participant UI deliberately renders only the three answer choices.
    prompt: audioOnly ? `Audio ichidagi savol ${form.position}` : form.prompt,
    options: form.options,
    correctOption: form.correctOption,
    points: Number(form.points),
    explanation: form.explanation,
  };
}

function isCefrAudioOnlyPart(parts: ExamPart[], partId: string | null, cefrExam: boolean): boolean {
  const part = parts.find((item) => item.id === partId);
  return Boolean(cefrExam && part?.section === 'listening' && part.position === 1);
}

function isCefrGapFillPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && part.section === 'listening' && part.position === 2;
}

function isCefrMatchingPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && part.section === 'listening' && (part.position === 3 || part.position === 4);
}

function isCefrExtractPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && part.section === 'listening' && part.position === 5;
}

const CEFR_LISTENING_PARTS = [
  { position: 1, title: 'Short responses', description: 'Audio ichidagi 8 tagacha savol va A/B/C variantlar.' },
  { position: 2, title: 'Gap-fill', description: 'Matndagi bo‘sh joylarni audio asosida to‘ldirish.' },
  { position: 3, title: 'Speaker matching', description: 'Speakerlarni umumiy A/B/C… javob bankiga moslash.' },
  { position: 4, title: 'Map labelling', description: 'Xarita rasmi bo‘yicha joylarni harflarga moslash.' },
  { position: 5, title: 'Three extracts', description: '3 extract, har birida 2 tadan — jami 6 savol.' },
] as const;

function cefrListeningPartTemplate(position: number): Pick<ExamPartForm, 'title' | 'instructions'> {
  const part = CEFR_LISTENING_PARTS.find((item) => item.position === position);
  if (!part) return { title: `Part ${position}`, instructions: '' };
  const instructions: Record<number, string> = {
    1: 'Audio ichidagi savollarni tinglang va A, B yoki C variantini tanlang.',
    2: 'Audio asosida matndagi bo‘sh joylarni to‘ldiring.',
    3: 'Har bir speaker uchun mos javob harfini tanlang. Ayrim variantlar ortiqcha bo‘lishi mumkin.',
    4: 'Audio asosida xaritadagi harflardan mos joyni tanlang. Ayrim harflar ortiqcha bo‘lishi mumkin.',
    5: '3 ta extractni tinglang. Har bir extract uchun 2 tadan savolga javob bering.',
  };
  return { title: `Part ${position} — ${part.title}`, instructions: instructions[position] ?? '' };
}

function emptyCefrListeningPart(position: number): ExamPartForm {
  return { ...emptyExamPart(position), position, section: 'listening', ...cefrListeningPartTemplate(position) };
}

function gapFillBlankNumbers(content: string): number[] {
  const matches = Array.from(content.matchAll(/\{\{([1-9]\d*)\}\}/g), (match) => Number(match[1]));
  return [...new Set(matches)].sort((left, right) => left - right);
}

function csvDelimiter(source: string): string {
  const firstLine = source.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  return [',', ';', '\t'].reduce((best, candidate) => {
    const count = firstLine.split(candidate).length - 1;
    const bestCount = firstLine.split(best).length - 1;
    return count > bestCount ? candidate : best;
  }, ',');
}

function parseCsvRows(source: string): string[][] {
  const delimiter = csvDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index <= source.length; index += 1) {
    const character = source[index] ?? '\n';
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(value.trim());
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error('CSV ichida yopilmagan qo‘shtirnoq bor. Faylni Excel orqali CSV UTF-8 qilib qayta saqlang.');
  return rows;
}

function csvHeaderIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseCefrAudioCsv(source: string): CefrAudioCsvQuestion[] {
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new Error('CSV faylda sarlavha va kamida bitta savol qatori bo‘lishi kerak.');
  const headers = rows[0].map((item) => item.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const positionIndex = csvHeaderIndex(headers, ['question_number', 'question_no', 'position', 'number', 'savol_raqami']);
  const optionAIndex = csvHeaderIndex(headers, ['option_a', 'variant_a', 'a']);
  const optionBIndex = csvHeaderIndex(headers, ['option_b', 'variant_b', 'b']);
  const optionCIndex = csvHeaderIndex(headers, ['option_c', 'variant_c', 'c']);
  const pointsIndex = csvHeaderIndex(headers, ['points', 'ball']);
  const explanationIndex = csvHeaderIndex(headers, ['explanation', 'izoh']);
  if ([positionIndex, optionAIndex, optionBIndex, optionCIndex].some((index) => index < 0)) {
    throw new Error('CSV sarlavhasi noto‘g‘ri. Kerakli ustunlar: question_number, option_a, option_b, option_c.');
  }

  const seenPositions = new Set<number>();
  const questions = rows.slice(1).map((row, offset) => {
    const rowNumber = offset + 2;
    const position = Number(row[positionIndex]);
    const options = [row[optionAIndex]?.trim(), row[optionBIndex]?.trim(), row[optionCIndex]?.trim()];
    const points = pointsIndex < 0 || !row[pointsIndex]?.trim() ? 1 : Number(row[pointsIndex]);
    if (!Number.isInteger(position) || position < 1) throw new Error(`${rowNumber}-qatorda question_number 1 yoki undan katta butun son bo‘lishi kerak.`);
    if (seenPositions.has(position)) throw new Error(`${rowNumber}-qatorda ${position}-savol takrorlangan.`);
    if (options.some((option) => !option)) throw new Error(`${rowNumber}-qatorda A, B va C variantlarining hammasini to‘ldiring.`);
    if (!Number.isInteger(points) || points < 1 || points > 1000) throw new Error(`${rowNumber}-qatorda points 1–1000 oralig‘idagi butun son bo‘lishi kerak.`);
    seenPositions.add(position);
    return { position, options: options as [string, string, string], correctOption: null, points, explanation: explanationIndex < 0 ? '' : (row[explanationIndex] ?? '').trim() };
  });
  if (questions.length > 8) throw new Error('CEFR Listening Part 1 uchun bir importda ko‘pi bilan 8 ta savol yuklash mumkin.');
  return questions.sort((left, right) => left.position - right.position);
}

function emptyExamPart(position: number): ExamPartForm {
  return {
    id: null,
    position,
    section: 'listening',
    title: '',
    instructions: '',
    content: '',
    audioUrl: '',
    imageUrl: '',
    maxPoints: '20',
  };
}

function examPartFormFrom(part: ExamPart): ExamPartForm {
  return {
    id: part.id,
    position: part.position,
    section: part.section,
    title: part.title,
    instructions: part.instructions,
    content: part.content,
    audioUrl: part.audioUrl ?? '',
    imageUrl: part.imageUrl ?? '',
    maxPoints: String(part.maxPoints || 20),
  };
}

function examPartInput(form: ExamPartForm, audioUrl: string): ExamPartInput {
  return {
    id: form.id,
    position: form.position,
    section: form.section,
    title: form.title,
    instructions: form.instructions,
    content: form.content,
    audioUrl,
    maxPoints: form.section === 'writing' ? Number(form.maxPoints) : 0,
  };
}

function writingGradeFormFrom(submission: WritingSubmission): WritingGradeForm {
  return { score: submission.score === null ? '' : String(submission.score), feedback: submission.feedback ?? '' };
}

function defaultExamTimingForm(): ExamTimingForm {
  return { listeningMinutes: '35', readingMinutes: '30', writingMinutes: '25' };
}

function examTimingFormFrom(timings: ExamSectionTimings | null): ExamTimingForm {
  if (!timings) return defaultExamTimingForm();
  return {
    listeningMinutes: String(timings.listeningMinutes),
    readingMinutes: String(timings.readingMinutes),
    writingMinutes: String(timings.writingMinutes),
  };
}

function displayDate(value: string): string {
  const result = formatContestDate(value);
  return `${result.date} · ${result.time}`;
}

export function ContestManagementPage() {
  const { adminAccess } = useAccessControl();
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [contests, setContests] = useState<ManagedContest[]>([]);
  const [editor, setEditor] = useState<ContestEditor | null>(null);
  const [form, setForm] = useState<ContestForm>(defaultContestForm);
  const [question, setQuestion] = useState<QuestionForm>(emptyQuestion(1));
  const [examPart, setExamPart] = useState<ExamPartForm>(emptyExamPart(1));
  const [examTiming, setExamTiming] = useState<ExamTimingForm>(defaultExamTimingForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [mapImageFile, setMapImageFile] = useState<File | null>(null);
  const [activeCefrListeningPart, setActiveCefrListeningPart] = useState<number | null>(1);
  const [writingSubmissions, setWritingSubmissions] = useState<WritingSubmission[]>([]);
  const [writingGrades, setWritingGrades] = useState<Record<string, WritingGradeForm>>({});
  const [loading, setLoading] = useState(true);
  const [editorLoading, setEditorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newContest, setNewContest] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContests(await fetchManagedContests());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Contestlar yuklanmadi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadEditor = useCallback(async (contestId: string, syncForm = true) => {
    setEditorLoading(true);
    setError(null);
    try {
      const next = await fetchContestEditor(contestId);
      setEditor(next);
      if (syncForm) setForm(contestFormFrom(next.contest));
      const firstObjectivePart = next.parts.find((part) => part.section !== 'writing')?.id ?? null;
      setQuestion(emptyQuestion(next.questions.length + 1, firstObjectivePart));
      setExamPart(emptyExamPart(next.parts.length + 1));
      setExamTiming(examTimingFormFrom(next.sectionTimings));
      setAudioFile(null);
      setMapImageFile(null);
      if (syncForm) setActiveCefrListeningPart(next.contest.subjectSlug === 'cefr' ? 1 : null);
      if (isEnglishExam(next.contest) && next.contest.status === 'Finished') {
        const submissions = await fetchWritingSubmissions(contestId);
        setWritingSubmissions(submissions);
        setWritingGrades(Object.fromEntries(submissions.map((submission) => [submission.id, writingGradeFormFrom(submission)])));
      } else {
        setWritingSubmissions([]);
        setWritingGrades({});
      }
      setNewContest(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Contest tahrirlovchisi ochilmadi.');
    } finally {
      setEditorLoading(false);
    }
  }, []);

  const selectContest = (contest: ManagedContest) => {
    if (contest.subjectSlug === 'programming') {
      navigate('/programming-management');
      return;
    }
    void loadEditor(contest.id);
  };

  const openNewContest = () => {
    setNewContest(true);
    setEditor(null);
    setForm(defaultContestForm());
    setQuestion(emptyQuestion(1));
    setExamPart(emptyExamPart(1));
    setExamTiming(defaultExamTimingForm());
    setAudioFile(null);
    setMapImageFile(null);
    setActiveCefrListeningPart(1);
    setWritingSubmissions([]);
    setWritingGrades({});
    setError(null);
    setNotice(null);
  };

  const run = async (key: string, work: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await work();
      setNotice(success);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Amal bajarilmadi.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveContest = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Contest nomini kiriting.');
      return;
    }
    if (form.visibility === 'Private' && newContest && form.privateAccessCode.trim().length < 10) {
      setError('Private contest uchun kamida 10 belgili access code kiriting.');
      return;
    }

    await run('contest', async () => {
      const input = contestInput(form);
      if (newContest) {
        const id = await createContest(input);
        await refresh();
        await loadEditor(id);
      } else if (editor) {
        await updateContest(editor.contest.id, input);
        await refresh();
        await loadEditor(editor.contest.id);
      }
    }, newContest ? 'Draft contest yaratildi. Endi haqiqiy savollarni kiriting.' : 'Contest ma’lumotlari saqlandi.');
  };

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    const cefrAudioOnly = isCefrAudioOnlyPart(editor.parts, question.partId, currentContest?.subjectSlug === 'cefr');
    if ((!cefrAudioOnly && !question.prompt.trim()) || question.options.some((item) => !item.trim())) {
      setError('Savol matni va barcha variantlarni to‘ldiring.');
      return;
    }
    if (isEnglishExam(currentContest) && !question.partId) {
      setError('Listening yoki Reading partini tanlang.');
      return;
    }
    if (cefrAudioOnly && question.options.length !== 3) {
      setError('CEFR Listening Part 1 uchun aynan 3 ta variant kiriting.');
      return;
    }
    const questionPart = editor.parts.find((part) => part.id === question.partId);
    if (questionPart && isCefrExtractPart(questionPart, currentContest?.subjectSlug === 'cefr') && (!Number.isInteger(question.position) || question.position < 1 || question.position > 6)) {
      setError('CEFR Listening Part 5 uchun savol raqami 1 dan 6 gacha bo‘lishi kerak.');
      return;
    }

    await run('question', async () => {
      await saveContestQuestion(editor.contest.id, questionInput(question, cefrAudioOnly));
      await refresh();
      await loadEditor(editor.contest.id, false);
    }, question.id ? 'Savol yangilandi.' : 'Savol saqlandi.');
  };

  const importCefrPartOneQuestions = async (partId: string, rows: CefrAudioCsvQuestion[]) => {
    if (!editor || !currentContest || !isCefrAudioOnlyPart(editor.parts, partId, currentContest.subjectSlug === 'cefr')) {
      setError('CSV faqat CEFR Listening Part 1 uchun yuklanadi.');
      return false;
    }
    return run('cefr-csv-import', async () => {
      for (const row of rows) {
        const existing = editor.questions.find((item) => item.partId === partId && item.position === row.position);
        await saveContestQuestion(editor.contest.id, questionInput({
          id: existing?.id ?? null,
          partId,
          position: row.position,
          prompt: '',
          options: row.options,
          correctOption: row.correctOption,
          points: String(row.points),
          explanation: row.explanation,
        }, true));
      }
      await refresh();
      await loadEditor(editor.contest.id, false);
    }, `${rows.length} ta CEFR Listening Part 1 savoli CSV fayldan saqlandi.`);
  };

  const saveExamPartForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentContest) return;
    const partToSave = currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null
      ? { ...examPart, position: activeCefrListeningPart, section: 'listening' as const }
      : examPart;
    if (!partToSave.title.trim()) return setError('Part nomini kiriting.');
    if (partToSave.section === 'writing' && (!partToSave.content.trim() || Number(partToSave.maxPoints) < 1)) {
      return setError('Writing uchun topic va maksimal ballni kiriting.');
    }
    await run('exam-part', async () => {
      let audioUrl = partToSave.audioUrl;
      if (audioFile) audioUrl = await uploadContestAudio(currentContest.id, audioFile);
      const partId = await saveExamPart(currentContest.id, examPartInput(partToSave, audioUrl));
      if (currentContest.subjectSlug === 'cefr' && partToSave.section === 'listening' && partToSave.position === 4) {
        const imageUrl = mapImageFile ? await uploadContestImage(currentContest.id, mapImageFile) : partToSave.imageUrl;
        await saveCefrMapImage(currentContest.id, partId, imageUrl || null);
      }
      await refresh();
      await loadEditor(currentContest.id, false);
    }, partToSave.id ? 'Exam parti yangilandi.' : 'Yangi exam parti qo‘shildi.');
  };

  const saveExamTiming = async () => {
    if (!currentContest) return;
    const input: ExamSectionTimings = {
      listeningMinutes: Number(examTiming.listeningMinutes),
      readingMinutes: Number(examTiming.readingMinutes),
      writingMinutes: Number(examTiming.writingMinutes),
    };
    const contestMinutes = Math.round((new Date(currentContest.endTime).getTime() - new Date(currentContest.startTime).getTime()) / 60_000);
    if (![input.listeningMinutes, input.readingMinutes, input.writingMinutes].every((minutes) => Number.isInteger(minutes) && minutes > 0)) {
      setError('Har bir bo‘lim uchun butun va musbat minut kiriting.');
      return;
    }
    if (input.listeningMinutes + input.readingMinutes + input.writingMinutes !== contestMinutes) {
      setError(`Bo‘limlar jami ${contestMinutes} minut bo‘lishi shart.`);
      return;
    }
    await run('exam-timing', async () => {
      await saveExamSectionTimings(currentContest.id, input);
      await loadEditor(currentContest.id, false);
    }, 'Listening, Reading va Writing vaqtlari saqlandi.');
  };

  const saveGapFillAnswerKeys = async (partId: string, keys: GapFillAnswerKey[]) => {
    if (!editor || !currentContest) return false;
    return run('gap-fill-keys', async () => {
      await saveCefrGapFillAnswerKeys(currentContest.id, partId, keys);
      await loadEditor(currentContest.id, false);
    }, 'CEFR Part 2 javob kaliti saqlandi.');
  };

  const saveMatchingConfig = async (partId: string, config: Omit<MatchingEditorConfig, 'partId'>) => {
    if (!currentContest) return false;
    return run('matching-config', async () => {
      await saveCefrMatchingConfig(currentContest.id, partId, config);
      await loadEditor(currentContest.id, false);
    }, `CEFR Part ${activeCefrListeningPart ?? ''} matching kaliti saqlandi.`);
  };

  const removeExamPart = async (partId: string) => {
    if (!currentContest || !window.confirm('Bu partni o‘chirasizmi? Avval uning savollarini o‘chirish talab qilinishi mumkin.')) return;
    await run(`delete-part:${partId}`, async () => {
      await deleteExamPart(currentContest.id, partId);
      await refresh();
      await loadEditor(currentContest.id, false);
    }, 'Exam parti o‘chirildi.');
  };

  const saveWritingGrade = async (submission: WritingSubmission) => {
    const grade = writingGrades[submission.id] ?? writingGradeFormFrom(submission);
    const score = Number(grade.score);
    if (!Number.isInteger(score) || score < 0 || score > submission.maxPoints) {
      setError(`Ball 0 va ${submission.maxPoints} oralig‘ida bo‘lishi kerak.`);
      return;
    }
    await run(`grade:${submission.id}`, async () => {
      await gradeWritingSubmission(submission.id, score, grade.feedback);
      if (currentContest) await loadEditor(currentContest.id, false);
    }, 'Writing bahosi saqlandi.');
  };

  const currentContest = editor?.contest ?? null;
  const academicContests = useMemo(() => contests.filter((contest) => contest.subjectSlug !== 'programming'), [contests]);
  const englishExam = isEnglishExam(currentContest);
  const languageExamCount = academicContests.filter((contest) => isEnglishExam(contest)).length;
  const draftCount = academicContests.filter((contest) => !contest.isPublished && !contest.archivedAt).length;
  const editable = Boolean(currentContest && !currentContest.isPublished && currentContest.status === 'Upcoming');
  const ungradedWritingCount = writingSubmissions.filter((submission) => submission.score === null).length;
  const canFinalize = Boolean(
    currentContest
      && currentContest.isPublished
      && currentContest.status === 'Finished'
      && !currentContest.isFinalized
      && (currentContest.type === 'Unrated' || adminAccess)
      && (!englishExam || ungradedWritingCount === 0),
  );
  const questionCount = editor?.questions.length ?? 0;
  const isBusy = busy !== null;
  const focusedCefrPart = currentContest?.subjectSlug === 'cefr' && activeCefrListeningPart !== null
    ? editor?.parts.find((part) => part.section === 'listening' && part.position === activeCefrListeningPart) ?? null
    : null;
  const focusedCefrQuestions = focusedCefrPart
    ? (editor?.questions.filter((item) => item.partId === focusedCefrPart.id) ?? [])
    : (editor?.questions ?? []);

  const openCefrListeningPart = (position: number | null) => {
    setActiveCefrListeningPart(position);
    setAudioFile(null);
    setMapImageFile(null);
    if (position === null) {
      setExamPart(emptyExamPart((editor?.parts.length ?? 0) + 1));
      return;
    }
    const existing = editor?.parts.find((part) => part.section === 'listening' && part.position === position);
    setExamPart(existing ? examPartFormFrom(existing) : emptyCefrListeningPart(position));
    setQuestion(emptyQuestion(1, position === 5 ? null : existing?.id ?? null));
  };

  const publish = async () => {
    if (!currentContest || questionCount === 0 || !window.confirm('Contestni e’lon qilasizmi? E’lon qilingandan keyin savollar va jadvalni o‘zgartirib bo‘lmaydi.')) return;
    await run('publish', async () => {
      await publishContest(currentContest.id);
      await refresh();
      await loadEditor(currentContest.id);
    }, 'Contest e’lon qilindi.');
  };

  const finalize = async () => {
    if (!currentContest || !window.confirm('Contest natijalari va ratinglarini yakunlaysizmi? Bu amal qaytarilmaydi.')) return;
    await run('finalize', async () => {
      await finalizeContest(currentContest.id);
      await refresh();
      await loadEditor(currentContest.id);
    }, 'Contest natijalari serverda yakunlandi.');
  };

  const archive = async () => {
    if (!currentContest || !window.confirm('Contestni arxivlaysizmi? U ommaviy ro‘yxatdan yashiriladi.')) return;
    await run('archive', async () => {
      await archiveContest(currentContest.id);
      await refresh();
      openNewContest();
    }, 'Contest arxivlandi.');
  };

  const removeContest = async () => {
    if (!currentContest || !window.confirm('Draft contestni butunlay o‘chirasizmi? Savollar va partlar ham o‘chadi; bu amal qaytarilmaydi.')) return;
    await run('delete-contest', async () => {
      await deleteContest(currentContest.id);
      await refresh();
      openNewContest();
    }, 'Draft contest o‘chirildi.');
  };

  const deleteQuestion = async (questionId: string) => {
    if (!currentContest || !window.confirm('Bu savolni o‘chirasizmi?')) return;
    await run(`delete:${questionId}`, async () => {
      await deleteContestQuestion(currentContest.id, questionId);
      await refresh();
      await loadEditor(currentContest.id, false);
    }, 'Savol o‘chirildi.');
  };

  const contestSummary = useMemo(() => {
    if (!currentContest) return null;
    const parts = englishExam ? ` · ${editor?.parts.length ?? 0} ta exam part` : '';
    return `${currentContest.questionCount} savol${parts} · ${currentContest.participants} ro‘yxatdan o‘tgan`;
  }, [currentContest, editor?.parts.length, englishExam]);

  if (profile?.role === 'judge') {
    return <div className="container-page py-32"><div className="card mx-auto max-w-2xl p-8 text-center"><Code2 className="mx-auto h-10 w-10 text-indigo-600" /><h1 className="mt-4 text-xl font-bold text-slate-900">Judge uchun Gym studio</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Judge faqat unrated Gym contest yaratishi mumkin. Academic Rated/Unrated contestlar faqat tasdiqlangan admin tomonidan yaratiladi.</p><Link to="/programming-management" className="btn-primary mt-6">Programming Gym studio’ga o‘tish</Link></div></div>;
  }

  return (
    <div className="management-canvas min-h-screen">
      <ManagementToast message={error ?? notice} kind={error ? 'error' : 'success'} onDismiss={() => { setError(null); setNotice(null); }} />
      <section className="workspace-hero pt-28">
        <div className="workspace-hero-content py-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100 ring-1 ring-cyan-200/20"><ShieldCheck className="h-3.5 w-3.5" />Academic & Language studio</span>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Test, olimpiada va til imtihonlarini aniq oqimda tuzing</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Science uchun oddiy savol oqimini, IELTS/CEFR uchun esa Listening audio, Reading passage va keyin baholanadigan Writing’ni bitta tushunarli ish maydonida yarating.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="font-display text-2xl font-extrabold">{loading ? '—' : academicContests.length}</p><p className="mt-1 text-xs text-slate-300">Academic contestlar</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="font-display text-2xl font-extrabold">{loading ? '—' : languageExamCount}</p><p className="mt-1 text-xs text-slate-300">IELTS / CEFR examlar</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="font-display text-2xl font-extrabold">{loading ? '—' : draftCount}</p><p className="mt-1 text-xs text-slate-300">Tayyorlanayotgan draft</p></div>
            </div>
          </div>
          <div className="workspace-switcher mt-8 max-w-3xl">
            <div className="workspace-switcher-item workspace-switcher-item-active"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-100"><Compass className="h-5 w-5" /></span><span><span className="block text-sm font-bold">Academic & Language studio</span><span className="mt-1 block text-xs leading-relaxed text-slate-200">Science testlari, IELTS/CEFR exam partlari va writing baholash oqimi.</span></span></div>
            <Link to="/programming-management" className="workspace-switcher-item"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-100"><Code2 className="h-5 w-5" /></span><span><span className="block text-sm font-bold">Programming studio</span><span className="mt-1 block text-xs leading-relaxed text-slate-300">Programming contest jadvali, alohida task banki va judge testlari.</span></span></Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><Link to="/contests" className="btn border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">Ommaviy contestlarni ko‘rish</Link><button type="button" onClick={() => void refresh()} disabled={loading || isBusy} className="btn border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Yangilash</button><button type="button" onClick={openNewContest} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" />Yangi contest</button></div>
        </div>
      </section>

      <main className="container-page py-8">
        <div className="grid gap-7 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="card h-fit overflow-hidden xl:sticky xl:top-24">
            <div className="border-b border-slate-100 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">Academic navigator</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Science va til contestini tanlang. Programming alohida studio’da.</p></div><span className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{academicContests.length}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-cyan-50 p-2.5"><p className="text-lg font-extrabold text-cyan-700">{languageExamCount}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700/70">Til examlari</p></div><div className="rounded-xl bg-sun-50 p-2.5"><p className="text-lg font-extrabold text-sun-700">{draftCount}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-sun-700/70">Draft</p></div></div></div>
            {loading ? <div className="p-6"><LoadingState message="Yuklanmoqda" /></div> : academicContests.length ? <div className="max-h-[65vh] overflow-y-auto">{academicContests.map((contest) => <button key={contest.id} type="button" onClick={() => selectContest(contest)} className={`workspace-list-item w-full ${currentContest?.id === contest.id ? 'workspace-list-item-active' : ''}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold text-slate-800">{contest.title}</p><StatusPill contest={contest} /></div><p className="mt-2 text-xs font-semibold text-indigo-600">{contest.subject}</p><p className="mt-1 text-xs text-slate-500">{displayDate(contest.startTime)}</p><p className="mt-1 text-xs text-slate-400">{contest.questionCount} savol · {contest.participants} ishtirokchi</p></button>)}</div> : <div className="p-6 text-center"><ClipboardList className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Academic contest hali yo‘q</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Yangi draft yarating, savollarni qo‘shing va keyin e’lon qiling.</p></div>}
          </aside>

          <div className="min-w-0 space-y-7">
            <section className="card overflow-hidden">
              <div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{newContest ? 'New draft' : 'Contest settings'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{newContest ? 'Yangi contest yaratish' : currentContest?.title}</h2><p className="mt-1 text-sm text-slate-500">{newContest ? 'Fan tanlang va asosiy jadvalni belgilang. Programming contestlar Programming studio’da yaratiladi.' : contestSummary}</p></div>{currentContest && <StatusPill contest={currentContest} large />}</div>
              {editorLoading ? <LoadingState className="min-h-72" message="Tahrirlovchi yuklanmoqda" /> : <ContestFormFields form={form} setForm={setForm} disabled={!newContest && !editable} onSubmit={saveContest} busy={busy === 'contest'} isNew={newContest} canCreateRated={adminAccess} />}
            </section>

            {currentContest && (
              <>
                {englishExam && (
                  <><section className="workspace-callout"><div className="flex flex-wrap items-start gap-3"><Headphones className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><p className="font-bold">{currentContest.subjectSlug === 'cefr' ? 'CEFR Listening studio' : 'IELTS oqimi'}</p><p className="mt-1 leading-relaxed text-indigo-900/80">{currentContest.subjectSlug === 'cefr' ? 'Avval kerakli Partni tanlang. Har Part o‘zining kichik, alohida ish maydonida ochiladi — faqat shu Part uchun kerakli audio, savol va javob kalitini ko‘rasiz.' : '1. Listening uchun audio biriktiring. 2. Reading uchun passage yozing. 3. Har bir objective partga savol ulang. 4. Writing javoblari contest tugagach alohida baholanadi.'}</p></div></div></section>{currentContest.subjectSlug === 'cefr' && <CefrListeningPartNavigator parts={editor?.parts ?? []} activePart={activeCefrListeningPart} onSelect={openCefrListeningPart} />}{(currentContest.subjectSlug !== 'cefr' || activeCefrListeningPart === null) && <ExamSectionTimingSection form={examTiming} setForm={setExamTiming} contest={currentContest} savedTimings={editor?.sectionTimings ?? null} editable={editable} busy={busy === 'exam-timing'} onSave={() => void saveExamTiming()} />}<ExamPartsSection
                    parts={editor?.parts ?? []}
                    form={examPart}
                    setForm={setExamPart}
                    audioFile={audioFile}
                    setAudioFile={setAudioFile}
                    mapImageFile={mapImageFile}
                    setMapImageFile={setMapImageFile}
                    editable={editable}
                    cefrExam={currentContest.subjectSlug === 'cefr'}
                    activeCefrListeningPart={currentContest.subjectSlug === 'cefr' ? activeCefrListeningPart : null}
                    busy={busy}
                    onSubmit={saveExamPartForm}
                    onNew={() => { const position = currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null ? activeCefrListeningPart : (editor?.parts.length ?? 0) + 1; setExamPart(currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null ? emptyCefrListeningPart(position) : emptyExamPart(position)); setAudioFile(null); setMapImageFile(null); }}
                    onEdit={(part) => { setExamPart(examPartFormFrom(part)); setAudioFile(null); setMapImageFile(null); }}
                    onDelete={(partId) => void removeExamPart(partId)}
                  /></>
                )}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 2 && <CefrGapFillAnswerKeySection parts={editor?.parts ?? []} answerKeys={editor?.gapFillAnswerKeys ?? []} busy={busy === 'gap-fill-keys'} onSave={saveGapFillAnswerKeys} />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 3 && <CefrMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 4 && <CefrMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} partPosition={4} mapMode />}
                {currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 5 ? <CefrPartFiveQuestions part={focusedCefrPart} questions={focusedCefrQuestions} form={question} setForm={setQuestion} parts={editor?.parts ?? []} editable={editable} busy={busy} editingId={question.id} onSave={saveQuestion} onEdit={(item) => setQuestion(questionFormFrom(item))} onDelete={(questionId) => void deleteQuestion(questionId)} /> : (currentContest.subjectSlug !== 'cefr' || activeCefrListeningPart === null || activeCefrListeningPart === 1) && <section className="card overflow-hidden">
                  <div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{currentContest.subjectSlug === 'cefr' ? 'CEFR · Listening Part 1' : 'Real questions'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{currentContest.subjectSlug === 'cefr' ? 'Part 1 — A/B/C savollari' : englishExam ? 'Listening va Reading savollari' : 'Savollar'} ({currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length : questionCount})</h2><p className="mt-1 text-sm text-slate-500">{currentContest.subjectSlug === 'cefr' ? 'Bu ixcham sahifada faqat Part 1 audio variantlari va ularning javob kalitlari turadi.' : 'To‘g‘ri javoblar faqat shu himoyalangan editor va serverda saqlanadi.'}</p></div>{editable && <button type="button" onClick={() => setQuestion(emptyQuestion(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length + 1 : questionCount + 1, currentContest.subjectSlug === 'cefr' ? focusedCefrPart?.id ?? null : editor?.parts.find((part) => part.section !== 'writing')?.id ?? null))} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Savol qo‘shish</button>}</div>
                  {editable && currentContest.subjectSlug === 'cefr' && <CefrPartOneCsvImporter parts={editor?.parts ?? []} busy={busy === 'cefr-csv-import'} onImport={importCefrPartOneQuestions} />}
                  {(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions : editor?.questions ?? []).length ? <div className="divide-y divide-slate-100">{(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions : editor?.questions ?? []).map((item) => <div key={item.id}><QuestionRow question={item} parts={editor?.parts ?? []} cefrExam={currentContest.subjectSlug === 'cefr'} editable={editable} editing={question.id === item.id} busy={busy === `delete:${item.id}`} onEdit={() => setQuestion(questionFormFrom(item))} onDelete={() => void deleteQuestion(item.id)} />{editable && question.id === item.id && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} englishExam={englishExam} cefrExam={currentContest.subjectSlug === 'cefr'} parts={editor?.parts ?? []} fixedPart={currentContest.subjectSlug === 'cefr' ? focusedCefrPart ?? undefined : undefined} onCancel={() => setQuestion(emptyQuestion(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length + 1 : questionCount + 1, currentContest.subjectSlug === 'cefr' ? focusedCefrPart?.id ?? null : editor?.parts.find((part) => part.section !== 'writing')?.id ?? null))} />}</div>)}</div> : <div className="p-6 text-sm text-slate-500">{currentContest.subjectSlug === 'cefr' ? 'Part 1 savollari hali yo‘q. CSV import qiling yoki bittalab qo‘shing.' : 'Savol yo‘q. Contest e’lon qilinishidan oldin kamida bitta to‘liq savol qo‘shilishi shart.'}</div>}
                  {editable && !question.id && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} englishExam={englishExam} cefrExam={currentContest.subjectSlug === 'cefr'} parts={editor?.parts ?? []} fixedPart={currentContest.subjectSlug === 'cefr' ? focusedCefrPart ?? undefined : undefined} />}
                  {!editable && <div className="border-t border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">{currentContest.isPublished ? 'E’lon qilingan contest savollari o‘zgarmaydi.' : 'Boshlangan contest savollari o‘zgarmaydi.'}</div>}
                </section>}

                {englishExam && currentContest.status === 'Finished' && <WritingReviewSection submissions={writingSubmissions} grades={writingGrades} setGrades={setWritingGrades} busy={busy} finalized={currentContest.isFinalized} onGrade={saveWritingGrade} />}

                <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-bold text-slate-900">Contest holati</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">E’lon qilinganidan keyin contest ommaviy ro‘yxatda chiqadi. Tugagan rated contest faqat tasdiqlangan admin yakunlagach foydalanuvchilarning haqiqiy ratingiga ta’sir qiladi.</p>{englishExam && currentContest.status === 'Finished' && ungradedWritingCount > 0 && <p className="mt-2 text-xs font-semibold text-sun-700">{ungradedWritingCount} ta writing hali baholanmagan. Reyting va yakuniy natijalar shu baholar kiritilguncha kutadi.</p>}{currentContest.type === 'Rated' && !adminAccess && <p className="mt-2 text-xs font-medium text-slate-500">Rated contest natijasini yakunlash admin tasdiqlovini talab qiladi.</p>}</div><div className="flex flex-wrap gap-2">{editable && <button type="button" onClick={() => void publish()} disabled={questionCount === 0 || isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Send className="h-4 w-4" />E’lon qilish</button>}{canFinalize && <button type="button" onClick={() => void finalize()} disabled={isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Trophy className="h-4 w-4" />Natijani yakunlash</button>}{editable && <button type="button" onClick={() => void removeContest()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />O‘chirish</button>}{!currentContest.archivedAt && <button type="button" onClick={() => void archive()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Archive className="h-4 w-4" />Arxivlash</button>}</div></div></section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusPill({ contest, large = false }: { contest: ManagedContest; large?: boolean }) {
  const label = contest.archivedAt ? 'Arxiv' : contest.isFinalized ? 'Yakunlangan' : contest.isPublished ? contest.status : 'Draft';
  const color = contest.archivedAt ? 'bg-slate-100 text-slate-600' : contest.isFinalized ? 'bg-success-50 text-success-700' : contest.isPublished && contest.status === 'Live' ? 'bg-error-50 text-error-700' : contest.isPublished ? 'bg-indigo-50 text-indigo-700' : 'bg-sun-50 text-sun-700';
  return <span className={`shrink-0 rounded-full font-bold ${large ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[10px]'} ${color}`}>{label}</span>;
}

function ContestFormFields({ form, setForm, disabled, onSubmit, busy, isNew, canCreateRated }: { form: ContestForm; setForm: Dispatch<SetStateAction<ContestForm>>; disabled: boolean; onSubmit: (event: FormEvent) => void; busy: boolean; isNew: boolean; canCreateRated: boolean }) {
  const update = <K extends keyof ContestForm>(key: K, value: ContestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateVisibility = (visibility: ContestVisibility) => setForm((current) => ({
    ...current,
    visibility,
    privateAccessCode: visibility === 'Private' && (isNew || current.visibility !== 'Private')
      ? current.privateAccessCode || generatePrivateAccessCode()
      : current.privateAccessCode,
  }));
  return (
    <form onSubmit={onSubmit} className="p-5 sm:p-6">
      {disabled && <div className="mb-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">E’lon qilingan yoki boshlangan contestning jadvali va tavsifi o‘zgartirilmaydi.</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Contest nomi" className="md:col-span-2"><input required value={form.title} disabled={disabled} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: August Mathematics Challenge" /></Field>
        <Field label="Tavsif" className="md:col-span-2"><textarea value={form.description} disabled={disabled} onChange={(event) => update('description', event.target.value)} className="input min-h-28 resize-y" placeholder="Contest maqsadi va qatnashuvchilar bilishi kerak bo‘lgan ma’lumotlar" /></Field>
        <Field label="Fan yoki imtihon"><AppSelect value={form.subjectSlug} disabled={disabled} onChange={(value) => update('subjectSlug', value)} options={academicContestSubjects.map(([value, label]) => ({ value, label }))} ariaLabel="Fan yoki imtihon" /><p className="mt-1.5 text-xs text-slate-500">Programming contestlarni maxsus programming boshqaruvida yarating.</p></Field>
        <Field label="Turi"><AppSelect value={form.type} disabled={disabled} onChange={(value) => update('type', value as ContestType)} options={[{ value: 'Unrated', label: 'Unrated', description: 'Ratingga ta’sir qilmaydi' }, { value: 'Rated', label: 'Rated', description: 'Yakunlangach ratingga ta’sir qiladi', disabled: !canCreateRated }]} ariaLabel="Contest turi" />{!canCreateRated && <p className="mt-1.5 text-xs text-slate-500">Rated contestlarni faqat tasdiqlangan admin yaratadi.</p>}</Field>
        <Field label="Kirish"><AppSelect value={form.visibility} disabled={disabled} onChange={(value) => updateVisibility(value as ContestVisibility)} options={[{ value: 'Public', label: 'Public', description: 'Contest katalogida ko‘rinadi' }, { value: 'Private', label: 'Private', description: 'Faqat access code bilan' }]} ariaLabel="Contestga kirish turi" /></Field>
        <Field label="Qiyinlik"><AppSelect value={form.difficulty} disabled={disabled} onChange={(value) => update('difficulty', value as ContestDifficulty)} options={['Easy', 'Medium', 'Hard', 'Expert'].map((value) => ({ value, label: value }))} ariaLabel="Contest qiyinligi" /></Field>
        {form.visibility === 'Private' && <Field label={isNew ? 'Private access code' : 'Yangi access code (ixtiyoriy)'} className="md:col-span-2"><div className="flex flex-col gap-2 sm:flex-row"><input required={isNew} readOnly value={form.privateAccessCode} disabled={disabled} className="input flex-1 font-mono tracking-wide" placeholder="Private tanlanganda xavfsiz kod yaratiladi" /><button type="button" disabled={disabled} onClick={() => update('privateAccessCode', generatePrivateAccessCode())} className="btn-ghost shrink-0 px-4 py-2.5 text-sm disabled:opacity-50">Yangi kod yaratish</button></div><p className="mt-1.5 text-xs text-slate-500">Har yangi kod 100-bit tasodifiy qiymatdir. U faqat hash holatida saqlanadi va bitta private contestga bog‘lanadi.</p></Field>}
        <Field label="Ishtirokchilar limiti"><input required min="1" max="100000" type="number" value={form.maxParticipants} disabled={disabled} onChange={(event) => update('maxParticipants', event.target.value)} className="input" /></Field>
        <Field label="Boshlanish vaqti"><input required type="datetime-local" value={form.startTime} disabled={disabled} onChange={(event) => update('startTime', event.target.value)} className="input" /></Field>
        <Field label="Tugash vaqti"><input required type="datetime-local" value={form.endTime} disabled={disabled} onChange={(event) => update('endTime', event.target.value)} className="input" /></Field>
        <Field label="Qoidalar (har qatorda bittadan)" className="md:col-span-2"><textarea value={form.rulesText} disabled={disabled} onChange={(event) => update('rulesText', event.target.value)} className="input min-h-24 resize-y" placeholder="Masalan: Bitta akkaunt bilan qatnashing\nMaslahatlashmang" /></Field>
        <Field label="Teglar (vergul bilan)" className="md:col-span-1"><input value={form.tagsText} disabled={disabled} onChange={(event) => update('tagsText', event.target.value)} className="input" placeholder="algebra, olympiad" /></Field>
        <Field label="Sovrin (ixtiyoriy)" className="md:col-span-1"><input value={form.prize} disabled={disabled} onChange={(event) => update('prize', event.target.value)} className="input" placeholder="Certificate yoki prize pool" /></Field>
      </div>
      {!disabled && <div className="mt-6 flex justify-end"><button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : isNew ? 'Draft yaratish' : 'O‘zgarishlarni saqlash'}</button></div>}
    </form>
  );
}

function CefrGapFillAnswerKeySection({ parts, answerKeys, busy, onSave }: { parts: ExamPart[]; answerKeys: GapFillAnswerKey[]; busy: boolean; onSave: (partId: string, keys: GapFillAnswerKey[]) => Promise<boolean> }) {
  const part = parts.find((item) => isCefrGapFillPart(item, true));
  const blankNumbers = gapFillBlankNumbers(part?.content ?? '');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(blankNumbers.map((blankNumber) => {
      const key = answerKeys.find((item) => item.partId === part?.id && item.blankNumber === blankNumber);
      return [blankNumber, key?.acceptedAnswers.join(', ') ?? ''];
    })));
    setError(null);
  }, [answerKeys, part?.id, part?.content]); // Reset only when saved server data or the template changes.

  if (!part) return null;
  if (blankNumbers.length === 0) return <section className="card border border-dashed border-sun-300 bg-sun-50/70 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-sun-700">CEFR · Listening Part 2</p><h2 className="mt-1 text-lg font-bold text-slate-900">Gap-fill javob kaliti</h2><p className="mt-2 text-sm leading-relaxed text-sun-900">Part 2 matniga bo‘sh joylar qo‘ying: masalan <code className="rounded bg-white px-1.5 py-0.5">{'{{1}}'}</code>, <code className="rounded bg-white px-1.5 py-0.5">{'{{2}}'}</code>. Saqlangandan keyin shu yerda javoblarni alohida yozasiz.</p></section>;

  const save = async () => {
    const keys: GapFillAnswerKey[] = blankNumbers.map((blankNumber) => ({
      partId: part.id,
      blankNumber,
      acceptedAnswers: (drafts[blankNumber] ?? '').split(',').map((answer) => answer.trim()).filter(Boolean),
      points: 1,
    }));
    if (keys.some((key) => key.acceptedAnswers.length === 0)) {
      setError('Har bir bo‘sh joy uchun kamida bitta to‘g‘ri javob yozing. Bir nechta qabul qilinadigan javobni vergul bilan ajrating.');
      return;
    }
    const saved = await onSave(part.id, keys);
    if (saved) setError(null);
  };

  return <section className="card overflow-hidden ring-1 ring-violet-100"><div className="workspace-panel-heading bg-gradient-to-r from-violet-50 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">CEFR · Listening Part 2</p><h2 className="mt-1 text-xl font-bold text-slate-900">Gap-fill javob kaliti</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Bu javoblar faqat admin/judge uchun. Ishtirokchi matndagi bo‘sh joylarga yozadi, keyin server javobni avtomatik tekshiradi.</p></div><span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">{blankNumbers.length} ta bo‘sh joy</span></div><div className="p-5 sm:p-6"><div className="grid gap-3 md:grid-cols-2">{blankNumbers.map((blankNumber) => <label key={blankNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="text-sm font-bold text-slate-800">({blankNumber}) javob</span><input value={drafts[blankNumber] ?? ''} disabled={busy} onChange={(event) => setDrafts((current) => ({ ...current, [blankNumber]: event.target.value }))} className="input mt-3 bg-white" placeholder="Masalan: Victoria Hall" /><span className="mt-2 block text-xs leading-relaxed text-slate-500">Muqobil javoblar bo‘lsa, vergul bilan ajrating.</span></label>)}</div>{error && <p className="mt-4 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium leading-relaxed text-error-700">{error}</p>}<div className="mt-5 flex justify-end"><button type="button" disabled={busy} onClick={() => void save()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : 'Javob kalitini saqlash'}</button></div></div></section>;
}

function CefrMatchingConfigSection({ parts, configs, busy, onSave, partPosition = 3, mapMode = false }: { parts: ExamPart[]; configs: MatchingEditorConfig[]; busy: boolean; onSave: (partId: string, config: Omit<MatchingEditorConfig, 'partId'>) => Promise<boolean>; partPosition?: number; mapMode?: boolean }) {
  const part = parts.find((item) => item.section === 'listening' && item.position === partPosition);
  const config = configs.find((item) => item.partId === part?.id);
  const [options, setOptions] = useState<MatchingEditorConfig['options']>([]);
  const [speakers, setSpeakers] = useState<MatchingEditorConfig['speakers']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptions(config?.options.length ? config.options : Array.from({ length: 6 }, (_, position) => ({ position, label: mapMode ? `Map point ${String.fromCharCode(65 + position)}` : '' })));
    setSpeakers(config?.speakers.length ? config.speakers : Array.from({ length: 4 }, (_, index) => ({ speakerNumber: index + 1, label: mapMode ? `Location ${index + 1}` : `Speaker ${index + 1}`, correctOption: null })));
    setError(null);
  }, [config, part?.id]);

  if (!part) return null;
  const updateOption = (position: number, label: string) => setOptions((current) => current.map((option) => option.position === position ? { ...option, label } : option));
  const updateSpeaker = (speakerNumber: number, update: Partial<MatchingEditorConfig['speakers'][number]>) => setSpeakers((current) => current.map((speaker) => speaker.speakerNumber === speakerNumber ? { ...speaker, ...update } : speaker));
  const addOption = () => setOptions((current) => current.length >= 12 ? current : [...current, { position: current.length, label: '' }]);
  const removeOption = (position: number) => setOptions((current) => current.length <= 2 ? current : current.filter((option) => option.position !== position).map((option, index) => ({ ...option, position: index })));
  const addSpeaker = () => setSpeakers((current) => current.length >= 10 ? current : [...current, { speakerNumber: current.length + 1, label: mapMode ? `Location ${current.length + 1}` : `Speaker ${current.length + 1}`, correctOption: null }]);
  const removeSpeaker = (speakerNumber: number) => setSpeakers((current) => current.length <= 1 ? current : current.filter((speaker) => speaker.speakerNumber !== speakerNumber).map((speaker, index) => ({ ...speaker, speakerNumber: index + 1 })));
  const save = async () => {
    if (options.some((option) => !option.label.trim())) return setError('Barcha A/B/C… variant matnlarini kiriting.');
    if (speakers.some((speaker) => !speaker.label.trim())) return setError('Har bir speaker nomini kiriting.');
    const saved = await onSave(part.id, { options, speakers });
    if (saved) setError(null);
  };

  const unanswered = speakers.filter((speaker) => speaker.correctOption === null).length;
  const title = mapMode ? 'Map letter matching' : 'Speaker matching';
  const subjectLabel = mapMode ? 'joy' : 'speaker';
  return <section className={`card overflow-hidden ring-1 ${mapMode ? 'ring-sky-100' : 'ring-emerald-100'}`}><div className={`workspace-panel-heading bg-gradient-to-r ${mapMode ? 'from-sky-50 to-white' : 'from-emerald-50 to-white'}`}><div><p className={`text-xs font-bold uppercase tracking-wider ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>CEFR · Listening Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{mapMode ? 'Tiniq xarita rasmi ishtirokchiga to‘liq ko‘rinadi. Har bir joy uchun xaritadagi A/B/C… belgisini tanlang; ortiqcha harflar qoldirilishi mumkin.' : 'Speakerlar audio ichida vaziyatini aytadi. Ishtirokchi har bir speakerga umumiy A/B/C… javob bankidan bitta harf bog‘laydi. Ortiqcha variantlar qoldirilishi mumkin.'}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${unanswered ? 'bg-sun-100 text-sun-700' : mapMode ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{unanswered ? `${unanswered} ta kalit kutilmoqda` : `${speakers.length} ${subjectLabel} · ${options.length} variant`}</span></div><div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{mapMode ? 'Xaritadagi joylar' : 'Speakerlar'}</h3><button type="button" disabled={busy || speakers.length >= 10} onClick={addSpeaker} className={`text-xs font-bold disabled:opacity-50 ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>+ {mapMode ? 'Joy' : 'Speaker'} qo‘shish</button></div><div className="space-y-3">{speakers.map((speaker) => <div key={speaker.speakerNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${mapMode ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{speaker.speakerNumber}</span><input value={speaker.label} disabled={busy} onChange={(event) => updateSpeaker(speaker.speakerNumber, { label: event.target.value })} className="input flex-1 bg-white" placeholder={`${mapMode ? 'Location' : 'Speaker'} ${speaker.speakerNumber}`} />{speakers.length > 1 && <button type="button" disabled={busy} onClick={() => removeSpeaker(speaker.speakerNumber)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700"><Trash2 className="h-4 w-4" /></button>}</div><div className="mt-3"><AppSelect value={speaker.correctOption === null ? '' : String(speaker.correctOption)} disabled={busy} onChange={(value) => updateSpeaker(speaker.speakerNumber, { correctOption: value ? Number(value) : null })} options={[{ value: '', label: 'Javob kalitini keyin tanlash' }, ...options.map((option) => ({ value: String(option.position), label: `${String.fromCharCode(65 + option.position)} — ${option.label || 'Variant matni'}` }))]} ariaLabel={`${speaker.label} uchun to‘g‘ri variant`} /></div></div>)}</div></div><div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{mapMode ? 'Xarita harflari' : 'Umumiy javob banki'}</h3><button type="button" disabled={busy || options.length >= 12} onClick={addOption} className={`text-xs font-bold disabled:opacity-50 ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>+ Variant qo‘shish</button></div><div className="space-y-3">{options.map((option) => <div key={option.position} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">{String.fromCharCode(65 + option.position)}</span><input value={option.label} disabled={busy} onChange={(event) => updateOption(option.position, event.target.value)} className="input flex-1" placeholder={mapMode ? `Xaritadagi ${String.fromCharCode(65 + option.position)} nuqta` : 'Masalan: a pair of pillows'} />{options.length > 2 && <button type="button" disabled={busy} onClick={() => removeOption(option.position)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></div></div>{error && <p className="mx-5 mb-0 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-700 sm:mx-6">{error}</p>}<div className="flex justify-end p-5 pt-5 sm:px-6 sm:pb-6"><button type="button" disabled={busy} onClick={() => void save()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : `${title}ni saqlash`}</button></div></section>;
}

function CefrPartOneCsvImporter({ parts, busy, onImport }: { parts: ExamPart[]; busy: boolean; onImport: (partId: string, rows: CefrAudioCsvQuestion[]) => Promise<boolean> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CefrAudioCsvQuestion[]>([]);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const part = parts.find((item) => item.section === 'listening' && item.position === 1);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setRows([]);
      setFilename('');
      setError('Faqat .csv fayl yuklang. Excelda “CSV UTF-8” formatini tanlang.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setRows([]);
      setFilename('');
      setError('CSV fayl 1 MB dan kichik bo‘lishi kerak.');
      return;
    }
    try {
      const nextRows = parseCefrAudioCsv(await file.text());
      setRows(nextRows);
      setFilename(file.name);
    } catch (reason) {
      setRows([]);
      setFilename('');
      setError(reason instanceof Error ? reason.message : 'CSV o‘qilmadi.');
    }
  };

  const saveImport = async () => {
    if (!part || rows.length === 0) return;
    const saved = await onImport(part.id, rows);
    if (saved) {
      setRows([]);
      setFilename('');
      setError(null);
    }
  };

  if (!part) {
    return <div className="border-b border-slate-100 bg-sun-50 px-5 py-4 text-sm leading-relaxed text-sun-800">CSV importni yoqish uchun avval <strong>Listening</strong> bo‘limida <strong>1-raqamli Part</strong> yarating.</div>;
  }

  return <section className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-indigo-50/60 px-5 py-5 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR · Listening Part 1</p>
        <h3 className="mt-1 text-base font-bold text-slate-900">Savollarni CSV fayldan import qilish</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Exceldan olingan 8 ta savol va A/B/C variantlar avtomatik saqlanadi. Bir xil savol raqami bo‘lsa, u yangilanadi.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(event) => { void readFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="btn-ghost px-3 py-2 text-sm disabled:opacity-50"><Upload className="h-4 w-4" />CSV faylni tanlash</button>
        {rows.length > 0 && <button type="button" disabled={busy} onClick={() => void saveImport()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Import qilinmoqda…' : `${rows.length} ta savolni saqlash`}</button>}
      </div>
    </div>
    <div className="mt-4 rounded-xl border border-cyan-100 bg-white/90 px-4 py-3 text-xs leading-relaxed text-slate-600"><span className="font-bold text-slate-800">Kerakli sarlavhalar:</span> <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">question_number, option_a, option_b, option_c</code><span className="ml-1">— <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">points</code> va <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">explanation</code> ixtiyoriy. To‘g‘ri javoblar importdan keyin shu panelda qo‘lda belgilanadi.</span></div>
    {error && <p className="mt-3 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium leading-relaxed text-error-700">{error}</p>}
    {rows.length > 0 && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold text-slate-800">Import ko‘rinishi</p><p className="text-xs text-slate-500">{filename} · {rows.length} ta savol</p></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">{rows.map((row) => <article key={row.position} className="bg-white p-3"><p className="text-xs font-extrabold text-indigo-700">Savol {row.position} · {row.points} ball</p><div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">{row.options.map((option, index) => <p key={`${row.position}-${index}`} className={index === row.correctOption ? 'font-bold text-success-700' : ''}>{String.fromCharCode(65 + index)}. {option}</p>)}</div></article>)}</div></div>}
  </section>;
}

function QuestionRow({ question, parts, cefrExam, editable, editing, busy, onEdit, onDelete }: { question: EditorQuestion; parts: ExamPart[]; cefrExam: boolean; editable: boolean; editing: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  const part = parts.find((item) => item.id === question.partId);
  const audioOnly = isCefrAudioOnlyPart(parts, question.partId, cefrExam);
  return <div className={`flex items-start justify-between gap-4 p-5 transition-colors ${editing ? 'bg-indigo-50/45' : ''}`}><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{audioOnly ? 'Audio ichidagi savol' : `Savol ${question.position}`} · {question.points} ball{part ? ` · ${part.title}` : ''}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{audioOnly ? 'Savol audio yozuvda beriladi. Ishtirokchi faqat quyidagi 3 variantni ko‘radi.' : question.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.map((option, index) => <div key={`${question.id}-${index}`} className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${question.correctOption === index ? 'border-success-400/50 bg-success-500/10 text-success-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="mr-1.5 font-extrabold">{String.fromCharCode(65 + index)}.</span>{option}</div>)}</div><p className={`mt-2 text-xs ${question.correctOption === null ? 'font-semibold text-sun-700' : 'text-slate-500'}`}>{question.correctOption === null ? 'To‘g‘ri variant hali belgilanmagan' : `To‘g‘ri variant: ${String.fromCharCode(65 + question.correctOption)}`}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} className={`rounded-lg p-2 transition-colors ${editing ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-700'}`} title="Tahrirlash" aria-label={`${question.position}-savolni tahrirlash`}><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>;
}

function QuestionFormFields({ form, setForm, busy, onSubmit, englishExam, cefrExam, parts, fixedPart, onCancel }: { form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; busy: boolean; onSubmit: (event: FormEvent) => void; englishExam: boolean; cefrExam: boolean; parts: ExamPart[]; fixedPart?: ExamPart; onCancel?: () => void }) {
  const updateOption = (index: number, value: string) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const objectiveParts = parts.filter((part) => part.section !== 'writing' && !isCefrGapFillPart(part, cefrExam) && !isCefrMatchingPart(part, cefrExam) && !isCefrExtractPart(part, cefrExam));
  const audioOnly = isCefrAudioOnlyPart(parts, form.partId, cefrExam);
  const maxOptions = audioOnly ? 3 : 8;
  const addOption = () => setForm((current) => {
    const currentMax = isCefrAudioOnlyPart(parts, current.partId, cefrExam) ? 3 : 8;
    return current.options.length >= currentMax ? current : { ...current, options: [...current.options, ''] };
  });
  useEffect(() => {
    if (!audioOnly || form.options.length === 3) return;
    setForm((current) => {
      if (!isCefrAudioOnlyPart(parts, current.partId, cefrExam) || current.options.length === 3) return current;
      return { ...current, options: [...current.options.slice(0, 3), ...Array(Math.max(0, 3 - current.options.length)).fill('')] };
    });
  }, [audioOnly, cefrExam, form.options.length, parts, setForm]);
  const removeOption = (index: number) => setForm((current) => {
    if (current.options.length <= (audioOnly ? 3 : 2)) return current;
    const options = current.options.filter((_, itemIndex) => itemIndex !== index);
    const correctOption = current.correctOption === null
      ? null
      : current.correctOption === index
        ? Math.max(0, index - 1)
        : current.correctOption > index
          ? current.correctOption - 1
          : current.correctOption;
    return { ...current, options, correctOption };
  });
  return <form onSubmit={onSubmit} className="border-t border-indigo-100 bg-indigo-50/35 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Savol ${form.position} ni shu yerda tahrirlash` : 'Yangi savol'}</p><p className="mt-1 text-xs text-slate-500">Javoblar va to‘g‘ri variant serverda himoyalangan tarzda saqlanadi.</p></div>{form.id && <button type="button" onClick={onCancel ?? (() => setForm(emptyQuestion(form.position, englishExam ? objectiveParts[0]?.id ?? null : null)))} className="btn-ghost px-3 py-2 text-xs">Yopish</button>}</div>
    <div className="mt-5 grid gap-4">
      {fixedPart ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900"><p className="font-bold">Part {fixedPart.position} ga biriktiriladi</p><p className="mt-1 text-xs text-indigo-700">{fixedPart.title}</p>{isCefrAudioOnlyPart(parts, fixedPart.id, cefrExam) && <p className="mt-2 text-xs leading-relaxed text-cyan-800">Savol audio ichida bo‘ladi; ishtirokchiga faqat 3 ta variant ko‘rsatiladi.</p>}</div> : englishExam && <Field label="Exam parti"><AppSelect value={form.partId ?? ''} onChange={(value) => setForm((current) => ({ ...current, partId: value || null }))} options={[{ value: '', label: 'Listening yoki Reading partini tanlang' }, ...objectiveParts.map((part) => ({ value: part.id, label: `${part.position}. ${part.section === 'listening' ? 'Listening' : 'Reading'} — ${part.title}` }))]} ariaLabel="Exam parti" />{audioOnly && <p className="mt-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-xs leading-relaxed text-cyan-800">CEFR Listening Part 1: savol audio ichida bo‘ladi. Ishtirokchiga faqat 3 ta variant ko‘rsatiladi.</p>}{objectiveParts.length === 0 && <p className="mt-1.5 text-xs text-error-700">Avval Listening yoki Reading partini yarating.</p>}</Field>}
      <Field label="Savol raqami"><input required min="1" type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))} className="input max-w-36" /></Field>
      {audioOnly ? <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">Savol matni audio ichida</p><p className="mt-1 text-xs">Bu formatda alohida prompt yozilmaydi: audio berilgan savolga mos 3 ta variantni kiriting.</p></div> : <Field label="Savol matni"><textarea required value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} className="input min-h-24 resize-y" placeholder="Savolni aniq va to‘liq yozing" /></Field>}
      <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">{audioOnly ? 'Audio uchun 3 ta variant' : 'Variantlar'}</label>{form.options.length < maxOptions && <button type="button" onClick={addOption} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">+ Variant qo‘shish</button>}</div><div className="space-y-2">{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><label className="flex cursor-pointer items-center"><input type="radio" name="correct-option" checked={form.correctOption === index} onChange={() => setForm((current) => ({ ...current, correctOption: index }))} className="h-4 w-4 accent-indigo-600" /><span className="ml-2 w-5 text-xs font-bold text-slate-500">{String.fromCharCode(65 + index)}</span></label><input required value={option} onChange={(event) => updateOption(index, event.target.value)} className="input flex-1" placeholder={`${String.fromCharCode(65 + index)} variant`} />{form.options.length > (audioOnly ? 3 : 2) && <button type="button" onClick={() => removeOption(index)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700" aria-label={`Variant ${index + 1} ni o‘chirish`}><Trash2 className="h-4 w-4" /></button>}</div>)}</div><p className={`mt-2 text-xs ${form.correctOption === null ? 'font-semibold text-sun-700' : 'text-slate-500'}`}>{form.correctOption === null ? 'To‘g‘ri variantni A, B yoki C orqali belgilang.' : 'Radio tugmasi to‘g‘ri variantni belgilaydi; foydalanuvchiga u ko‘rsatilmaydi.'}</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Field label="Ball"><input required min="1" max="1000" type="number" value={form.points} onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} className="input" /></Field><Field label="Izoh (ixtiyoriy)" className="md:col-span-2"><input value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} className="input" placeholder="Natija chiqqandan keyingi tushuntirish" /></Field></div>
    </div>
    <div className="mt-5 flex justify-end"><button type="submit" disabled={busy || (englishExam && objectiveParts.length === 0)} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : form.id ? 'Savolni saqlash' : 'Savol qo‘shish'}</button></div>
  </form>;
}

function ExamSectionTimingSection({ form, setForm, contest, savedTimings, editable, busy, onSave }: { form: ExamTimingForm; setForm: Dispatch<SetStateAction<ExamTimingForm>>; contest: ManagedContest; savedTimings: ExamSectionTimings | null; editable: boolean; busy: boolean; onSave: () => void }) {
  const contestMinutes = Math.max(0, Math.round((new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime()) / 60_000));
  const listeningMinutes = Number(form.listeningMinutes) || 0;
  const readingMinutes = Number(form.readingMinutes) || 0;
  const writingMinutes = Number(form.writingMinutes) || 0;
  const totalMinutes = listeningMinutes + readingMinutes + writingMinutes;
  const remainingMinutes = contestMinutes - totalMinutes;
  const update = (key: keyof ExamTimingForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <section className="card overflow-hidden ring-cyan-100"><div className="workspace-panel-heading bg-gradient-to-r from-cyan-50/80 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Section timers</p><h2 className="mt-1 text-xl font-bold text-slate-900">Listening, Reading va Writing vaqti</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Har bir bo‘limning alohida server timeri bo‘ladi. Vaqt tugashi bilan oldingi bo‘lim yopiladi va keyingi bo‘lim avtomatik ochiladi.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${savedTimings ? 'bg-success-50 text-success-700' : 'bg-sun-50 text-sun-700'}`}>{savedTimings ? 'Sozlangan' : 'Sozlanmagan'}</span></div><div className="p-5 sm:p-6"><div className="grid gap-4 md:grid-cols-3"><SectionTimerField label="Listening" value={form.listeningMinutes} icon={<Headphones className="h-4 w-4" />} color="indigo" disabled={!editable} onChange={(value) => update('listeningMinutes', value)} /><SectionTimerField label="Reading" value={form.readingMinutes} icon={<ClipboardList className="h-4 w-4" />} color="cyan" disabled={!editable} onChange={(value) => update('readingMinutes', value)} /><SectionTimerField label="Writing" value={form.writingMinutes} icon={<PenLine className="h-4 w-4" />} color="violet" disabled={!editable} onChange={(value) => update('writingMinutes', value)} /></div><div className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${remainingMinutes === 0 ? 'border-success-200 bg-success-50/70' : 'border-sun-200 bg-sun-50/70'}`}><div><p className="text-sm font-bold text-slate-800">Jami: {totalMinutes} / {contestMinutes} minut</p><p className="mt-1 text-xs leading-relaxed text-slate-600">Masalan: 35 min Listening + 30 min Reading + 25 min Writing = 90 min imtihon.</p></div><div className={`rounded-xl px-3 py-2 text-sm font-bold ${remainingMinutes === 0 ? 'bg-success-100 text-success-700' : 'bg-sun-100 text-sun-700'}`}>{remainingMinutes === 0 ? 'Vaqtlar mos' : remainingMinutes > 0 ? `${remainingMinutes} min ajratilmagan` : `${Math.abs(remainingMinutes)} min ortiqcha`}</div></div>{editable && <div className="mt-5 flex justify-end"><button type="button" disabled={busy || remainingMinutes !== 0 || totalMinutes < 3} onClick={onSave} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : 'Bo‘lim vaqtlarini saqlash'}</button></div>}</div></section>;
}

function SectionTimerField({ label, value, icon, color, disabled, onChange }: { label: string; value: string; icon: ReactNode; color: 'indigo' | 'cyan' | 'violet'; disabled: boolean; onChange: (value: string) => void }) {
  const palette = color === 'cyan' ? 'bg-cyan-50 text-cyan-700 ring-cyan-100' : color === 'violet' ? 'bg-violet-50 text-violet-700 ring-violet-100' : 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  return <label className={`rounded-2xl p-4 ring-1 ${palette}`}><span className="flex items-center gap-2 text-sm font-bold">{icon}{label}</span><span className="mt-4 flex items-center gap-2"><input required min="1" max="720" type="number" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="input w-full bg-white" /><span className="text-sm font-semibold">min</span></span></label>;
}

function CefrListeningPartNavigator({ parts, activePart, onSelect }: { parts: ExamPart[]; activePart: number | null; onSelect: (position: number | null) => void }) {
  return <section className="card overflow-hidden ring-1 ring-indigo-100">
    <div className="bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-5 py-5 sm:px-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">CEFR listening · 5 qadam</p><h2 className="mt-1 text-xl font-bold text-slate-900">Qaysi Partni tayyorlaysiz?</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Partni bosing: sahifada faqat o‘sha Partning kerakli maydonlari qoladi. Shuning uchun CSV, xarita, javob kaliti va oddiy savollar bir-biriga aralashmaydi.</p></div>
    <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 lg:grid-cols-5">{CEFR_LISTENING_PARTS.map((item) => {
      const part = parts.find((candidate) => candidate.section === 'listening' && candidate.position === item.position);
      const selected = activePart === item.position;
      return <button key={item.position} type="button" onClick={() => onSelect(item.position)} className={`rounded-2xl border p-3.5 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${selected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{item.position}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selected ? 'bg-white/15 text-white' : part ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{part ? 'Yaratilgan' : 'Boshlanmagan'}</span></div><p className="mt-3 text-sm font-extrabold">Part {item.position}</p><p className={`mt-1 text-xs font-semibold ${selected ? 'text-indigo-100' : 'text-slate-600'}`}>{item.title}</p><p className={`mt-2 text-[11px] leading-relaxed ${selected ? 'text-white/75' : 'text-slate-400'}`}>{item.description}</p></button>;
    })}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><p className="text-xs leading-relaxed text-slate-500">Listening partlardan tashqari Reading, Writing va umumiy bo‘lim vaqtlari ham alohida saqlanadi.</p><button type="button" onClick={() => onSelect(null)} className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${activePart === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Reading / Writing / vaqt</button></div>
  </section>;
}

function ExamPartsSection({ parts, form, setForm, audioFile, setAudioFile, mapImageFile, setMapImageFile, editable, cefrExam, activeCefrListeningPart, busy, onSubmit, onNew, onEdit, onDelete }: { parts: ExamPart[]; form: ExamPartForm; setForm: Dispatch<SetStateAction<ExamPartForm>>; audioFile: File | null; setAudioFile: Dispatch<SetStateAction<File | null>>; mapImageFile: File | null; setMapImageFile: Dispatch<SetStateAction<File | null>>; editable: boolean; cefrExam: boolean; activeCefrListeningPart: number | null; busy: string | null; onSubmit: (event: FormEvent) => void; onNew: () => void; onEdit: (part: ExamPart) => void; onDelete: (partId: string) => void }) {
  const update = <K extends keyof ExamPartForm>(key: K, value: ExamPartForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const sectionLabel: Record<ExamSection, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };
  if (cefrExam && activeCefrListeningPart !== null) return <CefrFocusedExamPartSection parts={parts} form={form} setForm={setForm} audioFile={audioFile} setAudioFile={setAudioFile} mapImageFile={mapImageFile} setMapImageFile={setMapImageFile} editable={editable} partPosition={activeCefrListeningPart} busy={busy} onSubmit={onSubmit} onEdit={onEdit} onDelete={onDelete} />;
  return <section className="card overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">IELTS / CEFR exam builder</p><h2 className="mt-1 text-xl font-bold text-slate-900">Partlar ({parts.length})</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Listening uchun audio, Reading uchun passage va Writing uchun topic yarating. Har bir Listening/Reading partiga savol biriktiriladi.</p></div>{editable && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Yangi part</button>}</div>
    {parts.length ? <div className="divide-y divide-slate-100">{parts.map((part) => <div key={part.id} className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{part.position}. {sectionLabel[part.section]}</p><p className="mt-1 text-sm font-bold text-slate-800">{part.title}</p><p className="mt-1 text-xs text-slate-500">{part.section === 'listening' ? (part.audioUrl ? 'Audio biriktirilgan' : 'Audio kiritilmagan') : part.section === 'reading' ? `${part.content.length} belgilik passage` : `${part.maxPoints} ballik writing topic`}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => onEdit(part)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy === `delete-part:${part.id}`} onClick={() => onDelete(part.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy === `delete-part:${part.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>)}</div> : <div className="p-6 text-sm text-slate-500">Partlar hali yo‘q. Listening, Reading yoki Writing partini qo‘shing.</div>}
    {editable && <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Part ${form.position} ni tahrirlash` : 'Yangi exam parti'}</p><p className="mt-1 text-xs text-slate-500">Audio fayl 25 MB gacha bo‘lishi mumkin. URL ham berish mumkin.</p></div>{form.id && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-xs">Bekor qilish</button>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Bo‘lim"><AppSelect value={form.section} onChange={(value) => update('section', value as ExamSection)} options={['listening', 'reading', 'writing'].map((value) => ({ value, label: sectionLabel[value as ExamSection] }))} ariaLabel="Exam bo‘limi" /></Field>
        <Field label="Part raqami"><input required min="1" max="50" type="number" value={form.position} onChange={(event) => update('position', Number(event.target.value))} className="input" /></Field>
        <Field label="Part nomi" className="md:col-span-2"><input required value={form.title} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: Part 1 — Campus conversation" /></Field>
        <Field label="Ko‘rsatmalar" className="md:col-span-2"><textarea value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="input min-h-20 resize-y" placeholder="Ishtirokchi ko‘radigan yo‘riqnoma" /></Field>
        {form.section === 'listening' && <><Field label="Audio fayl"><input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700" />{audioFile && <p className="mt-1.5 text-xs text-indigo-700">Yuklanadi: {audioFile.name}</p>}</Field><Field label="Audio URL (ixtiyoriy)"><input value={form.audioUrl} onChange={(event) => update('audioUrl', event.target.value)} className="input" placeholder="https://…/audio.mp3" /></Field>{cefrExam && form.position === 2 && <Field label="Part 2 to‘liq matni (gap-fill)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-56 resize-y font-medium leading-7" placeholder={'Seminar on the Toy Industry\n9.30 – 10.00: {{1}} to the seminar by Sally Connor\n...'} /><p className="mt-2 text-xs leading-relaxed text-violet-700">Ishtirokchi to‘ldiradigan har joyni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{1}}'}</code>, <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{2}}'}</code> kabi belgilang. Javoblar keyingi “Gap-fill javob kaliti” kartasida alohida yoziladi.</p></Field>}{cefrExam && form.position === 3 && <Field label="Part 3 ko‘rsatmasi (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="Har bir speaker uchun mos javob harfini tanlang. Ba’zi variantlar ortiqcha bo‘lishi mumkin." /><p className="mt-2 text-xs leading-relaxed text-emerald-700">Speakerlar va A/B/C… umumiy javob banki part saqlangandan keyin alohida “Speaker matching” kartasida sozlanadi.</p></Field>}{cefrExam && form.position === 4 && <><Field label="Tiniq xarita rasmi" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setMapImageFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700" />{mapImageFile && <p className="mt-1.5 text-xs text-sky-700">Yuklanadi: {mapImageFile.name} · rasm original sifatida saqlanadi.</p>}<p className="mt-2 text-xs leading-relaxed text-slate-500">PNG, JPG yoki WebP; 12 MB gacha. Xarita natural o‘lchamida ko‘rsatiladi.</p></Field><Field label="Xarita URL (ixtiyoriy)" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} className="input" placeholder="https://…/map.png" /></Field><Field label="Part 4 ko‘rsatmasi (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="Xaritadagi A–F harflaridan mos joyni tanlang. Ba’zi harflar ortiqcha bo‘lishi mumkin." /></Field>{form.imageUrl && <div className="md:col-span-2 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-3"><img src={form.imageUrl} alt="Xarita preview" className="h-auto w-full object-contain" /></div>}</>}{form.audioUrl && <div className="md:col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"><audio controls className="w-full" src={form.audioUrl}>Audio preview</audio></div>}</>}
        {form.section === 'reading' && <Field label="Reading passage" className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-44 resize-y" placeholder="Passage matnini shu yerga yozing" /></Field>}
        {form.section === 'writing' && <><Field label="Writing topic" className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-32 resize-y" placeholder="Task 1 yoki Task 2 topicini yozing" /></Field><Field label="Maksimal ball"><input required min="1" max="1000" type="number" value={form.maxPoints} onChange={(event) => update('maxPoints', event.target.value)} className="input" /></Field></>}
      </div>
      <div className="mt-5 flex justify-end"><button type="submit" disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy === 'exam-part' ? <Loader2 className="h-4 w-4 animate-spin" /> : form.section === 'listening' ? <FileAudio className="h-4 w-4" /> : form.section === 'reading' ? <Headphones className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}{busy === 'exam-part' ? 'Saqlanmoqda…' : form.id ? 'Partni saqlash' : 'Part qo‘shish'}</button></div>
    </form>}
  </section>;
}

function CefrFocusedExamPartSection({ parts, form, setForm, audioFile, setAudioFile, mapImageFile, setMapImageFile, editable, partPosition, busy, onSubmit, onEdit, onDelete }: { parts: ExamPart[]; form: ExamPartForm; setForm: Dispatch<SetStateAction<ExamPartForm>>; audioFile: File | null; setAudioFile: Dispatch<SetStateAction<File | null>>; mapImageFile: File | null; setMapImageFile: Dispatch<SetStateAction<File | null>>; editable: boolean; partPosition: number; busy: string | null; onSubmit: (event: FormEvent) => void; onEdit: (part: ExamPart) => void; onDelete: (partId: string) => void }) {
  const update = <K extends keyof ExamPartForm>(key: K, value: ExamPartForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const meta = CEFR_LISTENING_PARTS.find((item) => item.position === partPosition) ?? { position: partPosition, title: 'Listening', description: 'Listening partini tayyorlang.' };
  const savedPart = parts.find((part) => part.section === 'listening' && part.position === partPosition);
  const editingThisPart = form.section === 'listening' && form.position === partPosition;
  return <section className="card overflow-hidden ring-1 ring-indigo-100">
    <div className="workspace-panel-heading bg-gradient-to-r from-indigo-50 via-white to-cyan-50"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">CEFR Listening · Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{meta.title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{meta.description}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${savedPart ? 'bg-success-50 text-success-700' : 'bg-sun-50 text-sun-700'}`}>{savedPart ? 'Part saqlangan' : '1-qadam: part yarating'}</span></div>
    {savedPart && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3 sm:px-6"><div><p className="text-sm font-bold text-slate-800">{savedPart.title}</p><p className="mt-1 text-xs text-slate-500">{savedPart.audioUrl ? 'Audio biriktirilgan' : 'Audio hali kiritilmagan'}{partPosition === 4 && (savedPart.imageUrl ? ' · Xarita rasmi biriktirilgan' : ' · Xarita rasmi hali yo‘q')}</p></div>{editable && <div className="flex gap-1"><button type="button" onClick={() => onEdit(savedPart)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700" title="Partni tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy === `delete-part:${savedPart.id}`} onClick={() => onDelete(savedPart.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="Partni o‘chirish">{busy === `delete-part:${savedPart.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>}
    {editable && <form onSubmit={onSubmit} className="bg-slate-50/70 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-900">{savedPart && editingThisPart ? 'Part ma’lumotlarini tahrirlash' : `Part ${partPosition} ni sozlash`}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Bu sahifada faqat Part {partPosition} uchun zarur maydonlar ko‘rinadi.</p></div>{savedPart && <button type="button" onClick={() => onEdit(savedPart)} className="btn-ghost px-3 py-2 text-xs">Saqlangan ma’lumotni tiklash</button>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Part nomi" className="md:col-span-2"><input required value={form.title} onChange={(event) => update('title', event.target.value)} className="input" placeholder={`Part ${partPosition} nomi`} /></Field>
        <Field label="Ishtirokchiga ko‘rsatma" className="md:col-span-2"><textarea value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="input min-h-20 resize-y" placeholder="Qisqa va aniq ko‘rsatma" /></Field>
        <Field label="Audio fayl"><input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700" />{audioFile && <p className="mt-1.5 text-xs text-indigo-700">Yuklanadi: {audioFile.name}</p>}</Field>
        <Field label="Audio URL (ixtiyoriy)"><input value={form.audioUrl} onChange={(event) => update('audioUrl', event.target.value)} className="input" placeholder="https://…/audio.mp3" /></Field>
        {partPosition === 1 && <div className="md:col-span-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">Keyingi qadam: A/B/C savollar</p><p className="mt-1 text-xs">Partni saqlang. Pastdagi kichik Part 1 panelidan CSV import qilasiz yoki savollarni bittalab yozasiz. Savolning o‘zi audio ichida bo‘ladi.</p></div>}
        {partPosition === 2 && <Field label="To‘liq matn va bo‘sh joylar" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-56 resize-y font-medium leading-7" placeholder={'Seminar on the Toy Industry\n9.30 – 10.00: {{1}} to the seminar by Sally Connor\n...'} /><p className="mt-2 text-xs leading-relaxed text-violet-700">Bo‘sh joylarni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{1}}'}</code>, <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{2}}'}</code> kabi belgilang. Saqlagandan keyin javob kaliti shu Part sahifasida chiqadi.</p></Field>}
        {partPosition === 3 && <Field label="Qo‘shimcha ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="Har bir speaker uchun mos javob harfini tanlang." /><p className="mt-2 text-xs leading-relaxed text-emerald-700">Saqlagandan keyin speakerlar va umumiy A/B/C… javob banki shu Part sahifasida sozlanadi.</p></Field>}
        {partPosition === 4 && <><Field label="Tiniq xarita rasmi" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setMapImageFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700" />{mapImageFile && <p className="mt-1.5 text-xs text-sky-700">Yuklanadi: {mapImageFile.name} · original sifati saqlanadi.</p>}<p className="mt-2 text-xs leading-relaxed text-slate-500">PNG, JPG yoki WebP; 12 MB gacha.</p></Field><Field label="Xarita URL (ixtiyoriy)" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} className="input" placeholder="https://…/map.png" /></Field><Field label="Qo‘shimcha ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-24 resize-y" placeholder="Xaritadagi A–F harflaridan mos joyni tanlang." /></Field>{form.imageUrl && <div className="md:col-span-2 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-3"><img src={form.imageUrl} alt="Xarita preview" className="h-auto w-full object-contain" /></div>}</>}
        {partPosition === 5 && <Field label="Extractlar uchun ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-24 resize-y leading-7" placeholder="3 ta extractni tinglang. Har bir extract bo‘yicha 2 tadan savolga javob bering." /><div className="mt-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 text-xs leading-relaxed text-fuchsia-900"><p className="font-bold">Part 5 formati qat’iy: 3 extract × 2 savol = 6 savol.</p><p className="mt-1">Partni saqlaganingizdan keyin pastda Extract 1, 2 va 3 uchun aniq 2 tadan savol joyi chiqadi.</p></div></Field>}
        {form.audioUrl && <div className="md:col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"><audio controls className="w-full" src={form.audioUrl}>Audio preview</audio></div>}
      </div>
      <div className="mt-5 flex justify-end"><button type="submit" disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy === 'exam-part' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}{busy === 'exam-part' ? 'Saqlanmoqda…' : savedPart ? 'Partni saqlash' : 'Partni yaratish'}</button></div>
    </form>}
  </section>;
}

function CefrPartFiveQuestions({ part, questions, form, setForm, parts, editable, busy, editingId, onSave, onEdit, onDelete }: { part: ExamPart | null; questions: EditorQuestion[]; form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; parts: ExamPart[]; editable: boolean; busy: string | null; editingId: string | null; onSave: (event: FormEvent) => Promise<void>; onEdit: (question: EditorQuestion) => void; onDelete: (questionId: string) => void }) {
  if (!part) return <section className="card border border-dashed border-fuchsia-200 bg-fuchsia-50/60 p-6"><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">CEFR · Listening Part 5</p><h2 className="mt-1 text-xl font-bold text-slate-900">Avval Part 5 ni yarating</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Audio va Part 5 ma’lumotlarini yuqorida saqlang. Shundan keyin bu yerda 3 ta extract va har biriga 2 tadan savol joyi ochiladi.</p></section>;
  const extracts = [1, 2, 3].map((extractNumber) => ({ extractNumber, questionPositions: [((extractNumber - 1) * 2) + 1, extractNumber * 2] }));
  const count = questions.filter((question) => question.position >= 1 && question.position <= 6).length;
  return <section className="card overflow-hidden ring-1 ring-fuchsia-100"><div className="workspace-panel-heading bg-gradient-to-r from-fuchsia-50 via-white to-violet-50"><div><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">CEFR · Listening Part 5</p><h2 className="mt-1 text-xl font-bold text-slate-900">3 ta extract · 6 ta savol</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Har extract aynan 2 ta savoldan iborat. Savol raqamlari avtomatik tartibda 1–6 bo‘ladi; contest e’lon qilinishidan oldin oltalasi ham to‘ldirilgan bo‘lishi shart.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${count === 6 ? 'bg-success-50 text-success-700' : 'bg-fuchsia-100 text-fuchsia-700'}`}>{count}/6 savol</span></div><div className="grid gap-5 bg-slate-50/50 p-5 sm:p-6 lg:grid-cols-3">{extracts.map(({ extractNumber, questionPositions }) => <article key={extractNumber} className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-white shadow-sm"><div className="border-b border-fuchsia-100 bg-fuchsia-50/70 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">Extract {extractNumber}</p><p className="mt-1 text-sm font-bold text-slate-800">Savol {questionPositions[0]} va {questionPositions[1]}</p></div><div className="divide-y divide-slate-100">{questionPositions.map((position) => {
    const item = questions.find((question) => question.position === position);
    const creatingHere = !form.id && form.partId === part.id && form.position === position;
    if (!item) return <div key={position} className="p-4"><p className="text-xs font-bold text-slate-500">Savol {position}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Hali qo‘shilmagan.</p>{editable && <button type="button" onClick={() => setForm(emptyQuestion(position, part.id))} className="btn-ghost mt-3 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Savol {position} ni yozish</button>}{creatingHere && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(1, null))} />}</div>;
    return <div key={item.id}><QuestionRow question={item} parts={parts} cefrExam editable={editable} editing={editingId === item.id} busy={busy === `delete:${item.id}`} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />{editable && editingId === item.id && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(1, null))} />}</div>;
  })}</div></article>)}</div></section>;
}

function WritingReviewSection({ submissions, grades, setGrades, busy, finalized, onGrade }: { submissions: WritingSubmission[]; grades: Record<string, WritingGradeForm>; setGrades: Dispatch<SetStateAction<Record<string, WritingGradeForm>>>; busy: string | null; finalized: boolean; onGrade: (submission: WritingSubmission) => void }) {
  return <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Delayed writing review</p><h2 className="mt-1 text-xl font-bold text-slate-900">Writing tekshiruvi ({submissions.length})</h2><p className="mt-1 text-sm text-slate-500">Writing baholari kiritilib, contest yakunlanmaguncha final natija va rated reyting o‘zgarmaydi.</p></div>{submissions.length ? <div className="divide-y divide-slate-100">{submissions.map((submission) => { const grade = grades[submission.id] ?? writingGradeFormFrom(submission); return <article key={submission.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{submission.displayName}</p><p className="mt-1 text-xs text-slate-500">Part {submission.partPosition}: {submission.partTitle} · maksimal {submission.maxPoints} ball</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${submission.score === null ? 'bg-sun-50 text-sun-700' : 'bg-success-50 text-success-700'}`}>{submission.score === null ? 'Baholanmagan' : `${submission.score}/${submission.maxPoints} baholangan`}</span></div><div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{submission.content}</div><div className="mt-4 grid gap-4 md:grid-cols-[150px_minmax(0,1fr)_auto]"><Field label="Ball"><input disabled={finalized} min="0" max={submission.maxPoints} type="number" value={grade.score} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, score: event.target.value } }))} className="input" /></Field><Field label="Feedback (ixtiyoriy)"><input disabled={finalized} value={grade.feedback} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, feedback: event.target.value } }))} className="input" placeholder="Ishtirokchiga izoh" /></Field><div className="flex items-end"><button type="button" disabled={finalized || busy !== null} onClick={() => onGrade(submission)} className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50">{busy === `grade:${submission.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{submission.score === null ? 'Baholash' : 'Yangilash'}</button></div></div></article>; })}</div> : <div className="p-6 text-sm text-slate-500">Yuborilgan writing javoblari yo‘q.</div>}</section>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
