import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;

export type ContestDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';
export type ContestType = 'Rated' | 'Unrated';
export type ContestStatus = 'Upcoming' | 'Live' | 'Finished';
export type ContestMode = 'Contest' | 'Gym';
export type ContestVisibility = 'Public' | 'Private';

const PRIVATE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Creates a 100-bit, human-friendly code for one private contest. */
export function generatePrivateAccessCode(): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure access-code generation is unavailable in this browser.');
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  const characters = Array.from(bytes, (byte) => PRIVATE_CODE_ALPHABET[byte & 31]);
  return `PVT-${characters.slice(0, 5).join('')}-${characters.slice(5, 10).join('')}-${characters.slice(10, 15).join('')}-${characters.slice(15).join('')}`;
}

export type Contest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  subjectSlug: string;
  subject: string;
  difficulty: ContestDifficulty;
  type: ContestType;
  mode: ContestMode;
  visibility: ContestVisibility;
  status: ContestStatus;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxParticipants: number;
  participants: number;
  rules: string[];
  tags: string[];
  prize: string | null;
  organizer: string;
  questionCount: number;
  isFinalized: boolean;
  registered: boolean;
};

export type ContestQuestion = {
  id: string;
  partId: string | null;
  position: number;
  prompt: string;
  options: string[];
  points: number;
};

export type ExamSection = 'listening' | 'reading' | 'writing';

export type ExamPart = {
  id: string;
  position: number;
  section: ExamSection;
  title: string;
  instructions: string;
  content: string;
  audioUrl: string | null;
  maxPoints: number;
};

export type ExamPartInput = Omit<ExamPart, 'id'> & { id?: string | null };

export type ExamSectionTimings = {
  listeningMinutes: number;
  readingMinutes: number;
  writingMinutes: number;
};

export type ActiveExamTiming = ExamSectionTimings & {
  activeSection: ExamSection;
  sectionStartsAt: string;
  sectionEndsAt: string;
};

export type WritingResponse = {
  partId: string;
  content: string;
  submittedAt: string | null;
  updatedAt: string | null;
};

export type WritingSubmission = {
  id: string;
  partId: string;
  partPosition: number;
  partTitle: string;
  maxPoints: number;
  userId: string;
  displayName: string;
  content: string;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
};

export type ContestWorkspace = {
  contest: Pick<Contest, 'id' | 'slug' | 'title' | 'subjectSlug' | 'subject' | 'startTime' | 'endTime' | 'type'> & {
    completedAt: string | null;
  };
  parts: ExamPart[];
  examTiming: ActiveExamTiming | null;
  questions: ContestQuestion[];
  answers: Record<string, number>;
  writingResponses: Record<string, WritingResponse>;
};

export type ContestLeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  answeredCount: number;
  totalQuestions: number;
};

export type ManagedContest = Contest & {
  isPublished: boolean;
  isFinalized: boolean;
  archivedAt: string | null;
};

export type EditorQuestion = ContestQuestion & {
  correctOption: number;
  explanation: string | null;
};

export type ContestEditor = {
  contest: ManagedContest;
  parts: ExamPart[];
  sectionTimings: ExamSectionTimings | null;
  questions: EditorQuestion[];
};

export type ContestInput = {
  title: string;
  description: string;
  subjectSlug: string;
  difficulty: ContestDifficulty;
  type: ContestType;
  /** Existing callers intentionally default to a public competitive contest. */
  mode?: ContestMode;
  visibility?: ContestVisibility;
  /** Required only for a new private contest; never returned from the server. */
  privateAccessCode?: string | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  rules: string[];
  tags: string[];
  prize?: string | null;
};

export type ContestQuestionInput = {
  id?: string | null;
  partId?: string | null;
  position: number;
  prompt: string;
  options: string[];
  correctOption: number;
  points: number;
  explanation?: string | null;
};

export const contestSubjects = [
  ['programming', 'Programming'],
  ['science', 'Science'],
  ['mathematics', 'Mathematics'],
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['biology', 'Biology'],
  ['english', 'English'],
  ['ielts', 'IELTS'],
  ['cefr', 'CEFR'],
  ['sat', 'SAT'],
  ['ai-ml', 'AI & ML'],
  ['cyber-security', 'Cyber Security'],
  ['data-science', 'Data Science'],
  ['economics', 'Economics'],
  ['history', 'History'],
  ['geography', 'Geography'],
] as const;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function asRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.map(asRow);
  return value == null ? [] : [asRow(value)];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function number(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return [];
}

function valueAt(row: Row, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function titleCase(value: string): string {
  return value.split('-').map((part) => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function subjectLabel(slug: string): string {
  return contestSubjects.find(([candidate]) => candidate === slug)?.[1] ?? titleCase(slug);
}

export function formatContestDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatContestDate(value: string): { date: string; time: string; relative: string } {
  const date = new Date(value);
  const delta = date.getTime() - Date.now();
  const minutes = Math.round(Math.abs(delta) / 60000);
  const relative = delta >= 0
    ? (minutes < 60 ? 'Starts soon' : minutes < 1440 ? `Starts in ${Math.round(minutes / 60)}h` : `Starts in ${Math.round(minutes / 1440)}d`)
    : (minutes < 60 ? 'Started recently' : minutes < 1440 ? `Started ${Math.round(minutes / 60)}h ago` : `Started ${Math.round(minutes / 1440)}d ago`);
  return {
    date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    relative,
  };
}

function mapDifficulty(value: unknown): ContestDifficulty {
  const normalized = text(value, 'medium').toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  if (normalized === 'expert') return 'Expert';
  return 'Medium';
}

function mapType(value: unknown): ContestType {
  return text(value).toLowerCase() === 'rated' ? 'Rated' : 'Unrated';
}

function mapMode(value: unknown): ContestMode {
  return text(value).toLowerCase() === 'gym' ? 'Gym' : 'Contest';
}

function mapVisibility(value: unknown): ContestVisibility {
  return text(value).toLowerCase() === 'private' ? 'Private' : 'Public';
}

function mapStatus(value: unknown, startTime: string, endTime: string): ContestStatus {
  const normalized = text(value).toLowerCase();
  if (normalized === 'live') return 'Live';
  if (normalized === 'finished') return 'Finished';
  if (normalized === 'upcoming') return 'Upcoming';
  const now = Date.now();
  if (now < new Date(startTime).getTime()) return 'Upcoming';
  return now >= new Date(endTime).getTime() ? 'Finished' : 'Live';
}

function mapContest(row: Row, managed = false): ManagedContest | Contest {
  const startTime = text(valueAt(row, 'start_at', 'startTime'));
  const endTime = text(valueAt(row, 'end_at', 'endTime'));
  const subjectSlug = text(valueAt(row, 'subject', 'subject_slug'), 'programming');
  const contest: Contest = {
    id: text(valueAt(row, 'id')),
    slug: text(valueAt(row, 'slug')),
    title: text(valueAt(row, 'title')),
    description: text(valueAt(row, 'description')),
    subjectSlug,
    subject: subjectLabel(subjectSlug),
    difficulty: mapDifficulty(valueAt(row, 'difficulty')),
    type: mapType(valueAt(row, 'contest_type', 'type')),
    mode: mapMode(valueAt(row, 'contest_mode', 'mode')),
    visibility: mapVisibility(valueAt(row, 'visibility')),
    status: mapStatus(valueAt(row, 'status'), startTime, endTime),
    startTime,
    endTime,
    durationMinutes: Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)),
    maxParticipants: number(valueAt(row, 'max_participants', 'maxParticipants')),
    participants: number(valueAt(row, 'participant_count', 'participants')),
    rules: arrayOfStrings(valueAt(row, 'rules')),
    tags: arrayOfStrings(valueAt(row, 'tags')),
    prize: nullableText(valueAt(row, 'prize')),
    organizer: text(valueAt(row, 'organizer'), 'Contest organizer'),
    questionCount: number(valueAt(row, 'question_count', 'questions_count')),
    isFinalized: bool(valueAt(row, 'is_finalized', 'isFinalized')),
    registered: bool(valueAt(row, 'is_registered', 'registered')),
  };

  if (!managed) return contest;
  return {
    ...contest,
    isPublished: bool(valueAt(row, 'is_published', 'isPublished')),
    isFinalized: contest.isFinalized,
    archivedAt: nullableText(valueAt(row, 'archived_at', 'archivedAt')),
  };
}

function mapExamSection(value: unknown): ExamSection {
  const section = text(value).toLowerCase();
  if (section === 'listening' || section === 'writing') return section;
  return 'reading';
}

function mapExamPart(row: Row): ExamPart {
  return {
    id: text(valueAt(row, 'id')),
    position: number(valueAt(row, 'position'), 1),
    section: mapExamSection(valueAt(row, 'section')),
    title: text(valueAt(row, 'title'), 'Exam part'),
    instructions: text(valueAt(row, 'instructions')),
    content: text(valueAt(row, 'content')),
    audioUrl: nullableText(valueAt(row, 'audio_url', 'audioUrl')),
    maxPoints: number(valueAt(row, 'max_points', 'maxPoints')),
  };
}

function mapExamSectionTimings(value: unknown): ExamSectionTimings | null {
  const row = asRow(value);
  if (!Object.keys(row).length) return null;
  const listeningMinutes = number(valueAt(row, 'listening_minutes', 'listeningMinutes'));
  const readingMinutes = number(valueAt(row, 'reading_minutes', 'readingMinutes'));
  const writingMinutes = number(valueAt(row, 'writing_minutes', 'writingMinutes'));
  if (listeningMinutes < 1 || readingMinutes < 1 || writingMinutes < 1) return null;
  return { listeningMinutes, readingMinutes, writingMinutes };
}

function mapActiveExamTiming(value: unknown): ActiveExamTiming | null {
  const timings = mapExamSectionTimings(value);
  if (!timings) return null;
  const row = asRow(value);
  const activeSection = mapExamSection(valueAt(row, 'active_section', 'activeSection'));
  const sectionStartsAt = text(valueAt(row, 'section_starts_at', 'sectionStartsAt'));
  const sectionEndsAt = text(valueAt(row, 'section_ends_at', 'sectionEndsAt'));
  if (!sectionStartsAt || !sectionEndsAt) return null;
  return { ...timings, activeSection, sectionStartsAt, sectionEndsAt };
}

function rpcError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchPublicContests(): Promise<Contest[]> {
  const { data, error } = await supabase.rpc('get_discoverable_contests');
  rpcError(error);
  return asRows(data).map((row) => mapContest(row) as Contest);
}

export async function fetchPublicContest(slug: string): Promise<Contest | null> {
  const { data, error } = await supabase.rpc('get_discoverable_contest', { p_slug: slug });
  rpcError(error);
  const row = asRows(data)[0];
  return row ? mapContest(row) as Contest : null;
}

export async function registerForContest(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('register_for_contest_v2', { p_contest_id: contestId });
  rpcError(error);
}

export async function redeemPrivateContestAccess(accessCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_private_contest_access', { p_access_code: accessCode.trim() });
  rpcError(error);
  const slug = text(valueAt(asRow(data), 'slug'));
  if (!slug) throw new Error('Private contest access was not confirmed.');
  return slug;
}

export async function fetchContestWorkspace(slug: string): Promise<ContestWorkspace> {
  const { data, error } = await supabase.rpc('get_contest_workspace', { p_slug: slug });
  rpcError(error);
  const payload = asRow(data);
  const contestRow = asRow(payload.contest);
  const subjectSlug = text(valueAt(contestRow, 'subject'), 'programming');
  const questions = asRows(payload.questions).map((row) => ({
    id: text(valueAt(row, 'id')),
    partId: nullableText(valueAt(row, 'exam_part_id', 'part_id', 'partId')),
    position: number(valueAt(row, 'position')),
    prompt: text(valueAt(row, 'prompt')),
    options: arrayOfStrings(valueAt(row, 'options')),
    points: number(valueAt(row, 'points'), 1),
  })).sort((a, b) => a.position - b.position);
  const answers = Object.fromEntries(asRows(payload.answers).map((row) => [
    text(valueAt(row, 'question_id', 'questionId')),
    number(valueAt(row, 'selected_option', 'selectedOption')),
  ]));
  const writingResponses: Record<string, WritingResponse> = Object.fromEntries(asRows(payload.writing_responses).map((row): [string, WritingResponse] => {
    const partId = text(valueAt(row, 'part_id', 'partId'));
    return [partId, {
      partId,
      content: text(valueAt(row, 'content')),
      submittedAt: nullableTimestamp(valueAt(row, 'submitted_at', 'submittedAt')),
      updatedAt: nullableTimestamp(valueAt(row, 'updated_at', 'updatedAt')),
    }];
  }));

  return {
    contest: {
      id: text(valueAt(contestRow, 'id')),
      slug: text(valueAt(contestRow, 'slug')),
      title: text(valueAt(contestRow, 'title')),
      subjectSlug,
      subject: subjectLabel(subjectSlug),
      startTime: text(valueAt(contestRow, 'start_at', 'startTime')),
      endTime: text(valueAt(contestRow, 'end_at', 'endTime')),
      type: mapType(valueAt(contestRow, 'contest_type', 'type')),
      completedAt: nullableTimestamp(valueAt(contestRow, 'completed_at', 'completedAt')),
    },
    parts: asRows(payload.parts).map(mapExamPart).sort((left, right) => left.position - right.position),
    examTiming: mapActiveExamTiming(payload.exam_timing),
    questions,
    answers,
    writingResponses,
  };
}

export async function submitContestAnswer(questionId: string, selectedOption: number): Promise<void> {
  const { error } = await supabase.rpc('submit_contest_answer', {
    p_question_id: questionId,
    p_selected_option: selectedOption,
  });
  rpcError(error);
}

export async function saveExamWritingResponse(partId: string, content: string, submit = false): Promise<WritingResponse> {
  const { data, error } = await supabase.rpc('save_exam_writing_response', {
    p_exam_part_id: partId,
    p_content: content.trim(),
    p_submit: submit,
  });
  rpcError(error);
  const row = asRow(data);
  return {
    partId,
    content: content.trim(),
    submittedAt: nullableTimestamp(valueAt(row, 'submitted_at', 'submittedAt')),
    updatedAt: new Date().toISOString(),
  };
}

export async function completeEnglishExam(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_exam_submission', { p_contest_id: contestId });
  rpcError(error);
}

export async function fetchContestLeaderboard(slug: string): Promise<ContestLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_contest_leaderboard', { p_slug: slug });
  rpcError(error);
  return asRows(data).map((row, index) => ({
    rank: number(valueAt(row, 'rank'), index + 1),
    userId: text(valueAt(row, 'user_id', 'userId')),
    displayName: text(valueAt(row, 'display_name', 'full_name'), 'Participant'),
    score: number(valueAt(row, 'score')),
    answeredCount: number(valueAt(row, 'answered_count', 'answeredCount')),
    totalQuestions: number(valueAt(row, 'total_questions', 'totalQuestions')),
  }));
}

function contestParams(input: ContestInput) {
  return {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_subject: input.subjectSlug,
    p_difficulty: input.difficulty.toLowerCase(),
    p_contest_type: input.type.toLowerCase(),
    p_contest_mode: (input.mode ?? 'Contest').toLowerCase(),
    p_visibility: (input.visibility ?? 'Public').toLowerCase(),
    p_private_access_code: input.privateAccessCode?.trim() || null,
    p_start_at: new Date(input.startTime).toISOString(),
    p_end_at: new Date(input.endTime).toISOString(),
    p_max_participants: input.maxParticipants,
    p_rules: input.rules.filter(Boolean),
    p_tags: input.tags.filter(Boolean),
    p_prize: input.prize?.trim() || null,
  };
}

export async function fetchManagedContests(): Promise<ManagedContest[]> {
  const { data, error } = await supabase.rpc('get_managed_contests_v2');
  rpcError(error);
  return asRows(data).map((row) => mapContest(row, true) as ManagedContest);
}

export async function createContest(input: ContestInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_contest_v2', contestParams(input));
  rpcError(error);
  const id = text(data);
  if (!id) throw new Error('Contest creation returned no ID.');
  return id;
}

export async function updateContest(contestId: string, input: ContestInput): Promise<void> {
  const { error } = await supabase.rpc('update_contest_v2', { p_contest_id: contestId, ...contestParams(input) });
  rpcError(error);
}

export async function fetchContestEditor(contestId: string): Promise<ContestEditor> {
  const { data, error } = await supabase.rpc('get_contest_editor', { p_contest_id: contestId });
  rpcError(error);
  const payload = asRow(data);
  const contest = mapContest(asRow(payload.contest), true) as ManagedContest;
  const questions = asRows(payload.questions).map((row) => ({
    id: text(valueAt(row, 'id')),
    partId: nullableText(valueAt(row, 'exam_part_id', 'part_id', 'partId')),
    position: number(valueAt(row, 'position')),
    prompt: text(valueAt(row, 'prompt')),
    options: arrayOfStrings(valueAt(row, 'options')),
    correctOption: number(valueAt(row, 'correct_option', 'correctOption')),
    points: number(valueAt(row, 'points'), 1),
    explanation: nullableText(valueAt(row, 'explanation')),
  })).sort((a, b) => a.position - b.position);
  return {
    contest,
    parts: asRows(payload.parts).map(mapExamPart).sort((left, right) => left.position - right.position),
    sectionTimings: mapExamSectionTimings(payload.section_timings),
    questions,
  };
}

export async function saveContestQuestion(contestId: string, input: ContestQuestionInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_contest_question', {
    p_contest_id: contestId,
    p_question_id: input.id ?? null,
    p_exam_part_id: input.partId ?? null,
    p_position: input.position,
    p_prompt: input.prompt.trim(),
    p_options: input.options.map((item) => item.trim()),
    p_correct_option: input.correctOption,
    p_points: input.points,
    p_explanation: input.explanation?.trim() || null,
  });
  rpcError(error);
  const id = text(data);
  if (!id) throw new Error('Question save returned no ID.');
  return id;
}

export async function saveExamPart(contestId: string, input: ExamPartInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_contest_exam_part', {
    p_contest_id: contestId,
    p_part_id: input.id ?? null,
    p_position: input.position,
    p_section: input.section,
    p_title: input.title.trim(),
    p_instructions: input.instructions.trim(),
    p_content: input.content.trim(),
    p_audio_url: input.audioUrl?.trim() || null,
    p_max_points: input.maxPoints,
  });
  rpcError(error);
  const id = text(data);
  if (!id) throw new Error('Exam part save returned no ID.');
  return id;
}

export async function saveExamSectionTimings(contestId: string, input: ExamSectionTimings): Promise<void> {
  const { error } = await supabase.rpc('save_contest_exam_section_timings', {
    p_contest_id: contestId,
    p_listening_minutes: input.listeningMinutes,
    p_reading_minutes: input.readingMinutes,
    p_writing_minutes: input.writingMinutes,
  });
  rpcError(error);
}

export async function deleteExamPart(contestId: string, partId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contest_exam_part', {
    p_contest_id: contestId,
    p_part_id: partId,
  });
  rpcError(error);
}

export async function uploadContestAudio(contestId: string, file: File): Promise<string> {
  if (!file.type.startsWith('audio/')) throw new Error('Faqat audio fayl yuklash mumkin.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Audio fayl hajmi 25 MB dan kichik bo‘lishi kerak.');
  const filename = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'audio';
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${contestId}/${id}-${filename}`;
  const { error } = await supabase.storage.from('contest-audio').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  rpcError(error);
  const { data } = supabase.storage.from('contest-audio').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Audio URL yaratilmadi.');
  return data.publicUrl;
}

export async function fetchWritingSubmissions(contestId: string): Promise<WritingSubmission[]> {
  const { data, error } = await supabase.rpc('get_contest_writing_submissions', { p_contest_id: contestId });
  rpcError(error);
  return asRows(data).map((row) => ({
    id: text(valueAt(row, 'id')),
    partId: text(valueAt(row, 'part_id', 'partId')),
    partPosition: number(valueAt(row, 'part_position', 'partPosition'), 1),
    partTitle: text(valueAt(row, 'part_title', 'partTitle'), 'Writing'),
    maxPoints: number(valueAt(row, 'max_points', 'maxPoints')),
    userId: text(valueAt(row, 'user_id', 'userId')),
    displayName: text(valueAt(row, 'display_name', 'displayName'), 'Participant'),
    content: text(valueAt(row, 'content')),
    submittedAt: text(valueAt(row, 'submitted_at', 'submittedAt')),
    score: valueAt(row, 'score') === null || valueAt(row, 'score') === undefined ? null : number(valueAt(row, 'score')),
    feedback: nullableText(valueAt(row, 'feedback')),
    gradedAt: nullableTimestamp(valueAt(row, 'graded_at', 'gradedAt')),
  }));
}

export async function gradeWritingSubmission(submissionId: string, score: number, feedback = ''): Promise<void> {
  const { error } = await supabase.rpc('grade_contest_writing_submission', {
    p_submission_id: submissionId,
    p_score: score,
    p_feedback: feedback.trim() || null,
  });
  rpcError(error);
}

export async function deleteContestQuestion(contestId: string, questionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contest_question', {
    p_contest_id: contestId,
    p_question_id: questionId,
  });
  rpcError(error);
}

export async function publishContest(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_contest', { p_contest_id: contestId });
  rpcError(error);
}

export async function archiveContest(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_contest', { p_contest_id: contestId });
  rpcError(error);
}

export async function deleteContest(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contest', { p_contest_id: contestId });
  rpcError(error);
}

export async function promotePrivateGymToRated(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('promote_private_gym_to_rated', { p_contest_id: contestId });
  rpcError(error);
}

export async function finalizeContest(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_contest_v2', { p_contest_id: contestId });
  rpcError(error);
}
