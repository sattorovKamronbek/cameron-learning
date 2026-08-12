import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
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
import { LoadingState } from '@/components/LoadingState';
import {
  archiveContest,
  contestSubjects,
  createContest,
  deleteExamPart,
  deleteContestQuestion,
  fetchContestEditor,
  fetchManagedContests,
  fetchWritingSubmissions,
  finalizeContest,
  formatContestDate,
  gradeWritingSubmission,
  publishContest,
  saveExamPart,
  saveContestQuestion,
  uploadContestAudio,
  updateContest,
  type ContestDifficulty,
  type ContestEditor,
  type ContestInput,
  type ContestQuestionInput,
  type ContestType,
  type ExamPart,
  type ExamPartInput,
  type ExamSection,
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
  correctOption: number;
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
  maxPoints: string;
};

type WritingGradeForm = {
  score: string;
  feedback: string;
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

function questionInput(form: QuestionForm): ContestQuestionInput {
  return {
    id: form.id,
    partId: form.partId,
    position: form.position,
    prompt: form.prompt,
    options: form.options,
    correctOption: form.correctOption,
    points: Number(form.points),
    explanation: form.explanation,
  };
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

function displayDate(value: string): string {
  const result = formatContestDate(value);
  return `${result.date} · ${result.time}`;
}

export function ContestManagementPage() {
  const { adminAccess } = useAccessControl();
  const { navigate } = useRouter();
  const [contests, setContests] = useState<ManagedContest[]>([]);
  const [editor, setEditor] = useState<ContestEditor | null>(null);
  const [form, setForm] = useState<ContestForm>(defaultContestForm);
  const [question, setQuestion] = useState<QuestionForm>(emptyQuestion(1));
  const [examPart, setExamPart] = useState<ExamPartForm>(emptyExamPart(1));
  const [audioFile, setAudioFile] = useState<File | null>(null);
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
      setAudioFile(null);
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
    setAudioFile(null);
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Amal bajarilmadi.');
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
    if (!question.prompt.trim() || question.options.some((item) => !item.trim())) {
      setError('Savol matni va barcha variantlarni to‘ldiring.');
      return;
    }
    if (isEnglishExam(currentContest) && !question.partId) {
      setError('Listening yoki Reading partini tanlang.');
      return;
    }

    await run('question', async () => {
      await saveContestQuestion(editor.contest.id, questionInput(question));
      await refresh();
      await loadEditor(editor.contest.id, false);
    }, question.id ? 'Savol yangilandi.' : 'Savol saqlandi.');
  };

  const saveExamPartForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentContest) return;
    if (!examPart.title.trim()) return setError('Part nomini kiriting.');
    if (examPart.section === 'writing' && (!examPart.content.trim() || Number(examPart.maxPoints) < 1)) {
      return setError('Writing uchun topic va maksimal ballni kiriting.');
    }
    await run('exam-part', async () => {
      let audioUrl = examPart.audioUrl;
      if (audioFile) audioUrl = await uploadContestAudio(currentContest.id, audioFile);
      await saveExamPart(currentContest.id, examPartInput(examPart, audioUrl));
      await refresh();
      await loadEditor(currentContest.id, false);
    }, examPart.id ? 'Exam parti yangilandi.' : 'Yangi exam parti qo‘shildi.');
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

  return (
    <div className="management-canvas min-h-screen">
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
        {error && <Notice kind="error">{error}</Notice>}
        {notice && <Notice kind="success">{notice}</Notice>}

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
                  <><section className="workspace-callout"><div className="flex flex-wrap items-start gap-3"><Headphones className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><p className="font-bold">IELTS / CEFR oqimi</p><p className="mt-1 leading-relaxed text-indigo-900/80">1. Listening uchun audio biriktiring. 2. Reading uchun passage yozing. 3. Har bir objective partga savol ulang. 4. Writing javoblari contest tugagach alohida baholanadi.</p></div></div></section><ExamPartsSection
                    parts={editor?.parts ?? []}
                    form={examPart}
                    setForm={setExamPart}
                    audioFile={audioFile}
                    setAudioFile={setAudioFile}
                    editable={editable}
                    busy={busy}
                    onSubmit={saveExamPartForm}
                    onNew={() => { setExamPart(emptyExamPart((editor?.parts.length ?? 0) + 1)); setAudioFile(null); }}
                    onEdit={(part) => { setExamPart(examPartFormFrom(part)); setAudioFile(null); }}
                    onDelete={(partId) => void removeExamPart(partId)}
                  /></>
                )}
                <section className="card overflow-hidden">
                  <div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Real questions</p><h2 className="mt-1 text-xl font-bold text-slate-900">{englishExam ? 'Listening va Reading savollari' : 'Savollar'} ({questionCount})</h2><p className="mt-1 text-sm text-slate-500">To‘g‘ri javoblar faqat shu himoyalangan editor va serverda saqlanadi.</p></div>{editable && <button type="button" onClick={() => setQuestion(emptyQuestion(questionCount + 1, editor?.parts.find((part) => part.section !== 'writing')?.id ?? null))} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Savol qo‘shish</button>}</div>
                  {editor?.questions.length ? <div className="divide-y divide-slate-100">{editor.questions.map((item) => <QuestionRow key={item.id} question={item} parts={editor.parts} editable={editable} busy={busy === `delete:${item.id}`} onEdit={() => setQuestion(questionFormFrom(item))} onDelete={() => void deleteQuestion(item.id)} />)}</div> : <div className="p-6 text-sm text-slate-500">Savol yo‘q. Contest e’lon qilinishidan oldin kamida bitta to‘liq savol qo‘shilishi shart.</div>}
                  {editable && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} englishExam={englishExam} parts={editor?.parts ?? []} />}
                  {!editable && <div className="border-t border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">{currentContest.isPublished ? 'E’lon qilingan contest savollari o‘zgarmaydi.' : 'Boshlangan contest savollari o‘zgarmaydi.'}</div>}
                </section>

                {englishExam && currentContest.status === 'Finished' && <WritingReviewSection submissions={writingSubmissions} grades={writingGrades} setGrades={setWritingGrades} busy={busy} finalized={currentContest.isFinalized} onGrade={saveWritingGrade} />}

                <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-bold text-slate-900">Contest holati</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">E’lon qilinganidan keyin contest ommaviy ro‘yxatda chiqadi. Tugagan rated contest faqat tasdiqlangan admin yakunlagach foydalanuvchilarning haqiqiy ratingiga ta’sir qiladi.</p>{englishExam && currentContest.status === 'Finished' && ungradedWritingCount > 0 && <p className="mt-2 text-xs font-semibold text-sun-700">{ungradedWritingCount} ta writing hali baholanmagan. Reyting va yakuniy natijalar shu baholar kiritilguncha kutadi.</p>}{currentContest.type === 'Rated' && !adminAccess && <p className="mt-2 text-xs font-medium text-slate-500">Rated contest natijasini yakunlash admin tasdiqlovini talab qiladi.</p>}</div><div className="flex flex-wrap gap-2">{editable && <button type="button" onClick={() => void publish()} disabled={questionCount === 0 || isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Send className="h-4 w-4" />E’lon qilish</button>}{canFinalize && <button type="button" onClick={() => void finalize()} disabled={isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Trophy className="h-4 w-4" />Natijani yakunlash</button>}{!currentContest.archivedAt && <button type="button" onClick={() => void archive()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Archive className="h-4 w-4" />Arxivlash</button>}</div></div></section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Notice({ kind, children }: { kind: 'error' | 'success'; children: string }) {
  const Icon = kind === 'error' ? AlertCircle : CheckCircle2;
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${kind === 'error' ? 'border-error-200 bg-error-50 text-error-800' : 'border-success-200 bg-success-50 text-success-800'}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><p>{children}</p></div>;
}

function StatusPill({ contest, large = false }: { contest: ManagedContest; large?: boolean }) {
  const label = contest.archivedAt ? 'Arxiv' : contest.isFinalized ? 'Yakunlangan' : contest.isPublished ? contest.status : 'Draft';
  const color = contest.archivedAt ? 'bg-slate-100 text-slate-600' : contest.isFinalized ? 'bg-success-50 text-success-700' : contest.isPublished && contest.status === 'Live' ? 'bg-error-50 text-error-700' : contest.isPublished ? 'bg-indigo-50 text-indigo-700' : 'bg-sun-50 text-sun-700';
  return <span className={`shrink-0 rounded-full font-bold ${large ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[10px]'} ${color}`}>{label}</span>;
}

function ContestFormFields({ form, setForm, disabled, onSubmit, busy, isNew, canCreateRated }: { form: ContestForm; setForm: Dispatch<SetStateAction<ContestForm>>; disabled: boolean; onSubmit: (event: FormEvent) => void; busy: boolean; isNew: boolean; canCreateRated: boolean }) {
  const update = <K extends keyof ContestForm>(key: K, value: ContestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form onSubmit={onSubmit} className="p-5 sm:p-6">
      {disabled && <div className="mb-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">E’lon qilingan yoki boshlangan contestning jadvali va tavsifi o‘zgartirilmaydi.</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Contest nomi" className="md:col-span-2"><input required value={form.title} disabled={disabled} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: August Mathematics Challenge" /></Field>
        <Field label="Tavsif" className="md:col-span-2"><textarea value={form.description} disabled={disabled} onChange={(event) => update('description', event.target.value)} className="input min-h-28 resize-y" placeholder="Contest maqsadi va qatnashuvchilar bilishi kerak bo‘lgan ma’lumotlar" /></Field>
        <Field label="Fan yoki imtihon"><select value={form.subjectSlug} disabled={disabled} onChange={(event) => update('subjectSlug', event.target.value)} className="input">{academicContestSubjects.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</select><p className="mt-1.5 text-xs text-slate-500">Programming contestlarni maxsus programming boshqaruvida yarating.</p></Field>
        <Field label="Turi"><select value={form.type} disabled={disabled} onChange={(event) => update('type', event.target.value as ContestType)} className="input"><option value="Unrated">Unrated — ratingga ta’sir qilmaydi</option><option value="Rated" disabled={!canCreateRated}>Rated — yakunlangach ratingga ta’sir qiladi</option></select>{!canCreateRated && <p className="mt-1.5 text-xs text-slate-500">Rated contestlarni faqat tasdiqlangan admin yaratadi.</p>}</Field>
        <Field label="Qiyinlik"><select value={form.difficulty} disabled={disabled} onChange={(event) => update('difficulty', event.target.value as ContestDifficulty)} className="input"><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option><option value="Expert">Expert</option></select></Field>
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

function QuestionRow({ question, parts, editable, busy, onEdit, onDelete }: { question: EditorQuestion; parts: ExamPart[]; editable: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  const part = parts.find((item) => item.id === question.partId);
  return <div className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Savol {question.position} · {question.points} ball{part ? ` · ${part.title}` : ''}</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{question.prompt}</p><p className="mt-2 text-xs text-slate-500">To‘g‘ri variant: {String.fromCharCode(65 + question.correctOption)}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>;
}

function QuestionFormFields({ form, setForm, busy, onSubmit, englishExam, parts }: { form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; busy: boolean; onSubmit: (event: FormEvent) => void; englishExam: boolean; parts: ExamPart[] }) {
  const updateOption = (index: number, value: string) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const addOption = () => setForm((current) => current.options.length >= 8 ? current : { ...current, options: [...current.options, ''] });
  const objectiveParts = parts.filter((part) => part.section !== 'writing');
  const removeOption = (index: number) => setForm((current) => {
    if (current.options.length <= 2) return current;
    const options = current.options.filter((_, itemIndex) => itemIndex !== index);
    const correctOption = current.correctOption === index
      ? Math.max(0, index - 1)
      : current.correctOption > index
        ? current.correctOption - 1
        : current.correctOption;
    return { ...current, options, correctOption };
  });
  return <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Savol ${form.position} ni tahrirlash` : 'Yangi savol'}</p><p className="mt-1 text-xs text-slate-500">Javoblar va to‘g‘ri variant serverda himoyalangan tarzda saqlanadi.</p></div>{form.id && <button type="button" onClick={() => setForm(emptyQuestion(form.position, englishExam ? objectiveParts[0]?.id ?? null : null))} className="btn-ghost px-3 py-2 text-xs">Bekor qilish</button>}</div><div className="mt-5 grid gap-4">{englishExam && <Field label="Exam parti"><select required value={form.partId ?? ''} onChange={(event) => setForm((current) => ({ ...current, partId: event.target.value || null }))} className="input"><option value="">Listening yoki Reading partini tanlang</option>{objectiveParts.map((part) => <option key={part.id} value={part.id}>{part.position}. {part.section === 'listening' ? 'Listening' : 'Reading'} — {part.title}</option>)}</select>{objectiveParts.length === 0 && <p className="mt-1.5 text-xs text-error-700">Avval Listening yoki Reading partini yarating.</p>}</Field>}<Field label="Savol raqami"><input required min="1" type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))} className="input max-w-36" /></Field><Field label="Savol matni"><textarea required value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} className="input min-h-24 resize-y" placeholder="Savolni aniq va to‘liq yozing" /></Field><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">Variantlar</label>{form.options.length < 8 && <button type="button" onClick={addOption} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">+ Variant qo‘shish</button>}</div><div className="space-y-2">{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><label className="flex cursor-pointer items-center"><input type="radio" name="correct-option" checked={form.correctOption === index} onChange={() => setForm((current) => ({ ...current, correctOption: index }))} className="h-4 w-4 accent-indigo-600" /><span className="ml-2 w-5 text-xs font-bold text-slate-500">{String.fromCharCode(65 + index)}</span></label><input required value={option} onChange={(event) => updateOption(index, event.target.value)} className="input flex-1" placeholder={`${String.fromCharCode(65 + index)} variant`} />{form.options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700" aria-label={`Variant ${index + 1} ni o‘chirish`}><Trash2 className="h-4 w-4" /></button>}</div>)}</div><p className="mt-2 text-xs text-slate-500">Radio tugmasi to‘g‘ri variantni belgilaydi; foydalanuvchiga u ko‘rsatilmaydi.</p></div><div className="grid gap-4 md:grid-cols-3"><Field label="Ball"><input required min="1" max="1000" type="number" value={form.points} onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} className="input" /></Field><Field label="Izoh (ixtiyoriy)" className="md:col-span-2"><input value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} className="input" placeholder="Natija chiqqandan keyingi tushuntirish" /></Field></div></div><div className="mt-5 flex justify-end"><button type="submit" disabled={busy || (englishExam && objectiveParts.length === 0)} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : form.id ? 'Savolni saqlash' : 'Savol qo‘shish'}</button></div></form>;
}

function ExamPartsSection({ parts, form, setForm, audioFile, setAudioFile, editable, busy, onSubmit, onNew, onEdit, onDelete }: { parts: ExamPart[]; form: ExamPartForm; setForm: Dispatch<SetStateAction<ExamPartForm>>; audioFile: File | null; setAudioFile: Dispatch<SetStateAction<File | null>>; editable: boolean; busy: string | null; onSubmit: (event: FormEvent) => void; onNew: () => void; onEdit: (part: ExamPart) => void; onDelete: (partId: string) => void }) {
  const update = <K extends keyof ExamPartForm>(key: K, value: ExamPartForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const sectionLabel: Record<ExamSection, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };
  return <section className="card overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">IELTS / CEFR exam builder</p><h2 className="mt-1 text-xl font-bold text-slate-900">Partlar ({parts.length})</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Listening uchun audio, Reading uchun passage va Writing uchun topic yarating. Har bir Listening/Reading partiga savol biriktiriladi.</p></div>{editable && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Yangi part</button>}</div>{parts.length ? <div className="divide-y divide-slate-100">{parts.map((part) => <div key={part.id} className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{part.position}. {sectionLabel[part.section]}</p><p className="mt-1 text-sm font-bold text-slate-800">{part.title}</p><p className="mt-1 text-xs text-slate-500">{part.section === 'listening' ? (part.audioUrl ? 'Audio biriktirilgan' : 'Audio kiritilmagan') : part.section === 'reading' ? `${part.content.length} belgilik passage` : `${part.maxPoints} ballik writing topic`}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => onEdit(part)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy === `delete-part:${part.id}`} onClick={() => onDelete(part.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy === `delete-part:${part.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>)}</div> : <div className="p-6 text-sm text-slate-500">Partlar hali yo‘q. Listening, Reading yoki Writing partini qo‘shing.</div>}{editable && <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Part ${form.position} ni tahrirlash` : 'Yangi exam parti'}</p><p className="mt-1 text-xs text-slate-500">Audio fayl 25 MB gacha bo‘lishi mumkin. URL ham berish mumkin.</p></div>{form.id && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-xs">Bekor qilish</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Bo‘lim"><select value={form.section} onChange={(event) => update('section', event.target.value as ExamSection)} className="input"><option value="listening">Listening</option><option value="reading">Reading</option><option value="writing">Writing</option></select></Field><Field label="Part raqami"><input required min="1" max="50" type="number" value={form.position} onChange={(event) => update('position', Number(event.target.value))} className="input" /></Field><Field label="Part nomi" className="md:col-span-2"><input required value={form.title} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: Part 1 — Campus conversation" /></Field><Field label="Ko‘rsatmalar" className="md:col-span-2"><textarea value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="input min-h-20 resize-y" placeholder="Ishtirokchi ko‘radigan yo‘riqnoma" /></Field>{form.section === 'listening' && <><Field label="Audio fayl"><input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700" />{audioFile && <p className="mt-1.5 text-xs text-indigo-700">Yuklanadi: {audioFile.name}</p>}</Field><Field label="Audio URL (ixtiyoriy)"><input value={form.audioUrl} onChange={(event) => update('audioUrl', event.target.value)} className="input" placeholder="https://…/audio.mp3" /></Field>{form.audioUrl && <div className="md:col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"><audio controls className="w-full" src={form.audioUrl}>Audio preview</audio></div>}</>}{form.section === 'reading' && <Field label="Reading passage" className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-44 resize-y" placeholder="Passage matnini shu yerga yozing" /></Field>}{form.section === 'writing' && <><Field label="Writing topic" className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-32 resize-y" placeholder="Task 1 yoki Task 2 topicini yozing" /></Field><Field label="Maksimal ball"><input required min="1" max="1000" type="number" value={form.maxPoints} onChange={(event) => update('maxPoints', event.target.value)} className="input" /></Field></>}</div><div className="mt-5 flex justify-end"><button type="submit" disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy === 'exam-part' ? <Loader2 className="h-4 w-4 animate-spin" /> : form.section === 'listening' ? <FileAudio className="h-4 w-4" /> : form.section === 'reading' ? <Headphones className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}{busy === 'exam-part' ? 'Saqlanmoqda…' : form.id ? 'Partni saqlash' : 'Part qo‘shish'}</button></div></form>}</section>;
}

function WritingReviewSection({ submissions, grades, setGrades, busy, finalized, onGrade }: { submissions: WritingSubmission[]; grades: Record<string, WritingGradeForm>; setGrades: Dispatch<SetStateAction<Record<string, WritingGradeForm>>>; busy: string | null; finalized: boolean; onGrade: (submission: WritingSubmission) => void }) {
  return <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Delayed writing review</p><h2 className="mt-1 text-xl font-bold text-slate-900">Writing tekshiruvi ({submissions.length})</h2><p className="mt-1 text-sm text-slate-500">Writing baholari kiritilib, contest yakunlanmaguncha final natija va rated reyting o‘zgarmaydi.</p></div>{submissions.length ? <div className="divide-y divide-slate-100">{submissions.map((submission) => { const grade = grades[submission.id] ?? writingGradeFormFrom(submission); return <article key={submission.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{submission.displayName}</p><p className="mt-1 text-xs text-slate-500">Part {submission.partPosition}: {submission.partTitle} · maksimal {submission.maxPoints} ball</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${submission.score === null ? 'bg-sun-50 text-sun-700' : 'bg-success-50 text-success-700'}`}>{submission.score === null ? 'Baholanmagan' : `${submission.score}/${submission.maxPoints} baholangan`}</span></div><div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{submission.content}</div><div className="mt-4 grid gap-4 md:grid-cols-[150px_minmax(0,1fr)_auto]"><Field label="Ball"><input disabled={finalized} min="0" max={submission.maxPoints} type="number" value={grade.score} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, score: event.target.value } }))} className="input" /></Field><Field label="Feedback (ixtiyoriy)"><input disabled={finalized} value={grade.feedback} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, feedback: event.target.value } }))} className="input" placeholder="Ishtirokchiga izoh" /></Field><div className="flex items-end"><button type="button" disabled={finalized || busy !== null} onClick={() => onGrade(submission)} className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50">{busy === `grade:${submission.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{submission.score === null ? 'Baholash' : 'Yangilash'}</button></div></div></article>; })}</div> : <div className="p-6 text-sm text-slate-500">Yuborilgan writing javoblari yo‘q.</div>}</section>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
