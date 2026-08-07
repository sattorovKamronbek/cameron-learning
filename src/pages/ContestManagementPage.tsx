import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
} from 'lucide-react';
import { Link } from '@/router';
import { LoadingState } from '@/components/LoadingState';
import {
  archiveContest,
  contestSubjects,
  createContest,
  deleteContestQuestion,
  fetchContestEditor,
  fetchManagedContests,
  finalizeContest,
  formatContestDate,
  publishContest,
  saveContestQuestion,
  updateContest,
  type ContestDifficulty,
  type ContestEditor,
  type ContestInput,
  type ContestQuestionInput,
  type ContestType,
  type EditorQuestion,
  type ManagedContest,
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
  position: number;
  prompt: string;
  options: string[];
  correctOption: number;
  points: string;
  explanation: string;
};

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
    subjectSlug: 'programming',
    difficulty: 'Medium',
    type: 'Rated',
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

function emptyQuestion(position: number): QuestionForm {
  return { id: null, position, prompt: '', options: ['', '', '', ''], correctOption: 0, points: '1', explanation: '' };
}

function questionFormFrom(question: EditorQuestion): QuestionForm {
  return {
    id: question.id,
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
    position: form.position,
    prompt: form.prompt,
    options: form.options,
    correctOption: form.correctOption,
    points: Number(form.points),
    explanation: form.explanation,
  };
}

function displayDate(value: string): string {
  const result = formatContestDate(value);
  return `${result.date} · ${result.time}`;
}

export function ContestManagementPage() {
  const [contests, setContests] = useState<ManagedContest[]>([]);
  const [editor, setEditor] = useState<ContestEditor | null>(null);
  const [form, setForm] = useState<ContestForm>(defaultContestForm);
  const [question, setQuestion] = useState<QuestionForm>(emptyQuestion(1));
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
      setQuestion(emptyQuestion(next.questions.length + 1));
      setNewContest(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Contest tahrirlovchisi ochilmadi.');
    } finally {
      setEditorLoading(false);
    }
  }, []);

  const selectContest = (contestId: string) => { void loadEditor(contestId); };

  const openNewContest = () => {
    setNewContest(true);
    setEditor(null);
    setForm(defaultContestForm());
    setQuestion(emptyQuestion(1));
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

    await run('question', async () => {
      await saveContestQuestion(editor.contest.id, questionInput(question));
      await refresh();
      await loadEditor(editor.contest.id, false);
    }, question.id ? 'Savol yangilandi.' : 'Savol saqlandi.');
  };

  const currentContest = editor?.contest ?? null;
  const editable = Boolean(currentContest && !currentContest.isPublished && currentContest.status === 'Upcoming');
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
    return `${currentContest.questionCount} savol · ${currentContest.participants} ro‘yxatdan o‘tgan`;
  }, [currentContest]);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white pt-28">
        <div className="container-page flex flex-wrap items-start justify-between gap-6 py-9">
          <div>
            <span className="eyebrow"><ShieldCheck className="h-3.5 w-3.5" />Protected contest tools</span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Contest boshqaruvi</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">Bu yerda faqat haqiqiy schedule va serverda saqlanadigan savollar bilan contest yaratiladi. E’lon qilish, yakunlash va rating hisoblash huquqi judge/admin nazoratida.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/contests" className="btn-ghost px-4 py-2.5 text-sm">Ommaviy contestlar</Link>
            <button type="button" onClick={() => void refresh()} disabled={loading || isBusy} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-60"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Yangilash</button>
            <button type="button" onClick={openNewContest} className="btn-primary px-4 py-2.5 text-sm"><Plus className="h-4 w-4" />Yangi contest</button>
          </div>
        </div>
      </section>

      <main className="container-page py-8">
        {error && <Notice kind="error">{error}</Notice>}
        {notice && <Notice kind="success">{notice}</Notice>}

        <div className="grid gap-7 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="card h-fit overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><p className="text-sm font-bold text-slate-900">Mening contestlarim</p><p className="mt-0.5 text-xs text-slate-400">Faqat siz boshqara oladiganlari</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{contests.length}</span></div>
            {loading ? <div className="p-6"><LoadingState message="Yuklanmoqda" /></div> : contests.length ? <div className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">{contests.map((contest) => <button key={contest.id} type="button" onClick={() => selectContest(contest.id)} className={`w-full p-4 text-left transition-colors hover:bg-slate-50 ${currentContest?.id === contest.id ? 'bg-indigo-50' : ''}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold text-slate-800">{contest.title}</p><StatusPill contest={contest} /></div><p className="mt-2 text-xs text-slate-500">{displayDate(contest.startTime)}</p><p className="mt-1 text-xs text-slate-400">{contest.questionCount} savol · {contest.participants} ishtirokchi</p></button>)}</div> : <div className="p-6 text-center"><ClipboardList className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Contest hali yo‘q</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Yangi draft yarating, savollarni qo‘shing va keyin e’lon qiling.</p></div>}
          </aside>

          <div className="min-w-0 space-y-7">
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{newContest ? 'New draft' : 'Contest settings'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{newContest ? 'Yangi contest yaratish' : currentContest?.title}</h2>{contestSummary && <p className="mt-1 text-sm text-slate-500">{contestSummary}</p>}</div>{currentContest && <StatusPill contest={currentContest} large />}</div>
              {editorLoading ? <LoadingState className="min-h-72" message="Tahrirlovchi yuklanmoqda" /> : <ContestFormFields form={form} setForm={setForm} disabled={!newContest && !editable} onSubmit={saveContest} busy={busy === 'contest'} isNew={newContest} />}
            </section>

            {currentContest && (
              <>
                <section className="card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Real questions</p><h2 className="mt-1 text-xl font-bold text-slate-900">Savollar ({questionCount})</h2><p className="mt-1 text-sm text-slate-500">To‘g‘ri javoblar faqat shu himoyalangan editor va serverda saqlanadi.</p></div>{editable && <button type="button" onClick={() => setQuestion(emptyQuestion(questionCount + 1))} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Savol qo‘shish</button>}</div>
                  {editor?.questions.length ? <div className="divide-y divide-slate-100">{editor.questions.map((item) => <QuestionRow key={item.id} question={item} editable={editable} busy={busy === `delete:${item.id}`} onEdit={() => setQuestion(questionFormFrom(item))} onDelete={() => void deleteQuestion(item.id)} />)}</div> : <div className="p-6 text-sm text-slate-500">Savol yo‘q. Contest e’lon qilinishidan oldin kamida bitta to‘liq savol qo‘shilishi shart.</div>}
                  {editable && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} />}
                  {!editable && <div className="border-t border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">{currentContest.isPublished ? 'E’lon qilingan contest savollari o‘zgarmaydi.' : 'Boshlangan contest savollari o‘zgarmaydi.'}</div>}
                </section>

                <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-bold text-slate-900">Contest holati</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">E’lon qilinganidan keyin contest ommaviy ro‘yxatda chiqadi. Tugagan rated contest faqat yakunlash tugmasi bosilgach foydalanuvchilarning haqiqiy ratingiga ta’sir qiladi.</p></div><div className="flex flex-wrap gap-2">{editable && <button type="button" onClick={() => void publish()} disabled={questionCount === 0 || isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Send className="h-4 w-4" />E’lon qilish</button>}{currentContest.isPublished && currentContest.status === 'Finished' && !currentContest.isFinalized && <button type="button" onClick={() => void finalize()} disabled={isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Trophy className="h-4 w-4" />Natijani yakunlash</button>}{!currentContest.archivedAt && <button type="button" onClick={() => void archive()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Archive className="h-4 w-4" />Arxivlash</button>}</div></div></section>
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

function ContestFormFields({ form, setForm, disabled, onSubmit, busy, isNew }: { form: ContestForm; setForm: Dispatch<SetStateAction<ContestForm>>; disabled: boolean; onSubmit: (event: FormEvent) => void; busy: boolean; isNew: boolean }) {
  const update = <K extends keyof ContestForm>(key: K, value: ContestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form onSubmit={onSubmit} className="p-5 sm:p-6">
      {disabled && <div className="mb-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">E’lon qilingan yoki boshlangan contestning jadvali va tavsifi o‘zgartirilmaydi.</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Contest nomi" className="md:col-span-2"><input required value={form.title} disabled={disabled} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: August Mathematics Challenge" /></Field>
        <Field label="Tavsif" className="md:col-span-2"><textarea value={form.description} disabled={disabled} onChange={(event) => update('description', event.target.value)} className="input min-h-28 resize-y" placeholder="Contest maqsadi va qatnashuvchilar bilishi kerak bo‘lgan ma’lumotlar" /></Field>
        <Field label="Fan"><select value={form.subjectSlug} disabled={disabled} onChange={(event) => update('subjectSlug', event.target.value)} className="input">{contestSubjects.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</select></Field>
        <Field label="Turi"><select value={form.type} disabled={disabled} onChange={(event) => update('type', event.target.value as ContestType)} className="input"><option value="Rated">Rated — yakunlangach ratingga ta’sir qiladi</option><option value="Unrated">Unrated — ratingga ta’sir qilmaydi</option></select></Field>
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

function QuestionRow({ question, editable, busy, onEdit, onDelete }: { question: EditorQuestion; editable: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Savol {question.position} · {question.points} ball</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{question.prompt}</p><p className="mt-2 text-xs text-slate-500">To‘g‘ri variant: {String.fromCharCode(65 + question.correctOption)}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>;
}

function QuestionFormFields({ form, setForm, busy, onSubmit }: { form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; busy: boolean; onSubmit: (event: FormEvent) => void }) {
  const updateOption = (index: number, value: string) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const addOption = () => setForm((current) => current.options.length >= 8 ? current : { ...current, options: [...current.options, ''] });
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
  return <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Savol ${form.position} ni tahrirlash` : 'Yangi savol'}</p><p className="mt-1 text-xs text-slate-500">Javoblar va to‘g‘ri variant serverda himoyalangan tarzda saqlanadi.</p></div>{form.id && <button type="button" onClick={() => setForm(emptyQuestion(form.position))} className="btn-ghost px-3 py-2 text-xs">Bekor qilish</button>}</div><div className="mt-5 grid gap-4"><Field label="Savol raqami"><input required min="1" type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))} className="input max-w-36" /></Field><Field label="Savol matni"><textarea required value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} className="input min-h-24 resize-y" placeholder="Savolni aniq va to‘liq yozing" /></Field><div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">Variantlar</label>{form.options.length < 8 && <button type="button" onClick={addOption} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">+ Variant qo‘shish</button>}</div><div className="space-y-2">{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><label className="flex cursor-pointer items-center"><input type="radio" name="correct-option" checked={form.correctOption === index} onChange={() => setForm((current) => ({ ...current, correctOption: index }))} className="h-4 w-4 accent-indigo-600" /><span className="ml-2 w-5 text-xs font-bold text-slate-500">{String.fromCharCode(65 + index)}</span></label><input required value={option} onChange={(event) => updateOption(index, event.target.value)} className="input flex-1" placeholder={`${String.fromCharCode(65 + index)} variant`} />{form.options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700" aria-label={`Variant ${index + 1} ni o‘chirish`}><Trash2 className="h-4 w-4" /></button>}</div>)}</div><p className="mt-2 text-xs text-slate-500">Radio tugmasi to‘g‘ri variantni belgilaydi; foydalanuvchiga u ko‘rsatilmaydi.</p></div><div className="grid gap-4 md:grid-cols-3"><Field label="Ball"><input required min="1" max="1000" type="number" value={form.points} onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} className="input" /></Field><Field label="Izoh (ixtiyoriy)" className="md:col-span-2"><input value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} className="input" placeholder="Natija chiqqandan keyingi tushuntirish" /></Field></div></div><div className="mt-5 flex justify-end"><button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : form.id ? 'Savolni saqlash' : 'Savol qo‘shish'}</button></div></form>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
