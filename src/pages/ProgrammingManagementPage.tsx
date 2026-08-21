import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  Bold,
  BookOpenCheck,
  Calculator,
  Clock3,
  ChevronRight,
  Code2,
  Compass,
  Download,
  FileCode2,
  FileArchive,
  FolderPlus,
  Layers3,
  Link2,
  List,
  ListOrdered,
  LibraryBig,
  Loader2,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Trash2,
  Trophy,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { Link } from '@/router';
import { useAccessControl } from '@/lib/access';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { AppSelect } from '@/components/AppSelect';
import { ManagementToast } from '@/components/ManagementToast';
import { ContestProblemPdfBuilder } from '@/components/ContestProblemPdfBuilder';
import {
  archiveContest,
  createContest,
  deleteContest,
  fetchManagedContests,
  formatContestDate,
  generatePrivateAccessCode,
  publishContest,
  promotePrivateGymToRated,
  reopenContestAfterTesting,
  updateContest,
  type ContestDifficulty,
  type ContestInput,
  type ContestMode,
  type ContestVisibility,
  type ManagedContest,
} from '@/lib/contests';
import {
  attachProgrammingProblem,
  deleteProgrammingProblem,
  detachProgrammingProblem,
  fetchManagedProgrammingProblems,
  fetchProgrammingContestEditor,
  fetchProgrammingProblemEditor,
  formatProblemLimit,
  problemLetter,
  saveProgrammingProblem,
  type ManagedProgrammingProblem,
  type ProblemExample,
  type ProblemPublicationScope,
  type ProblemTestCase,
  type ProgrammingContestEditor,
  type ProgrammingDifficulty,
  type ProgrammingProblemEditor,
  type ProgrammingProblemInput,
} from '@/lib/programming';
import { downloadTestcaseArchive, readTestcaseArchive } from '@/lib/testcase-archive';
import {
  generateJavaScriptTestCases,
  generateRemoteTestCases,
  generatorExamples,
  generatorLanguageOptions,
  type TestcaseGeneratorLanguage,
} from '@/lib/testcase-generator';

type Tab = 'contests' | 'problems';

type ContestForm = {
  title: string;
  description: string;
  difficulty: ContestDifficulty;
  type: 'Rated' | 'Unrated';
  mode: ContestMode;
  visibility: ContestVisibility;
  privateAccessCode: string;
  startTime: string;
  endTime: string;
  maxParticipants: string;
  rulesText: string;
  tagsText: string;
  prize: string;
};

type ProblemForm = {
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  examples: ProblemExample[];
  timeLimitMs: string;
  memoryLimitMb: string;
  difficulty: ProgrammingDifficulty;
  tagsText: string;
  editorial: string;
  publicationScope: ProblemPublicationScope;
  testCases: ProblemTestCase[];
};

function localDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function tomorrowAtOriginalTime(startTime: string, endTime: string): { startTime: string; endTime: string } {
  const previousStart = new Date(startTime);
  const previousEnd = new Date(endTime);
  const duration = Math.max(60_000, previousEnd.getTime() - previousStart.getTime());
  const nextStart = new Date();
  nextStart.setDate(nextStart.getDate() + 1);
  nextStart.setHours(previousStart.getHours(), previousStart.getMinutes(), 0, 0);
  return { startTime: nextStart.toISOString(), endTime: new Date(nextStart.getTime() + duration).toISOString() };
}

function defaultContestForm(): ContestForm {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    title: '', description: '', difficulty: 'Medium', type: 'Unrated', mode: 'Gym', visibility: 'Public', privateAccessCode: '',
    startTime: localDateTime(start), endTime: localDateTime(end), maxParticipants: '1000',
    rulesText: 'Only one account may be used.\nDo not share solutions during the contest.',
    tagsText: 'algorithms', prize: '',
  };
}

function contestFormFrom(contest: ManagedContest): ContestForm {
  return {
    title: contest.title,
    description: contest.description,
    difficulty: contest.difficulty,
    type: contest.type,
    mode: contest.mode,
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
    subjectSlug: 'programming',
    difficulty: form.difficulty,
    type: form.type,
    mode: form.mode,
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

function emptyProblemForm(scope: ProblemPublicationScope = 'site'): ProblemForm {
  return {
    title: '', statement: '', inputDescription: '', outputDescription: '', constraints: '',
    examples: [{ input: '', output: '', explanation: '' }],
    timeLimitMs: '1000', memoryLimitMb: '256', difficulty: 'Medium', tagsText: '', editorial: '',
    publicationScope: scope,
    testCases: [],
  };
}

function problemFormFrom(problem: ProgrammingProblemEditor): ProblemForm {
  return {
    title: problem.title,
    statement: problem.statement,
    inputDescription: problem.inputDescription,
    outputDescription: problem.outputDescription,
    constraints: problem.constraints,
    examples: problem.examples.length ? problem.examples : [{ input: '', output: '', explanation: '' }],
    timeLimitMs: String(problem.timeLimitMs),
    memoryLimitMb: String(problem.memoryLimitMb),
    difficulty: problem.difficulty,
    tagsText: problem.tags.join(', '),
    editorial: problem.editorial ?? '',
    publicationScope: problem.publicationScope,
    testCases: problem.testCases,
  };
}

function problemInput(form: ProblemForm): ProgrammingProblemInput {
  return {
    title: form.title,
    statement: form.statement,
    inputDescription: form.inputDescription,
    outputDescription: form.outputDescription,
    constraints: form.constraints,
    examples: form.examples,
    timeLimitMs: Number(form.timeLimitMs),
    memoryLimitMb: Number(form.memoryLimitMb),
    difficulty: form.difficulty,
    tags: form.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
    editorial: form.editorial,
    publicationScope: form.publicationScope,
    testCases: form.testCases,
  };
}

function contestDate(value: string): string {
  const date = formatContestDate(value);
  return `${date.date} · ${date.time}`;
}

function isContestSettingsEditable(contest: ManagedContest | null): boolean {
  return Boolean(contest && !contest.archivedAt && new Date(contest.startTime).getTime() > Date.now());
}

function isProblemSetEditable(contest: ManagedContest | null): boolean {
  return Boolean(contest && !contest.isPublished && !contest.archivedAt && new Date(contest.startTime).getTime() > Date.now());
}

export function ProgrammingManagementPage() {
  const { adminAccess } = useAccessControl();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('contests');
  const [contests, setContests] = useState<ManagedContest[]>([]);
  const [problems, setProblems] = useState<ManagedProgrammingProblem[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [contestEditor, setContestEditor] = useState<ProgrammingContestEditor | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [contestForm, setContestForm] = useState<ContestForm>(defaultContestForm);
  const [problemForm, setProblemForm] = useState<ProblemForm>(emptyProblemForm);
  const [loading, setLoading] = useState(true);
  const [editorLoading, setEditorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problemSearch, setProblemSearch] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedContestId) ?? null,
    [contests, selectedContestId],
  );
  const editingContest = selectedContest !== null;
  // A published contest may still need a schedule or description correction
  // before it begins. Its problem set remains locked after publication.
  // A verified administrator is the final steward of the platform and can
  // correct any contest or problem set; judges stay limited to safe drafts.
  const canEditSettings = Boolean(adminAccess) || isContestSettingsEditable(selectedContest);
  const canEditProblemSet = Boolean(adminAccess) || isProblemSetEditable(selectedContest);
  const canReopenAfterTesting = Boolean(
    adminAccess
      && selectedContest
      && !selectedContest.archivedAt
      && selectedContest.type === 'Unrated'
      && selectedContest.status !== 'Upcoming',
  );
  const isJudge = profile?.role === 'judge';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contestResult, problemResult] = await Promise.allSettled([fetchManagedContests(), fetchManagedProgrammingProblems()]);
      if (contestResult.status === 'fulfilled') {
        setContests(contestResult.value.filter((contest) => contest.subjectSlug === 'programming'));
      } else {
        setContests([]);
      }
      if (problemResult.status === 'fulfilled') {
        setProblems(problemResult.value);
      } else {
        setProblems([]);
      }

      const errors = [contestResult, problemResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : 'Programming ma’lumotlari yuklanmadi.');
      if (errors.length) setError(errors.join(' '));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContest = useCallback(async (contest: ManagedContest) => {
    setSelectedContestId(contest.id);
    setContestForm(contestFormFrom(contest));
    setEditorLoading(true);
    setError(null);
    try {
      setContestEditor(await fetchProgrammingContestEditor(contest.id));
    } catch (reason) {
      setContestEditor(null);
      setError(reason instanceof Error ? reason.message : 'Contest masalalari yuklanmadi.');
    } finally {
      setEditorLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Amal bajarilmadi.');
    } finally {
      setBusy(null);
    }
  };

  const newContest = () => {
    setTab('contests');
    setSelectedContestId(null);
    setContestEditor(null);
    setContestForm(defaultContestForm());
    setError(null);
    setNotice(null);
  };

  const newProblem = (scope: ProblemPublicationScope = 'site') => {
    const creatingForContest = scope === 'contest' && Boolean(selectedContest);
    setTab(creatingForContest ? 'contests' : 'problems');
    setSelectedProblemId(null);
    setProblemForm(emptyProblemForm(scope));
    setError(null);
    setNotice(null);
    if (creatingForContest) window.setTimeout(() => document.getElementById('contest-problem-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const saveContest = async (event: FormEvent) => {
    event.preventDefault();
    if (!contestForm.title.trim()) return setError('Contest nomini kiriting.');
    if (Number(contestForm.maxParticipants) < 1) return setError('Ishtirokchilar limitini tekshiring.');
    if (contestForm.visibility === 'Private' && !selectedContest && contestForm.privateAccessCode.trim().length < 10) return setError('Private contest uchun kamida 10 belgili access code kiriting.');
    const protectedForm: ContestForm = isJudge ? { ...contestForm, mode: 'Gym', type: 'Unrated' } : contestForm;
    await run('contest', async () => {
      if (selectedContest) {
        await updateContest(selectedContest.id, contestInput(protectedForm));
        await refresh();
        await loadContest({ ...selectedContest, ...contestInput(protectedForm), startTime: new Date(protectedForm.startTime).toISOString(), endTime: new Date(protectedForm.endTime).toISOString() });
      } else {
        const contestId = await createContest(contestInput(protectedForm));
        await refresh();
        const next = (await fetchManagedContests()).find((contest) => contest.id === contestId);
        if (next) await loadContest(next);
      }
    }, selectedContest ? 'Contest sozlamalari saqlandi.' : 'Draft contest yaratildi. Endi masalalarni biriktiring.');
  };

  const selectProblem = async (problemId: string) => {
    setTab('problems');
    setSelectedProblemId(problemId);
    setEditorLoading(true);
    setError(null);
    try {
      setProblemForm(problemFormFrom(await fetchProgrammingProblemEditor(problemId)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Masala tahrirlovchisi ochilmadi.');
    } finally {
      setEditorLoading(false);
    }
  };

  const saveProblem = async (event: FormEvent) => {
    event.preventDefault();
    if (!problemForm.title.trim() || !problemForm.statement.trim()) return setError('Masala nomi va shartini to‘ldiring.');
    if (problemForm.testCases.some((test) => !test.input.trim())) return setError('Har bir qo‘shilgan test uchun input kiriting yoki bo‘sh testni o‘chiring.');
    const attachToCurrentContest = Boolean(
      !selectedProblemId
      && problemForm.publicationScope === 'contest'
      && selectedContest
      && contestEditor
      && canEditProblemSet,
    );
    await run('problem', async () => {
      const savedId = await saveProgrammingProblem(problemInput(problemForm), selectedProblemId ?? undefined);
      if (attachToCurrentContest && selectedContest && contestEditor) {
        await attachProgrammingProblem(selectedContest.id, savedId, contestEditor.problems.length + 1, 100);
      }
      await refresh();
      setSelectedProblemId(savedId);
      setProblemForm(problemFormFrom(await fetchProgrammingProblemEditor(savedId)));
      if (attachToCurrentContest && selectedContest) await loadContest(selectedContest);
    }, selectedProblemId ? 'Masala va testlar saqlandi.' : attachToCurrentContest ? 'Masala saqlandi va contestga biriktirildi.' : 'Masala kutubxonaga saqlandi.');
  };

  const attach = async (problemId: string) => {
    if (!selectedContest || !contestEditor) return;
    await run(`attach:${problemId}`, async () => {
      await attachProgrammingProblem(selectedContest.id, problemId, contestEditor.problems.length + 1, 100);
      await refresh();
      await loadContest(selectedContest);
    }, 'Masala contestga biriktirildi.');
  };

  const detach = async (problemId: string) => {
    if (!selectedContest || !window.confirm('Masalani contestdan olib tashlaysizmi? Kutubxonadagi masalaning o‘zi saqlanib qoladi.')) return;
    await run(`detach:${problemId}`, async () => {
      await detachProgrammingProblem(selectedContest.id, problemId);
      await refresh();
      await loadContest(selectedContest);
    }, 'Masala contestdan olib tashlandi.');
  };

  const removeProblem = async () => {
    if (!selectedProblemId || !window.confirm('Masalani va uning testlarini o‘chirasizmi?')) return;
    await run('delete-problem', async () => {
      await deleteProgrammingProblem(selectedProblemId);
      setSelectedProblemId(null);
      setProblemForm(emptyProblemForm());
      await refresh();
    }, 'Masala o‘chirildi.');
  };

  const publish = async () => {
    if (!selectedContest || !contestEditor || !window.confirm('Contestni e’lon qilasizmi? Boshlanishidan oldin jadval va tavsifni yangilash mumkin, problem set esa yopiladi.')) return;
    if (!contestEditor.problems.length) return setError('E’lon qilishdan oldin kamida bitta programming masala biriktiring.');
    await run('publish', async () => {
      await publishContest(selectedContest.id);
      await refresh();
      await loadContest({ ...selectedContest, isPublished: true });
    }, 'Contest e’lon qilindi. Masalalar contest tugashi bilan Practice bo‘limida paydo bo‘ladi.');
  };

  const archive = async () => {
    if (!selectedContest || !window.confirm('Contestni arxivlaysizmi?')) return;
    await run('archive', async () => {
      await archiveContest(selectedContest.id);
      newContest();
      await refresh();
    }, 'Contest arxivlandi.');
  };

  const removeContest = async () => {
    if (!selectedContest || !window.confirm('Draft contestni va uning biriktirilgan ma’lumotlarini butunlay o‘chirasizmi? Bu amalni qaytarib bo‘lmaydi.')) return;
    await run('delete-contest', async () => {
      await deleteContest(selectedContest.id);
      newContest();
      await refresh();
    }, 'Draft contest o‘chirildi.');
  };

  const reopenAfterTesting = async () => {
    if (!selectedContest) return;
    const nextSchedule = tomorrowAtOriginalTime(selectedContest.startTime, selectedContest.endTime);
    if (!window.confirm('Contestni testdan keyin qayta tayyorlaysizmi? Faqat sizning test urinishlaringiz va test natijalari o‘chiriladi. Contest ertaga avvalgi soatda qayta qo‘yiladi.')) return;
    await run('reopen-test', async () => {
      await reopenContestAfterTesting(selectedContest.id, nextSchedule.startTime, nextSchedule.endTime);
      await refresh();
      await loadContest({ ...selectedContest, startTime: nextSchedule.startTime, endTime: nextSchedule.endTime, isFinalized: false });
    }, 'Test urinishlari tozalandi. Contest ertaga qayta rejalashtirildi. Kerak bo‘lsa jadvalini yana tahrirlang.');
  };

  const promotePrivateGym = async () => {
    if (!selectedContest || !window.confirm('Bu private Gym rated contestga o‘tkaziladi. Shundan so‘ng uni faqat admin boshqara oladi. Davom etasizmi?')) return;
    await run('promote-private-gym', async () => {
      await promotePrivateGymToRated(selectedContest.id);
      await refresh();
      const updated = (await fetchManagedContests()).find((contest) => contest.id === selectedContest.id);
      if (updated) await loadContest(updated);
    }, 'Private Gym rated contestga o‘tkazildi.');
  };

  const filteredProblems = useMemo(() => {
    const search = problemSearch.trim().toLowerCase();
    return problems.filter((problem) => !search || [problem.title, ...problem.tags].some((entry) => entry.toLowerCase().includes(search)));
  }, [problems, problemSearch]);
  const linkedIds = new Set(contestEditor?.problems.map((problem) => problem.id) ?? []);
  const draftCount = contests.filter((contest) => !contest.isPublished && !contest.archivedAt).length;
  const publishedCount = contests.filter((contest) => contest.isPublished && !contest.archivedAt).length;

  return (
    <div className="management-canvas min-h-screen">
      <ManagementToast message={error ?? notice} kind={error ? 'error' : 'success'} onDismiss={() => { setError(null); setNotice(null); }} />
      <section className="workspace-hero pt-28">
        <div className="workspace-hero-content py-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-400/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-100 ring-1 ring-indigo-200/20"><Code2 className="h-3.5 w-3.5" />Programming studio</span>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Contest va masalalarni alohida boshqaring</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Avval masala bankini tayyorlang, keyin uni contestga qo‘shing. Shu sabab tasklar va contest sozlamalari hech qachon bir panelda aralashib ketmaydi.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="font-display text-2xl font-extrabold">{loading ? '—' : contests.length}</p><p className="mt-1 text-xs text-slate-300">Contestlar</p><p className="mt-1 text-[10px] text-slate-400">{publishedCount} e’lon · {draftCount} draft</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3"><p className="font-display text-2xl font-extrabold">{loading ? '—' : problems.length}</p><p className="mt-1 text-xs text-slate-300">Masalalar</p></div>
              <button type="button" onClick={() => void refresh()} disabled={loading || busy !== null} className="btn border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/15 disabled:opacity-60"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Yangilash</button>
            </div>
          </div>
          <div className="workspace-switcher mt-8 max-w-3xl">
            <Link to="/contest-management" className="workspace-switcher-item"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><Compass className="h-5 w-5" /></span><span><span className="block text-sm font-bold">Academic & Language studio</span><span className="mt-1 block text-xs leading-relaxed text-slate-300">Science, IELTS va CEFR testlari, exam partlari hamda writing tekshiruvi.</span></span></Link>
            <div className="workspace-switcher-item workspace-switcher-item-active"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400/20 text-indigo-100"><Code2 className="h-5 w-5" /></span><span><span className="block text-sm font-bold">Programming studio</span><span className="mt-1 block text-xs leading-relaxed text-slate-200">Masalalar banki va programming contestlar uchun maxsus judge oqimi.</span></span></div>
          </div>
        </div>
      </section>

      <main className="container-page py-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-soft backdrop-blur">
          <div className="flex flex-wrap gap-1">
            <TabButton active={tab === 'contests'} onClick={() => setTab('contests')} icon={Trophy}>Contestlar <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">{contests.length}</span></TabButton>
            <TabButton active={tab === 'problems'} onClick={() => setTab('problems')} icon={LibraryBig}>Masalalar banki <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{problems.length}</span></TabButton>
          </div>
          {tab === 'contests'
            ? <button type="button" onClick={newContest} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" />Yangi contest</button>
            : <button type="button" onClick={() => newProblem('site')} className="btn-primary px-4 py-2 text-sm"><FolderPlus className="h-4 w-4" />Yangi masala</button>}
        </div>

        {loading ? <LoadingState className="card min-h-[28rem]" message="Programming ma’lumotlari yuklanmoqda" /> : tab === 'contests' ? (
          <div className="grid gap-7 xl:grid-cols-[310px_minmax(0,1fr)]">
            <ContestSidebar contests={contests} currentId={selectedContestId} onSelect={(contest) => void loadContest(contest)} onCreate={newContest} />
            <div className="min-w-0 space-y-7">
              <section className="card overflow-hidden">
                <div className="workspace-panel-heading">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{editingContest ? 'Contest settings' : 'New programming contest'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{editingContest ? selectedContest?.title : 'Programming contest yaratish'}</h2><p className="mt-1 text-sm text-slate-500">Bu panel faqat contest jadvali, qoidalari va nashri uchun. Masalalar quyidagi alohida problem-set kartasida boshqariladi.</p></div>
                  {selectedContest && <ContestPill contest={selectedContest} />}
                </div>
                <ContestSettingsForm form={contestForm} setForm={setContestForm} onSubmit={saveContest} busy={busy === 'contest'} disabled={editingContest && !canEditSettings} canCreateRated={adminAccess} isJudge={isJudge} isNew={!editingContest} />
              </section>

              {selectedContest && (
                <>
                  <section className="card overflow-hidden ring-indigo-100">
                    <div className="workspace-panel-heading bg-gradient-to-r from-indigo-50/70 to-white">
                      <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Problem set</p><h2 className="mt-1 text-xl font-bold text-slate-900">Contest masalalari</h2><p className="mt-1 text-sm text-slate-500">Masalalar A, B, C… tartibida chiqadi. Contest scope bilan yaratilganlari tugash vaqtida Practice’ga avtomatik nashr qilinadi.</p></div>
                      {canEditProblemSet && <button type="button" onClick={() => newProblem('contest')} className="btn-ghost px-3 py-2 text-sm"><FileCode2 className="h-4 w-4" />Contest uchun yangi masala</button>}
                    </div>
                    {editorLoading ? <LoadingState className="min-h-48" message="Problem set yuklanmoqda" /> : contestEditor?.problems.length ? <div className="divide-y divide-slate-100">{contestEditor.problems.map((problem) => <ContestProblemRow key={problem.id} problem={problem} editable={canEditProblemSet} busy={busy === `detach:${problem.id}`} onRemove={() => void detach(problem.id)} />)}</div> : <EmptyProblemSet editable={canEditProblemSet} onCreate={() => newProblem('contest')} />}
                  </section>

                  {canEditProblemSet && problemForm.publicationScope === 'contest' && <section id="contest-problem-builder" className="card overflow-hidden ring-2 ring-indigo-100"><div className="workspace-panel-heading bg-gradient-to-r from-indigo-50/70 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Contest problem builder</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selectedProblemId ? 'Contest masalasini tahrirlash' : 'Contest uchun masala yaratish'}</h2><p className="mt-1 text-sm text-slate-500">Shart, preview, samplelar, checker va maxfiy testlar bitta qulay ish maydonida.</p></div>{selectedProblemId && <button type="button" disabled={busy !== null} onClick={() => void removeProblem()} className="btn-ghost px-3 py-2 text-xs text-error-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />O‘chirish</button>}</div>{editorLoading ? <LoadingState className="min-h-96" message="Masala yuklanmoqda" /> : <ProblemEditorForm form={problemForm} setForm={setProblemForm} onSubmit={saveProblem} busy={busy === 'problem'} contestContext={selectedContest} />}</section>}

                  {canEditProblemSet && <section className="card overflow-hidden"><div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reusable library</p><h2 className="mt-1 text-lg font-bold text-slate-900">Masalalar bankidan qo‘shish</h2><p className="mt-1 text-sm text-slate-500">Bu yer faqat tayyor masalani contestga biriktirish uchun. Yangi masala yaratish “Masalalar banki” ish maydonida amalga oshadi.</p></div><input value={problemSearch} onChange={(event) => setProblemSearch(event.target.value)} className="input w-full sm:w-64" placeholder="Masalani qidiring" /></div><div className="divide-y divide-slate-100">{filteredProblems.filter((problem) => !linkedIds.has(problem.id)).slice(0, 12).map((problem) => <div key={problem.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-semibold text-slate-800">{problem.title}</p><p className="mt-1 text-xs text-slate-500">{problem.difficulty} · {formatProblemLimit(problem.timeLimitMs, problem.memoryLimitMb)} · {problem.publicationScope === 'contest' ? 'Contest → Practice' : 'Site masalasi'}</p></div><button type="button" onClick={() => void attach(problem.id)} disabled={busy !== null} className="btn-ghost px-3 py-2 text-xs disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Qo‘shish</button></div>)}{!filteredProblems.filter((problem) => !linkedIds.has(problem.id)).length && <p className="p-6 text-sm text-slate-500">Qo‘shiladigan masala topilmadi. Yangi contest masalasini yarating.</p>}</div></section>}

                  <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-bold text-slate-900">Nashr holati</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">E’lon qilingach problem set yopiladi, lekin contest boshlanishidan oldin jadvali va tavsifini yangilash mumkin. Tugash vaqti yetishi bilan contest-scope masalalar Practice katalogida avtomatik ochiladi.</p></div><div className="flex flex-wrap gap-2">{adminAccess && selectedContest.mode === 'Gym' && selectedContest.visibility === 'Private' && !selectedContest.isPublished && <button type="button" onClick={() => void promotePrivateGym()} disabled={busy !== null} className="btn-ghost px-4 py-2.5 text-sm text-violet-700 disabled:opacity-50"><Trophy className="h-4 w-4" />Ratedga o‘tkazish</button>}{canEditProblemSet && <button type="button" onClick={() => void publish()} disabled={!contestEditor?.problems.length || busy !== null} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Send className="h-4 w-4" />E’lon qilish</button>}{canReopenAfterTesting && <button type="button" onClick={() => void reopenAfterTesting()} disabled={busy !== null} className="btn-ghost px-4 py-2.5 text-sm text-indigo-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Ertaga qayta tayyorlash</button>}{canEditProblemSet && !selectedContest.isPublished && <button type="button" onClick={() => void removeContest()} disabled={busy !== null} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />O‘chirish</button>}{!selectedContest.archivedAt && <button type="button" onClick={() => void archive()} disabled={busy !== null} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Archive className="h-4 w-4" />Arxivlash</button>}</div></div></section>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)]">
            <section className="card overflow-hidden"><div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Problem library</p><h2 className="mt-1 text-xl font-bold text-slate-900">Masalalar ({problems.length})</h2><p className="mt-1 text-sm text-slate-500">Kutubxonadan masala tanlang yoki yangi task yarating. Contestga biriktirish contest ish maydonida bajariladi.</p></div><input value={problemSearch} onChange={(event) => setProblemSearch(event.target.value)} className="input w-full sm:w-64" placeholder="Nomi yoki teg orqali qidiring" /></div><div className="divide-y divide-slate-100">{filteredProblems.length ? filteredProblems.map((problem) => <ProblemLibraryRow key={problem.id} problem={problem} active={problem.id === selectedProblemId} onClick={() => void selectProblem(problem.id)} />) : <div className="p-10 text-center"><LibraryBig className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Masala topilmadi</p></div>}</div></section>
            <section className="card overflow-hidden ring-indigo-100"><div className="workspace-panel-heading bg-gradient-to-r from-indigo-50/70 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{selectedProblemId ? 'Edit problem' : 'New problem'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selectedProblemId ? 'Masalani tahrirlash' : 'Masala yaratish'}</h2><p className="mt-1 text-sm text-slate-500">Shart, namunalar va maxfiy judge testlari shu alohida editor ichida saqlanadi.</p></div>{selectedProblemId && <button type="button" disabled={busy !== null} onClick={() => void removeProblem()} className="btn-ghost px-3 py-2 text-xs text-error-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />O‘chirish</button>}</div>{editorLoading ? <LoadingState className="min-h-96" message="Masala yuklanmoqda" /> : <ProblemEditorForm form={problemForm} setForm={setProblemForm} onSubmit={saveProblem} busy={busy === 'problem'} contestContext={selectedContest} />}</section>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Trophy; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`workspace-tab ${active ? 'workspace-tab-active' : 'workspace-tab-idle'}`}><Icon className="h-4 w-4" />{children}</button>;
}

function ContestSidebar({ contests, currentId, onSelect, onCreate }: { contests: ManagedContest[]; currentId: string | null; onSelect: (contest: ManagedContest) => void; onCreate: () => void }) {
  const drafts = contests.filter((contest) => !contest.isPublished && !contest.archivedAt).length;
  const published = contests.filter((contest) => contest.isPublished && !contest.archivedAt).length;
  return <aside className="card h-fit overflow-hidden xl:sticky xl:top-24"><div className="border-b border-slate-100 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">Contest navigatori</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Jadval va problem set uchun contestni shu yerdan tanlang.</p></div><span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{contests.length}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-sun-50 p-2.5"><p className="text-lg font-extrabold text-sun-700">{drafts}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-sun-700/70">Draft</p></div><div className="rounded-xl bg-indigo-50 p-2.5"><p className="text-lg font-extrabold text-indigo-700">{published}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700/70">E’lon qilingan</p></div></div></div>{contests.length ? <div className="max-h-[65vh] overflow-y-auto">{contests.map((contest) => <button key={contest.id} type="button" onClick={() => onSelect(contest)} className={`workspace-list-item w-full ${contest.id === currentId ? 'workspace-list-item-active' : ''}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold text-slate-800">{contest.title}</p><ContestPill contest={contest} compact /></div><p className="mt-2 text-xs text-slate-500">{contestDate(contest.startTime)}</p><p className="mt-1 text-xs text-slate-400">{contest.questionCount} masala · {contest.participants} qatnashuvchi</p></button>)}</div> : <div className="p-7 text-center"><Trophy className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Contest yo‘q</p><button type="button" onClick={onCreate} className="mt-2 text-xs font-bold text-indigo-700">Birinchisini yarating</button></div>}</aside>;
}

function ContestPill({ contest, compact = false }: { contest: ManagedContest; compact?: boolean }) {
  const label = contest.archivedAt ? 'Arxiv' : contest.isPublished ? contest.status : 'Draft';
  const color = contest.archivedAt ? 'bg-slate-100 text-slate-600' : contest.isPublished && contest.status === 'Live' ? 'bg-success-50 text-success-700' : contest.isPublished ? 'bg-indigo-50 text-indigo-700' : 'bg-sun-50 text-sun-700';
  return <span className={`shrink-0 rounded-full font-bold ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} ${color}`}>{label}</span>;
}

function ContestSettingsForm({ form, setForm, onSubmit, busy, disabled, canCreateRated, isJudge, isNew }: { form: ContestForm; setForm: React.Dispatch<React.SetStateAction<ContestForm>>; onSubmit: (event: FormEvent) => void; busy: boolean; disabled: boolean; canCreateRated: boolean; isJudge: boolean; isNew: boolean }) {
  const set = <K extends keyof ContestForm>(key: K, value: ContestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setMode = (mode: ContestMode) => setForm((current) => ({ ...current, mode, type: mode === 'Gym' ? 'Unrated' : current.type }));
  const setVisibility = (visibility: ContestVisibility) => setForm((current) => ({
    ...current,
    visibility,
    privateAccessCode: visibility === 'Private' && (isNew || current.visibility !== 'Private')
      ? current.privateAccessCode || generatePrivateAccessCode()
      : current.privateAccessCode,
  }));
  return <form onSubmit={onSubmit} className="p-5 sm:p-6">
    {disabled && <div className="mb-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Boshlangan, yakunlangan yoki arxivlangan contest sozlamalari o‘zgarmaydi.</div>}
    {isJudge && <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-900"><p className="font-bold">Judge uchun Gym rejimi</p><p className="mt-1 text-xs leading-relaxed">Judge faqat unrated Gym yaratadi. Private Gym’ni keyinchalik tasdiqlangan admin Rated contestga o‘tkaza oladi.</p></div>}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Contest nomi" className="md:col-span-2"><input required disabled={disabled} value={form.title} onChange={(event) => set('title', event.target.value)} className="input" placeholder="Masalan: UzAlgo Round #12" /></Field>
      <Field label="Qisqa tavsif" className="md:col-span-2"><textarea disabled={disabled} value={form.description} onChange={(event) => set('description', event.target.value)} className="input min-h-24 resize-y" placeholder="Format, qoidalar va contest haqida qisqacha" /></Field>
      <Field label="Rejim"><AppSelect disabled={disabled || isJudge} value={form.mode} onChange={(value) => setMode(value as ContestMode)} options={[{ value: 'Gym', label: 'Gym', description: 'Mashq rejimi, doim Unrated' }, { value: 'Contest', label: 'Contest', description: 'Rated yoki Unrated' }]} ariaLabel="Contest rejimi" /></Field>
      <Field label="Turi"><AppSelect disabled={disabled || isJudge || form.mode === 'Gym'} value={form.type} onChange={(value) => set('type', value as ContestForm['type'])} options={[{ value: 'Unrated', label: 'Unrated' }, { value: 'Rated', label: 'Rated', disabled: !canCreateRated }]} ariaLabel="Contest turi" />{form.mode === 'Gym' ? <p className="mt-1 text-xs text-cyan-700">Gym reytingga ta’sir qilmaydi.</p> : !canCreateRated && <p className="mt-1 text-xs text-slate-500">Rated contestni faqat tasdiqlangan admin yaratadi.</p>}</Field>
      <Field label="Kirish"><AppSelect disabled={disabled} value={form.visibility} onChange={(value) => setVisibility(value as ContestVisibility)} options={[{ value: 'Public', label: 'Public', description: 'Katalogda ko‘rinadi' }, { value: 'Private', label: 'Private', description: 'Access code bilan' }]} ariaLabel="Contestga kirish turi" /></Field>
      <Field label="Umumiy qiyinlik"><AppSelect disabled={disabled} value={form.difficulty} onChange={(value) => set('difficulty', value as ContestDifficulty)} options={['Easy', 'Medium', 'Hard', 'Expert'].map((value) => ({ value, label: value }))} ariaLabel="Contest qiyinligi" /></Field>
      {form.visibility === 'Private' && <Field label={isNew ? 'Private access code' : 'Yangi access code (ixtiyoriy)'} className="md:col-span-2"><div className="flex flex-col gap-2 sm:flex-row"><input disabled={disabled} required={isNew} readOnly value={form.privateAccessCode} className="input flex-1 font-mono tracking-wide" placeholder="Private tanlanganda xavfsiz kod yaratiladi" /><button type="button" disabled={disabled} onClick={() => set('privateAccessCode', generatePrivateAccessCode())} className="btn-ghost shrink-0 px-4 py-2.5 text-sm disabled:opacity-50">Yangi kod yaratish</button></div><p className="mt-1 text-xs text-slate-500">Har yaratishda 100-bit tasodifiy kod olinadi. U hash holatida saqlanadi va bitta private contestga bog‘lanadi.</p></Field>}
      <Field label="Boshlanish vaqti"><input required disabled={disabled} type="datetime-local" value={form.startTime} onChange={(event) => set('startTime', event.target.value)} className="input" /></Field>
      <Field label="Tugash vaqti"><input required disabled={disabled} type="datetime-local" value={form.endTime} onChange={(event) => set('endTime', event.target.value)} className="input" /></Field>
      <Field label="Ishtirokchilar limiti"><input required disabled={disabled} min="1" max="100000" type="number" value={form.maxParticipants} onChange={(event) => set('maxParticipants', event.target.value)} className="input" /></Field>
      <Field label="Teglar (vergul bilan)"><input disabled={disabled} value={form.tagsText} onChange={(event) => set('tagsText', event.target.value)} className="input" placeholder="dp, graphs, beginner" /></Field>
      <Field label="Qoidalar (har qatorda bittadan)" className="md:col-span-2"><textarea disabled={disabled} value={form.rulesText} onChange={(event) => set('rulesText', event.target.value)} className="input min-h-24 resize-y" /></Field>
      <Field label="Sovrin (ixtiyoriy)" className="md:col-span-2"><input disabled={disabled} value={form.prize} onChange={(event) => set('prize', event.target.value)} className="input" placeholder="Certificate, prize pool…" /></Field>
    </div>
    {!disabled && <div className="mt-6 flex justify-end"><button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : isNew ? 'Draft yaratish' : 'Sozlamalarni saqlash'}</button></div>}
  </form>;
}

function EmptyProblemSet({ editable, onCreate }: { editable: boolean; onCreate: () => void }) {
  return <div className="p-9 text-center"><Layers3 className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Problem set bo‘sh</p><p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">Masala bankidan mavjud masalani tanlang yoki shu contest uchun yangi masala yozing.</p>{editable && <button type="button" onClick={onCreate} className="btn-primary mt-5 px-4 py-2 text-sm"><Plus className="h-4 w-4" />Masala yaratish</button>}</div>;
}

function ContestProblemRow({ problem, editable, busy, onRemove }: { problem: ProgrammingContestEditor['problems'][number]; editable: boolean; busy: boolean; onRemove: () => void }) {
  return <div className="flex flex-wrap items-center gap-4 p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-display text-sm font-extrabold text-white">{problemLetter(problem.position)}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{problem.title}</p><p className="mt-1 text-xs text-slate-500">{problem.difficulty} · {formatProblemLimit(problem.timeLimitMs, problem.memoryLimitMb)} · {problem.points} ball</p></div><div className="flex flex-wrap items-center gap-2">{problem.tags.slice(0, 3).map((tag) => <span key={tag} className="chip bg-slate-100 text-slate-600">{tag}</span>)}{editable && <button type="button" disabled={busy} onClick={onRemove} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="Contestdan olib tashlash">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}</button>}</div></div>;
}

function ProblemLibraryRow({ problem, active, onClick }: { problem: ManagedProgrammingProblem; active: boolean; onClick: () => void }) {
  const practiceState = problem.publicationScope === 'site' ? 'Practice’da' : problem.practiceAvailableAt ? 'Practice’da' : problem.contestTitle ? `Contest: ${problem.contestTitle}` : 'Contestga biriktirilmagan';
  return <button type="button" onClick={onClick} className={`workspace-list-item flex w-full items-center gap-4 ${active ? 'workspace-list-item-active' : ''}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${problem.publicationScope === 'contest' ? 'bg-sun-50 text-sun-700' : 'bg-indigo-50 text-indigo-700'}`}>{problem.publicationScope === 'contest' ? <Trophy className="h-5 w-5" /> : <BookOpenCheck className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{problem.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{problem.difficulty} · {formatProblemLimit(problem.timeLimitMs, problem.memoryLimitMb)} · {practiceState}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" /></button>;
}

function ProblemEditorForm({ form, setForm, onSubmit, busy, contestContext }: { form: ProblemForm; setForm: React.Dispatch<React.SetStateAction<ProblemForm>>; onSubmit: (event: FormEvent) => void; busy: boolean; contestContext: ManagedContest | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [panel, setPanel] = useState<'problem' | 'checker' | 'pdf'>('problem');
  const set = <K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const editExample = (index: number, key: keyof ProblemExample, value: string) => setForm((current) => ({ ...current, examples: current.examples.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }));
  const editTest = (index: number, key: keyof ProblemTestCase, value: string | number | boolean) => setForm((current) => ({ ...current, testCases: current.testCases.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }));
  const appendTests = (tests: ProblemTestCase[]) => setForm((current) => ({ ...current, testCases: [...current.testCases, ...tests] }));
  useEffect(() => {
    const saveWithShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', saveWithShortcut);
    return () => window.removeEventListener('keydown', saveWithShortcut);
  }, []);

  return <form ref={formRef} onSubmit={onSubmit} className="p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div className="flex flex-wrap rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setPanel('problem')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${panel === 'problem' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Masala</button><button type="button" onClick={() => setPanel('checker')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${panel === 'checker' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Testlar & checker <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{form.testCases.length}</span></button><button type="button" onClick={() => setPanel('pdf')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${panel === 'pdf' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>AI PDF Builder</button></div>
      <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-xs disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : 'Saqlash'} <span className="hidden text-[10px] opacity-80 sm:inline">Ctrl + S</span></button>
    </div>

    <div className="mb-5 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 sm:grid-cols-3"><BuilderStep number="1" title="Masalani yozing" detail="Nomi, sharti va limitlarni to‘ldiring." active={panel === 'problem'} /><BuilderStep number="2" title="Namuna qo‘shing" detail={`${form.examples.filter((example) => example.input || example.output).length} ta sample tayyor.`} active={panel === 'problem'} /><BuilderStep number="3" title="Tekshiring" detail={`${form.testCases.length} ta judge testi mavjud.`} active={panel === 'checker'} /></div>

    {panel === 'problem' ? <div className="space-y-6">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Vaqt limiti"><div className="flex"><input required min="50" max="60000" type="number" value={form.timeLimitMs} onChange={(event) => set('timeLimitMs', event.target.value)} className="input rounded-r-none" /><span className="flex items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-500">ms</span></div></Field><Field label="Xotira limiti"><div className="flex"><input required min="16" max="1024" type="number" value={form.memoryLimitMb} onChange={(event) => set('memoryLimitMb', event.target.value)} className="input rounded-r-none" /><span className="flex items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-500">MB</span></div></Field><Field label="Qiyinlik"><AppSelect value={form.difficulty} onChange={(value) => set('difficulty', value as ProgrammingDifficulty)} options={['Easy', 'Medium', 'Hard'].map((value) => ({ value, label: value }))} ariaLabel="Masala qiyinligi" /></Field></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]"><Field label="Masala nomi (O‘zbekcha)"><input required value={form.title} onChange={(event) => set('title', event.target.value)} className="input" placeholder="A. Ikki son yig‘indisi" /></Field><Field label="Teglar"><input value={form.tagsText} onChange={(event) => set('tagsText', event.target.value)} className="input" placeholder="arrays, math" /></Field></div>
        <MarkdownEditor label="Masala sharti" required value={form.statement} onChange={(value) => set('statement', value)} placeholder="Masalani aniq, to‘liq va o‘quvchiga tushunarli qilib yozing." minHeight="min-h-64" />
        <MarkdownEditor label="Kirish ma’lumotlari" value={form.inputDescription} onChange={(value) => set('inputDescription', value)} placeholder="Kirish formatini yozing." />
        <MarkdownEditor label="Chiqish ma’lumotlari" value={form.outputDescription} onChange={(value) => set('outputDescription', value)} placeholder="Chiqish formatini yozing." />
        <MarkdownEditor label="Cheklovlar" value={form.constraints} onChange={(value) => set('constraints', value)} placeholder="1 ≤ n ≤ 2 × 10⁵" minHeight="min-h-24" />
        <ExamplesEditor examples={form.examples} onChange={editExample} onAdd={() => setForm((current) => ({ ...current, examples: [...current.examples, { input: '', output: '', explanation: '' }] }))} onRemove={(index) => setForm((current) => current.examples.length > 1 ? { ...current, examples: current.examples.filter((_, itemIndex) => itemIndex !== index) } : current)} />
        <MarkdownEditor label="Editorial (contest tugagach ko‘rsatiladi)" value={form.editorial} onChange={(value) => set('editorial', value)} placeholder="Yechim g‘oyasi va murakkablik tahlili" />
        <Field label="Nashr oqimi"><AppSelect value={form.publicationScope} onChange={(value) => set('publicationScope', value as ProblemPublicationScope)} options={[{ value: 'site', label: 'Site masalasi', description: 'Saqlangach Practice’da ko‘rinadi' }, { value: 'contest', label: 'Contest masalasi', description: 'Contest tugagach Practice’da ko‘rinadi' }]} ariaLabel="Nashr oqimi" />{form.publicationScope === 'contest' && <p className="mt-2 text-xs leading-relaxed text-sun-700">{contestContext ? `Bu masala “${contestContext.title}” contestiga saqlanadi va contest tugagach Practice’ga avtomatik ochiladi.` : 'Contest scope masalani saqlang, so‘ng contest problem setiga biriktiring.'}</p>}</Field>
      </div>
      <LiveProblemPreview form={form} />
    </div> : panel === 'checker' ? <div className="space-y-5"><div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-5 w-5 text-indigo-600" /><div><p className="text-sm font-bold text-slate-800">Standart checker</p><p className="mt-1 text-xs leading-relaxed text-slate-600">Judge outputni tokenlar bo‘yicha tekshiradi: bo‘sh joylar va satr oxiri farqlari yechimni noto‘g‘ri qilmaydi. Maxsus checker keyingi kengaytma sifatida ushbu tabga ulanadi.</p></div></div></div><TestCasesEditor tests={form.testCases} onChange={editTest} onAppend={appendTests} onAdd={() => setForm((current) => ({ ...current, testCases: [...current.testCases, { input: '', output: '', isSample: false, weight: 1 }] }))} onRemove={(index) => setForm((current) => ({ ...current, testCases: current.testCases.filter((_, itemIndex) => itemIndex !== index) }))} /></div> : <ContestProblemPdfBuilder problem={form} contestName={contestContext?.title} />}
  </form>;
}

function MarkdownEditor({ label, value, onChange, placeholder, minHeight = 'min-h-36', required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; minHeight?: string; required?: boolean }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const insert = (before: string, after = '') => {
    const target = editorRef.current;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? start;
    const selection = value.slice(start, end) || 'matn';
    const next = `${value.slice(0, start)}${before}${selection}${after}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => { target?.focus(); target?.setSelectionRange(start + before.length, start + before.length + selection.length); });
  };
  const actions = [{ label: 'B', title: 'Qalin', icon: Bold, before: '**', after: '**' }, { label: '</>', title: 'Kod', icon: Code2, before: '`', after: '`' }, { label: '•', title: 'Ro‘yxat', icon: List, before: '- ' }, { label: '1.', title: 'Raqamli ro‘yxat', icon: ListOrdered, before: '1. ' }, { label: '↗', title: 'Havola', icon: Link2, before: '[', after: '](https://)' }, { label: 'ƒ', title: 'Formula', icon: Calculator, before: '$', after: '$' }];
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-error-600">*</span>}</span><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100"><div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">{actions.map(({ label: actionLabel, title, icon: Icon, before, after }) => <button key={title} type="button" title={title} aria-label={title} onClick={() => insert(before, after)} className="flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-bold text-slate-500 hover:bg-white hover:text-indigo-700"><Icon className="h-3.5 w-3.5" /><span className="sr-only">{actionLabel}</span></button>)}</div><textarea ref={editorRef} required={required} value={value} onChange={(event) => onChange(event.target.value)} className={`block w-full resize-y border-0 bg-transparent p-3 font-mono text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 ${minHeight}`} placeholder={placeholder} /></div></label>;
}

function LiveProblemPreview({ form }: { form: ProblemForm }) {
  const examples = form.examples.filter((example) => example.input || example.output);
  return <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap gap-2"><span className="chip bg-indigo-50 text-indigo-700"><Clock3 className="h-3.5 w-3.5" />{form.timeLimitMs || '—'} ms</span><span className="chip bg-slate-200 text-slate-700">{form.memoryLimitMb || '—'} MB</span><span className="chip bg-sun-50 text-sun-700">{form.difficulty}</span></div><div className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Live preview</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{form.title || 'Masala nomi kiritilmagan'}</h3></div><div className="grid gap-5 p-4 lg:grid-cols-2"><div className="space-y-4"><PreviewBlock title="Shart" value={form.statement} empty="Masala sharti shu yerda ko‘rinadi." /><PreviewBlock title="Kirish ma’lumotlari" value={form.inputDescription} empty="Kirish formati kiritilmagan." /></div><div className="space-y-4"><PreviewBlock title="Chiqish ma’lumotlari" value={form.outputDescription} empty="Chiqish formati kiritilmagan." /><PreviewBlock title="Cheklovlar" value={form.constraints} empty="Cheklovlar kiritilmagan." /></div><div className="lg:col-span-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Namunaviy testlar</p>{examples.length ? <div className="mt-2 overflow-hidden rounded-lg border border-slate-200"><div className="grid grid-cols-[2.5rem_1fr_1fr] bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span className="p-2">#</span><span className="border-l border-slate-200 p-2">input.txt</span><span className="border-l border-slate-200 p-2">output.txt</span></div>{examples.map((example, index) => <div key={index} className="grid grid-cols-[2.5rem_1fr_1fr] border-t border-slate-100 text-xs"><span className="p-2 font-bold text-slate-400">{index + 1}</span><pre className="overflow-auto border-l border-slate-100 p-2 font-mono text-slate-700">{example.input}</pre><pre className="overflow-auto border-l border-slate-100 p-2 font-mono text-slate-700">{example.output}</pre></div>)}</div> : <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Namunaviy testcase’lar mavjud emas</p>}</div></div></div></aside>;
}

function PreviewBlock({ title, value, empty }: { title: string; value: string; empty: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p><p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${value ? 'text-slate-700' : 'text-slate-400'}`}>{value || empty}</p></div>;
}

function BuilderStep({ number, title, detail, active }: { number: string; title: string; detail: string; active: boolean }) {
  return <div className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${active ? 'bg-white shadow-sm ring-1 ring-indigo-100' : ''}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{number}</span><span className="min-w-0"><span className="block text-xs font-bold text-slate-700">{title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{detail}</span></span></div>;
}

function ExamplesEditor({ examples, onChange, onAdd, onRemove }: { examples: ProblemExample[]; onChange: (index: number, key: keyof ProblemExample, value: string) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Namunalar</p><p className="mt-1 text-xs text-slate-500">Foydalanuvchiga ko‘rinadigan input va output.</p></div><button type="button" onClick={onAdd} className="text-xs font-bold text-indigo-700">+ Namuna</button></div><div className="mt-4 space-y-4">{examples.map((example, index) => <div key={index} className="rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-500">Namuna {index + 1}</p>{examples.length > 1 && <button type="button" onClick={() => onRemove(index)} className="text-xs font-semibold text-error-700">O‘chirish</button>}</div><div className="grid gap-3 sm:grid-cols-2"><textarea value={example.input} onChange={(event) => onChange(index, 'input', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Input" /><textarea value={example.output} onChange={(event) => onChange(index, 'output', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Output" /></div><input value={example.explanation ?? ''} onChange={(event) => onChange(index, 'explanation', event.target.value)} className="input mt-3" placeholder="Izoh (ixtiyoriy)" /></div>)}</div></div>;
}

function TestCasesEditor({ tests, onChange, onAppend, onAdd, onRemove }: { tests: ProblemTestCase[]; onChange: (index: number, key: keyof ProblemTestCase, value: string | number | boolean) => void; onAppend: (tests: ProblemTestCase[]) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<TestcaseGeneratorLanguage>('javascript');
  const [generatorSource, setGeneratorSource] = useState(generatorExamples.javascript.generatorSource);
  const [referenceSource, setReferenceSource] = useState(generatorExamples.javascript.referenceSource);
  const [count, setCount] = useState('10');
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeLanguage = (value: TestcaseGeneratorLanguage) => {
    setLanguage(value);
    setGeneratorSource(generatorExamples[value].generatorSource);
    setReferenceSource(generatorExamples[value].referenceSource);
    setStatus(null);
    setError(null);
  };

  const applyTemplate = () => {
    setGeneratorSource(generatorExamples[language].generatorSource);
    setReferenceSource(generatorExamples[language].referenceSource);
    setError(null);
  };

  const addImportedArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      const imported = readTestcaseArchive(await file.arrayBuffer());
      onAppend(imported.map((test) => ({ ...test, isSample: false, weight: 1 })));
      setStatus(`${imported.length} ta test ZIP’dan qo‘shildi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ZIP import qilib bo‘lmadi.');
    }
  };

  const generate = async () => {
    const parsedCount = Number(count);
    const parsedSeed = Number(seed);
    setGenerating(true);
    setError(null);
    setStatus(null);
    try {
      const request = {
        language,
        generatorSource,
        referenceSource,
        count: parsedCount,
        seed: Number.isInteger(parsedSeed) ? parsedSeed : Date.now(),
      };
      const generated = language === 'javascript'
        ? await generateJavaScriptTestCases(request)
        : await generateRemoteTestCases(request);
      if (!generated.length) throw new Error('Generator hech qanday test qaytarmadi.');
      onAppend(generated.map((test) => ({ ...test, isSample: false, weight: 1 })));
      setStatus(`${generated.length} ta test yaratildi va ro‘yxatga qo‘shildi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Testlarni yaratib bo‘lmadi.');
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    try {
      downloadTestcaseArchive(tests, 'programming-testcases');
      setStatus(`${tests.length} ta test ZIP faylga tayyorlandi.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ZIP yuklab olinmadi.');
    }
  };

  return <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-bold text-slate-800">Judge testlari <span className="font-medium text-slate-400">({tests.length})</span></p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">Testlar ixtiyoriy: qo‘lda yozing, generator bilan yarating yoki ZIP’dan import qiling. Barchasi bitta ro‘yxatda saqlanadi.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onAdd} className="btn-ghost px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Qo‘lda test</button><button type="button" onClick={() => importRef.current?.click()} className="btn-ghost px-3 py-2 text-xs"><Upload className="h-3.5 w-3.5" />ZIP import</button><button type="button" onClick={download} disabled={!tests.length} className="btn-ghost px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-3.5 w-3.5" />ZIP yuklab olish</button><input ref={importRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => void addImportedArchive(event)} /></div>
    </div>

    <details className="rounded-xl border border-indigo-100 bg-white p-3" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-indigo-800"><Wand2 className="h-4 w-4" />Testcase Generator <span className="text-xs font-medium text-slate-400">JavaScript · Python · C++</span></summary>
      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Til</span><select value={language} onChange={(event) => changeLanguage(event.target.value as TestcaseGeneratorLanguage)} className="input h-10 py-1.5 text-xs">{generatorLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Testlar</span><input value={count} min="1" max="25" type="number" onChange={(event) => setCount(event.target.value)} className="input h-10 py-1.5 text-xs" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">Seed</span><input value={seed} type="number" onChange={(event) => setSeed(event.target.value)} className="input h-10 py-1.5 text-xs" /></label><button type="button" onClick={applyTemplate} className="mt-6 h-10 text-xs font-bold text-indigo-700 hover:text-indigo-800">Misolni tiklash</button></div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">Generator har bir test uchun input, reference solution esa shu input uchun expected output yaratadi. JavaScript brauzer worker’ida, Python va C++ himoyalangan judge xizmatida ishlaydi.</p>
        <div className="grid gap-3 lg:grid-cols-2"><label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><FileCode2 className="h-3.5 w-3.5" />Generator kodi</span><textarea value={generatorSource} onChange={(event) => setGeneratorSource(event.target.value)} spellCheck={false} className="input min-h-52 resize-y font-mono text-xs leading-5" /></label><label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Code2 className="h-3.5 w-3.5" />Reference solution</span><textarea value={referenceSource} onChange={(event) => setReferenceSource(event.target.value)} spellCheck={false} className="input min-h-52 resize-y font-mono text-xs leading-5" /></label></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div>{error && <p className="text-xs font-semibold text-error-700">{error}</p>}{status && <p className="text-xs font-semibold text-success-700">{status}</p>}</div><button type="button" onClick={() => void generate()} disabled={generating} className="btn-primary px-4 py-2 text-xs disabled:opacity-60">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{generating ? 'Yaratilmoqda…' : 'Testlarni yaratish'}</button></div>
      </div>
    </details>

    {!tests.length ? <div className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-5 text-center"><FileArchive className="mx-auto h-7 w-7 text-indigo-300" /><p className="mt-2 text-sm font-semibold text-slate-700">Test qo‘shilmagan</p><p className="mt-1 text-xs text-slate-500">Bu draftni testlarsiz saqlashingiz mumkin. Keyin qo‘lda, generator orqali yoki ZIP import bilan test qo‘shing.</p></div> : <div className="space-y-4">{tests.map((test, index) => <div key={`${test.id ?? 'new'}-${index}`} className="rounded-xl border border-indigo-100 bg-white p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-500">Test {index + 1}</p><div className="flex items-center gap-3"><label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={test.isSample} onChange={(event) => onChange(index, 'isSample', event.target.checked)} className="accent-indigo-600" />Sample</label><label className="flex items-center gap-1 text-xs text-slate-600">Weight <input min="1" max="100" type="number" value={test.weight} onChange={(event) => onChange(index, 'weight', Number(event.target.value))} className="w-14 rounded border border-slate-200 px-1.5 py-1 text-xs" /></label><button type="button" onClick={() => onRemove(index)} className="text-xs font-semibold text-error-700">O‘chirish</button></div></div><div className="grid gap-3 sm:grid-cols-2"><textarea value={test.input} onChange={(event) => onChange(index, 'input', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Input" /><textarea value={test.output} onChange={(event) => onChange(index, 'output', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Expected output" /></div></div>)}</div>}
  </section>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
