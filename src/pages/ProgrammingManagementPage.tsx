import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  BookOpenCheck,
  ChevronRight,
  Code2,
  Compass,
  FileCode2,
  FolderPlus,
  Layers3,
  LibraryBig,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { Link } from '@/router';
import { useAccessControl } from '@/lib/access';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/LoadingState';
import { AppSelect } from '@/components/AppSelect';
import { ManagementToast } from '@/components/ManagementToast';
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
    testCases: [{ input: '', output: '', isSample: false, weight: 1 }],
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
    testCases: problem.testCases.length ? problem.testCases : [{ input: '', output: '', isSample: false, weight: 1 }],
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
  const canEditSettings = isContestSettingsEditable(selectedContest);
  const canEditProblemSet = isProblemSetEditable(selectedContest);
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
    setTab('problems');
    setSelectedProblemId(null);
    setProblemForm(emptyProblemForm(scope));
    setError(null);
    setNotice(null);
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
    if (!problemForm.testCases.length || problemForm.testCases.some((test) => !test.input.trim() && !test.output.trim())) return setError('Kamida bitta to‘liq test qo‘shing.');
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
  const set = <K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const editExample = (index: number, key: keyof ProblemExample, value: string) => setForm((current) => ({ ...current, examples: current.examples.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }));
  const editTest = (index: number, key: keyof ProblemTestCase, value: string | number | boolean) => setForm((current) => ({ ...current, testCases: current.testCases.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }));
  return <form onSubmit={onSubmit} className="p-5 sm:p-6">
    <div className="grid gap-5">
      <Field label="Masala nomi"><input required value={form.title} onChange={(event) => set('title', event.target.value)} className="input" placeholder="A. Two Sum" /></Field>
      <Field label="Masala sharti"><textarea required value={form.statement} onChange={(event) => set('statement', event.target.value)} className="input min-h-44 resize-y font-mono text-sm" placeholder="Masalani aniq, to‘liq va Markdown-uslubida yozing." /></Field>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Input"><textarea value={form.inputDescription} onChange={(event) => set('inputDescription', event.target.value)} className="input min-h-28 resize-y" placeholder="Kirish formati" /></Field><Field label="Output"><textarea value={form.outputDescription} onChange={(event) => set('outputDescription', event.target.value)} className="input min-h-28 resize-y" placeholder="Chiqish formati" /></Field></div>
      <Field label="Cheklovlar"><textarea value={form.constraints} onChange={(event) => set('constraints', event.target.value)} className="input min-h-24 resize-y font-mono text-sm" placeholder="1 ≤ n ≤ 2 × 10⁵" /></Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Qiyinlik"><AppSelect value={form.difficulty} onChange={(value) => set('difficulty', value as ProgrammingDifficulty)} options={['Easy', 'Medium', 'Hard'].map((value) => ({ value, label: value }))} ariaLabel="Masala qiyinligi" /></Field>
        <Field label="Teglar (vergul bilan)"><input value={form.tagsText} onChange={(event) => set('tagsText', event.target.value)} className="input" placeholder="arrays, sorting" /></Field>
        <Field label="Time limit (ms)"><input required min="50" max="60000" type="number" value={form.timeLimitMs} onChange={(event) => set('timeLimitMs', event.target.value)} className="input" /></Field>
        <Field label="Memory limit (MB)"><input required min="16" max="1024" type="number" value={form.memoryLimitMb} onChange={(event) => set('memoryLimitMb', event.target.value)} className="input" /></Field>
      </div>
      <Field label="Nashr oqimi"><AppSelect value={form.publicationScope} onChange={(value) => set('publicationScope', value as ProblemPublicationScope)} options={[{ value: 'site', label: 'Site masalasi', description: 'Saqlangach Practice’da ko‘rinadi' }, { value: 'contest', label: 'Contest masalasi', description: 'Contest tugagach Practice’da ko‘rinadi' }]} ariaLabel="Nashr oqimi" />{form.publicationScope === 'contest' && <p className="mt-2 text-xs leading-relaxed text-sun-700">{contestContext ? `Bu masalani saqlagach “${contestContext.title}” contestiga biriktiring. Practice nashri ${contestDate(contestContext.endTime)} dan keyin avtomatik ishlaydi.` : 'Contest scope masalani saqlang, so‘ng Contestlar yorlig‘ida problem setga biriktiring.'}</p>}</Field>
      <ExamplesEditor examples={form.examples} onChange={editExample} onAdd={() => setForm((current) => ({ ...current, examples: [...current.examples, { input: '', output: '', explanation: '' }] }))} onRemove={(index) => setForm((current) => current.examples.length > 1 ? { ...current, examples: current.examples.filter((_, itemIndex) => itemIndex !== index) } : current)} />
      <TestCasesEditor tests={form.testCases} onChange={editTest} onAdd={() => setForm((current) => ({ ...current, testCases: [...current.testCases, { input: '', output: '', isSample: false, weight: 1 }] }))} onRemove={(index) => setForm((current) => current.testCases.length > 1 ? { ...current, testCases: current.testCases.filter((_, itemIndex) => itemIndex !== index) } : current)} />
      <Field label="Editorial (contest tugagach ko‘rsatilishi mumkin)"><textarea value={form.editorial} onChange={(event) => set('editorial', event.target.value)} className="input min-h-28 resize-y" placeholder="Yechim g‘oyasi va murakkablik tahlili" /></Field>
    </div>
    <div className="mt-6 flex justify-end"><button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : 'Masalani saqlash'}</button></div>
  </form>;
}

function ExamplesEditor({ examples, onChange, onAdd, onRemove }: { examples: ProblemExample[]; onChange: (index: number, key: keyof ProblemExample, value: string) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Namunalar</p><p className="mt-1 text-xs text-slate-500">Foydalanuvchiga ko‘rinadigan input va output.</p></div><button type="button" onClick={onAdd} className="text-xs font-bold text-indigo-700">+ Namuna</button></div><div className="mt-4 space-y-4">{examples.map((example, index) => <div key={index} className="rounded-xl bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-500">Namuna {index + 1}</p>{examples.length > 1 && <button type="button" onClick={() => onRemove(index)} className="text-xs font-semibold text-error-700">O‘chirish</button>}</div><div className="grid gap-3 sm:grid-cols-2"><textarea value={example.input} onChange={(event) => onChange(index, 'input', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Input" /><textarea value={example.output} onChange={(event) => onChange(index, 'output', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Output" /></div><input value={example.explanation ?? ''} onChange={(event) => onChange(index, 'explanation', event.target.value)} className="input mt-3" placeholder="Izoh (ixtiyoriy)" /></div>)}</div></div>;
}

function TestCasesEditor({ tests, onChange, onAdd, onRemove }: { tests: ProblemTestCase[]; onChange: (index: number, key: keyof ProblemTestCase, value: string | number | boolean) => void; onAdd: () => void; onRemove: (index: number) => void }) {
  return <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Judge testlari</p><p className="mt-1 text-xs text-slate-500">Bu testlar foydalanuvchiga ko‘rinmaydi; sample sifatida belgilanganlari bundan mustasno.</p></div><button type="button" onClick={onAdd} className="text-xs font-bold text-indigo-700">+ Test</button></div><div className="mt-4 space-y-4">{tests.map((test, index) => <div key={index} className="rounded-xl border border-indigo-100 bg-white p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-500">Test {index + 1}</p><div className="flex items-center gap-3"><label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={test.isSample} onChange={(event) => onChange(index, 'isSample', event.target.checked)} className="accent-indigo-600" />Sample</label><label className="flex items-center gap-1 text-xs text-slate-600">Weight <input min="1" max="100" type="number" value={test.weight} onChange={(event) => onChange(index, 'weight', Number(event.target.value))} className="w-14 rounded border border-slate-200 px-1.5 py-1 text-xs" /></label>{tests.length > 1 && <button type="button" onClick={() => onRemove(index)} className="text-xs font-semibold text-error-700">O‘chirish</button>}</div></div><div className="grid gap-3 sm:grid-cols-2"><textarea required value={test.input} onChange={(event) => onChange(index, 'input', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Input" /><textarea required value={test.output} onChange={(event) => onChange(index, 'output', event.target.value)} className="input min-h-20 resize-y font-mono text-xs" placeholder="Expected output" /></div></div>)}</div></div>;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
