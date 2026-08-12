import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;

export type ProgrammingDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemPublicationScope = 'site' | 'contest';

export type ProblemExample = {
  input: string;
  output: string;
  explanation?: string | null;
};

export type ProblemTestCase = {
  id?: string;
  input: string;
  output: string;
  isSample: boolean;
  weight: number;
};

export type ProgrammingProblem = {
  id: string;
  slug: string;
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  examples: ProblemExample[];
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: ProgrammingDifficulty;
  tags: string[];
  editorial: string | null;
  publicationScope: ProblemPublicationScope;
  isPublished: boolean;
  createdAt: string;
  practiceAvailableAt: string | null;
};

export type ManagedProgrammingProblem = ProgrammingProblem & {
  linkedContestCount: number;
  contestTitle: string | null;
  contestEndAt: string | null;
};

export type ProgrammingProblemEditor = ProgrammingProblem & {
  testCases: ProblemTestCase[];
};

export type ProgrammingProblemInput = {
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  examples: ProblemExample[];
  timeLimitMs: number;
  memoryLimitMb: number;
  difficulty: ProgrammingDifficulty;
  tags: string[];
  editorial?: string | null;
  publicationScope: ProblemPublicationScope;
  testCases: ProblemTestCase[];
};

export type ProgrammingContestProblem = Pick<ProgrammingProblem, 'id' | 'slug' | 'title' | 'difficulty' | 'tags' | 'timeLimitMs' | 'memoryLimitMb'> & {
  position: number;
  points: number;
  status?: 'Solved' | 'Attempted' | 'Unsolved';
};

export type ProgrammingContestOverview = {
  id: string;
  slug: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'Live' | 'Finished';
  problems: ProgrammingContestProblem[];
};

export type ProgrammingContestEditor = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  problems: ProgrammingContestProblem[];
};

const rows = (value: unknown): Row[] => Array.isArray(value)
  ? value.filter((entry): entry is Row => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
  : value && typeof value === 'object' && !Array.isArray(value) ? [value as Row] : [];

const row = (value: unknown): Row => rows(value)[0] ?? {};
const text = (value: unknown, fallback = ''): string => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const nullableText = (value: unknown): string | null => text(value) || null;
const number = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (value: unknown): boolean => value === true || value === 'true' || value === 1;
const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
  : [];

function valueAt(source: Row, ...keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function mapDifficulty(value: unknown): ProgrammingDifficulty {
  const normalized = text(value, 'medium').toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard' || normalized === 'expert') return 'Hard';
  return 'Medium';
}

function mapScope(value: unknown): ProblemPublicationScope {
  return text(value).toLowerCase() === 'contest' ? 'contest' : 'site';
}

function mapExamples(value: unknown): ProblemExample[] {
  return rows(value).map((entry) => ({
    input: text(valueAt(entry, 'input')),
    output: text(valueAt(entry, 'output')),
    explanation: nullableText(valueAt(entry, 'explanation')),
  })).filter((entry) => entry.input || entry.output);
}

function mapTestCases(value: unknown): ProblemTestCase[] {
  return rows(value).map((entry) => ({
    id: nullableText(valueAt(entry, 'id')) ?? undefined,
    input: text(valueAt(entry, 'input')),
    output: text(valueAt(entry, 'output')),
    isSample: bool(valueAt(entry, 'is_sample', 'isSample')),
    weight: number(valueAt(entry, 'weight'), 1),
  }));
}

function mapProblem(source: Row): ProgrammingProblem {
  return {
    id: text(valueAt(source, 'id')),
    slug: text(valueAt(source, 'slug')),
    title: text(valueAt(source, 'title')),
    statement: text(valueAt(source, 'statement')),
    inputDescription: text(valueAt(source, 'input_description', 'inputDescription')),
    outputDescription: text(valueAt(source, 'output_description', 'outputDescription')),
    constraints: text(valueAt(source, 'constraints')),
    examples: mapExamples(valueAt(source, 'examples')),
    timeLimitMs: number(valueAt(source, 'time_limit_ms', 'timeLimitMs'), 1000),
    memoryLimitMb: number(valueAt(source, 'memory_limit_mb', 'memoryLimitMb'), 256),
    difficulty: mapDifficulty(valueAt(source, 'difficulty')),
    tags: strings(valueAt(source, 'tags')),
    editorial: nullableText(valueAt(source, 'editorial')),
    publicationScope: mapScope(valueAt(source, 'publication_scope', 'publicationScope')),
    isPublished: bool(valueAt(source, 'is_published', 'isPublished')),
    createdAt: text(valueAt(source, 'created_at', 'createdAt')),
    practiceAvailableAt: nullableText(valueAt(source, 'practice_available_at', 'practiceAvailableAt')),
  };
}

function rpcError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function problemParams(input: ProgrammingProblemInput) {
  return {
    p_title: input.title.trim(),
    p_statement: input.statement.trim(),
    p_input_description: input.inputDescription.trim(),
    p_output_description: input.outputDescription.trim(),
    p_constraints: input.constraints.trim(),
    p_examples: input.examples
      .filter((entry) => entry.input.trim() || entry.output.trim())
      .map((entry) => ({ input: entry.input.trim(), output: entry.output.trim(), explanation: entry.explanation?.trim() || null })),
    p_time_limit_ms: input.timeLimitMs,
    p_memory_limit_mb: input.memoryLimitMb,
    p_difficulty: input.difficulty.toLowerCase(),
    p_tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    p_editorial: input.editorial?.trim() || null,
    p_publication_scope: input.publicationScope,
    p_test_cases: input.testCases.map((entry) => ({
      input: entry.input,
      output: entry.output,
      is_sample: entry.isSample,
      weight: entry.weight,
    })),
  };
}

export async function fetchPublicProgrammingProblems(): Promise<ProgrammingProblem[]> {
  const { data, error } = await supabase.rpc('get_public_programming_problems');
  rpcError(error);
  return rows(data).map(mapProblem);
}

export async function fetchProgrammingProblem(slug: string, contestSlug?: string): Promise<ProgrammingProblem | null> {
  const { data, error } = await supabase.rpc('get_programming_problem', {
    p_slug: slug,
    p_contest_slug: contestSlug || null,
  });
  rpcError(error);
  const found = rows(data)[0];
  return found ? mapProblem(found) : null;
}

export async function fetchProgrammingContestOverview(slug: string): Promise<ProgrammingContestOverview | null> {
  const { data, error } = await supabase.rpc('get_programming_contest_overview', { p_slug: slug });
  rpcError(error);
  const payload = row(data);
  if (!text(payload.id)) return null;
  const statusText = text(payload.status, 'upcoming').toLowerCase();
  return {
    id: text(payload.id),
    slug: text(payload.slug),
    title: text(payload.title),
    startTime: text(valueAt(payload, 'start_at', 'startTime')),
    endTime: text(valueAt(payload, 'end_at', 'endTime')),
    status: statusText === 'live' ? 'Live' : statusText === 'finished' ? 'Finished' : 'Upcoming',
    problems: rows(payload.problems).map((entry) => ({
      id: text(entry.id),
      slug: text(entry.slug),
      title: text(entry.title),
      difficulty: mapDifficulty(entry.difficulty),
      tags: strings(entry.tags),
      timeLimitMs: number(valueAt(entry, 'time_limit_ms', 'timeLimitMs'), 1000),
      memoryLimitMb: number(valueAt(entry, 'memory_limit_mb', 'memoryLimitMb'), 256),
      position: number(entry.position, 1),
      points: number(entry.points, 100),
    })).sort((left, right) => left.position - right.position),
  };
}

export async function fetchManagedProgrammingProblems(): Promise<ManagedProgrammingProblem[]> {
  const { data, error } = await supabase.rpc('get_managed_programming_problems');
  rpcError(error);
  return rows(data).map((entry) => ({
    ...mapProblem(entry),
    linkedContestCount: number(valueAt(entry, 'linked_contest_count', 'linkedContestCount')),
    contestTitle: nullableText(valueAt(entry, 'contest_title', 'contestTitle')),
    contestEndAt: nullableText(valueAt(entry, 'contest_end_at', 'contestEndAt')),
  }));
}

export async function fetchProgrammingProblemEditor(problemId: string): Promise<ProgrammingProblemEditor> {
  const { data, error } = await supabase.rpc('get_programming_problem_editor', { p_problem_id: problemId });
  rpcError(error);
  const payload = row(data);
  return { ...mapProblem(payload), testCases: mapTestCases(payload.test_cases) };
}

export async function saveProgrammingProblem(input: ProgrammingProblemInput, problemId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('save_programming_problem', {
    ...problemParams(input),
    p_problem_id: problemId || null,
  });
  rpcError(error);
  const id = text(data);
  if (!id) throw new Error('Masala saqlangani tasdiqlanmadi.');
  return id;
}

export async function deleteProgrammingProblem(problemId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_programming_problem', { p_problem_id: problemId });
  rpcError(error);
}

export async function fetchProgrammingContestEditor(contestId: string): Promise<ProgrammingContestEditor> {
  const { data, error } = await supabase.rpc('get_programming_contest_editor', { p_contest_id: contestId });
  rpcError(error);
  const payload = row(data);
  return {
    id: text(payload.id),
    title: text(payload.title),
    startTime: text(valueAt(payload, 'start_at', 'startTime')),
    endTime: text(valueAt(payload, 'end_at', 'endTime')),
    isPublished: bool(valueAt(payload, 'is_published', 'isPublished')),
    problems: rows(payload.problems).map((entry) => ({
      id: text(entry.id),
      slug: text(entry.slug),
      title: text(entry.title),
      difficulty: mapDifficulty(entry.difficulty),
      tags: strings(entry.tags),
      timeLimitMs: number(valueAt(entry, 'time_limit_ms', 'timeLimitMs'), 1000),
      memoryLimitMb: number(valueAt(entry, 'memory_limit_mb', 'memoryLimitMb'), 256),
      position: number(entry.position, 1),
      points: number(entry.points, 100),
    })).sort((left, right) => left.position - right.position),
  };
}

export async function attachProgrammingProblem(contestId: string, problemId: string, position: number, points: number): Promise<void> {
  const { error } = await supabase.rpc('attach_programming_problem', {
    p_contest_id: contestId,
    p_problem_id: problemId,
    p_position: position,
    p_points: points,
  });
  rpcError(error);
}

export async function detachProgrammingProblem(contestId: string, problemId: string): Promise<void> {
  const { error } = await supabase.rpc('detach_programming_problem', {
    p_contest_id: contestId,
    p_problem_id: problemId,
  });
  rpcError(error);
}

export function problemLetter(position: number): string {
  return String.fromCharCode(65 + Math.max(0, position - 1));
}

export function formatProblemLimit(milliseconds: number, memoryMb: number): string {
  return `${milliseconds / 1000}s · ${memoryMb} MB`;
}
