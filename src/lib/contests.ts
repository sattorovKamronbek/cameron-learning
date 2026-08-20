import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;

export type ContestDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';
export type ContestType = 'Rated' | 'Unrated';
export type ContestStatus = 'Upcoming' | 'Live' | 'Finished';
export type ContestMode = 'Contest' | 'Gym' | 'Test';
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

/** Generates the single administrator-held code used to restore an excluded attempt. */
export function generateContestIntegrityOverrideCode(): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure code generation is unavailable in this browser.');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const characters = Array.from(bytes, (byte) => PRIVATE_CODE_ALPHABET[byte & 31]);
  return `RESTORE-${characters.slice(0, 4).join('')}-${characters.slice(4, 8).join('')}-${characters.slice(8, 12).join('')}-${characters.slice(12).join('')}`;
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
  answerType: 'choice' | 'text';
  wordLimit: number;
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
  imageUrl: string | null;
  maxPoints: number;
};

export type ExamPartInput = Omit<ExamPart, 'id' | 'imageUrl'> & { id?: string | null };

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

/** A personal text anchor inside a Reading passage. */
export type ReadingHighlight = {
  id: string;
  start: number;
  end: number;
  quote: string;
};

/** Private per-user notes and highlights for one Reading part. */
export type ReadingAnnotation = {
  partId: string;
  note: string;
  highlights: ReadingHighlight[];
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

export type ContestIntegrityExclusion = {
  userId: string;
  displayName: string;
  excludedAt: string;
  reason: string;
};

export type GapFillAnswerKey = {
  partId: string;
  blankNumber: number;
  acceptedAnswers: string[];
  points: number;
};

export type GapFillResponse = {
  partId: string;
  blankNumber: number;
  answer: string;
};

export type MatchingOption = {
  position: number;
  label: string;
};

export type MatchingSpeaker = {
  speakerNumber: number;
  label: string;
  imageUrl: string | null;
  correctOption: number | null;
};

export type MatchingEditorConfig = {
  partId: string;
  options: MatchingOption[];
  speakers: MatchingSpeaker[];
};

export type MatchingWorkspaceConfig = {
  partId: string;
  options: MatchingOption[];
  speakers: Array<Omit<MatchingSpeaker, 'correctOption'>>;
};

export type MatchingResponse = {
  partId: string;
  speakerNumber: number;
  optionPosition: number;
};

export type ContestWorkspace = {
  contest: Pick<Contest, 'id' | 'slug' | 'title' | 'subjectSlug' | 'subject' | 'startTime' | 'endTime' | 'type' | 'mode'> & {
    completedAt: string | null;
    /** A test participant chooses this once before their individual timer starts. */
    showResults: boolean;
  };
  parts: ExamPart[];
  examTiming: ActiveExamTiming | null;
  questions: ContestQuestion[];
  answers: Record<string, number>;
  textAnswers: Record<string, string>;
  gapFillResponses: Record<string, GapFillResponse>;
  matchingConfigs: Record<string, MatchingWorkspaceConfig>;
  matchingResponses: Record<string, MatchingResponse>;
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

/** Objective (Listening + Reading) score a test participant elected to see. */
export type LanguageTestResult = {
  totalScore: number;
  totalPoints: number;
  answeredCount: number;
  totalQuestions: number;
  listeningScore: number;
  listeningPoints: number;
  listeningAnsweredCount: number;
  listeningQuestionCount: number;
  readingScore: number;
  readingPoints: number;
  readingAnsweredCount: number;
  readingQuestionCount: number;
};

/** Server-calculated results visible only to the contest manager after it ends. */
export type ContestAdminResult = ContestLeaderboardEntry & {
  completedAt: string | null;
  listeningCorrectCount: number;
  listeningAnsweredCount: number;
  listeningTotalQuestions: number;
  readingCorrectCount: number;
  readingAnsweredCount: number;
  readingTotalQuestions: number;
  writingScore: number;
  writingMaxPoints: number;
  writingSubmittedCount: number;
  writingGradedCount: number;
  writingTotalCount: number;
  pendingWritingCount: number;
};

export type ManagedContest = Contest & {
  isPublished: boolean;
  isFinalized: boolean;
  archivedAt: string | null;
};

export type EditorQuestion = ContestQuestion & {
  correctOption: number | null;
  acceptedAnswers: string[];
  explanation: string | null;
};

export type ContestEditor = {
  contest: ManagedContest;
  parts: ExamPart[];
  sectionTimings: ExamSectionTimings | null;
  questions: EditorQuestion[];
  gapFillAnswerKeys: GapFillAnswerKey[];
  matchingConfigs: MatchingEditorConfig[];
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
  answerType?: 'choice' | 'text';
  correctOption: number | null;
  acceptedAnswers?: string[];
  wordLimit?: number;
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

function gapFillResponseKey(partId: string, blankNumber: number): string {
  return `${partId}:${blankNumber}`;
}

function matchingResponseKey(partId: string, speakerNumber: number): string {
  return `${partId}:${speakerNumber}`;
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
  const mode = text(value).toLowerCase();
  if (mode === 'gym') return 'Gym';
  if (mode === 'test') return 'Test';
  return 'Contest';
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

function mapAnswerType(value: unknown): 'choice' | 'text' {
  return text(value).toLowerCase() === 'text' ? 'text' : 'choice';
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
    imageUrl: nullableText(valueAt(row, 'image_url', 'imageUrl')),
    maxPoints: number(valueAt(row, 'max_points', 'maxPoints')),
  };
}

function mapMatchingEditorConfigs(value: unknown): MatchingEditorConfig[] {
  return asRows(value).map((row) => ({
    partId: text(valueAt(row, 'part_id', 'partId')),
    options: asRows(valueAt(row, 'options')).map((option) => ({
      position: number(valueAt(option, 'position')),
      label: text(valueAt(option, 'label')),
    })).sort((left, right) => left.position - right.position),
    speakers: asRows(valueAt(row, 'speakers')).map((speaker) => ({
      speakerNumber: number(valueAt(speaker, 'speaker_number', 'speakerNumber')),
      label: text(valueAt(speaker, 'label')),
      imageUrl: nullableText(valueAt(speaker, 'image_url', 'imageUrl')),
      correctOption: valueAt(speaker, 'correct_option', 'correctOption') === null || valueAt(speaker, 'correct_option', 'correctOption') === undefined
        ? null
        : number(valueAt(speaker, 'correct_option', 'correctOption')),
    })).sort((left, right) => left.speakerNumber - right.speakerNumber),
  }));
}

function mapMatchingWorkspaceConfigs(value: unknown): Record<string, MatchingWorkspaceConfig> {
  return Object.fromEntries(asRows(value).map((row): [string, MatchingWorkspaceConfig] => {
    const partId = text(valueAt(row, 'part_id', 'partId'));
    return [partId, {
      partId,
      options: asRows(valueAt(row, 'options')).map((option) => ({ position: number(valueAt(option, 'position')), label: text(valueAt(option, 'label')) })).sort((left, right) => left.position - right.position),
      speakers: asRows(valueAt(row, 'speakers')).map((speaker) => ({ speakerNumber: number(valueAt(speaker, 'speaker_number', 'speakerNumber')), label: text(valueAt(speaker, 'label')), imageUrl: nullableText(valueAt(speaker, 'image_url', 'imageUrl')) })).sort((left, right) => left.speakerNumber - right.speakerNumber),
    }];
  }));
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

function mapReadingHighlights(value: unknown): ReadingHighlight[] {
  return asRows(value).flatMap((row): ReadingHighlight[] => {
    const id = text(valueAt(row, 'id'));
    const start = number(valueAt(row, 'start'), -1);
    const end = number(valueAt(row, 'end'), -1);
    const quote = text(valueAt(row, 'quote'));
    return id
      && Number.isSafeInteger(start)
      && Number.isSafeInteger(end)
      && start >= 0
      && end > start
      && quote
      ? [{ id, start, end, quote }]
      : [];
  });
}

function mapReadingAnnotation(value: unknown): ReadingAnnotation {
  const row = asRow(value);
  return {
    partId: text(valueAt(row, 'part_id', 'partId')),
    note: text(valueAt(row, 'note')),
    highlights: mapReadingHighlights(valueAt(row, 'highlights')),
    updatedAt: nullableTimestamp(valueAt(row, 'updated_at', 'updatedAt')),
  };
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

/** Starts a self-paced IELTS / CEFR test and records its one-time result preference. */
export async function startLanguageTest(contestId: string, showResults: boolean): Promise<void> {
  const { error } = await supabase.rpc('start_language_test', {
    p_contest_id: contestId,
    p_show_results: showResults,
  });
  rpcError(error);
}

/** Returns only Listening and Reading results, never Writing. */
export async function fetchLanguageTestResult(slug: string): Promise<LanguageTestResult> {
  const { data, error } = await supabase.rpc('get_language_test_result', { p_slug: slug });
  rpcError(error);
  const row = asRow(data);
  return {
    totalScore: number(valueAt(row, 'total_score', 'totalScore')),
    totalPoints: number(valueAt(row, 'total_points', 'totalPoints')),
    answeredCount: number(valueAt(row, 'answered_count', 'answeredCount')),
    totalQuestions: number(valueAt(row, 'total_questions', 'totalQuestions')),
    listeningScore: number(valueAt(row, 'listening_score', 'listeningScore')),
    listeningPoints: number(valueAt(row, 'listening_points', 'listeningPoints')),
    listeningAnsweredCount: number(valueAt(row, 'listening_answered_count', 'listeningAnsweredCount')),
    listeningQuestionCount: number(valueAt(row, 'listening_question_count', 'listeningQuestionCount')),
    readingScore: number(valueAt(row, 'reading_score', 'readingScore')),
    readingPoints: number(valueAt(row, 'reading_points', 'readingPoints')),
    readingAnsweredCount: number(valueAt(row, 'reading_answered_count', 'readingAnsweredCount')),
    readingQuestionCount: number(valueAt(row, 'reading_question_count', 'readingQuestionCount')),
  };
}

export async function redeemPrivateContestAccess(accessCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_private_contest_access', { p_access_code: accessCode.trim() });
  rpcError(error);
  const slug = text(valueAt(asRow(data), 'slug'));
  if (!slug) throw new Error('Private contest access was not confirmed.');
  return slug;
}

function mapContestWorkspace(data: unknown): ContestWorkspace {
  const payload = asRow(data);
  const contestRow = asRow(payload.contest);
  const subjectSlug = text(valueAt(contestRow, 'subject'), 'programming');
  const questions = asRows(payload.questions).map((row) => ({
    id: text(valueAt(row, 'id')),
    partId: nullableText(valueAt(row, 'exam_part_id', 'part_id', 'partId')),
    position: number(valueAt(row, 'position')),
    prompt: text(valueAt(row, 'prompt')),
    options: arrayOfStrings(valueAt(row, 'options')),
    answerType: mapAnswerType(valueAt(row, 'answer_type', 'answerType')),
    wordLimit: number(valueAt(row, 'word_limit', 'wordLimit'), 0),
    points: number(valueAt(row, 'points'), 1),
  })).sort((a, b) => a.position - b.position);
  const answers = Object.fromEntries(asRows(payload.answers).flatMap((row): Array<[string, number]> => {
    const questionId = text(valueAt(row, 'question_id', 'questionId'));
    const selectedOption = number(valueAt(row, 'selected_option', 'selectedOption'), -1);
    return questionId && Number.isInteger(selectedOption) && selectedOption >= 0 ? [[questionId, selectedOption]] : [];
  }));
  const textAnswers = Object.fromEntries(asRows(payload.answers).flatMap((row): Array<[string, string]> => {
    const questionId = text(valueAt(row, 'question_id', 'questionId'));
    const selectedText = text(valueAt(row, 'selected_text', 'selectedText'));
    return questionId && selectedText ? [[questionId, selectedText]] : [];
  }));
  const gapFillResponses: Record<string, GapFillResponse> = Object.fromEntries(asRows(payload.gap_fill_responses).map((row): [string, GapFillResponse] => {
    const partId = text(valueAt(row, 'part_id', 'partId'));
    const blankNumber = number(valueAt(row, 'blank_number', 'blankNumber'));
    return [gapFillResponseKey(partId, blankNumber), {
      partId,
      blankNumber,
      answer: text(valueAt(row, 'answer')),
    }];
  }));
  const matchingConfigs = mapMatchingWorkspaceConfigs(payload.matching_configs);
  const matchingResponses: Record<string, MatchingResponse> = Object.fromEntries(asRows(payload.matching_responses).map((row): [string, MatchingResponse] => {
    const partId = text(valueAt(row, 'part_id', 'partId'));
    const speakerNumber = number(valueAt(row, 'speaker_number', 'speakerNumber'));
    return [matchingResponseKey(partId, speakerNumber), {
      partId,
      speakerNumber,
      optionPosition: number(valueAt(row, 'option_position', 'optionPosition')),
    }];
  }));
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
      mode: mapMode(valueAt(contestRow, 'contest_mode', 'mode')),
      completedAt: nullableTimestamp(valueAt(contestRow, 'completed_at', 'completedAt')),
      showResults: bool(valueAt(contestRow, 'show_test_results', 'showResults')),
    },
    parts: asRows(payload.parts).map(mapExamPart).sort((left, right) => {
      const sectionOrder: Record<ExamSection, number> = { listening: 1, reading: 2, writing: 3 };
      return sectionOrder[left.section] - sectionOrder[right.section] || left.position - right.position;
    }),
    examTiming: mapActiveExamTiming(payload.exam_timing),
    questions,
    answers,
    textAnswers,
    gapFillResponses,
    matchingConfigs,
    matchingResponses,
    writingResponses,
  };
}

export async function fetchContestWorkspace(slug: string): Promise<ContestWorkspace> {
  const { data, error } = await supabase.rpc('get_contest_workspace', { p_slug: slug });
  rpcError(error);
  return mapContestWorkspace(data);
}

/** Owner-only rehearsal for a draft contest. It never publishes or registers a participant. */
export async function fetchContestPreviewWorkspace(slug: string): Promise<ContestWorkspace> {
  const { data, error } = await supabase.rpc('get_contest_preview_workspace', { p_slug: slug });
  rpcError(error);
  return mapContestWorkspace(data);
}

/** Fetches only the signed-in user's private Reading notes for a contest. */
export async function fetchReadingAnnotations(contestId: string): Promise<Record<string, ReadingAnnotation>> {
  const { data, error } = await supabase.rpc('get_reading_annotations', { p_contest_id: contestId });
  rpcError(error);
  return Object.fromEntries(asRows(data).flatMap((row): Array<[string, ReadingAnnotation]> => {
    const annotation = mapReadingAnnotation(row);
    return annotation.partId ? [[annotation.partId, annotation]] : [];
  }));
}

/** Saves a user's note and highlights for one Reading part. Empty data removes it. */
export async function saveReadingAnnotation(partId: string, note: string, highlights: ReadingHighlight[]): Promise<ReadingAnnotation> {
  const { data, error } = await supabase.rpc('save_reading_annotation', {
    p_exam_part_id: partId,
    p_note: note.trim(),
    p_highlights: highlights.map((highlight) => ({
      id: highlight.id,
      start: highlight.start,
      end: highlight.end,
      quote: highlight.quote,
    })),
  });
  rpcError(error);
  return mapReadingAnnotation(data);
}

export async function submitContestAnswer(questionId: string, selectedOption: number): Promise<void> {
  const { error } = await supabase.rpc('submit_contest_answer', {
    p_question_id: questionId,
    p_selected_option: selectedOption,
  });
  rpcError(error);
}

export async function submitContestPreviewAnswer(questionId: string, selectedOption: number): Promise<void> {
  const { error } = await supabase.rpc('save_contest_preview_answer', {
    p_question_id: questionId,
    p_selected_option: selectedOption,
  });
  rpcError(error);
}

export async function clearContestAnswer(questionId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_contest_answer', { p_question_id: questionId });
  rpcError(error);
}

export async function clearContestPreviewAnswer(questionId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_contest_preview_answer', { p_question_id: questionId });
  rpcError(error);
}

export async function submitContestTextAnswer(questionId: string, answer: string): Promise<void> {
  const { error } = await supabase.rpc('submit_contest_text_answer', {
    p_question_id: questionId,
    p_selected_text: answer.trim(),
  });
  rpcError(error);
}

export async function submitContestPreviewTextAnswer(questionId: string, answer: string): Promise<void> {
  const { error } = await supabase.rpc('save_contest_preview_text_answer', {
    p_question_id: questionId,
    p_selected_text: answer.trim(),
  });
  rpcError(error);
}

export async function saveCefrGapFillResponse(partId: string, blankNumber: number, answer: string): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_gap_fill_response', {
    p_exam_part_id: partId,
    p_blank_number: blankNumber,
    p_answer: answer.trim(),
  });
  rpcError(error);
}

export async function saveCefrPreviewGapFillResponse(partId: string, blankNumber: number, answer: string): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_preview_gap_fill_response', {
    p_exam_part_id: partId,
    p_blank_number: blankNumber,
    p_answer: answer.trim(),
  });
  rpcError(error);
}

export async function saveCefrMatchingResponse(partId: string, speakerNumber: number, optionPosition: number): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_matching_response', {
    p_exam_part_id: partId,
    p_speaker_number: speakerNumber,
    p_option_position: optionPosition,
  });
  rpcError(error);
}

export async function saveCefrPreviewMatchingResponse(partId: string, speakerNumber: number, optionPosition: number): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_preview_matching_response', {
    p_exam_part_id: partId,
    p_speaker_number: speakerNumber,
    p_option_position: optionPosition,
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

export async function saveContestPreviewWritingResponse(partId: string, content: string, submit = false): Promise<WritingResponse> {
  const { data, error } = await supabase.rpc('save_contest_preview_writing_response', {
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

export async function clearContestPreviewResponses(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_contest_preview_responses', { p_contest_id: contestId });
  rpcError(error);
}

export async function completeEnglishExam(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_exam_submission', { p_contest_id: contestId });
  rpcError(error);
}

/** Ends the participant's attempt without requiring every answer to be filled. */
export async function endContestAttempt(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('end_contest_attempt', { p_contest_id: contestId });
  rpcError(error);
}

/** Closes an attempt because the participant left the protected contest page. */
export async function excludeContestAttempt(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('exclude_contest_attempt', { p_contest_id: contestId });
  rpcError(error);
}

/** Clears an admin creator's own unrated test run and schedules it again. */
export async function reopenContestAfterTesting(contestId: string, startTime: string, endTime: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_contest_after_testing', {
    p_contest_id: contestId,
    p_start_at: startTime,
    p_end_at: endTime,
  });
  rpcError(error);
}

/** Locks Listening for this participant and opens Reading before the shared timer expires. */
export async function completeListeningSection(contestId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_listening_section', { p_contest_id: contestId });
  rpcError(error);
}

/** Closes Listening or Reading early for this participant and opens the next section. */
export async function completeExamSection(contestId: string, section: 'listening' | 'reading'): Promise<void> {
  const { error } = await supabase.rpc('complete_exam_section', {
    p_contest_id: contestId,
    p_section: section,
  });
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

/** Reads the private post-contest result board for an owning manager or administrator. */
export async function fetchContestAdminResults(contestId: string, individualTest = false): Promise<ContestAdminResult[]> {
  const { data, error } = await supabase.rpc(individualTest ? 'get_language_test_admin_results' : 'get_contest_admin_results', { p_contest_id: contestId });
  rpcError(error);
  return asRows(data).map((row, index) => ({
    rank: number(valueAt(row, 'rank'), index + 1),
    userId: text(valueAt(row, 'user_id', 'userId')),
    displayName: text(valueAt(row, 'display_name', 'full_name'), 'Participant'),
    score: number(valueAt(row, 'score')),
    answeredCount: number(valueAt(row, 'answered_count', 'answeredCount')),
    totalQuestions: number(valueAt(row, 'total_questions', 'totalQuestions')),
    completedAt: nullableTimestamp(valueAt(row, 'completed_at', 'completedAt')),
    listeningCorrectCount: number(valueAt(row, 'listening_correct_count', 'listeningCorrectCount')),
    listeningAnsweredCount: number(valueAt(row, 'listening_answered_count', 'listeningAnsweredCount')),
    listeningTotalQuestions: number(valueAt(row, 'listening_total_questions', 'listeningTotalQuestions')),
    readingCorrectCount: number(valueAt(row, 'reading_correct_count', 'readingCorrectCount')),
    readingAnsweredCount: number(valueAt(row, 'reading_answered_count', 'readingAnsweredCount')),
    readingTotalQuestions: number(valueAt(row, 'reading_total_questions', 'readingTotalQuestions')),
    writingScore: number(valueAt(row, 'writing_score', 'writingScore')),
    writingMaxPoints: number(valueAt(row, 'writing_max_points', 'writingMaxPoints')),
    writingSubmittedCount: number(valueAt(row, 'writing_submitted_count', 'writingSubmittedCount')),
    writingGradedCount: number(valueAt(row, 'writing_graded_count', 'writingGradedCount')),
    writingTotalCount: number(valueAt(row, 'writing_total_count', 'writingTotalCount')),
    pendingWritingCount: number(valueAt(row, 'pending_writing_count', 'pendingWritingCount')),
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
  const parts = asRows(payload.parts).map(mapExamPart).sort((left, right) => left.position - right.position);
  const partOrder = new Map(parts.map((part, index) => [part.id, index]));
  const questions = asRows(payload.questions).map((row) => ({
    id: text(valueAt(row, 'id')),
    partId: nullableText(valueAt(row, 'exam_part_id', 'part_id', 'partId')),
    position: number(valueAt(row, 'position')),
    prompt: text(valueAt(row, 'prompt')),
    options: arrayOfStrings(valueAt(row, 'options')),
    answerType: mapAnswerType(valueAt(row, 'answer_type', 'answerType')),
    wordLimit: number(valueAt(row, 'word_limit', 'wordLimit'), 0),
    correctOption: valueAt(row, 'correct_option', 'correctOption') === null || valueAt(row, 'correct_option', 'correctOption') === undefined
      ? null
      : number(valueAt(row, 'correct_option', 'correctOption')),
    acceptedAnswers: arrayOfStrings(valueAt(row, 'accepted_answers', 'acceptedAnswers')),
    points: number(valueAt(row, 'points'), 1),
    explanation: nullableText(valueAt(row, 'explanation')),
  })).sort((a, b) => (partOrder.get(a.partId ?? '') ?? Number.MAX_SAFE_INTEGER) - (partOrder.get(b.partId ?? '') ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
  return {
    contest,
    parts,
    sectionTimings: mapExamSectionTimings(payload.section_timings),
    questions,
    gapFillAnswerKeys: asRows(payload.gap_fill_answer_keys).map((row) => ({
      partId: text(valueAt(row, 'part_id', 'partId')),
      blankNumber: number(valueAt(row, 'blank_number', 'blankNumber')),
      acceptedAnswers: arrayOfStrings(valueAt(row, 'accepted_answers', 'acceptedAnswers')),
      points: number(valueAt(row, 'points'), 1),
    })).sort((left, right) => left.partId.localeCompare(right.partId) || left.blankNumber - right.blankNumber),
    matchingConfigs: mapMatchingEditorConfigs(payload.matching_configs),
  };
}

export async function saveCefrGapFillAnswerKeys(contestId: string, partId: string, keys: GapFillAnswerKey[]): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_gap_fill_answer_keys', {
    p_contest_id: contestId,
    p_exam_part_id: partId,
    p_answer_keys: keys.map((key) => ({
      blank_number: key.blankNumber,
      accepted_answers: key.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean),
      points: key.points,
    })),
  });
  rpcError(error);
}

export async function saveCefrMatchingConfig(contestId: string, partId: string, config: Omit<MatchingEditorConfig, 'partId'>): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_matching_config', {
    p_contest_id: contestId,
    p_exam_part_id: partId,
    p_options: config.options.map((option) => ({ position: option.position, label: option.label.trim() })),
    p_speakers: config.speakers.map((speaker) => ({ speaker_number: speaker.speakerNumber, label: speaker.label.trim(), image_url: speaker.imageUrl?.trim() || null, correct_option: speaker.correctOption })),
  });
  rpcError(error);
}

export async function saveContestQuestion(contestId: string, input: ContestQuestionInput): Promise<string> {
  // Always use the typed-answer-capable RPC. The older choice-only overload
  // still caps options at eight, while IELTS Passage 2 heading matching needs
  // the full i-ix set of nine headings.
  const params = {
    p_contest_id: contestId,
    p_question_id: input.id ?? null,
    p_exam_part_id: input.partId ?? null,
    p_position: input.position,
    p_prompt: input.prompt.trim(),
    p_options: input.options.map((item) => item.trim()),
    p_correct_option: input.correctOption,
    p_points: input.points,
    p_explanation: input.explanation?.trim() || null,
    p_answer_type: input.answerType,
    p_accepted_answers: input.answerType === 'text'
      ? (input.acceptedAnswers ?? []).map((item) => item.trim()).filter(Boolean)
      : [],
    p_word_limit: input.answerType === 'text' ? input.wordLimit ?? 0 : 0,
  };

  const { data, error } = await supabase.rpc('save_contest_question', params);
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

export async function saveCefrMapImage(contestId: string, partId: string, imageUrl: string | null): Promise<void> {
  const { error } = await supabase.rpc('save_cefr_map_image', {
    p_contest_id: contestId,
    p_exam_part_id: partId,
    p_image_url: imageUrl?.trim() || null,
  });
  rpcError(error);
}

export async function saveExamPartImage(contestId: string, partId: string, imageUrl: string | null): Promise<void> {
  const { error } = await supabase.rpc('save_exam_part_image', {
    p_contest_id: contestId,
    p_exam_part_id: partId,
    p_image_url: imageUrl?.trim() || null,
  });
  rpcError(error);
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

export async function uploadContestImage(contestId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm faylini yuklash mumkin.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Xarita rasmi 12 MB dan kichik bo‘lishi kerak.');
  const filename = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'map-image';
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${contestId}/${id}-${filename}`;
  const { error } = await supabase.storage.from('contest-images').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  rpcError(error);
  const { data } = supabase.storage.from('contest-images').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Rasm URL yaratilmagan.');
  return data.publicUrl;
}

export async function setContestIntegrityOverrideCode(contestId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('set_contest_integrity_override_code', {
    p_contest_id: contestId,
    p_code: code.trim(),
  });
  rpcError(error);
}

export async function fetchContestIntegrityExclusions(contestId: string): Promise<ContestIntegrityExclusion[]> {
  const { data, error } = await supabase.rpc('list_contest_integrity_exclusions', { p_contest_id: contestId });
  rpcError(error);
  return asRows(data).map((row) => ({
    userId: text(valueAt(row, 'user_id', 'userId')),
    displayName: text(valueAt(row, 'display_name', 'displayName'), 'Participant'),
    excludedAt: text(valueAt(row, 'excluded_at', 'excludedAt')),
    reason: text(valueAt(row, 'exclusion_reason', 'reason'), 'left-contest-page'),
  }));
}

export async function restoreContestAttemptWithOverride(contestId: string, userId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('restore_contest_attempt_with_override', {
    p_contest_id: contestId,
    p_user_id: userId,
    p_code: code.trim(),
  });
  rpcError(error);
}

export async function fetchWritingSubmissions(contestId: string, individualTest = false): Promise<WritingSubmission[]> {
  const { data, error } = await supabase.rpc(individualTest ? 'get_language_test_writing_submissions' : 'get_contest_writing_submissions', { p_contest_id: contestId });
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

export async function gradeWritingSubmission(submissionId: string, score: number, feedback = '', individualTest = false): Promise<void> {
  const { error } = await supabase.rpc(individualTest ? 'grade_language_test_writing_submission' : 'grade_contest_writing_submission', {
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
