import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  Archive,
  BookOpen,
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
  RotateCcw,
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
  clearContestPreviewResponses,
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
  reopenContestAfterTesting,
  saveExamPart,
  saveExamPartImage,
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
  answerType: 'choice' | 'text';
  correctOption: number | null;
  acceptedAnswersText: string;
  wordLimit: string;
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
  return { id: null, partId, position, prompt: '', options: ['', '', '', ''], answerType: 'choice', correctOption: 0, acceptedAnswersText: '', wordLimit: '2', points: '1', explanation: '' };
}

function questionFormFrom(question: EditorQuestion): QuestionForm {
  return {
    id: question.id,
    partId: question.partId,
    position: question.position,
    prompt: question.prompt,
    options: question.options,
    answerType: question.answerType,
    correctOption: question.correctOption,
    acceptedAnswersText: question.acceptedAnswers.join('\n'),
    wordLimit: question.wordLimit ? String(question.wordLimit) : '2',
    points: String(question.points),
    explanation: question.explanation ?? '',
  };
}

function questionInput(form: QuestionForm, audioOnly = false, sharedGapFillAnswerKey = false, partTwoSummaryAnswerKey = false, partTwoTwoAnswerKey = false, partThreeSharedAnswerKey = false, partFourSharedGapFillAnswerKey = false, readingPassageOneSharedTextAnswerKey = false, readingPassageTwoHeadingAnswerKey = false, readingPassageTwoGapAnswerKey = false, readingPassageTwoTwoAnswerKey = false): ContestQuestionInput {
  return {
    id: form.id,
    partId: form.partId,
    position: form.position,
    // CEFR Listening Part 1 asks the question in the recording. A short,
    // internal marker keeps the database audit trail intact while the
    // participant UI deliberately renders only the three answer choices.
    prompt: audioOnly
      ? `Audio ichidagi savol ${form.position}`
      : sharedGapFillAnswerKey
        ? `Shared IELTS Listening Part 1 gap-fill answer key {{${form.position}}}`
        : partTwoSummaryAnswerKey
          ? `Shared IELTS Listening Part 2 summary answer key {{${form.position}}}`
          : partTwoTwoAnswerKey
            ? `Shared IELTS Listening Part 2 two-answer key {{${form.position}}}`
            : partThreeSharedAnswerKey
              ? `Shared IELTS Listening Part 3 shared answer key {{${form.position}}}`
              : partFourSharedGapFillAnswerKey
                ? `Shared IELTS Listening Part 4 gap-fill answer key {{${form.position}}}`
                : readingPassageOneSharedTextAnswerKey
                  ? `Shared IELTS Reading Passage 1 gap-fill answer key {{${form.position}}}`
                  : readingPassageTwoHeadingAnswerKey
                    ? `Shared IELTS Reading Passage 2 heading answer key {{${form.position}}}`
                    : readingPassageTwoGapAnswerKey
                      ? `Shared IELTS Reading Passage 2 summary answer key {{${form.position}}}`
                      : readingPassageTwoTwoAnswerKey
                        ? `Shared IELTS Reading Passage 2 two-answer key {{${form.position}}}`
                        : form.prompt,
    options: form.answerType === 'text' ? [] : form.options,
    answerType: form.answerType,
    correctOption: form.answerType === 'text' ? null : form.correctOption,
    acceptedAnswers: form.answerType === 'text' ? form.acceptedAnswersText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [],
    wordLimit: form.answerType === 'text' ? Number(form.wordLimit) : 0,
    points: Number(form.points),
    explanation: form.explanation,
  };
}

function isCefrAudioOnlyPart(parts: ExamPart[], partId: string | null, cefrExam: boolean): boolean {
  const part = parts.find((item) => item.id === partId);
  return Boolean(cefrExam && part?.section === 'listening' && part.position === 1);
}

function isCefrGapFillPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && ((part.section === 'listening' && (part.position === 2 || part.position === 6)) || (part.section === 'reading' && part.position === 1));
}

function isCefrMatchingPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && ((part.section === 'listening' && (part.position === 3 || part.position === 4)) || (part.section === 'reading' && (part.position === 2 || part.position === 3)));
}

function isCefrExtractPart(part: ExamPart, cefrExam: boolean): boolean {
  return cefrExam && part.section === 'listening' && part.position === 5;
}

const CEFR_LISTENING_PARTS = [
  { position: 1, title: 'Short responses', description: 'Audio ichidagi 8 tagacha savol va A/B/C variantlar.' },
  { position: 2, title: 'Gap-fill', description: 'Matndagi bo‘sh joylarni audio asosida to‘ldirish.' },
  { position: 3, title: 'Speaker matching', description: 'Speakerlarni umumiy A/B/C… javob bankiga moslash.' },
  { position: 4, title: 'Map labelling', description: 'Xarita rasmi bo‘yicha joylarni harflarga moslash.' },
  { position: 5, title: 'Three extracts', description: '3 extract, har birida 2 tadan — umumiy raqamlashda 24–29.' },
  { position: 6, title: 'Gap-fill', description: 'Matndagi bo‘sh joylarni audio asosida to‘ldirish — 30–35.' },
] as const;

const CEFR_PART_FIVE_QUESTION_POSITIONS = [24, 25, 26, 27, 28, 29] as const;
const CEFR_PART_TWO_QUESTION_POSITIONS = [9, 10, 11, 12, 13, 14] as const;
const CEFR_PART_SIX_QUESTION_POSITIONS = [30, 31, 32, 33, 34, 35] as const;
const CEFR_PART_THREE_QUESTION_POSITIONS = [15, 16, 17, 18] as const;
const CEFR_PART_FOUR_QUESTION_POSITIONS = [19, 20, 21, 22, 23] as const;

const CEFR_READING_PARTS = [
  { position: 1, title: 'Open gap-fill', description: 'Matndan 1–6 bo‘sh joyni bitta so‘z bilan to‘ldiring.' },
  { position: 2, title: 'Statement → Situation matching', description: '7–14 statementni mos situation bilan ulang.' },
  { position: 3, title: 'Matching headings', description: '15–20 paragraf uchun heading toping; 2 ta variant ortiqcha.' },
  { position: 4, title: 'Choice + True / False / Not Given', description: '21–24 A/B/C/D, 25–29 True/False/Not Given.' },
  { position: 5, title: 'Mini-text completion + multiple choice', description: '30–33 alohida kichik text, 34–35 A/B/C/D.' },
] as const;

const CEFR_READING_PART_ONE_QUESTION_POSITIONS = [1, 2, 3, 4, 5, 6] as const;
const CEFR_READING_PART_TWO_QUESTION_POSITIONS = [7, 8, 9, 10, 11, 12, 13, 14] as const;
const CEFR_READING_PART_THREE_QUESTION_POSITIONS = [15, 16, 17, 18, 19, 20] as const;
const CEFR_READING_PART_FOUR_CHOICE_QUESTION_POSITIONS = [21, 22, 23, 24] as const;
const CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS = [25, 26, 27, 28, 29] as const;
const CEFR_READING_PART_FOUR_QUESTION_POSITIONS = [...CEFR_READING_PART_FOUR_CHOICE_QUESTION_POSITIONS, ...CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS] as const;
const CEFR_READING_PART_FIVE_TEXT_POSITIONS = [30, 31, 32, 33] as const;
const CEFR_READING_PART_FIVE_CHOICE_POSITIONS = [34, 35] as const;
const CEFR_READING_PART_FIVE_QUESTION_POSITIONS = [...CEFR_READING_PART_FIVE_TEXT_POSITIONS, ...CEFR_READING_PART_FIVE_CHOICE_POSITIONS] as const;
const CEFR_TRUE_FALSE_NOT_GIVEN_OPTIONS = ['True', 'False', 'Not Given'] as const;
const IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] as const;
const IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS = [48, 49, 50, 51, 52, 53] as const;
const IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS = [54, 55, 56, 57, 58, 59, 60] as const;
const IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS = [61, 62, 63, 64] as const;
const IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS = [65, 66] as const;
const IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX = 'IELTS_READING_PASSAGE_TWO_STRUCTURED\n';
const IELTS_LISTENING_PART_FOUR_SHARED_GAP_FILL_FORMAT = 'IELTS_LISTENING_PART_FOUR_SHARED_GAP_FILL';
const IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS = [13, 14] as const;
const IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS = [15, 16, 17, 18] as const;
const IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS = [19, 20] as const;
const IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT = 'IELTS_LISTENING_PART_TWO_STRUCTURED';
const IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS = [21, 22] as const;
const IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS = [23, 24] as const;
const IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS = [25, 26, 27, 28, 29, 30] as const;
const IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT = 'IELTS_LISTENING_PART_THREE_STRUCTURED';
const IELTS_LISTENING_PART_THREE_FLOW_CHART_TEMPLATE = `Geography lesson plan: student activities
---
Examine a pencil and discuss where the component materials come from
---
Locate the top {{25}} on a world map
---
Discuss the pros and cons of different {{26}}
---
In groups, discuss countries' possible {{27}} to the USA
---
Complete a {{28}} about pencil distribution within the USA
---
Share ideas about the {{29}} of pencils
---
Prepare a {{30}}`;
const IELTS_LISTENING_PART_ONE_GAP_FILL_TEMPLATE = `Complete the form below.

Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Name: {{1}}
Address: {{2}}
Contact number: {{3}}

Booking details
Date: {{4}}
Number of people: {{5}}
Preferred time: {{6}}
Type of room: {{7}}
Special request: {{8}}
Total cost: {{9}}
Payment method: {{10}}`;
const IELTS_LISTENING_PART_FOUR_GAP_FILL_TEMPLATE = `Discovery

It was part of a ship's {{31}}, found in the sea near Antikythera, in Greece.

It was wrongly thought to be a piece of {{32}}.

It was later realised to be a mechanism that had broken into pieces.

Equipment used for analysis of the mechanism

"Dome" — produces photographs which make the {{33}} clearer

"BladeRunner" — produces X-rays

  • originally used to identify {{34}} in engines

Description

The mechanism consisted of:

  • 30 or more gear wheels made of {{35}}
  • models of the sun, moon and planets
  • a framework made of {{36}}

How the mechanism was used

The operator turned a {{37}} to move the gear wheels.

The sun, moon and planets could be moved into their correct positions for any date.

Most surprisingly, the mechanism could calculate when an {{38}} would occur.

It may have been used as a {{39}} when planning festivals.

Later use of similar technology

13th – 14th centuries: used for making {{40}} in Western Europe.`;
const IELTS_READING_PASSAGE_ONE_SHARED_TEXT_TEMPLATE = `The history of the guitar

Instruments similar to the guitar have been played by musicians for over {{48}} years. What we know about many of these early stringed instruments comes from {{49}} {{50}} rather than actual physical examples or music played on them. In some ways, these early stringed instruments were closer to {{51}} than the guitar as we know it today. We do have examples of six-string guitars that are 200 years old. However, the {{52}} of six-string guitars made by guitar makers (who are also known as luthiers) before the final decade of the eighteenth century is often open to question.

Although the electric guitar was invented in the 1930s, it took several decades for electric guitars to develop, with the company Rickenbacker playing a major part in this development. Most {{53}} electric guitars in use today are similar in design to guitars produced by the Fender Musical Instruments Company and the Gibson Guitar Corporation in the 1950s.`;
const IELTS_READING_PASSAGE_TWO_GAP_FILL_TEMPLATE = `A New Approach to Knowledge

John Ray was a scholar and self-taught botanist, whose work reflected the {{61}} that was taking place during the 17th century in people's way of thinking about the natural world.

This new approach is the basis of the modern field of {{62}}.

As Ray himself explained, his interest in plants was aroused after graduating, when he had to spend time outdoors after a period of {{63}}.

He taught himself, and then recorded the knowledge he acquired in the Cambridge {{64}} of English Plants, which was published in 1660.`;

const IELTS_EXAM_PARTS = [
  { position: 1, section: 'listening', title: 'Listening Part 1 — Everyday conversation', instructions: 'Questions 1–10. Listen to a conversation in an everyday social context. The recording is played once only.', content: '', maxPoints: '0' },
  { position: 2, section: 'listening', title: 'Listening Part 2 — Everyday monologue', instructions: 'Questions 11–20. Listen to one speaker in an everyday social context. The recording is played once only.', content: '', maxPoints: '0' },
  { position: 3, section: 'listening', title: 'Listening Part 3 — Educational discussion', instructions: 'Questions 21–30. Listen to a discussion in an education or training context. The recording is played once only.', content: '', maxPoints: '0' },
  { position: 4, section: 'listening', title: 'Listening Part 4 — Academic monologue', instructions: 'Questions 31–40. Listen to an academic talk or lecture. The recording is played once only.', content: '', maxPoints: '0' },
  { position: 5, section: 'reading', title: 'Reading Passage 1', instructions: 'Questions 41–53. Read the passage and answer the questions. You may use multiple choice, matching, True/False/Not Given, headings, completion or short-answer items.', content: '', maxPoints: '0' },
  { position: 6, section: 'reading', title: 'Reading Passage 2', instructions: 'Questions 54–66. Read the passage and answer the questions. Check every word limit carefully.', content: '', maxPoints: '0' },
  { position: 7, section: 'reading', title: 'Reading Passage 3', instructions: 'Questions 67–80. Read the passage and answer the questions. This passage may include a detailed argument.', content: '', maxPoints: '0' },
  { position: 8, section: 'writing', title: 'Writing Task 1 — Visual information', instructions: 'Spend about 20 minutes on this task. Write at least 150 words. Describe, summarise or explain the information shown.', content: 'The chart, table, graph or diagram below shows …\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.', maxPoints: '1' },
  { position: 9, section: 'writing', title: 'Writing Task 2 — Essay', instructions: 'Spend about 40 minutes on this task. Write at least 250 words. Give reasons for your answer and include relevant examples.', content: 'Write about the following topic:\n\n…\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.', maxPoints: '2' },
] as const satisfies ReadonlyArray<{ position: number; section: ExamSection; title: string; instructions: string; content: string; maxPoints: string }>;

function ieltsPartNumber(part: Pick<ExamPart, 'position' | 'section'>): number {
  if (part.section === 'reading') return part.position - 4;
  if (part.section === 'writing') return part.position - 7;
  return part.position;
}

function ieltsPartLabel(part: Pick<ExamPart, 'position' | 'section'>): string {
  const base = part.section === 'reading' ? 'Reading Passage' : part.section === 'writing' ? 'Writing Task' : 'Listening Part';
  return `${base} ${ieltsPartNumber(part)}`;
}

function cefrListeningPartTemplate(position: number): Pick<ExamPartForm, 'title' | 'instructions'> {
  const part = CEFR_LISTENING_PARTS.find((item) => item.position === position);
  if (!part) return { title: `Part ${position}`, instructions: '' };
  const instructions: Record<number, string> = {
    1: 'Audio ichidagi savollarni tinglang va A, B yoki C variantini tanlang.',
    2: 'Audio asosida matndagi bo‘sh joylarni to‘ldiring.',
    3: 'Har bir speaker uchun mos javob harfini tanlang. Ayrim variantlar ortiqcha bo‘lishi mumkin.',
    4: 'Audio asosida xaritadagi harflardan mos joyni tanlang. Ayrim harflar ortiqcha bo‘lishi mumkin.',
    5: '3 ta extractni tinglang. Har bir extract uchun 2 tadan savolga javob bering.',
    6: 'Audio asosida matndagi bo‘sh joylarni to‘ldiring.',
  };
  return { title: `Part ${position} — ${part.title}`, instructions: instructions[position] ?? '' };
}

function emptyCefrListeningPart(position: number): ExamPartForm {
  return { ...emptyExamPart(position), position, section: 'listening', ...cefrListeningPartTemplate(position) };
}

function cefrReadingPartTemplate(position: number): Pick<ExamPartForm, 'title' | 'instructions'> {
  const part = CEFR_READING_PARTS.find((item) => item.position === position);
  if (!part) return { title: `Reading Part ${position}`, instructions: '' };
  const instructions: Record<number, string> = {
    1: 'Matnni o‘qing va har bir bo‘sh joyga BIR SO‘Z yozing.',
    2: 'Har bir statement uchun mos situationni tanlang.',
    3: 'Katta matndagi har paragraf uchun mos headingni tanlang. 2 ta heading ortiqcha bo‘ladi.',
    4: '21–24 uchun A, B, C yoki D ni; 25–29 uchun TRUE, FALSE yoki NOT GIVEN ni tanlang.',
    5: '30–33 alohida kichik matndagi bo‘sh joylarni to‘ldiring; 34–35 uchun A, B, C yoki D variantini tanlang.',
  };
  return { title: `Reading Part ${position} — ${part.title}`, instructions: instructions[position] ?? '' };
}

function emptyCefrReadingPart(position: number): ExamPartForm {
  return { ...emptyExamPart(position), position, section: 'reading', ...cefrReadingPartTemplate(position) };
}

function cefrReadingQuestionPositions(position: number): readonly number[] {
  if (position === 2) return CEFR_READING_PART_TWO_QUESTION_POSITIONS;
  if (position === 3) return CEFR_READING_PART_THREE_QUESTION_POSITIONS;
  if (position === 4) return CEFR_READING_PART_FOUR_QUESTION_POSITIONS;
  if (position === 5) return CEFR_READING_PART_FIVE_QUESTION_POSITIONS;
  return CEFR_READING_PART_ONE_QUESTION_POSITIONS;
}

function emptyIeltsPart(position: number): ExamPartForm {
  const template = IELTS_EXAM_PARTS.find((part) => part.position === position) ?? IELTS_EXAM_PARTS[0];
  return { id: null, position: template.position, section: template.section, title: template.title, instructions: template.instructions, content: template.content, audioUrl: '', imageUrl: '', maxPoints: template.maxPoints };
}

function gapFillBlankNumbers(content: string): number[] {
  const matches = Array.from(content.matchAll(/\{\{([1-9]\d*)\}\}/g), (match) => Number(match[1]));
  return [...new Set(matches)].sort((left, right) => left - right);
}

function hasIeltsListeningPartOneGapFillMarkers(content: string): boolean {
  const markers = gapFillBlankNumbers(content);
  const markerCount = Array.from(content.matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return markerCount === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.length
    && markers.length === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.length
    && markers.every((marker, index) => marker === IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS[index]);
}

function hasIeltsReadingPassageOneSharedTextMarkers(content: string): boolean {
  const markers = gapFillBlankNumbers(content);
  const markerCount = Array.from(content.matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return markerCount === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.length
    && markers.length === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.length
    && markers.every((marker, index) => marker === IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[index]);
}

function containsGapFillMarker(content: string): boolean {
  return /\{\{[1-9]\d*\}\}/.test(content);
}

function isIeltsListeningPartOneSharedGapFill(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  return Boolean(ieltsExam && part?.section === 'listening' && part.position === 1 && hasIeltsListeningPartOneGapFillMarkers(part.content));
}

function isIeltsListeningPartTwoStructured(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  return Boolean(ieltsExam && part?.section === 'listening' && part.position === 2 && part.content === IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT);
}

function isIeltsListeningPartThreeStructured(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  return Boolean(ieltsExam && part?.section === 'listening' && part.position === 3 && part.content === IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT);
}

function isIeltsListeningPartFourSharedGapFill(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  const markers = gapFillBlankNumbers(part?.content ?? '');
  const markerCount = Array.from((part?.content ?? '').matchAll(/\{\{[1-9]\d*\}\}/g)).length;
  return Boolean(ieltsExam && part?.section === 'listening' && part.position === 4 && part.content !== IELTS_LISTENING_PART_FOUR_SHARED_GAP_FILL_FORMAT && markerCount === 10 && markers.length === 10 && markers.every((marker, index) => marker === IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[index]));
}

function isIeltsReadingPassageOneSharedText(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  return Boolean(ieltsExam && part?.section === 'reading' && part.position === 5 && hasIeltsReadingPassageOneSharedTextMarkers(part.content));
}

function isIeltsReadingPassageTwoStructured(part: ExamPart | undefined, ieltsExam: boolean): boolean {
  return Boolean(ieltsExam && part?.section === 'reading' && part.position === 6 && part.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX));
}

function ieltsReadingPassageContent(content: string): string {
  return content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX)
    ? content.slice(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX.length)
    : content;
}

function ieltsReadingQuestionPositions(partPosition: number): readonly number[] {
  if (partPosition === 5) return Array.from({ length: 13 }, (_, index) => index + 41);
  if (partPosition === 6) return Array.from({ length: 13 }, (_, index) => index + 54);
  if (partPosition === 7) return Array.from({ length: 14 }, (_, index) => index + 67);
  return [];
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
    if (!Number.isInteger(position) || position < 1 || position > 8) throw new Error(`${rowNumber}-qatorda question_number 1–8 oralig‘idagi butun son bo‘lishi kerak.`);
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
  return { listeningMinutes: '30', readingMinutes: '60', writingMinutes: '60' };
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
  const [activeCefrReadingPart, setActiveCefrReadingPart] = useState<number | null>(null);
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
      if (syncForm) {
        setActiveCefrListeningPart(next.contest.subjectSlug === 'cefr' ? 1 : null);
        setActiveCefrReadingPart(null);
      }
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
    setActiveCefrReadingPart(null);
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
    const questionPart = editor.parts.find((part) => part.id === question.partId);
    const cefrReadingPartFiveAnswerKeyOnly = currentContest?.subjectSlug === 'cefr'
      && questionPart?.section === 'reading'
      && questionPart.position === 5
      && question.position > 30
      && question.position <= 33;
    const ieltsSharedGapFillAnswerKeyOnly = isIeltsListeningPartOneSharedGapFill(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsPartTwoStructured = isIeltsListeningPartTwoStructured(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsPartThreeStructured = isIeltsListeningPartThreeStructured(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsPartFourSharedGapFill = isIeltsListeningPartFourSharedGapFill(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsReadingPassageOneSharedText = isIeltsReadingPassageOneSharedText(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsReadingPassageTwoStructured = isIeltsReadingPassageTwoStructured(questionPart, currentContest?.subjectSlug === 'ielts');
    const ieltsPartTwoSummaryKeyOnly = ieltsPartTwoStructured && question.position === 14;
    const ieltsPartTwoTwoAnswerKeyOnly = ieltsPartTwoStructured && question.position === 20;
    const ieltsPartThreeSharedAnswerKeyOnly = ieltsPartThreeStructured && (question.position === 22 || question.position === 24 || IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.slice(1).includes(question.position as typeof IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS[number]));
    const ieltsPartFourSharedGapFillAnswerKeyOnly = ieltsPartFourSharedGapFill && IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number]);
    const ieltsReadingPassageOneSharedTextAnswerKeyOnly = ieltsReadingPassageOneSharedText && IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number]);
    const ieltsReadingPassageTwoHeading = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS[number]);
    const ieltsReadingPassageTwoGapFill = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS[number]);
    const ieltsReadingPassageTwoTwoAnswer = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS[number]);
    const ieltsReadingPassageTwoGapAnswerKeyOnly = ieltsReadingPassageTwoGapFill && question.position !== 61;
    const ieltsReadingPassageTwoTwoAnswerKeyOnly = ieltsReadingPassageTwoTwoAnswer && question.position === 66;
    if ((!cefrAudioOnly && !cefrReadingPartFiveAnswerKeyOnly && !ieltsSharedGapFillAnswerKeyOnly && !ieltsPartTwoSummaryKeyOnly && !ieltsPartTwoTwoAnswerKeyOnly && !ieltsPartThreeSharedAnswerKeyOnly && !ieltsPartFourSharedGapFillAnswerKeyOnly && !ieltsReadingPassageOneSharedTextAnswerKeyOnly && !ieltsReadingPassageTwoHeading && !ieltsReadingPassageTwoGapAnswerKeyOnly && !ieltsReadingPassageTwoTwoAnswerKeyOnly && !question.prompt.trim()) || (question.answerType === 'choice' && question.options.some((item) => !item.trim()))) {
      setError(question.answerType === 'text' ? 'Savol matni va kamida bitta to‘g‘ri javob kalitini to‘ldiring.' : 'Savol matni va barcha variantlarni to‘ldiring.');
      return;
    }
    if (question.answerType === 'text' && (!question.acceptedAnswersText.split(/\r?\n/).some((item) => item.trim()) || !Number.isInteger(Number(question.wordLimit)) || Number(question.wordLimit) < 1 || Number(question.wordLimit) > 20)) {
      setError('Yozma javob uchun kamida bitta javob kaliti va 1–20 oralig‘ida so‘z limiti kiriting.');
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
    if (questionPart && isCefrAudioOnlyPart(editor.parts, question.partId, currentContest?.subjectSlug === 'cefr') && (!Number.isInteger(question.position) || question.position < 1 || question.position > 8)) {
      setError('CEFR Listening Part 1 savollari umumiy raqamlashda 1 dan 8 gacha bo‘lishi kerak.');
      return;
    }
    if (ieltsSharedGapFillAnswerKeyOnly && (!IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS[number]) || question.answerType !== 'text')) {
      setError('IELTS Listening Part 1 umumiy filling gap uchun 1–10-savollar yozma javob turida bo‘lishi kerak.');
      return;
    }
    if (ieltsPartTwoStructured) {
      const inSummary = IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS[number]);
      const inActivities = IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS[number]);
      const inTwoAnswer = IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS[number]);
      if ((!inSummary && !inActivities && !inTwoAnswer) && (!Number.isInteger(question.position) || question.position < 11 || question.position > 20)) {
        setError('IELTS Listening Part 2 savollari 11 dan 20 gacha bo‘lishi kerak.');
        return;
      }
      if (inSummary && (question.answerType !== 'text' || Number(question.wordLimit) !== 1 || (question.position === 13 && (!question.prompt.includes('{{13}}') || !question.prompt.includes('{{14}}'))))) {
        setError('13–14 uchun yozma javob va 13-savolda {{13}} hamda {{14}} markerli bitta summary kerak.');
        return;
      }
      if (inActivities && (question.answerType !== 'choice' || question.options.length !== 3)) {
        setError('15–18 uchun aynan 3 ta A/B/C variant kerak.');
        return;
      }
      if (inTwoAnswer && (question.answerType !== 'choice' || question.options.length !== 5)) {
        setError('19–20 uchun aynan 5 ta A–E variant kerak.');
        return;
      }
    }
    if (ieltsPartThreeStructured) {
      const inFirstPair = IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS[number]);
      const inSecondPair = IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS[number]);
      const inFlowChart = IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS[number]);
      if (!inFirstPair && !inSecondPair && !inFlowChart) {
        setError('IELTS Listening Part 3 maxsus formati faqat 21–30-savollar uchun ishlatiladi.');
        return;
      }
      if ((inFirstPair || inSecondPair) && (question.answerType !== 'choice' || question.options.length !== 5)) {
        setError('21–22 va 23–24 uchun aynan 5 ta A–E variant kerak.');
        return;
      }
      if (inFlowChart && (question.answerType !== 'choice' || question.options.length !== 8 || (question.position === 25 && (IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.some((position) => !question.prompt.includes(`{{${position}}}`)) || question.prompt.split(/\n---\n/).length < 8)))) {
        setError('25–30 uchun 8 ta A–H variant va 25-savolda {{25}}–{{30}} markerli, --- bilan ajratilgan bitta flow-chart kerak.');
        return;
      }
    }
    if (ieltsPartFourSharedGapFill && (!IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number]) || question.answerType !== 'text')) {
      setError('IELTS Listening Part 4 umumiy gap filling uchun 31–40-savollar yozma javob turida bo‘lishi kerak.');
      return;
    }
    if (questionPart && currentContest?.subjectSlug === 'ielts' && questionPart.section === 'reading') {
      const positions = ieltsReadingQuestionPositions(questionPart.position);
      if (!positions.includes(question.position)) {
        setError(`IELTS Reading Passage ${questionPart.position - 4} savollari ${positions[0]} dan ${positions.at(-1)} gacha bo‘lishi kerak.`);
        return;
      }
      if (ieltsReadingPassageOneSharedTextAnswerKeyOnly && question.answerType !== 'text') {
        setError('IELTS Reading Passage 1 umumiy textidagi 48–53-savollar yozma javob turida bo‘lishi kerak.');
        return;
      }
      if (ieltsReadingPassageTwoStructured) {
        if (ieltsReadingPassageTwoHeading && (question.answerType !== 'choice' || question.options.length !== 9)) {
          setError('IELTS Reading Passage 2: 54–60 (mahalliy 14–20) uchun 9 ta i–ix heading varianti kerak.');
          return;
        }
        if (ieltsReadingPassageTwoGapFill && (question.answerType !== 'text' || Number(question.wordLimit) !== 1 || (question.position === 61 && IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.some((position) => !question.prompt.includes(`{{${position}}}`))))) {
          setError('IELTS Reading Passage 2: 61–64 (mahalliy 21–24) uchun bitta so‘zli summary va {{61}}–{{64}} markerlar kerak.');
          return;
        }
        if (ieltsReadingPassageTwoTwoAnswer && (question.answerType !== 'choice' || question.options.length !== 5)) {
          setError('IELTS Reading Passage 2: 65–66 (mahalliy 25–26) uchun 5 ta A–E variant kerak.');
          return;
        }
      }
    }
    if (questionPart && isCefrExtractPart(questionPart, currentContest?.subjectSlug === 'cefr') && (!Number.isInteger(question.position) || !CEFR_PART_FIVE_QUESTION_POSITIONS.includes(question.position as typeof CEFR_PART_FIVE_QUESTION_POSITIONS[number]))) {
      setError('CEFR Listening Part 5 savollari umumiy raqamlashda 24 dan 29 gacha bo‘lishi kerak.');
      return;
    }
    if (questionPart && currentContest?.subjectSlug === 'cefr' && questionPart.section === 'reading' && questionPart.position === 4) {
      if (!CEFR_READING_PART_FOUR_QUESTION_POSITIONS.includes(question.position as typeof CEFR_READING_PART_FOUR_QUESTION_POSITIONS[number])) {
        setError('CEFR Reading Part 4 savollari 21 dan 29 gacha bo‘lishi kerak.');
        return;
      }
      const isTfng = CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS.includes(question.position as typeof CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS[number]);
      if (isTfng && (question.options.length !== 3 || question.options.some((option, index) => option.trim() !== CEFR_TRUE_FALSE_NOT_GIVEN_OPTIONS[index]))) {
        setError('CEFR Reading Part 4: 25–29 variantlari aynan True, False va Not Given bo‘lishi kerak.');
        return;
      }
      if (!isTfng && question.options.length !== 4) {
        setError('CEFR Reading Part 4: 21–24 savollari aynan 4 ta A/B/C/D variantga ega bo‘lishi kerak.');
        return;
      }
    }
    if (questionPart && currentContest?.subjectSlug === 'cefr' && questionPart.section === 'reading' && questionPart.position === 5) {
      if (!CEFR_READING_PART_FIVE_QUESTION_POSITIONS.includes(question.position as typeof CEFR_READING_PART_FIVE_QUESTION_POSITIONS[number])) {
        setError('CEFR Reading Part 5 savollari 30 dan 35 gacha bo‘lishi kerak.');
        return;
      }
      const miniText = CEFR_READING_PART_FIVE_TEXT_POSITIONS.includes(question.position as typeof CEFR_READING_PART_FIVE_TEXT_POSITIONS[number]);
      const invalidMiniText = question.answerType !== 'text'
        || question.options.length !== 0
        || Number(question.wordLimit) !== 1
        || (question.position === 30
          ? ['{{30}}', '{{31}}', '{{32}}', '{{33}}'].some((marker) => !question.prompt.includes(marker))
          : question.prompt.trim() !== `Shared mini-text answer key {{${question.position}}}`);
      if (miniText && invalidMiniText) {
        setError(question.position === 30
          ? 'CEFR Reading Part 5: 30–33 uchun bitta kichik text yozing va unda {{30}}, {{31}}, {{32}}, {{33}} bo‘sh joylarining barchasini qo‘ying.'
          : `CEFR Reading Part 5: ${question.position}-savol umumiy kichik textdagi {{${question.position}}} uchun bitta so‘zli javob kalitiga ega bo‘lishi kerak.`);
        return;
      }
      if (!miniText && (question.answerType !== 'choice' || question.options.length !== 4)) {
        setError('CEFR Reading Part 5: 34–35 savollari aynan 4 ta A/B/C/D variantga ega bo‘lishi kerak.');
        return;
      }
    }

    await run('question', async () => {
      await saveContestQuestion(editor.contest.id, questionInput(question, cefrAudioOnly, ieltsSharedGapFillAnswerKeyOnly, ieltsPartTwoSummaryKeyOnly, ieltsPartTwoTwoAnswerKeyOnly, ieltsPartThreeSharedAnswerKeyOnly, ieltsPartFourSharedGapFillAnswerKeyOnly, ieltsReadingPassageOneSharedTextAnswerKeyOnly, ieltsReadingPassageTwoHeading, ieltsReadingPassageTwoGapAnswerKeyOnly, ieltsReadingPassageTwoTwoAnswerKeyOnly));
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
          answerType: 'choice',
          correctOption: row.correctOption,
          acceptedAnswersText: '',
          wordLimit: '0',
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
    let partToSave = currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null
      ? { ...examPart, position: activeCefrListeningPart, section: 'listening' as const }
      : currentContest.subjectSlug === 'cefr' && activeCefrReadingPart !== null
        ? { ...examPart, position: activeCefrReadingPart, section: 'reading' as const }
        : examPart;
    if (currentContest.subjectSlug === 'ielts') {
      const template = IELTS_EXAM_PARTS.find((item) => item.position === partToSave.position);
      if (!template) return setError('IELTS uchun faqat blueprintdagi 9 ta partdan foydalaning.');
      partToSave = { ...partToSave, section: template.section, maxPoints: template.maxPoints };
    }
    if (!partToSave.title.trim()) return setError('Part nomini kiriting.');
    if (partToSave.section === 'writing' && (!partToSave.content.trim() || Number(partToSave.maxPoints) < 1)) {
      return setError('Writing uchun topic va maksimal ballni kiriting.');
    }
    await run('exam-part', async () => {
      let audioUrl = partToSave.audioUrl;
      if (audioFile) audioUrl = await uploadContestAudio(currentContest.id, audioFile);
      if (currentContest.subjectSlug === 'ielts' && partToSave.section === 'listening' && partToSave.position !== 1) audioUrl = '';
      const partId = await saveExamPart(currentContest.id, examPartInput(partToSave, audioUrl));
      if (currentContest.subjectSlug === 'cefr' && partToSave.section === 'listening' && partToSave.position === 4) {
        const imageUrl = mapImageFile ? await uploadContestImage(currentContest.id, mapImageFile) : partToSave.imageUrl;
        await saveCefrMapImage(currentContest.id, partId, imageUrl || null);
      }
      if (currentContest.subjectSlug === 'ielts' && partToSave.section === 'writing' && partToSave.position === 8) {
        const imageUrl = mapImageFile ? await uploadContestImage(currentContest.id, mapImageFile) : partToSave.imageUrl;
        await saveExamPartImage(currentContest.id, partId, imageUrl || null);
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
    if (currentContest.subjectSlug === 'ielts' && (input.listeningMinutes !== 30 || input.readingMinutes !== 60 || input.writingMinutes !== 60)) {
      setError('IELTS Academic uchun vaqtlar qat’iy: 30 min Listening, 60 min Reading va 60 min Writing.');
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
    }, 'CEFR gap-fill javob kaliti saqlandi.');
  };

  const saveMatchingConfig = async (partId: string, config: Omit<MatchingEditorConfig, 'partId'>) => {
    if (!currentContest) return false;
    return run('matching-config', async () => {
      await saveCefrMatchingConfig(currentContest.id, partId, config);
      await loadEditor(currentContest.id, false);
    }, `CEFR ${activeCefrListeningPart !== null ? `Listening Part ${activeCefrListeningPart}` : `Reading Part ${activeCefrReadingPart ?? ''}`} matching kaliti saqlandi.`);
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
  // A future contest can still be refined after it has been published. Once it
  // starts, its content and schedule become immutable for participants.
  const editable = Boolean(currentContest && !currentContest.archivedAt && currentContest.status === 'Upcoming');
  const ungradedWritingCount = writingSubmissions.filter((submission) => submission.score === null).length;
  const canFinalize = Boolean(
    currentContest
      && currentContest.isPublished
      && currentContest.status === 'Finished'
      && !currentContest.isFinalized
      && (currentContest.type === 'Unrated' || adminAccess)
      && (!englishExam || ungradedWritingCount === 0),
  );
  const canReopenAfterTesting = Boolean(
    adminAccess
      && currentContest
      && !currentContest.archivedAt
      && currentContest.type === 'Unrated'
      && currentContest.status !== 'Upcoming',
  );
  const questionCount = editor?.questions.length ?? 0;
  const isBusy = busy !== null;
  const focusedCefrPart = currentContest?.subjectSlug === 'cefr' && activeCefrListeningPart !== null
    ? editor?.parts.find((part) => part.section === 'listening' && part.position === activeCefrListeningPart) ?? null
    : null;
  const focusedCefrQuestions = focusedCefrPart
    ? (editor?.questions.filter((item) => item.partId === focusedCefrPart.id) ?? [])
    : (editor?.questions ?? []);
  const focusedCefrReadingPart = currentContest?.subjectSlug === 'cefr' && activeCefrReadingPart !== null
    ? editor?.parts.find((part) => part.section === 'reading' && part.position === activeCefrReadingPart) ?? null
    : null;
  const focusedCefrReadingQuestions = focusedCefrReadingPart
    ? (editor?.questions.filter((item) => item.partId === focusedCefrReadingPart.id) ?? [])
    : [];

  const openCefrListeningPart = (position: number | null) => {
    setAudioFile(null);
    setMapImageFile(null);
    if (position === 0) {
      setActiveCefrListeningPart(null);
      setActiveCefrReadingPart(1);
      const readingPart = editor?.parts.find((part) => part.section === 'reading' && part.position === 1);
      setExamPart(readingPart ? examPartFormFrom(readingPart) : emptyCefrReadingPart(1));
      setQuestion(emptyQuestion(1, null));
      return;
    }
    if (position === null) {
      setActiveCefrListeningPart(null);
      setActiveCefrReadingPart(null);
      setExamPart(emptyExamPart((editor?.parts.length ?? 0) + 1));
      return;
    }
    setActiveCefrListeningPart(position);
    setActiveCefrReadingPart(null);
    const existing = editor?.parts.find((part) => part.section === 'listening' && part.position === position);
    setExamPart(existing ? examPartFormFrom(existing) : emptyCefrListeningPart(position));
    setQuestion(emptyQuestion(1, position === 5 || position === 6 ? null : existing?.id ?? null));
  };

  const openCefrReadingPart = (position: number | null) => {
    setActiveCefrReadingPart(position);
    setActiveCefrListeningPart(null);
    setAudioFile(null);
    setMapImageFile(null);
    if (position === null) {
      setExamPart(emptyExamPart((editor?.parts.length ?? 0) + 1));
      return;
    }
    const existing = editor?.parts.find((part) => part.section === 'reading' && part.position === position);
    setExamPart(existing ? examPartFormFrom(existing) : emptyCefrReadingPart(position));
    const questionPosition = cefrReadingQuestionPositions(position)[0] ?? 1;
    setQuestion(emptyQuestion(questionPosition, position === 1 || position === 2 || position === 4 ? null : existing?.id ?? null));
  };

  const openIeltsPart = (position: number) => {
    const existing = editor?.parts.find((part) => part.position === position);
    setExamPart(existing ? examPartFormFrom(existing) : emptyIeltsPart(position));
    setAudioFile(null);
    setMapImageFile(null);
    const nextQuestion = (editor?.questions.reduce((maximum, item) => Math.max(maximum, item.position), 0) ?? 0) + 1;
    setQuestion(emptyQuestion(nextQuestion, existing?.id ?? null));
  };

  const updateContestSubject = (subjectSlug: string) => {
    setForm((current) => {
      if (subjectSlug !== 'ielts') return { ...current, subjectSlug };
      const start = new Date(current.startTime);
      const end = new Date(start.getTime() + 150 * 60_000);
      return { ...current, subjectSlug, endTime: localDateTime(end) };
    });
    if (subjectSlug === 'ielts') setExamTiming({ listeningMinutes: '30', readingMinutes: '60', writingMinutes: '60' });
  };

  const publish = async () => {
    if (!currentContest || questionCount === 0 || !window.confirm('Contestni e’lon qilasizmi? Boshlanishidan oldin jadval va contest ma’lumotlarini yangilash mumkin.')) return;
    await run('publish', async () => {
      await publishContest(currentContest.id);
      await refresh();
      await loadEditor(currentContest.id);
    }, 'Contest e’lon qilindi.');
  };

  const clearPreviewResponses = async () => {
    if (!currentContest || !window.confirm('Sinov rejimida saqlangan barcha javoblaringizni tozalaysizmi? Contest draft holatda qoladi.')) return;
    await run('preview-clear', async () => {
      await clearContestPreviewResponses(currentContest.id);
    }, 'Sinov javoblari tozalandi. Contestni istalgancha qayta tekshirishingiz mumkin.');
  };

  const finalize = async () => {
    if (!currentContest || !window.confirm('Contest natijalari va ratinglarini yakunlaysizmi? Bu amal qaytarilmaydi.')) return;
    await run('finalize', async () => {
      await finalizeContest(currentContest.id);
      await refresh();
      await loadEditor(currentContest.id);
    }, 'Contest natijalari serverda yakunlandi.');
  };

  const reopenAfterTesting = async () => {
    if (!currentContest) return;
    const nextSchedule = tomorrowAtOriginalTime(currentContest.startTime, currentContest.endTime);
    if (!window.confirm('Contestni testdan keyin qayta tayyorlaysizmi? Faqat sizning test urinishlaringiz va test natijalari o‘chiriladi. Contest ertaga avvalgi soatda qayta qo‘yiladi.')) return;
    await run('reopen-test', async () => {
      await reopenContestAfterTesting(currentContest.id, nextSchedule.startTime, nextSchedule.endTime);
      await refresh();
      await loadEditor(currentContest.id);
    }, 'Test urinishlari tozalandi. Contest ertaga qayta rejalashtirildi. Kerak bo‘lsa jadvalini yana tahrirlang.');
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
              {editorLoading ? <LoadingState className="min-h-72" message="Tahrirlovchi yuklanmoqda" /> : <ContestFormFields form={form} setForm={setForm} disabled={!newContest && !editable} onSubjectChange={updateContestSubject} onSubmit={saveContest} busy={busy === 'contest'} isNew={newContest} canCreateRated={adminAccess} />}
            </section>

            {currentContest && (
              <>
                {englishExam && (
                  <><section className="workspace-callout"><div className="flex flex-wrap items-start gap-3"><Headphones className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><p className="font-bold">{currentContest.subjectSlug === 'cefr' ? 'CEFR Listening studio' : 'IELTS oqimi'}</p><p className="mt-1 leading-relaxed text-indigo-900/80">{currentContest.subjectSlug === 'cefr' ? 'Avval kerakli Partni tanlang. Har Part o‘zining kichik, alohida ish maydonida ochiladi — faqat shu Part uchun kerakli audio, savol va javob kalitini ko‘rasiz.' : 'IELTS Academic: 30 min Listening (1 ta umumiy audio, 4 part, 40 savol), 60 min Reading (3 passage, 40 savol) va 60 min Writing (2 task). Javob turi tanlovli yoki yozma bo‘lishi mumkin.'}</p></div></div></section>{currentContest.subjectSlug === 'ielts' && <IeltsExamBlueprint parts={editor?.parts ?? []} editable={editable} onSelect={openIeltsPart} />}{currentContest.subjectSlug === 'cefr' && <CefrListeningPartNavigator parts={editor?.parts ?? []} activePart={activeCefrListeningPart} onSelect={openCefrListeningPart} />}{(currentContest.subjectSlug !== 'cefr' || activeCefrListeningPart === null) && <ExamSectionTimingSection form={examTiming} setForm={setExamTiming} contest={currentContest} savedTimings={editor?.sectionTimings ?? null} editable={editable} busy={busy === 'exam-timing'} onSave={() => void saveExamTiming()} />}<ExamPartsSection
                    parts={editor?.parts ?? []}
                    form={examPart}
                    setForm={setExamPart}
                    audioFile={audioFile}
                    setAudioFile={setAudioFile}
                    mapImageFile={mapImageFile}
                    setMapImageFile={setMapImageFile}
                    editable={editable}
                    cefrExam={currentContest.subjectSlug === 'cefr'}
                    ieltsExam={currentContest.subjectSlug === 'ielts'}
                    activeCefrListeningPart={currentContest.subjectSlug === 'cefr' ? activeCefrListeningPart : null}
                    activeCefrReadingPart={currentContest.subjectSlug === 'cefr' ? activeCefrReadingPart : null}
                    busy={busy}
                    onSubmit={saveExamPartForm}
                    onNew={() => { const position = currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null ? activeCefrListeningPart : currentContest.subjectSlug === 'ielts' ? IELTS_EXAM_PARTS.find((part) => !editor?.parts.some((item) => item.position === part.position))?.position ?? 1 : (editor?.parts.length ?? 0) + 1; setExamPart(currentContest.subjectSlug === 'cefr' && activeCefrListeningPart !== null ? emptyCefrListeningPart(position) : currentContest.subjectSlug === 'ielts' ? emptyIeltsPart(position) : emptyExamPart(position)); setAudioFile(null); setMapImageFile(null); }}
                    onEdit={(part) => { setExamPart(examPartFormFrom(part)); setAudioFile(null); setMapImageFile(null); }}
                    onDelete={(partId) => void removeExamPart(partId)}
                  /></>
                )}
                {currentContest.subjectSlug === 'cefr' && activeCefrReadingPart !== null && <CefrReadingPartNavigator parts={editor?.parts ?? []} activePart={activeCefrReadingPart} onSelect={openCefrReadingPart} onListening={() => openCefrListeningPart(1)} onTools={() => openCefrReadingPart(null)} />}
                {editable && currentContest.subjectSlug === 'cefr' && (activeCefrListeningPart === 2 || activeCefrListeningPart === 6) && <CefrGapFillAnswerKeySection parts={editor?.parts ?? []} answerKeys={editor?.gapFillAnswerKeys ?? []} busy={busy === 'gap-fill-keys'} onSave={saveGapFillAnswerKeys} partPosition={activeCefrListeningPart} section="listening" />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 3 && <CefrMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 4 && <CefrMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} partPosition={4} mapMode />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrReadingPart === 1 && <CefrGapFillAnswerKeySection parts={editor?.parts ?? []} answerKeys={editor?.gapFillAnswerKeys ?? []} busy={busy === 'gap-fill-keys'} onSave={saveGapFillAnswerKeys} partPosition={1} section="reading" />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrReadingPart === 2 && <CefrReadingMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} onUploadImage={(file) => uploadContestImage(currentContest.id, file)} partPosition={2} />}
                {editable && currentContest.subjectSlug === 'cefr' && activeCefrReadingPart === 3 && <CefrReadingMatchingConfigSection parts={editor?.parts ?? []} configs={editor?.matchingConfigs ?? []} busy={busy === 'matching-config'} onSave={saveMatchingConfig} onUploadImage={(file) => uploadContestImage(currentContest.id, file)} partPosition={3} />}
                {currentContest.subjectSlug === 'cefr' && activeCefrReadingPart === 4 && <CefrReadingObjectiveQuestions part={focusedCefrReadingPart} questions={focusedCefrReadingQuestions} form={question} setForm={setQuestion} parts={editor?.parts ?? []} editable={editable} busy={busy} editingId={question.id} onSave={saveQuestion} onEdit={(item) => setQuestion(questionFormFrom(item))} onDelete={(questionId) => void deleteQuestion(questionId)} partPosition={4} />}
                {currentContest.subjectSlug === 'cefr' && activeCefrReadingPart === 5 && <CefrReadingObjectiveQuestions part={focusedCefrReadingPart} questions={focusedCefrReadingQuestions} form={question} setForm={setQuestion} parts={editor?.parts ?? []} editable={editable} busy={busy} editingId={question.id} onSave={saveQuestion} onEdit={(item) => setQuestion(questionFormFrom(item))} onDelete={(questionId) => void deleteQuestion(questionId)} partPosition={5} />}
                {currentContest.subjectSlug === 'cefr' && activeCefrListeningPart === 5 ? <CefrPartFiveQuestions part={focusedCefrPart} questions={focusedCefrQuestions} form={question} setForm={setQuestion} parts={editor?.parts ?? []} editable={editable} busy={busy} editingId={question.id} onSave={saveQuestion} onEdit={(item) => setQuestion(questionFormFrom(item))} onDelete={(questionId) => void deleteQuestion(questionId)} /> : (currentContest.subjectSlug !== 'cefr' || (activeCefrReadingPart === null && (activeCefrListeningPart === null || activeCefrListeningPart === 1))) && <section className="card overflow-hidden">
                  <div className="workspace-panel-heading"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{currentContest.subjectSlug === 'cefr' ? 'CEFR · Listening Part 1' : 'Real questions'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{currentContest.subjectSlug === 'cefr' ? 'Part 1 — A/B/C savollari' : englishExam ? 'Listening va Reading savollari' : 'Savollar'} ({currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length : questionCount})</h2><p className="mt-1 text-sm text-slate-500">{currentContest.subjectSlug === 'cefr' ? 'Bu ixcham sahifada faqat Part 1 audio variantlari va ularning javob kalitlari turadi.' : 'To‘g‘ri javoblar faqat shu himoyalangan editor va serverda saqlanadi.'}</p></div>{editable && <button type="button" onClick={() => setQuestion(emptyQuestion(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length + 1 : questionCount + 1, currentContest.subjectSlug === 'cefr' ? focusedCefrPart?.id ?? null : editor?.parts.find((part) => part.section !== 'writing')?.id ?? null))} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Savol qo‘shish</button>}</div>
                  {editable && currentContest.subjectSlug === 'cefr' && <CefrPartOneCsvImporter parts={editor?.parts ?? []} busy={busy === 'cefr-csv-import'} onImport={importCefrPartOneQuestions} />}
                  {(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions : editor?.questions ?? []).length ? <div className="divide-y divide-slate-100">{(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions : editor?.questions ?? []).map((item) => <div key={item.id}><QuestionRow question={item} parts={editor?.parts ?? []} cefrExam={currentContest.subjectSlug === 'cefr'} ieltsExam={currentContest.subjectSlug === 'ielts'} editable={editable} editing={question.id === item.id} busy={busy === `delete:${item.id}`} onEdit={() => setQuestion(questionFormFrom(item))} onDelete={() => void deleteQuestion(item.id)} />{editable && question.id === item.id && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} englishExam={englishExam} cefrExam={currentContest.subjectSlug === 'cefr'} parts={editor?.parts ?? []} fixedPart={currentContest.subjectSlug === 'cefr' ? focusedCefrPart ?? undefined : undefined} onCancel={() => setQuestion(emptyQuestion(currentContest.subjectSlug === 'cefr' ? focusedCefrQuestions.length + 1 : questionCount + 1, currentContest.subjectSlug === 'cefr' ? focusedCefrPart?.id ?? null : editor?.parts.find((part) => part.section !== 'writing')?.id ?? null))} />}</div>)}</div> : <div className="p-6 text-sm text-slate-500">{currentContest.subjectSlug === 'cefr' ? 'Part 1 savollari hali yo‘q. CSV import qiling yoki bittalab qo‘shing.' : 'Savol yo‘q. Contest e’lon qilinishidan oldin kamida bitta to‘liq savol qo‘shilishi shart.'}</div>}
                  {editable && !question.id && <QuestionFormFields form={question} setForm={setQuestion} busy={busy === 'question'} onSubmit={saveQuestion} englishExam={englishExam} cefrExam={currentContest.subjectSlug === 'cefr'} parts={editor?.parts ?? []} fixedPart={currentContest.subjectSlug === 'cefr' ? focusedCefrPart ?? undefined : undefined} />}
                  {!editable && <div className="border-t border-slate-100 bg-slate-50 p-5 text-sm text-slate-500">Boshlangan, yakunlangan yoki arxivlangan contest savollari o‘zgarmaydi.</div>}
                </section>}

                {englishExam && currentContest.status === 'Finished' && <WritingReviewSection submissions={writingSubmissions} grades={writingGrades} setGrades={setWritingGrades} busy={busy} finalized={currentContest.isFinalized} onGrade={saveWritingGrade} />}

                <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-bold text-slate-900">Contest holati</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">Draft paytida <strong>Sinov rejimi</strong> faqat sizga ochiladi: e’lon qilinmaydi, qatnashuvchi yaratmaydi va ratingga ta’sir qilmaydi. E’lon qilingan contestning jadvali va tafsilotlarini ham boshlanishidan oldin yangilash mumkin.</p>{englishExam && currentContest.status === 'Finished' && ungradedWritingCount > 0 && <p className="mt-2 text-xs font-semibold text-sun-700">{ungradedWritingCount} ta writing hali baholanmagan. Reyting va yakuniy natijalar shu baholar kiritilguncha kutadi.</p>}{currentContest.type === 'Rated' && !adminAccess && <p className="mt-2 text-xs font-medium text-slate-500">Rated contest natijasini yakunlash admin tasdiqlovini talab qiladi.</p>}</div><div className="flex flex-wrap gap-2">{!currentContest.isPublished && !currentContest.archivedAt && <Link to={`/contests/${currentContest.slug}/preview`} className="btn-ghost px-4 py-2.5 text-sm"><ClipboardList className="h-4 w-4" />Sinov rejimida ochish</Link>}{!currentContest.isPublished && !currentContest.archivedAt && <button type="button" onClick={() => void clearPreviewResponses()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Sinov javoblarini tozalash</button>}{editable && !currentContest.isPublished && <button type="button" onClick={() => void publish()} disabled={questionCount === 0 || isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Send className="h-4 w-4" />E’lon qilish</button>}{canFinalize && <button type="button" onClick={() => void finalize()} disabled={isBusy} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Trophy className="h-4 w-4" />Natijani yakunlash</button>}{canReopenAfterTesting && <button type="button" onClick={() => void reopenAfterTesting()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-indigo-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Ertaga qayta tayyorlash</button>}{editable && !currentContest.isPublished && <button type="button" onClick={() => void removeContest()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />O‘chirish</button>}{!currentContest.archivedAt && <button type="button" onClick={() => void archive()} disabled={isBusy} className="btn-ghost px-4 py-2.5 text-sm text-error-700 disabled:opacity-50"><Archive className="h-4 w-4" />Arxivlash</button>}</div></div></section>
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

function ContestFormFields({ form, setForm, disabled, onSubjectChange, onSubmit, busy, isNew, canCreateRated }: { form: ContestForm; setForm: Dispatch<SetStateAction<ContestForm>>; disabled: boolean; onSubjectChange: (subjectSlug: string) => void; onSubmit: (event: FormEvent) => void; busy: boolean; isNew: boolean; canCreateRated: boolean }) {
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
      {disabled && <div className="mb-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Boshlangan, yakunlangan yoki arxivlangan contestning jadvali va tafsilotlari o‘zgartirilmaydi.</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Contest nomi" className="md:col-span-2"><input required value={form.title} disabled={disabled} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: August Mathematics Challenge" /></Field>
        <Field label="Tavsif" className="md:col-span-2"><textarea value={form.description} disabled={disabled} onChange={(event) => update('description', event.target.value)} className="input min-h-28 resize-y" placeholder="Contest maqsadi va qatnashuvchilar bilishi kerak bo‘lgan ma’lumotlar" /></Field>
        <Field label="Fan yoki imtihon"><AppSelect value={form.subjectSlug} disabled={disabled} onChange={onSubjectChange} options={academicContestSubjects.map(([value, label]) => ({ value, label }))} ariaLabel="Fan yoki imtihon" /><p className="mt-1.5 text-xs text-slate-500">IELTS tanlansa vaqt avtomatik 30 + 60 + 60 minutga (jami 150 minut) o‘rnatiladi. Programming contestlarni maxsus programming boshqaruvida yarating.</p></Field>
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

function CefrGapFillAnswerKeySection({ parts, answerKeys, busy, onSave, partPosition, section }: { parts: ExamPart[]; answerKeys: GapFillAnswerKey[]; busy: boolean; onSave: (partId: string, keys: GapFillAnswerKey[]) => Promise<boolean>; partPosition: 1 | 2 | 6; section: 'listening' | 'reading' }) {
  const expectedNumbers = section === 'reading' ? CEFR_READING_PART_ONE_QUESTION_POSITIONS : partPosition === 2 ? CEFR_PART_TWO_QUESTION_POSITIONS : CEFR_PART_SIX_QUESTION_POSITIONS;
  const part = parts.find((item) => item.section === section && item.position === partPosition);
  const blankNumbers = useMemo(() => gapFillBlankNumbers(part?.content ?? ''), [part?.content]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(blankNumbers.map((blankNumber) => {
      const key = answerKeys.find((item) => item.partId === part?.id && item.blankNumber === blankNumber);
      return [blankNumber, key?.acceptedAnswers.join(', ') ?? ''];
    })));
    setError(null);
  }, [answerKeys, blankNumbers, part?.id, partPosition]); // Reset only when saved server data or the template changes.

  if (!part) return null;
  if (blankNumbers.length === 0) return <section className="card border border-dashed border-sun-300 bg-sun-50/70 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-sun-700">CEFR · {section === 'reading' ? 'Reading' : 'Listening'} Part {partPosition}</p><h2 className="mt-1 text-lg font-bold text-slate-900">Gap-fill javob kaliti</h2><p className="mt-2 text-sm leading-relaxed text-sun-900">Part {partPosition} matniga {expectedNumbers[0]}–{expectedNumbers[expectedNumbers.length - 1]} savol raqamlarini qo‘ying: <code className="rounded bg-white px-1.5 py-0.5">{`{{${expectedNumbers[0]}}}`}</code> dan <code className="rounded bg-white px-1.5 py-0.5">{`{{${expectedNumbers[expectedNumbers.length - 1]}}}`}</code> gacha. Saqlangandan keyin shu yerda javoblarni alohida yozasiz.</p></section>;

  const save = async () => {
    if (blankNumbers.length !== expectedNumbers.length || blankNumbers.some((blankNumber, index) => blankNumber !== expectedNumbers[index])) {
      setError(`CEFR ${section === 'reading' ? 'Reading' : 'Listening'} Part ${partPosition} bo‘sh joylari umumiy raqamlashda aynan ${expectedNumbers[0]}–${expectedNumbers[expectedNumbers.length - 1]} bo‘lishi kerak. Matnda {{${expectedNumbers[0]}}} dan {{${expectedNumbers[expectedNumbers.length - 1]}}} gacha ishlating.`);
      return;
    }
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

  return <section className="card overflow-hidden ring-1 ring-violet-100"><div className="workspace-panel-heading bg-gradient-to-r from-violet-50 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">CEFR · {section === 'reading' ? 'Reading' : 'Listening'} Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">Gap-fill javob kaliti</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Bu javoblar faqat admin/judge uchun. Ishtirokchi matndagi bo‘sh joylarga yozadi, keyin server javobni avtomatik tekshiradi.</p></div><span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">{blankNumbers.length} ta bo‘sh joy</span></div><div className="p-5 sm:p-6"><div className="grid gap-3 md:grid-cols-2">{blankNumbers.map((blankNumber) => <label key={blankNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="text-sm font-bold text-slate-800">({blankNumber}) javob</span><input value={drafts[blankNumber] ?? ''} disabled={busy} onChange={(event) => setDrafts((current) => ({ ...current, [blankNumber]: event.target.value }))} className="input mt-3 bg-white" placeholder="Masalan: Victoria Hall" /><span className="mt-2 block text-xs leading-relaxed text-slate-500">Muqobil javoblar bo‘lsa, vergul bilan ajrating.</span></label>)}</div>{error && <p className="mt-4 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium leading-relaxed text-error-700">{error}</p>}<div className="mt-5 flex justify-end"><button type="button" disabled={busy} onClick={() => void save()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : 'Javob kalitini saqlash'}</button></div></div></section>;
}

function CefrMatchingConfigSection({ parts, configs, busy, onSave, partPosition = 3, mapMode = false }: { parts: ExamPart[]; configs: MatchingEditorConfig[]; busy: boolean; onSave: (partId: string, config: Omit<MatchingEditorConfig, 'partId'>) => Promise<boolean>; partPosition?: 3 | 4; mapMode?: boolean }) {
  const part = parts.find((item) => item.section === 'listening' && item.position === partPosition);
  const config = configs.find((item) => item.partId === part?.id);
  const questionNumbers = partPosition === 3 ? CEFR_PART_THREE_QUESTION_POSITIONS : CEFR_PART_FOUR_QUESTION_POSITIONS;
  const [options, setOptions] = useState<MatchingEditorConfig['options']>([]);
  const [speakers, setSpeakers] = useState<MatchingEditorConfig['speakers']>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptions(config?.options.length ? config.options : Array.from({ length: 6 }, (_, position) => ({ position, label: mapMode ? `Map point ${String.fromCharCode(65 + position)}` : '' })));
    setSpeakers(questionNumbers.map((speakerNumber, index) => ({
      speakerNumber,
      label: config?.speakers[index]?.label ?? (mapMode ? `Location ${speakerNumber}` : `Speaker ${speakerNumber}`),
      imageUrl: config?.speakers[index]?.imageUrl ?? null,
      correctOption: config?.speakers[index]?.correctOption ?? null,
    })));
    setError(null);
  }, [config, mapMode, part?.id, questionNumbers]);

  if (!part) return null;
  const updateOption = (position: number, label: string) => setOptions((current) => current.map((option) => option.position === position ? { ...option, label } : option));
  const updateSpeaker = (speakerNumber: number, update: Partial<MatchingEditorConfig['speakers'][number]>) => setSpeakers((current) => current.map((speaker) => speaker.speakerNumber === speakerNumber ? { ...speaker, ...update } : speaker));
  const addOption = () => setOptions((current) => current.length >= 12 ? current : [...current, { position: current.length, label: '' }]);
  const removeOption = (position: number) => setOptions((current) => current.length <= 2 ? current : current.filter((option) => option.position !== position).map((option, index) => ({ ...option, position: index })));
  const save = async () => {
    if (options.some((option) => !option.label.trim())) return setError('Barcha A/B/C… variant matnlarini kiriting.');
    if (speakers.some((speaker) => !speaker.label.trim())) return setError('Har bir speaker nomini kiriting.');
    const saved = await onSave(part.id, { options, speakers });
    if (saved) setError(null);
  };

  const unanswered = speakers.filter((speaker) => speaker.correctOption === null).length;
  const title = mapMode ? 'Map letter matching' : 'Speaker matching';
  const subjectLabel = mapMode ? 'joy' : 'speaker';
  return <section className={`card overflow-hidden ring-1 ${mapMode ? 'ring-sky-100' : 'ring-emerald-100'}`}><div className={`workspace-panel-heading bg-gradient-to-r ${mapMode ? 'from-sky-50 to-white' : 'from-emerald-50 to-white'}`}><div><p className={`text-xs font-bold uppercase tracking-wider ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>CEFR · Listening Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{mapMode ? '19–23-savollar xaritadagi joylarni A/B/C… harflari bilan moslaydi.' : '15–18-savollar speakerlarni umumiy A/B/C… javob bankiga moslaydi.'}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${unanswered ? 'bg-sun-100 text-sun-700' : mapMode ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{unanswered ? `${unanswered} ta kalit kutilmoqda` : `${speakers.length} ${subjectLabel} · ${options.length} variant`}</span></div><div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{mapMode ? '19–23 xaritadagi joylar' : '15–18 speakerlar'}</h3><span className="text-xs font-medium text-slate-500">Raqamlar qat’iy</span></div><div className="space-y-3">{speakers.map((speaker) => <div key={speaker.speakerNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${mapMode ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{speaker.speakerNumber}</span><input value={speaker.label} disabled={busy} onChange={(event) => updateSpeaker(speaker.speakerNumber, { label: event.target.value })} className="input flex-1 bg-white" placeholder={`${mapMode ? 'Location' : 'Speaker'} ${speaker.speakerNumber}`} /></div><div className="mt-3"><AppSelect value={speaker.correctOption === null ? '' : String(speaker.correctOption)} disabled={busy} onChange={(value) => updateSpeaker(speaker.speakerNumber, { correctOption: value ? Number(value) : null })} options={[{ value: '', label: 'Javob kalitini keyin tanlash' }, ...options.map((option) => ({ value: String(option.position), label: `${String.fromCharCode(65 + option.position)} — ${option.label || 'Variant matni'}` }))]} ariaLabel={`${speaker.label} uchun to‘g‘ri variant`} /></div></div>)}</div></div><div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{mapMode ? 'Xarita harflari' : 'Umumiy javob banki'}</h3><button type="button" disabled={busy || options.length >= 12} onClick={addOption} className={`text-xs font-bold disabled:opacity-50 ${mapMode ? 'text-sky-700' : 'text-emerald-700'}`}>+ Variant qo‘shish</button></div><div className="space-y-3">{options.map((option) => <div key={option.position} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">{String.fromCharCode(65 + option.position)}</span><input value={option.label} disabled={busy} onChange={(event) => updateOption(option.position, event.target.value)} className="input flex-1" placeholder={mapMode ? `Xaritadagi ${String.fromCharCode(65 + option.position)} nuqta` : 'Masalan: a pair of pillows'} />{options.length > 2 && <button type="button" disabled={busy} onClick={() => removeOption(option.position)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></div></div>{error && <p className="mx-5 mb-0 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-700 sm:mx-6">{error}</p>}<div className="flex justify-end p-5 pt-5 sm:px-6 sm:pb-6"><button type="button" disabled={busy} onClick={() => void save()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : `${title}ni saqlash`}</button></div></section>;
}

function CefrReadingMatchingConfigSection({ parts, configs, busy, onSave, onUploadImage, partPosition }: { parts: ExamPart[]; configs: MatchingEditorConfig[]; busy: boolean; onSave: (partId: string, config: Omit<MatchingEditorConfig, 'partId'>) => Promise<boolean>; onUploadImage: (file: File) => Promise<string>; partPosition: 2 | 3 }) {
  const part = parts.find((item) => item.section === 'reading' && item.position === partPosition);
  const config = configs.find((item) => item.partId === part?.id);
  const questionNumbers = partPosition === 2 ? CEFR_READING_PART_TWO_QUESTION_POSITIONS : CEFR_READING_PART_THREE_QUESTION_POSITIONS;
  const isHeadings = partPosition === 3;
  const entryName = isHeadings ? 'paragraf' : 'statement';
  const [options, setOptions] = useState<MatchingEditorConfig['options']>([]);
  const [speakers, setSpeakers] = useState<MatchingEditorConfig['speakers']>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingStatement, setUploadingStatement] = useState<number | null>(null);

  useEffect(() => {
    setOptions(config?.options.length ? config.options : Array.from({ length: 8 }, (_, position) => ({ position, label: '' })));
    setSpeakers(questionNumbers.map((speakerNumber, index) => ({ speakerNumber, label: config?.speakers[index]?.label ?? (isHeadings ? `Paragraph ${String.fromCharCode(65 + index)}` : `Statement ${speakerNumber}`), imageUrl: config?.speakers[index]?.imageUrl ?? null, correctOption: config?.speakers[index]?.correctOption ?? null })));
    setError(null);
  }, [config, isHeadings, part?.id, questionNumbers]);

  if (!part) return null;
  const updateOption = (position: number, update: Partial<MatchingEditorConfig['options'][number]>) => setOptions((current) => current.map((item) => item.position === position ? { ...item, ...update } : item));
  const updateEntry = (speakerNumber: number, update: Partial<MatchingEditorConfig['speakers'][number]>) => setSpeakers((current) => current.map((item) => item.speakerNumber === speakerNumber ? { ...item, ...update } : item));
  const addOption = () => setOptions((current) => current.length >= 12 ? current : [...current, { position: current.length, label: '' }]);
  const removeOption = (position: number) => setOptions((current) => current.length <= 2 ? current : current.filter((item) => item.position !== position).map((item, index) => ({ ...item, position: index })));
  const uploadStatementImage = async (speakerNumber: number, file: File | undefined) => {
    if (!file) return;
    setUploadingStatement(speakerNumber);
    setError(null);
    try {
      const imageUrl = await onUploadImage(file);
      updateEntry(speakerNumber, { imageUrl });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Rasm yuklanmadi.');
    } finally {
      setUploadingStatement(null);
    }
  };
  const save = async () => {
    if (options.some((option) => !option.label.trim())) return setError('Har bir situation yoki heading matnini kiriting.');
    if (isHeadings && options.length !== 8) return setError('Reading Part 3 uchun 6 heading va aynan 2 ta ortiqcha heading — jami 8 ta variant bo‘lishi kerak.');
    if (speakers.some((speaker) => (!speaker.label.trim() && (partPosition !== 2 || !speaker.imageUrl)) || speaker.correctOption === null)) return setError(`Har bir ${entryName} uchun matn yoki rasm va to‘g‘ri javob kalitini kiriting.`);
    if (await onSave(part.id, { options, speakers })) setError(null);
  };
  const title = isHeadings ? 'Matching headings' : 'Statement → Situation matching';
  const description = isHeadings ? '15–20-paragrafni 8 ta heading bankiga ulang: 2 ta heading ortiqcha qoladi.' : '7–14 statement uchun mos situationni umumiy javob bankidan tanlang.';
  const statementImages = partPosition === 2;
  return <section className="card overflow-hidden ring-1 ring-cyan-100">
    <div className="workspace-panel-heading bg-gradient-to-r from-cyan-50 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR · Reading Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p></div><span className="rounded-full bg-cyan-100 px-3 py-1.5 text-xs font-bold text-cyan-700">{speakers.length} ta {entryName}</span></div>
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div>
        <div className="mb-3"><h3 className="text-sm font-bold text-slate-800">{isHeadings ? 'Paragraf / bo‘limlar' : '7–14 Statementlar'}</h3>{statementImages && <p className="mt-1 text-xs text-cyan-700">Har statement matn, rasm yoki ikkalasi bilan berilishi mumkin.</p>}</div>
        <div className="space-y-3">{speakers.map((speaker) => {
          const uploading = uploadingStatement === speaker.speakerNumber;
          return <div key={speaker.speakerNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-2"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-xs font-extrabold text-cyan-700">{speaker.speakerNumber}</span><div className="min-w-0 flex-1"><input value={speaker.label} disabled={busy || uploading} onChange={(event) => updateEntry(speaker.speakerNumber, { label: event.target.value })} className="input w-full bg-white" placeholder={isHeadings ? `Paragraph ${speaker.speakerNumber}` : `Statement ${speaker.speakerNumber} matni (ixtiyoriy)`} />{statementImages && <div className="mt-2 flex flex-wrap items-center gap-2"><label className="btn-ghost cursor-pointer px-3 py-2 text-xs"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || uploading} onChange={(event) => void uploadStatementImage(speaker.speakerNumber, event.target.files?.[0])} className="sr-only" />{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{speaker.imageUrl ? 'Statement rasmini almashtirish' : '+ Add statement image'}</label>{speaker.imageUrl && <button type="button" disabled={busy || uploading} onClick={() => updateEntry(speaker.speakerNumber, { imageUrl: null })} className="text-xs font-semibold text-error-700 hover:underline">Rasmni olib tashlash</button>}</div>}</div></div>
            {statementImages && speaker.imageUrl && <img src={speaker.imageUrl} alt={`${speaker.speakerNumber}-statement rasmi`} className="mt-3 max-h-52 w-full rounded-xl border border-cyan-100 bg-white object-contain" />}
            <div className="mt-3"><AppSelect value={speaker.correctOption === null ? '' : String(speaker.correctOption)} disabled={busy || uploading} onChange={(value) => updateEntry(speaker.speakerNumber, { correctOption: value ? Number(value) : null })} options={[{ value: '', label: 'To‘g‘ri situationni tanlang' }, ...options.map((option) => ({ value: String(option.position), label: `${String.fromCharCode(65 + option.position)} — ${option.label || 'Situation matni'}` }))]} ariaLabel={`${speaker.label || `${speaker.speakerNumber}-statement`} uchun to‘g‘ri situation`} /></div>
          </div>;
        })}</div>
      </div>
      <div><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">{isHeadings ? 'Sarlavhalar banki' : 'Situationlar — javob banki'}</h3><button type="button" disabled={busy || options.length >= 12} onClick={addOption} className="text-xs font-bold text-cyan-700 disabled:opacity-50">+ Variant qo‘shish</button></div><div className="space-y-3">{options.map((option) => <div key={option.position} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">{String.fromCharCode(65 + option.position)}</span><input value={option.label} disabled={busy} onChange={(event) => updateOption(option.position, { label: event.target.value })} className="input flex-1" placeholder={isHeadings ? 'Heading matni' : 'Situation matni'} />{options.length > 2 && <button type="button" disabled={busy} onClick={() => removeOption(option.position)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></div>
    </div>
    {error && <p className="mx-5 mb-0 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-700 sm:mx-6">{error}</p>}<div className="flex justify-end p-5 sm:px-6 sm:pb-6"><button type="button" disabled={busy || uploadingStatement !== null} onClick={() => void save()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : `${title}ni saqlash`}</button></div>
  </section>;
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

function QuestionRow({ question, parts, cefrExam, ieltsExam, editable, editing, busy, onEdit, onDelete }: { question: EditorQuestion; parts: ExamPart[]; cefrExam: boolean; ieltsExam: boolean; editable: boolean; editing: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  const part = parts.find((item) => item.id === question.partId);
  const audioOnly = isCefrAudioOnlyPart(parts, question.partId, cefrExam);
  const sharedMiniTextKey = cefrExam && part?.section === 'reading' && part.position === 5 && question.answerType === 'text' && question.position >= 31 && question.position <= 33;
  const ieltsSharedGapFillKey = isIeltsListeningPartOneSharedGapFill(part, ieltsExam) && question.answerType === 'text' && IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_ONE_GAP_FILL_POSITIONS[number]);
  const ieltsPartTwoStructured = isIeltsListeningPartTwoStructured(part, ieltsExam);
  const ieltsPartTwoSummaryKey = ieltsPartTwoStructured && question.position === 14;
  const ieltsPartTwoTwoAnswerKey = ieltsPartTwoStructured && question.position === 20;
  const ieltsPartThreeStructured = isIeltsListeningPartThreeStructured(part, ieltsExam);
  const ieltsPartThreeSharedKey = ieltsPartThreeStructured && (question.position === 22 || question.position === 24 || IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.slice(1).includes(question.position as typeof IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS[number]));
  const ieltsPartFourSharedGapFillKey = isIeltsListeningPartFourSharedGapFill(part, ieltsExam) && question.answerType === 'text' && IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(question.position as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number]);
  const ieltsReadingPassageOneSharedTextKey = isIeltsReadingPassageOneSharedText(part, ieltsExam) && question.answerType === 'text' && IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number]);
  const ieltsReadingPassageTwoStructured = isIeltsReadingPassageTwoStructured(part, ieltsExam);
  const ieltsReadingPassageTwoKey = ieltsReadingPassageTwoStructured && (IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS[number]) || question.position === 62 || question.position === 63 || question.position === 64 || question.position === 66);
  return <div className={`flex items-start justify-between gap-4 p-5 transition-colors ${editing ? 'bg-indigo-50/45' : ''}`}><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{audioOnly ? `Savol ${question.position} · audio ichida` : `Savol ${question.position}`} · {question.points} ball{part ? ` · ${part.title}` : ''}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800">{audioOnly ? 'Savol audio yozuvda beriladi. Ishtirokchi faqat quyidagi 3 variantni ko‘radi.' : sharedMiniTextKey ? `Umumiy kichik textdagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : ieltsSharedGapFillKey ? `Listening Part 1 umumiy filling gapdagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : ieltsPartTwoSummaryKey ? '13–14 umumiy summarydagi {{14}} bo‘sh joyi uchun javob kaliti.' : ieltsPartTwoTwoAnswerKey ? '19–20 umumiy checkbox savolining ikkinchi javob kaliti.' : ieltsPartThreeSharedKey ? question.position === 22 || question.position === 24 ? `${question.position - 1}–${question.position} umumiy checkbox savolining ikkinchi javob kaliti.` : `25–30 flow-chartdagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : ieltsPartFourSharedGapFillKey ? `Listening Part 4 umumiy gap fillingdagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : ieltsReadingPassageOneSharedTextKey ? `Reading Passage 1 umumiy textidagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : ieltsReadingPassageTwoKey ? IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.includes(question.position as typeof IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS[number]) ? `Reading Passage 2 heading matchingdagi ${question.position} uchun javob kaliti.` : question.position === 66 ? 'Reading Passage 2 65–66 ikki harfli savolining ikkinchi javob kaliti.' : `Reading Passage 2 umumiy summarydagi {{${question.position}}} bo‘sh joyi uchun javob kaliti.` : question.prompt}</p>{question.answerType === 'text' ? <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-xs leading-relaxed text-violet-900"><p className="font-bold">Yozma javob · ko‘pi bilan {question.wordLimit} so‘z yoki son</p><p className="mt-1">Qabul qilinadigan javoblar: {question.acceptedAnswers.join(' · ') || 'kiritilmagan'}</p></div> : <><div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.map((option, index) => <div key={`${question.id}-${index}`} className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${question.correctOption === index ? 'border-success-400/50 bg-success-500/10 text-success-600' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="mr-1.5 font-extrabold">{String.fromCharCode(65 + index)}.</span>{option}</div>)}</div><p className={`mt-2 text-xs ${question.correctOption === null ? 'font-semibold text-sun-700' : 'text-slate-500'}`}>{question.correctOption === null ? 'To‘g‘ri variant hali belgilanmagan' : `To‘g‘ri variant: ${String.fromCharCode(65 + question.correctOption)}`}</p></>}</div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} className={`rounded-lg p-2 transition-colors ${editing ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-700'}`} title="Tahrirlash" aria-label={`${question.position}-savolni tahrirlash`}><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>;
}

function QuestionFormFields({ form, setForm, busy, onSubmit, englishExam, cefrExam, parts, fixedPart, onCancel }: { form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; busy: boolean; onSubmit: (event: FormEvent) => void; englishExam: boolean; cefrExam: boolean; parts: ExamPart[]; fixedPart?: ExamPart; onCancel?: () => void }) {
  const updateOption = (index: number, value: string) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const objectiveParts = parts.filter((part) => part.section !== 'writing' && !isCefrGapFillPart(part, cefrExam) && !isCefrMatchingPart(part, cefrExam) && !isCefrExtractPart(part, cefrExam));
  const selectedPart = fixedPart ?? parts.find((part) => part.id === form.partId);
  const audioOnly = isCefrAudioOnlyPart(parts, form.partId, cefrExam);
  const cefrReadingPartFiveText = cefrExam
    && fixedPart?.section === 'reading'
    && fixedPart.position === 5
    && CEFR_READING_PART_FIVE_TEXT_POSITIONS.includes(form.position as typeof CEFR_READING_PART_FIVE_TEXT_POSITIONS[number]);
  const cefrReadingPartFiveSharedText = cefrReadingPartFiveText && form.position === 30;
  const ieltsListeningPartOneSharedGapFill = isIeltsListeningPartOneSharedGapFill(selectedPart, englishExam && !cefrExam);
  const ieltsListeningPartFourSharedGapFill = isIeltsListeningPartFourSharedGapFill(selectedPart, englishExam && !cefrExam);
  const ieltsReadingPassageOneSharedText = isIeltsReadingPassageOneSharedText(selectedPart, englishExam && !cefrExam);
  const ieltsReadingPassageOneSharedTextAnswerKey = ieltsReadingPassageOneSharedText && IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(form.position as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number]);
  const ieltsReadingPassageTwoStructured = isIeltsReadingPassageTwoStructured(selectedPart, englishExam && !cefrExam);
  const ieltsReadingPassageTwoHeading = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.includes(form.position as typeof IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS[number]);
  const ieltsReadingPassageTwoHeadingOptions = ieltsReadingPassageTwoHeading && form.position === 54;
  const ieltsReadingPassageTwoHeadingKey = ieltsReadingPassageTwoHeading && form.position !== 54;
  const ieltsReadingPassageTwoGapFill = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.includes(form.position as typeof IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS[number]);
  const ieltsReadingPassageTwoGapText = ieltsReadingPassageTwoGapFill && form.position === 61;
  const ieltsReadingPassageTwoGapKey = ieltsReadingPassageTwoGapFill && form.position !== 61;
  const ieltsReadingPassageTwoTwoAnswer = ieltsReadingPassageTwoStructured && IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS.includes(form.position as typeof IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS[number]);
  const ieltsReadingPassageTwoTwoAnswerOptions = ieltsReadingPassageTwoTwoAnswer && form.position === 65;
  const ieltsReadingPassageTwoTwoAnswerKey = ieltsReadingPassageTwoTwoAnswer && form.position === 66;
  const ieltsReadingPassageTwoSpecialQuestion = ieltsReadingPassageTwoHeading || ieltsReadingPassageTwoGapFill || ieltsReadingPassageTwoTwoAnswer;
  const ieltsListeningPartTwoStructured = isIeltsListeningPartTwoStructured(selectedPart, englishExam && !cefrExam);
  const ieltsPartTwoSummary = ieltsListeningPartTwoStructured && IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS[number]);
  const ieltsPartTwoSummaryText = ieltsPartTwoSummary && form.position === 13;
  const ieltsPartTwoSummaryKey = ieltsPartTwoSummary && form.position === 14;
  const ieltsPartTwoActivity = ieltsListeningPartTwoStructured && IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS[number]);
  const ieltsPartTwoTwoAnswer = ieltsListeningPartTwoStructured && IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS[number]);
  const ieltsPartTwoTwoAnswerKey = ieltsPartTwoTwoAnswer && form.position === 20;
  const ieltsPartTwoSpecialQuestion = ieltsPartTwoSummary || ieltsPartTwoActivity || ieltsPartTwoTwoAnswer;
  const ieltsListeningPartThreeStructured = isIeltsListeningPartThreeStructured(selectedPart, englishExam && !cefrExam);
  const ieltsPartThreeFirstPair = ieltsListeningPartThreeStructured && IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS[number]);
  const ieltsPartThreeSecondPair = ieltsListeningPartThreeStructured && IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS[number]);
  const ieltsPartThreeTwoAnswer = ieltsPartThreeFirstPair || ieltsPartThreeSecondPair;
  const ieltsPartThreeTwoAnswerKey = form.position === 22 || form.position === 24;
  const ieltsPartThreeFlowChart = ieltsListeningPartThreeStructured && IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.includes(form.position as typeof IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS[number]);
  const ieltsPartThreeFlowChartText = ieltsPartThreeFlowChart && form.position === 25;
  const ieltsPartThreeFlowChartKey = ieltsPartThreeFlowChart && form.position !== 25;
  const ieltsPartThreeSpecialQuestion = ieltsPartThreeTwoAnswer || ieltsPartThreeFlowChart;
  const ieltsPartThreeInheritedOptions = (ieltsPartThreeTwoAnswer && ieltsPartThreeTwoAnswerKey) || ieltsPartThreeFlowChartKey;
  const ieltsPartTwoInheritedOptions = (ieltsPartTwoActivity && form.position !== 15) || ieltsPartTwoTwoAnswerKey || ieltsPartThreeInheritedOptions || ieltsReadingPassageTwoHeadingKey || ieltsReadingPassageTwoTwoAnswerKey;
  const fixedOptionCount = ieltsReadingPassageTwoHeading ? 9 : ieltsPartTwoActivity ? 3 : ieltsPartTwoTwoAnswer || ieltsPartThreeTwoAnswer || ieltsReadingPassageTwoTwoAnswer ? 5 : ieltsPartThreeFlowChart ? 8 : null;
  const canUseTextAnswer = ((englishExam && !cefrExam && !audioOnly) || cefrReadingPartFiveText) && !ieltsPartTwoSpecialQuestion && !ieltsPartThreeSpecialQuestion && !ieltsListeningPartFourSharedGapFill && !ieltsReadingPassageOneSharedTextAnswerKey && !ieltsReadingPassageTwoSpecialQuestion;
  const textAnswer = (form.answerType === 'text' && canUseTextAnswer) || ieltsPartTwoSummary || ieltsListeningPartFourSharedGapFill || ieltsReadingPassageOneSharedTextAnswerKey || ieltsReadingPassageTwoGapFill;
  const maxOptions = fixedOptionCount ?? (audioOnly ? 3 : 8);
  const addOption = () => setForm((current) => {
    const currentMax = fixedOptionCount ?? (isCefrAudioOnlyPart(parts, current.partId, cefrExam) ? 3 : 8);
    return current.options.length >= currentMax ? current : { ...current, options: [...current.options, ''] };
  });
  useEffect(() => {
    if (!audioOnly || form.options.length === 3) return;
    setForm((current) => {
      if (!isCefrAudioOnlyPart(parts, current.partId, cefrExam) || current.options.length === 3) return current;
      return { ...current, options: [...current.options.slice(0, 3), ...Array(Math.max(0, 3 - current.options.length)).fill('')] };
    });
  }, [audioOnly, cefrExam, form.options.length, parts, setForm]);
  useEffect(() => {
    if (!cefrReadingPartFiveText || form.answerType === 'text') return;
    setForm((current) => current.answerType === 'text' ? current : { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: '1' });
  }, [cefrReadingPartFiveText, form.answerType, setForm]);
  useEffect(() => {
    if (!ieltsListeningPartOneSharedGapFill || form.answerType === 'text') return;
    setForm((current) => current.answerType === 'text' ? current : { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: current.wordLimit || '2' });
  }, [form.answerType, ieltsListeningPartOneSharedGapFill, setForm]);
  useEffect(() => {
    if (!ieltsListeningPartFourSharedGapFill || form.answerType === 'text') return;
    setForm((current) => current.answerType === 'text' ? current : { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: current.wordLimit || '2' });
  }, [form.answerType, ieltsListeningPartFourSharedGapFill, setForm]);
  useEffect(() => {
    if (!ieltsReadingPassageOneSharedTextAnswerKey || form.answerType === 'text') return;
    setForm((current) => current.answerType === 'text' ? current : { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: current.wordLimit || '2' });
  }, [form.answerType, ieltsReadingPassageOneSharedTextAnswerKey, setForm]);
  useEffect(() => {
    if (!ieltsReadingPassageTwoSpecialQuestion) return;
    setForm((current) => {
      const isHeading = IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS.includes(current.position as typeof IELTS_READING_PASSAGE_TWO_HEADING_POSITIONS[number]);
      const isGapFill = IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS.includes(current.position as typeof IELTS_READING_PASSAGE_TWO_GAP_FILL_POSITIONS[number]);
      const isTwoAnswer = IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS.includes(current.position as typeof IELTS_READING_PASSAGE_TWO_TWO_ANSWER_POSITIONS[number]);
      if (isHeading) {
        const options = current.position === 54
          ? [...current.options.slice(0, 9), ...Array(Math.max(0, 9 - current.options.length)).fill('')]
          : ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      if (isGapFill) return { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: '1' };
      if (isTwoAnswer) {
        const options = current.position === 65
          ? [...current.options.slice(0, 5), ...Array(Math.max(0, 5 - current.options.length)).fill('')]
          : ['A', 'B', 'C', 'D', 'E'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      return current;
    });
  }, [ieltsReadingPassageTwoSpecialQuestion, form.position, setForm]);
  useEffect(() => {
    if (!ieltsReadingPassageTwoGapText || form.prompt.trim()) return;
    setForm((current) => current.prompt.trim() ? current : { ...current, prompt: IELTS_READING_PASSAGE_TWO_GAP_FILL_TEMPLATE });
  }, [form.prompt, ieltsReadingPassageTwoGapText, setForm]);
  useEffect(() => {
    if (!ieltsListeningPartFourSharedGapFill || form.prompt.trim()) return;
    setForm((current) => current.prompt.trim() ? current : { ...current, prompt: `Shared IELTS Listening Part 4 gap-fill answer key {{${current.position}}}` });
  }, [form.prompt, ieltsListeningPartFourSharedGapFill, setForm]);
  useEffect(() => {
    if (!ieltsPartTwoSpecialQuestion && !ieltsPartThreeSpecialQuestion) return;
    setForm((current) => {
      const isSummary = IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_TWO_SUMMARY_POSITIONS[number]);
      const isActivity = IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_TWO_ACTIVITY_POSITIONS[number]);
      const isTwoAnswer = IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_TWO_TWO_ANSWER_POSITIONS[number]);
      if (isSummary) return { ...current, answerType: 'text', options: [], correctOption: null, wordLimit: '1' };
      if (isActivity) {
        const options = current.position === 15
          ? [...current.options.slice(0, 3), ...Array(Math.max(0, 3 - current.options.length)).fill('')]
          : ['A', 'B', 'C'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      if (isTwoAnswer) {
        const options = current.position === 19
          ? [...current.options.slice(0, 5), ...Array(Math.max(0, 5 - current.options.length)).fill('')]
          : ['A', 'B', 'C', 'D', 'E'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      const isPartThreePair = IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_THREE_FIRST_TWO_ANSWER_POSITIONS[number]) || IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_THREE_SECOND_TWO_ANSWER_POSITIONS[number]);
      if (isPartThreePair) {
        const options = current.position === 21 || current.position === 23
          ? [...current.options.slice(0, 5), ...Array(Math.max(0, 5 - current.options.length)).fill('')]
          : ['A', 'B', 'C', 'D', 'E'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      if (IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS.includes(current.position as typeof IELTS_LISTENING_PART_THREE_FLOW_CHART_POSITIONS[number])) {
        const options = current.position === 25
          ? [...current.options.slice(0, 8), ...Array(Math.max(0, 8 - current.options.length)).fill('')]
          : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        return { ...current, answerType: 'choice', options, correctOption: current.correctOption ?? 0 };
      }
      return current;
    });
  }, [ieltsPartThreeSpecialQuestion, ieltsPartTwoSpecialQuestion, form.position, setForm]);
  useEffect(() => {
    if (!ieltsPartThreeFlowChartText || form.prompt.trim()) return;
    setForm((current) => current.prompt.trim() ? current : { ...current, prompt: IELTS_LISTENING_PART_THREE_FLOW_CHART_TEMPLATE });
  }, [form.prompt, ieltsPartThreeFlowChartText, setForm]);
  useEffect(() => {
    const answerKeyPrompt = `Shared mini-text answer key {{${form.position}}}`;
    if (!cefrReadingPartFiveText || cefrReadingPartFiveSharedText || form.prompt === answerKeyPrompt) return;
    setForm((current) => current.prompt === answerKeyPrompt ? current : { ...current, prompt: answerKeyPrompt });
  }, [cefrReadingPartFiveSharedText, cefrReadingPartFiveText, form.position, form.prompt, setForm]);
  useEffect(() => {
    if (canUseTextAnswer || ieltsListeningPartFourSharedGapFill || ieltsReadingPassageOneSharedTextAnswerKey || ieltsReadingPassageTwoSpecialQuestion || ieltsPartTwoSpecialQuestion || ieltsPartThreeSpecialQuestion || form.answerType === 'choice') return;
    setForm((current) => current.answerType === 'choice' ? current : { ...current, answerType: 'choice', correctOption: current.correctOption ?? 0 });
  }, [canUseTextAnswer, form.answerType, ieltsListeningPartFourSharedGapFill, ieltsPartThreeSpecialQuestion, ieltsPartTwoSpecialQuestion, ieltsReadingPassageOneSharedTextAnswerKey, ieltsReadingPassageTwoSpecialQuestion, setForm]);
  const removeOption = (index: number) => setForm((current) => {
    if (current.options.length <= (fixedOptionCount ?? (audioOnly ? 3 : 2))) return current;
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
  const setAnswerType = (answerType: 'choice' | 'text') => setForm((current) => ({
    ...current,
    answerType,
    options: answerType === 'choice' ? (current.options.length >= 2 ? current.options : ['', '', '', '']) : current.options,
    correctOption: answerType === 'choice' ? (current.correctOption ?? 0) : null,
  }));
  return <form onSubmit={onSubmit} className="border-t border-indigo-100 bg-indigo-50/35 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Savol ${form.position} ni shu yerda tahrirlash` : 'Yangi savol'}</p><p className="mt-1 text-xs text-slate-500">Javoblar va to‘g‘ri variant serverda himoyalangan tarzda saqlanadi.</p></div>{form.id && <button type="button" onClick={onCancel ?? (() => setForm(emptyQuestion(form.position, englishExam ? objectiveParts[0]?.id ?? null : null)))} className="btn-ghost px-3 py-2 text-xs">Yopish</button>}</div>
    <div className="mt-5 grid gap-4">
      {fixedPart ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900"><p className="font-bold">Part {fixedPart.position} ga biriktiriladi</p><p className="mt-1 text-xs text-indigo-700">{fixedPart.title}</p>{isCefrAudioOnlyPart(parts, fixedPart.id, cefrExam) && <p className="mt-2 text-xs leading-relaxed text-cyan-800">Savol audio ichida bo‘ladi; ishtirokchiga faqat 3 ta variant ko‘rsatiladi.</p>}{cefrReadingPartFiveSharedText && <p className="mt-2 text-xs leading-relaxed text-violet-800">Bu bitta umumiy kichik text. Uning ichida <code>{'{{30}}'}</code>, <code>{'{{31}}'}</code>, <code>{'{{32}}'}</code> va <code>{'{{33}}'}</code> bo‘sh joylarining barchasini yozing.</p>}{cefrReadingPartFiveText && !cefrReadingPartFiveSharedText && <p className="mt-2 text-xs leading-relaxed text-violet-800">Kichik text 30-savolda yoziladi. Bu yerda faqat uning ichidagi <code>{`{{${form.position}}}`}</code> bo‘sh joyi uchun bitta so‘zli javob kalitini kiriting.</p>}{ieltsReadingPassageOneSharedTextAnswerKey && <p className="mt-2 text-xs leading-relaxed text-violet-800">48–53 uchun bitta umumiy text Passage 1 sahifasida yozilgan. Bu yerda faqat <code>{`{{${form.position}}}`}</code> bo‘sh joyining javob kalitini kiriting.</p>}{ieltsListeningPartTwoStructured && <p className="mt-2 text-xs leading-relaxed text-violet-800">11–12 odatiy savollar. 13: summary ichida <code>{'{{13}}'}</code> va <code>{'{{14}}'}</code>; 15–18: activitylar va umumiy A/B/C bank; 19: umumiy savol hamda A–E variantlar; 20: ikkinchi to‘g‘ri variant kaliti.</p>}{ieltsListeningPartThreeStructured && <p className="mt-2 text-xs leading-relaxed text-violet-800">21 va 23: umumiy checkbox savollari hamda A–E variantlar; 22 va 24: juftliklarning ikkinchi javob kaliti; 25: <code>{'{{25}}'}</code>–<code>{'{{30}}'}</code> markerli flow-chart va A–H bank; 26–30: flow-chart javob kalitlari.</p>}</div> : englishExam && <Field label="Exam parti"><AppSelect value={form.partId ?? ''} onChange={(value) => setForm((current) => ({ ...current, partId: value || null }))} options={[{ value: '', label: 'Listening yoki Reading partini tanlang' }, ...objectiveParts.map((part) => ({ value: part.id, label: `${part.position}. ${part.section === 'listening' ? 'Listening' : 'Reading'} — ${part.title}` }))]} ariaLabel="Exam parti" />{audioOnly && <p className="mt-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-xs leading-relaxed text-cyan-800">CEFR Listening Part 1: savol audio ichida bo‘ladi. Ishtirokchiga faqat 3 ta variant ko‘rsatiladi.</p>}{objectiveParts.length === 0 && <p className="mt-1.5 text-xs text-error-700">Avval Listening yoki Reading partini yarating.</p>}</Field>}
      <Field label="Savol raqami"><input required min="1" type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))} className="input max-w-36" /></Field>
      {audioOnly ? <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">Savol matni audio ichida</p><p className="mt-1 text-xs">Bu formatda alohida prompt yozilmaydi: audio berilgan savolga mos 3 ta variantni kiriting.</p></div> : cefrReadingPartFiveText && !cefrReadingPartFiveSharedText ? <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">Umumiy kichik text 30-savolda</p><p className="mt-1 text-xs">Bu karta faqat <code>{`{{${form.position}}}`}</code> bo‘sh joyining javob kalitini saqlaydi; matn ishtirokchiga faqat 30-savoldagi umumiy blokda ko‘rinadi.</p></div> : ieltsListeningPartOneSharedGapFill ? <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">1–10 uchun bitta umumiy filling gap</p><p className="mt-1 text-xs">Savol matni Part 1 dagi umumiy textda turadi. Bu yerda faqat <code>{`{{${form.position}}}`}</code> bo‘sh joyi uchun javob kaliti va so‘z limitini kiriting.</p></div> : ieltsReadingPassageOneSharedTextAnswerKey ? <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">48–53 uchun bitta umumiy reading text</p><p className="mt-1 text-xs">Matn Reading Passage 1 sahifasida turadi. Bu yerda faqat <code>{`{{${form.position}}}`}</code> bo‘sh joyi uchun javob kaliti va so‘z limitini kiriting.</p></div> : ieltsReadingPassageTwoHeading ? <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 text-sm leading-relaxed text-cyan-900"><p className="font-bold">54–60 uchun heading matching</p><p className="mt-1 text-xs">54-savolda i–ix headinglarni yozing. 55–60 savollarda faqat to‘g‘ri headingni belgilang.</p></div> : ieltsReadingPassageTwoGapKey ? <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">61–64 summary uchun javob kaliti</p><p className="mt-1 text-xs">Summary matni 61-savolda yoziladi. Bu yerda faqat <code>{`{{${form.position}}}`}</code> uchun bitta so‘zli javobni kiriting.</p></div> : ieltsReadingPassageTwoTwoAnswerKey ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">65–66 uchun ikkinchi harf</p><p className="mt-1 text-xs">Savol va A–E variantlari 65-savolda yoziladi. Bu yerda faqat ikkinchi to‘g‘ri harfni belgilang.</p></div> : ieltsPartTwoSummaryKey ? <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-sm leading-relaxed text-violet-900"><p className="font-bold">13–14 summary uchun javob kaliti</p><p className="mt-1 text-xs">Summary matni 13-savolda yoziladi. Bu yerda faqat <code>{'{{14}}'}</code> bo‘sh joyining javobini kiriting.</p></div> : ieltsPartTwoTwoAnswerKey ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">19–20 uchun ikkinchi javob kaliti</p><p className="mt-1 text-xs">Umumiy savol va A–E variantlar 19-savolda yoziladi. Bu yerda faqat ikkinchi to‘g‘ri harfni belgilang.</p></div> : ieltsPartThreeTwoAnswerKey ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">21–22 yoki 23–24 uchun ikkinchi javob kaliti</p><p className="mt-1 text-xs">Umumiy savol va A–E variantlar oldingi savolda yoziladi. Bu yerda faqat ikkinchi to‘g‘ri harfni belgilang.</p></div> : ieltsPartThreeFlowChartKey ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm leading-relaxed text-emerald-900"><p className="font-bold">25–30 flow-chart javob kaliti</p><p className="mt-1 text-xs">Flow-chart va A–H javob banki 25-savolda yoziladi. Bu yerda faqat <code>{`{{${form.position}}}`}</code> uchun to‘g‘ri harfni belgilang.</p></div> : <Field label={cefrReadingPartFiveSharedText ? 'Bitta kichik text — {{30}}–{{33}} bo‘sh joylari' : ieltsReadingPassageTwoGapText ? 'Questions 61–64 summary — {{61}}–{{64}} bo‘sh joylari' : ieltsReadingPassageTwoTwoAnswerOptions ? 'Questions 65–66 uchun umumiy savol' : ieltsPartTwoSummaryText ? 'Questions 13–14 summary — {{13}} va {{14}} bo‘sh joylari' : ieltsPartTwoActivity ? 'Activity nomi' : ieltsPartTwoTwoAnswer ? 'Questions 19–20 uchun umumiy savol' : ieltsPartThreeTwoAnswer ? `Questions ${form.position}–${form.position + 1} uchun umumiy savol` : ieltsPartThreeFlowChartText ? 'Questions 25–30 flow-chart — {{25}}–{{30}} bo‘sh joylari' : 'Savol matni'}><textarea required value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} className={`input resize-y ${ieltsPartThreeFlowChartText || ieltsReadingPassageTwoGapText ? 'min-h-72 font-medium leading-7' : 'min-h-24'}`} placeholder={cefrReadingPartFiveSharedText ? 'Masalan: The city has a {{30}} population, and its {{31}} is growing. ... {{32}} ... {{33}} ...' : ieltsReadingPassageTwoGapText ? IELTS_READING_PASSAGE_TWO_GAP_FILL_TEMPLATE : ieltsReadingPassageTwoTwoAnswerOptions ? "Which TWO of the following statements are true of Ray's early life?" : ieltsPartTwoSummaryText ? "Joan's official title is {{13}}. {{14}} come regularly." : ieltsPartTwoActivity ? 'masalan: correspondence' : ieltsPartTwoTwoAnswer ? 'Joan says the TWO ways the RDA needs to improve are by' : ieltsPartThreeTwoAnswer ? 'Which TWO topics were discussed?' : ieltsPartThreeFlowChartText ? IELTS_LISTENING_PART_THREE_FLOW_CHART_TEMPLATE : 'Savolni aniq va to‘liq yozing'} /></Field>}
      {canUseTextAnswer && !cefrReadingPartFiveText && !ieltsListeningPartOneSharedGapFill && <Field label="Javob formati"><AppSelect value={form.answerType} onChange={(value) => setAnswerType(value as 'choice' | 'text')} options={[{ value: 'choice', label: 'Tanlovli javob', description: 'MCQ, matching, headings yoki True/False/Not Given uchun' }, { value: 'text', label: 'Yozma javob', description: 'Gap, note, table, diagram yoki short answer uchun' }]} ariaLabel="Javob formati" /><p className="mt-1.5 text-xs leading-relaxed text-slate-500">IELTS’da A/B/C bilan cheklanib qolmang: tanlovli savol uchun kerakli variantlarni, yozma savol uchun esa to‘g‘ri so‘z/son javoblarini kiriting.</p></Field>}
      {textAnswer || ieltsPartTwoSummary ? <div className="grid gap-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 md:grid-cols-[minmax(0,1fr)_180px]"><Field label="Qabul qilinadigan javoblar"><textarea required value={form.acceptedAnswersText} onChange={(event) => setForm((current) => ({ ...current, acceptedAnswersText: event.target.value }))} className="input min-h-24 resize-y bg-white" placeholder={'Har qatorda bitta variant\nmasalan: solar panels\nsolar panel'} /><p className="mt-1.5 text-xs leading-relaxed text-violet-800">Katta-kichik harf va ortiqcha bo‘sh joylar hisobga olinmaydi. Bir nechta imlo shaklini alohida qatorda yozing.</p></Field><Field label="So‘z limiti"><input required min="1" max="20" type="number" value={form.wordLimit} onChange={(event) => setForm((current) => ({ ...current, wordLimit: event.target.value }))} className="input bg-white" /><p className="mt-1.5 text-xs leading-relaxed text-violet-800">Summary gap-fill uchun limit 1 qilib belgilanadi.</p></Field></div> : <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold text-slate-700">{audioOnly ? 'Audio uchun 3 ta variant' : ieltsPartTwoInheritedOptions ? 'Oldingi savoldan olinadigan variantlar' : ieltsReadingPassageTwoHeadingOptions ? 'List of Headings · i–ix' : ieltsReadingPassageTwoTwoAnswerOptions ? 'Umumiy A–E statementlar' : ieltsPartTwoActivity ? 'Umumiy A/B/C javob banki' : ieltsPartTwoTwoAnswer ? 'Umumiy A–E variantlar' : 'Variantlar'}</label>{form.options.length < maxOptions && <button type="button" onClick={addOption} className="text-xs font-bold text-indigo-700 hover:text-indigo-800">+ Variant qo‘shish</button>}</div><div className="space-y-2">{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><label className="flex cursor-pointer items-center"><input type="radio" name="correct-option" checked={form.correctOption === index} onChange={() => setForm((current) => ({ ...current, correctOption: index }))} className="h-4 w-4 accent-indigo-600" /><span className="ml-2 w-5 text-xs font-bold text-slate-500">{ieltsReadingPassageTwoHeading ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][index] : String.fromCharCode(65 + index)}</span></label><input required disabled={ieltsPartTwoInheritedOptions} value={option} onChange={(event) => updateOption(index, event.target.value)} className="input flex-1 disabled:bg-slate-100" placeholder={`${ieltsReadingPassageTwoHeading ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][index] : String.fromCharCode(65 + index)} variant`} />{form.options.length > (fixedOptionCount ?? (audioOnly ? 3 : 2)) && <button type="button" onClick={() => removeOption(index)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-700" aria-label={`Variant ${index + 1} ni o‘chirish`}><Trash2 className="h-4 w-4" /></button>}</div>)}</div><p className={`mt-2 text-xs ${form.correctOption === null ? 'font-semibold text-sun-700' : 'text-slate-500'}`}>{form.correctOption === null ? 'To‘g‘ri variantni belgilang.' : ieltsPartTwoInheritedOptions ? 'Variant matni umumiy birinchi savolda yoziladi; bu yerda faqat to‘g‘ri harfni belgilang.' : 'Radio tugmasi to‘g‘ri variantni belgilaydi; foydalanuvchiga u ko‘rsatilmaydi.'}</p></div>}
      <div className="grid gap-4 md:grid-cols-3"><Field label="Ball"><input required min="1" max="1000" type="number" value={form.points} onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} className="input" /></Field><Field label="Izoh (ixtiyoriy)" className="md:col-span-2"><input value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} className="input" placeholder="Natija chiqqandan keyingi tushuntirish" /></Field></div>
    </div>
    <div className="mt-5 flex justify-end"><button type="submit" disabled={busy || (!fixedPart && englishExam && objectiveParts.length === 0)} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : form.id ? 'Savolni saqlash' : 'Savol qo‘shish'}</button></div>
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
  const ielts = contest.subjectSlug === 'ielts';
  return <section className="card overflow-hidden ring-cyan-100"><div className="workspace-panel-heading bg-gradient-to-r from-cyan-50/80 to-white"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Section timers</p><h2 className="mt-1 text-xl font-bold text-slate-900">Listening, Reading va Writing vaqti</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{ielts ? 'IELTS Academic kompyuter testi uchun qat’iy vaqt: 30 min Listening, 60 min Reading, 60 min Writing.' : 'Har bir bo‘limning alohida server timeri bo‘ladi. Vaqt tugashi bilan oldingi bo‘lim yopiladi va keyingi bo‘lim avtomatik ochiladi.'}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${savedTimings ? 'bg-success-50 text-success-700' : 'bg-sun-50 text-sun-700'}`}>{savedTimings ? 'Sozlangan' : 'Sozlanmagan'}</span></div><div className="p-5 sm:p-6"><div className="grid gap-4 md:grid-cols-3"><SectionTimerField label="Listening" value={form.listeningMinutes} icon={<Headphones className="h-4 w-4" />} color="indigo" disabled={!editable || ielts} onChange={(value) => update('listeningMinutes', value)} /><SectionTimerField label="Reading" value={form.readingMinutes} icon={<ClipboardList className="h-4 w-4" />} color="cyan" disabled={!editable || ielts} onChange={(value) => update('readingMinutes', value)} /><SectionTimerField label="Writing" value={form.writingMinutes} icon={<PenLine className="h-4 w-4" />} color="violet" disabled={!editable || ielts} onChange={(value) => update('writingMinutes', value)} /></div><div className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${remainingMinutes === 0 ? 'border-success-200 bg-success-50/70' : 'border-sun-200 bg-sun-50/70'}`}><div><p className="text-sm font-bold text-slate-800">Jami: {totalMinutes} / {contestMinutes} minut</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{ielts ? 'Listening 4 part/40 savol; Reading 3 passage/40 savol; Writing 2 task.' : 'Bo‘limlar contest davomiyligiga aynan teng bo‘lishi kerak.'}</p></div><div className={`rounded-xl px-3 py-2 text-sm font-bold ${remainingMinutes === 0 ? 'bg-success-100 text-success-700' : 'bg-sun-100 text-sun-700'}`}>{remainingMinutes === 0 ? 'Vaqtlar mos' : remainingMinutes > 0 ? `${remainingMinutes} min ajratilmagan` : `${Math.abs(remainingMinutes)} min ortiqcha`}</div></div>{editable && <div className="mt-5 flex justify-end"><button type="button" disabled={busy || remainingMinutes !== 0 || totalMinutes < 3} onClick={onSave} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}{busy ? 'Saqlanmoqda…' : ielts ? 'IELTS vaqtlarini tasdiqlash' : 'Bo‘lim vaqtlarini saqlash'}</button></div>}</div></section>;
}

function SectionTimerField({ label, value, icon, color, disabled, onChange }: { label: string; value: string; icon: ReactNode; color: 'indigo' | 'cyan' | 'violet'; disabled: boolean; onChange: (value: string) => void }) {
  const palette = color === 'cyan' ? 'bg-cyan-50 text-cyan-700 ring-cyan-100' : color === 'violet' ? 'bg-violet-50 text-violet-700 ring-violet-100' : 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  return <label className={`rounded-2xl p-4 ring-1 ${palette}`}><span className="flex items-center gap-2 text-sm font-bold">{icon}{label}</span><span className="mt-4 flex items-center gap-2"><input required min="1" max="720" type="number" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="input w-full bg-white" /><span className="text-sm font-semibold">min</span></span></label>;
}

function CefrListeningPartNavigator({ parts, activePart, onSelect, onReading }: { parts: ExamPart[]; activePart: number | null; onSelect: (position: number | null) => void; onReading?: () => void }) {
  return <section className="card overflow-hidden ring-1 ring-indigo-100">
    <div className="bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-5 py-5 sm:px-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">CEFR listening · 6 qadam</p><h2 className="mt-1 text-xl font-bold text-slate-900">Qaysi Partni tayyorlaysiz?</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Partni bosing: sahifada faqat o‘sha Partning kerakli maydonlari qoladi. Shuning uchun CSV, xarita, javob kaliti va oddiy savollar bir-biriga aralashmaydi.</p></div>
    <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 xl:grid-cols-6">{CEFR_LISTENING_PARTS.map((item) => {
      const part = parts.find((candidate) => candidate.section === 'listening' && candidate.position === item.position);
      const selected = activePart === item.position;
      return <button key={item.position} type="button" onClick={() => onSelect(item.position)} className={`rounded-2xl border p-3.5 text-left transition-all ${selected ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${selected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{item.position}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selected ? 'bg-white/15 text-white' : part ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{part ? 'Yaratilgan' : 'Boshlanmagan'}</span></div><p className="mt-3 text-sm font-extrabold">Part {item.position}</p><p className={`mt-1 text-xs font-semibold ${selected ? 'text-indigo-100' : 'text-slate-600'}`}>{item.title}</p><p className={`mt-2 text-[11px] leading-relaxed ${selected ? 'text-white/75' : 'text-slate-400'}`}>{item.description}</p></button>;
    })}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><p className="text-xs leading-relaxed text-slate-500">Reading, Writing va umumiy bo‘lim vaqtlari ham alohida saqlanadi.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={onReading ?? (() => onSelect(0))} className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-100">Reading · 5 part</button><button type="button" onClick={() => onSelect(null)} className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${activePart === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Writing / vaqt</button></div></div>
  </section>;
}

function CefrReadingPartNavigator({ parts, activePart, onSelect, onListening, onTools }: { parts: ExamPart[]; activePart: number | null; onSelect: (position: number) => void; onListening: () => void; onTools: () => void }) {
  return <section className="card overflow-hidden ring-1 ring-cyan-100">
    <div className="bg-gradient-to-r from-cyan-50 via-white to-indigo-50 px-5 py-5 sm:px-6"><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR Reading · 5 qadam · 35 savol</p><h2 className="mt-1 text-xl font-bold text-slate-900">Qaysi Reading Partni tayyorlaysiz?</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">Ketma-ketlik: 1–6 gap-fill, 7–14 statement → situation, 15–20 matching headings, 21–29 choice + True/False/Not Given, 30–33 bitta kichik text completion va 34–35 multiple choice.</p></div>
    <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 xl:grid-cols-5">{CEFR_READING_PARTS.map((item) => {
      const part = parts.find((candidate) => candidate.section === 'reading' && candidate.position === item.position);
      const selected = activePart === item.position;
      return <button key={item.position} type="button" onClick={() => onSelect(item.position)} className={`rounded-2xl border p-3.5 text-left transition-all ${selected ? 'border-cyan-500 bg-cyan-600 text-white shadow-md shadow-cyan-200' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50'}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${selected ? 'bg-white/20 text-white' : 'bg-cyan-50 text-cyan-700'}`}>{item.position}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selected ? 'bg-white/15 text-white' : part ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{part ? 'Yaratilgan' : 'Boshlanmagan'}</span></div><p className="mt-3 text-sm font-extrabold">Part {item.position}</p><p className={`mt-1 text-xs font-semibold ${selected ? 'text-cyan-100' : 'text-slate-600'}`}>{item.title}</p><p className={`mt-2 text-[11px] leading-relaxed ${selected ? 'text-white/75' : 'text-slate-400'}`}>{item.description}</p></button>;
    })}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3"><p className="text-xs leading-relaxed text-slate-500">Reading uchun audio kerak emas: har Partga passage yoki topshiriq matnini kiriting.</p><div className="flex gap-2"><button type="button" onClick={onListening} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">Listening · 6 part</button><button type="button" onClick={onTools} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">Writing / vaqt</button></div></div>
  </section>;
}

function IeltsExamBlueprint({ parts, editable, onSelect }: { parts: ExamPart[]; editable: boolean; onSelect: (position: number) => void }) {
  const sectionColor: Record<ExamSection, string> = { listening: 'indigo', reading: 'cyan', writing: 'violet' };
  return <section className="card overflow-hidden ring-1 ring-indigo-100">
    <div className="bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-5 sm:px-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">IELTS Academic · rasmiy tuzilma</p><h2 className="mt-1 text-xl font-bold text-slate-900">4 Listening · 3 Reading · 2 Writing</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">Listening va Reading bo‘limlarida 40 tadan savol bo‘ladi. Writing Task 1 kamida 150 so‘z, Task 2 esa kamida 250 so‘z hamda ikki baravar og‘irlikka ega. Kartani bosib o‘sha part uchun audio, passage yoki taskni sozlang.</p></div>
    <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2 xl:grid-cols-3">{IELTS_EXAM_PARTS.map((template) => {
      const part = parts.find((item) => item.position === template.position);
      const color = sectionColor[template.section];
      return <button key={template.position} type="button" disabled={!editable} onClick={() => onSelect(template.position)} className={`rounded-2xl border bg-white p-3.5 text-left transition-all disabled:cursor-default ${editable ? 'hover:border-indigo-300 hover:bg-indigo-50/40' : ''} ${part ? 'border-success-200' : 'border-slate-200'}`}><div className="flex items-center justify-between gap-2"><span className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color === 'cyan' ? 'bg-cyan-50 text-cyan-700' : color === 'violet' ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>{ieltsPartLabel(template)}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${part ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{part ? 'Tayyor' : 'Kutilmoqda'}</span></div><p className="mt-3 text-sm font-extrabold text-slate-800">{template.title.replace(/^.*?—\s*/, '')}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{template.section === 'listening' ? template.position === 1 ? 'Full audio + 10 savol' : 'Part 1 umumiy audio + 10 savol' : template.section === 'reading' ? 'Passage + 13–14 savol' : template.position === 8 ? '150+ so‘z · ~20 min' : '250+ so‘z · ~40 min · ×2'}</p></button>;
    })}</div>
  </section>;
}

function ExamPartsSection({ parts, form, setForm, audioFile, setAudioFile, mapImageFile, setMapImageFile, editable, cefrExam, ieltsExam, activeCefrListeningPart, activeCefrReadingPart, busy, onSubmit, onNew, onEdit, onDelete }: { parts: ExamPart[]; form: ExamPartForm; setForm: Dispatch<SetStateAction<ExamPartForm>>; audioFile: File | null; setAudioFile: Dispatch<SetStateAction<File | null>>; mapImageFile: File | null; setMapImageFile: Dispatch<SetStateAction<File | null>>; editable: boolean; cefrExam: boolean; ieltsExam: boolean; activeCefrListeningPart: number | null; activeCefrReadingPart: number | null; busy: string | null; onSubmit: (event: FormEvent) => void; onNew: () => void; onEdit: (part: ExamPart) => void; onDelete: (partId: string) => void }) {
  const update = <K extends keyof ExamPartForm>(key: K, value: ExamPartForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const sectionLabel: Record<ExamSection, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing' };
  if (cefrExam && activeCefrListeningPart !== null) return <CefrFocusedExamPartSection parts={parts} form={form} setForm={setForm} audioFile={audioFile} setAudioFile={setAudioFile} mapImageFile={mapImageFile} setMapImageFile={setMapImageFile} editable={editable} partPosition={activeCefrListeningPart} busy={busy} onSubmit={onSubmit} onEdit={onEdit} onDelete={onDelete} />;
  if (cefrExam && activeCefrReadingPart !== null) return <CefrFocusedReadingPartSection parts={parts} form={form} setForm={setForm} editable={editable} partPosition={activeCefrReadingPart} busy={busy} onSubmit={onSubmit} onEdit={onEdit} onDelete={onDelete} />;
  return <section className="card overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">IELTS / CEFR exam builder</p><h2 className="mt-1 text-xl font-bold text-slate-900">Partlar ({parts.length})</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Listening uchun audio, Reading uchun passage va Writing uchun topic yarating. Har bir Listening/Reading partiga savol biriktiriladi.</p></div>{editable && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-sm"><Plus className="h-4 w-4" />Yangi part</button>}</div>
    {parts.length ? <div className="divide-y divide-slate-100">{parts.map((part) => <div key={part.id} className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{part.position}. {sectionLabel[part.section]}</p><p className="mt-1 text-sm font-bold text-slate-800">{part.title}</p><p className="mt-1 text-xs text-slate-500">{part.section === 'listening' ? (part.audioUrl ? 'Audio biriktirilgan' : 'Audio kiritilmagan') : part.section === 'reading' ? `${part.content.length} belgilik passage` : `${part.maxPoints} ballik writing topic`}</p></div>{editable && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => onEdit(part)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy === `delete-part:${part.id}`} onClick={() => onDelete(part.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="O‘chirish">{busy === `delete-part:${part.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>)}</div> : <div className="p-6 text-sm text-slate-500">Partlar hali yo‘q. Listening, Reading yoki Writing partini qo‘shing.</div>}
    {editable && <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{form.id ? `Part ${form.position} ni tahrirlash` : 'Yangi exam parti'}</p><p className="mt-1 text-xs text-slate-500">Audio fayl 25 MB gacha bo‘lishi mumkin. URL ham berish mumkin.</p></div>{form.id && <button type="button" onClick={onNew} className="btn-ghost px-3 py-2 text-xs">Bekor qilish</button>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Bo‘lim"><AppSelect value={form.section} disabled={ieltsExam} onChange={(value) => update('section', value as ExamSection)} options={['listening', 'reading', 'writing'].map((value) => ({ value, label: sectionLabel[value as ExamSection] }))} ariaLabel="Exam bo‘limi" />{ieltsExam && <p className="mt-1.5 text-xs text-indigo-700">IELTS blueprint bo‘lim va part tartibini qat’iy belgilaydi.</p>}</Field>
        <Field label="Part raqami"><input required min="1" max="50" type="number" value={form.position} disabled={ieltsExam} onChange={(event) => update('position', Number(event.target.value))} className="input" /></Field>
        <Field label="Part nomi" className="md:col-span-2"><input required value={form.title} onChange={(event) => update('title', event.target.value)} className="input" placeholder="Masalan: Part 1 — Campus conversation" /></Field>
        <Field label="Ko‘rsatmalar" className="md:col-span-2"><textarea value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="input min-h-20 resize-y" placeholder="Ishtirokchi ko‘radigan yo‘riqnoma" /></Field>
        {ieltsExam && form.section === 'listening' && form.position !== 1 && <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-relaxed text-indigo-900"><p className="font-bold">Umumiy Listening audio Part 1’da</p><p className="mt-1 text-xs">Bu Part alohida audio ishlatmaydi. Ishtirokchi Part 1–4 uchun bitta audio yozuvni faqat bir marta tinglaydi.</p></div>}
        {form.section === 'listening' && (!ieltsExam || form.position === 1) && <><Field label={ieltsExam ? 'Full Listening audio fayli' : 'Audio fayl'}><input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700" />{audioFile && <p className="mt-1.5 text-xs text-indigo-700">Yuklanadi: {audioFile.name}</p>}</Field><Field label={ieltsExam ? 'Full Listening audio URL (ixtiyoriy)' : 'Audio URL (ixtiyoriy)'}><input value={form.audioUrl} onChange={(event) => update('audioUrl', event.target.value)} className="input" placeholder="https://…/audio.mp3" /></Field>{ieltsExam && form.position === 1 && <Field label="Part 1 topshiriq formati" className="md:col-span-2"><AppSelect value={containsGapFillMarker(form.content) ? 'shared-gap-fill' : 'individual'} onChange={(value) => update('content', value === 'shared-gap-fill' ? (containsGapFillMarker(form.content) ? form.content : IELTS_LISTENING_PART_ONE_GAP_FILL_TEMPLATE) : '')} options={[{ value: 'individual', label: 'Alohida savollar', description: 'Har savol o‘zining matni bilan ko‘rsatiladi.' }, { value: 'shared-gap-fill', label: '1–10 bitta filling gap text', description: 'Barcha 10 ta javob umumiy form, note yoki jadval ichida bo‘ladi.' }]} ariaLabel="Listening Part 1 topshiriq formati" />{containsGapFillMarker(form.content) && <><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input mt-3 min-h-64 resize-y font-medium leading-7" /><p className="mt-2 text-xs leading-relaxed text-violet-700">Bitta umumiy matnda <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{1}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{10}}'}</code> gacha bo‘lgan markerlarning barchasi bo‘lishi shart. Keyin pastdagi savollar bo‘limida har marker uchun yozma javob kalitini kiriting.</p></>}</Field>}{cefrExam && form.position === 2 && <Field label="Part 2 to‘liq matni (gap-fill)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-56 resize-y font-medium leading-7" placeholder={'Seminar on the Toy Industry\n9.30 – 10.00: {{9}} to the seminar by Sally Connor\n...'} /><p className="mt-2 text-xs leading-relaxed text-violet-700">Ishtirokchi to‘ldiradigan har joyni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{9}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{14}}'}</code> gacha belgilang. Javoblar keyingi “Gap-fill javob kaliti” kartasida alohida yoziladi.</p></Field>}{cefrExam && form.position === 3 && <Field label="Part 3 ko‘rsatmasi (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="15–18-savol: har bir speaker uchun mos javob harfini tanlang." /><p className="mt-2 text-xs leading-relaxed text-emerald-700">Speakerlar 15–18 raqamlari bilan umumiy javob bankiga moslanadi.</p></Field>}{cefrExam && form.position === 4 && <><Field label="Tiniq xarita rasmi" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setMapImageFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700" />{mapImageFile && <p className="mt-1.5 text-xs text-sky-700">Yuklanadi: {mapImageFile.name} · rasm original sifatida saqlanadi.</p>}<p className="mt-2 text-xs leading-relaxed text-slate-500">PNG, JPG yoki WebP; 12 MB gacha. Xarita natural o‘lchamida ko‘rsatiladi.</p></Field><Field label="Xarita URL (ixtiyoriy)" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} className="input" placeholder="https://…/map.png" /></Field><Field label="Part 4 ko‘rsatmasi (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="19–23-savol: xaritadagi A–F harflaridan mos joyni tanlang." /></Field>{form.imageUrl && <div className="md:col-span-2 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-3"><img src={form.imageUrl} alt="Xarita preview" className="h-auto w-full object-contain" /></div>}</>}{form.audioUrl && <div className="md:col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"><audio controls className="w-full" src={form.audioUrl}>Audio preview</audio></div>}</>}
        {ieltsExam && form.section === 'listening' && form.position === 2 && <Field label="Part 2 topshiriq formati" className="md:col-span-2"><AppSelect value={form.content === IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT ? 'structured' : 'ordinary'} onChange={(value) => update('content', value === 'structured' ? IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT : '')} options={[{ value: 'ordinary', label: 'Oddiy savollar', description: 'Savollar alohida kartalar sifatida ko‘rsatiladi.' }, { value: 'structured', label: '13–20 uchta umumiy blok', description: '13–14 summary, 15–18 A/B/C matching va 19–20 uchun 2 ta checkbox.' }]} ariaLabel="Listening Part 2 topshiriq formati" />{form.content === IELTS_LISTENING_PART_TWO_STRUCTURED_FORMAT && <p className="mt-2 text-xs leading-relaxed text-violet-700">Savollar panelida 13–14 uchun bitta summary, 15–18 uchun A/B/C javob banki, 19–20 uchun 5 variantdan aynan 2 ta javobni tayyorlang.</p>}</Field>}
        {ieltsExam && form.section === 'listening' && form.position === 3 && <Field label="Part 3 topshiriq formati" className="md:col-span-2"><AppSelect value={form.content === IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT ? 'structured' : 'ordinary'} onChange={(value) => update('content', value === 'structured' ? IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT : '')} options={[{ value: 'ordinary', label: 'Oddiy savollar', description: 'Savollar alohida kartalar sifatida ko‘rsatiladi.' }, { value: 'structured', label: '21–30 umumiy bloklar', description: 'Ikki ikki-javobli savol va 25–30 uchun bitta flow-chart.' }]} ariaLabel="Listening Part 3 topshiriq formati" />{form.content === IELTS_LISTENING_PART_THREE_STRUCTURED_FORMAT && <p className="mt-2 text-xs leading-relaxed text-violet-700">21–22 va 23–24 uchun A–E dan ikkita checkbox, 25–30 uchun esa A–H javob banki va bitta flow-chart yarating.</p>}</Field>}
        {ieltsExam && form.section === 'listening' && form.position === 4 && <Field label="Part 4 topshiriq formati" className="md:col-span-2"><AppSelect value={isIeltsListeningPartFourSharedGapFill({ ...form, id: form.id ?? '', audioUrl: form.audioUrl || null, imageUrl: form.imageUrl || null, maxPoints: Number(form.maxPoints) } as ExamPart, true) ? 'shared-gap-fill' : 'ordinary'} onChange={(value) => update('content', value === 'shared-gap-fill' ? (gapFillBlankNumbers(form.content).some((marker) => IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(marker as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number])) ? form.content : IELTS_LISTENING_PART_FOUR_GAP_FILL_TEMPLATE) : '')} options={[{ value: 'ordinary', label: 'Oddiy savollar', description: 'Savollar alohida kartalar sifatida ko‘rsatiladi.' }, { value: 'shared-gap-fill', label: '31–40 bitta gap filling', description: 'Barcha 10 ta javob umumiy note-completion matnida bo‘ladi.' }]} ariaLabel="Listening Part 4 topshiriq formati" />{gapFillBlankNumbers(form.content).some((marker) => IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS.includes(marker as typeof IELTS_LISTENING_PART_FOUR_GAP_FILL_POSITIONS[number])) && <><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input mt-3 min-h-96 resize-y font-medium leading-7" /><p className="mt-2 text-xs leading-relaxed text-violet-700">Matnda <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{31}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{40}}'}</code> gacha bo‘lgan markerlarning barchasi bo‘lishi shart. Javob kalitlarini pastdagi savollar panelida kiriting.</p></>}</Field>}
        {ieltsExam && form.section === 'reading' && form.position === 5 && <Field label="Passage 1 topshiriq formati" className="md:col-span-2"><AppSelect value={hasIeltsReadingPassageOneSharedTextMarkers(form.content) ? 'shared-gap-fill' : 'ordinary'} onChange={(value) => update('content', value === 'shared-gap-fill' ? (gapFillBlankNumbers(form.content).some((marker) => IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS.includes(marker as typeof IELTS_READING_PASSAGE_ONE_SHARED_TEXT_POSITIONS[number])) ? form.content : IELTS_READING_PASSAGE_ONE_SHARED_TEXT_TEMPLATE) : '')} options={[{ value: 'ordinary', label: 'Oddiy Reading savollari', description: 'Har savol alohida karta sifatida ko‘rsatiladi.' }, { value: 'shared-gap-fill', label: '48–53 bitta umumiy text', description: '6 ta javob Passage 1 ichidagi bitta inline gap-fill matnida bo‘ladi.' }]} ariaLabel="Reading Passage 1 topshiriq formati" />{hasIeltsReadingPassageOneSharedTextMarkers(form.content) && <p className="mt-2 text-xs leading-relaxed text-violet-700">Passage ichida <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{48}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{53}}'}</code> gacha markerlarning har biri bir martadan bo‘lishi shart. Javob kalitlari savollar panelida yoziladi.</p>}</Field>}
        {ieltsExam && form.section === 'reading' && form.position === 6 && <Field label="Passage 2 topshiriq formati" className="md:col-span-2"><AppSelect value={form.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX) ? 'structured' : 'ordinary'} onChange={(value) => update('content', value === 'structured' ? (form.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX) ? form.content : `${IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX}${form.content}`) : ieltsReadingPassageContent(form.content))} options={[{ value: 'ordinary', label: 'Oddiy Reading savollari', description: 'Har savol alohida karta sifatida ko‘rsatiladi.' }, { value: 'structured', label: '14–26 umumiy bloklar', description: '14–20 headings, 21–24 bitta summary va 25–26 ikki harf.' }]} ariaLabel="Reading Passage 2 topshiriq formati" />{form.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX) && <p className="mt-2 text-xs leading-relaxed text-violet-700">Umumiy IELTS raqamlashda bu 54–66: 54–60 heading matching, 61–64 bitta gap filling va 65–66 uchun ikki harf.</p>}</Field>}
        {form.section === 'reading' && <Field label={ieltsExam && form.position === 5 && hasIeltsReadingPassageOneSharedTextMarkers(form.content) ? 'Passage 1 — 48–53 uchun umumiy text' : ieltsExam && form.position === 6 && form.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX) ? 'Passage 2 matni' : 'Reading passage'} className="md:col-span-2"><textarea required value={ieltsExam && form.position === 6 ? ieltsReadingPassageContent(form.content) : form.content} onChange={(event) => update('content', ieltsExam && form.position === 6 && form.content.startsWith(IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX) ? `${IELTS_READING_PASSAGE_TWO_STRUCTURED_PREFIX}${event.target.value}` : event.target.value)} className={`input resize-y ${ieltsExam && form.position === 5 && hasIeltsReadingPassageOneSharedTextMarkers(form.content) ? 'min-h-96 font-medium leading-7' : 'min-h-44'}`} placeholder="Passage matnini shu yerga yozing" /></Field>}
        {form.section === 'writing' && <><Field label="Writing topic" className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-32 resize-y" placeholder="Task 1 yoki Task 2 topicini yozing" /></Field>{ieltsExam && form.position === 8 && <><Field label="Task 1 visual (grafik, jadval yoki diagram)" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setMapImageFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-700" />{mapImageFile && <p className="mt-1.5 text-xs text-violet-700">Yuklanadi: {mapImageFile.name}</p>}<p className="mt-2 text-xs leading-relaxed text-slate-500">PNG, JPG yoki WebP; 12 MB gacha. Ishtirokchi Task 1 matni bilan birga ko‘radi.</p></Field><Field label="Visual URL (ixtiyoriy)" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} className="input" placeholder="https://…/chart.png" /></Field>{form.imageUrl && <div className="md:col-span-2 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/50 p-3"><img src={form.imageUrl} alt="Writing Task 1 visual preview" className="h-auto w-full object-contain" /></div>}</>}<Field label="Maksimal ball"><input required min="1" max="1000" type="number" value={form.maxPoints} onChange={(event) => update('maxPoints', event.target.value)} className="input" /></Field></>}
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
        {partPosition === 2 && <Field label="To‘liq matn va bo‘sh joylar" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-56 resize-y font-medium leading-7" placeholder={'Seminar on the Toy Industry\n9.30 – 10.00: {{9}} to the seminar by Sally Connor\n...'} /><p className="mt-2 text-xs leading-relaxed text-violet-700">Bo‘sh joylarni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{9}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{14}}'}</code> gacha belgilang. Saqlagandan keyin javob kaliti shu Part sahifasida chiqadi.</p></Field>}
        {partPosition === 6 && <Field label="To‘liq matn va bo‘sh joylar" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-56 resize-y font-medium leading-7" placeholder={'Lecture notes\nThe first topic is {{30}}\n...'} /><p className="mt-2 text-xs leading-relaxed text-violet-700">Bo‘sh joylarni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{30}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{35}}'}</code> gacha belgilang. Saqlagandan keyin javob kaliti shu Part sahifasida chiqadi.</p></Field>}
        {partPosition === 3 && <Field label="Qo‘shimcha ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-28 resize-y leading-7" placeholder="15–18-savol: har bir speaker uchun mos javob harfini tanlang." /><p className="mt-2 text-xs leading-relaxed text-emerald-700">Saqlagandan keyin 15–18-savollar va umumiy A/B/C… javob banki shu Part sahifasida sozlanadi.</p></Field>}
        {partPosition === 4 && <><Field label="Tiniq xarita rasmi" className="md:col-span-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setMapImageFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700" />{mapImageFile && <p className="mt-1.5 text-xs text-sky-700">Yuklanadi: {mapImageFile.name} · original sifati saqlanadi.</p>}<p className="mt-2 text-xs leading-relaxed text-slate-500">PNG, JPG yoki WebP; 12 MB gacha.</p></Field><Field label="Xarita URL (ixtiyoriy)" className="md:col-span-2"><input value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} className="input" placeholder="https://…/map.png" /></Field><Field label="Qo‘shimcha ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-24 resize-y" placeholder="19–23-savol: xaritadagi A–F harflaridan mos joyni tanlang." /></Field>{form.imageUrl && <div className="md:col-span-2 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-3"><img src={form.imageUrl} alt="Xarita preview" className="h-auto w-full object-contain" /></div>}</>}
        {partPosition === 5 && <Field label="Extractlar uchun ko‘rsatma (ixtiyoriy)" className="md:col-span-2"><textarea value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-24 resize-y leading-7" placeholder="24–29-savol: 3 ta extractni tinglang. Har bir extract bo‘yicha 2 tadan savolga javob bering." /><div className="mt-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 text-xs leading-relaxed text-fuchsia-900"><p className="font-bold">Part 5 formati qat’iy: 3 extract × 2 savol = 6 savol, raqamlar 24–29.</p><p className="mt-1">Partni saqlaganingizdan keyin pastda Extract 1 uchun 24–25, Extract 2 uchun 26–27 va Extract 3 uchun 28–29-savollar chiqadi.</p></div></Field>}
        {form.audioUrl && <div className="md:col-span-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"><audio controls className="w-full" src={form.audioUrl}>Audio preview</audio></div>}
      </div>
      <div className="mt-5 flex justify-end"><button type="submit" disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy === 'exam-part' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}{busy === 'exam-part' ? 'Saqlanmoqda…' : savedPart ? 'Partni saqlash' : 'Partni yaratish'}</button></div>
    </form>}
  </section>;
}

function CefrFocusedReadingPartSection({ parts, form, setForm, editable, partPosition, busy, onSubmit, onEdit, onDelete }: { parts: ExamPart[]; form: ExamPartForm; setForm: Dispatch<SetStateAction<ExamPartForm>>; editable: boolean; partPosition: number; busy: string | null; onSubmit: (event: FormEvent) => void; onEdit: (part: ExamPart) => void; onDelete: (partId: string) => void }) {
  const update = <K extends keyof ExamPartForm>(key: K, value: ExamPartForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const meta = CEFR_READING_PARTS.find((item) => item.position === partPosition) ?? { position: partPosition, title: 'Reading', description: 'Reading partini tayyorlang.' };
  const savedPart = parts.find((part) => part.section === 'reading' && part.position === partPosition);
  const markerRange = partPosition === 1 ? <p className="mt-2 text-xs leading-relaxed text-violet-700">Bo‘sh joylarni <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{1}}'}</code> dan <code className="rounded bg-violet-50 px-1.5 py-0.5">{'{{6}}'}</code> gacha belgilang. Javob kaliti Part sahifasida chiqadi.</p> : null;
  const taskHint = partPosition === 2 ? '7–14 statementni yozing. Keyin pastda har biriga mos situation va umumiy javob bankini sozlaysiz.' : partPosition === 3 ? 'Katta matndagi 15–20 paragrafni belgilang. Pastda 6 heading va 2 ortiqcha variantni sozlaysiz.' : partPosition === 4 ? '21–24 uchun A/B/C/D, 25–29 uchun True/False/Not Given savollarini Part yaratilgach alohida kartalarda yozasiz.' : partPosition === 5 ? 'Bu yerga asosiy passage yoki ko‘rsatmani yozing. Part yaratilgach 30–33 uchun alohida kichik textlar, 34–35 uchun A/B/C/D kartalari pastda chiqadi.' : '';
  return <section className="card overflow-hidden ring-1 ring-cyan-100">
    <div className="workspace-panel-heading bg-gradient-to-r from-cyan-50 via-white to-indigo-50"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR Reading · Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{meta.title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{meta.description}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${savedPart ? 'bg-success-50 text-success-700' : 'bg-sun-50 text-sun-700'}`}>{savedPart ? 'Part saqlangan' : '1-qadam: part yarating'}</span></div>
    {savedPart && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3 sm:px-6"><div><p className="text-sm font-bold text-slate-800">{savedPart.title}</p><p className="mt-1 text-xs text-slate-500">{savedPart.content.length} belgilik reading materiali</p></div>{editable && <div className="flex gap-1"><button type="button" onClick={() => onEdit(savedPart)} className="rounded-lg p-2 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700" title="Partni tahrirlash"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy === `delete-part:${savedPart.id}`} onClick={() => onDelete(savedPart.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-50 hover:text-error-700 disabled:opacity-50" title="Partni o‘chirish">{busy === `delete-part:${savedPart.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</div>}
    {editable && <form onSubmit={onSubmit} className="bg-slate-50/70 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-900">{savedPart ? 'Part ma’lumotlarini tahrirlash' : `Reading Part ${partPosition} ni sozlash`}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Passage va topshiriq matni faqat shu Reading Part uchun saqlanadi.</p></div>{savedPart && <button type="button" onClick={() => onEdit(savedPart)} className="btn-ghost px-3 py-2 text-xs">Saqlangan ma’lumotni tiklash</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Part nomi" className="md:col-span-2"><input required value={form.title} onChange={(event) => update('title', event.target.value)} className="input" placeholder={`Reading Part ${partPosition} nomi`} /></Field><Field label="Ishtirokchiga ko‘rsatma" className="md:col-span-2"><textarea value={form.instructions} onChange={(event) => update('instructions', event.target.value)} className="input min-h-20 resize-y" placeholder="Qisqa va aniq ko‘rsatma" /></Field><Field label={partPosition === 1 ? 'To‘liq matn va bo‘sh joylar' : 'Reading passage / topshiriq matni'} className="md:col-span-2"><textarea required value={form.content} onChange={(event) => update('content', event.target.value)} className="input min-h-64 resize-y font-medium leading-7" placeholder={partPosition === 1 ? 'The study found that {{1}} is important for...\n...' : 'Passage matnini shu yerga yozing. Paragraf yoki bo‘limlarni aniq ajrating.'} />{markerRange}{taskHint && <p className="mt-2 text-xs leading-relaxed text-cyan-700">{taskHint}</p>}</Field></div><div className="mt-5 flex justify-end"><button type="submit" disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">{busy === 'exam-part' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}{busy === 'exam-part' ? 'Saqlanmoqda…' : savedPart ? 'Partni saqlash' : 'Partni yaratish'}</button></div></form>}
  </section>;
}

function CefrPartFiveQuestions({ part, questions, form, setForm, parts, editable, busy, editingId, onSave, onEdit, onDelete }: { part: ExamPart | null; questions: EditorQuestion[]; form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; parts: ExamPart[]; editable: boolean; busy: string | null; editingId: string | null; onSave: (event: FormEvent) => Promise<void>; onEdit: (question: EditorQuestion) => void; onDelete: (questionId: string) => void }) {
  if (!part) return <section className="card border border-dashed border-fuchsia-200 bg-fuchsia-50/60 p-6"><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">CEFR · Listening Part 5</p><h2 className="mt-1 text-xl font-bold text-slate-900">Avval Part 5 ni yarating</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Audio va Part 5 ma’lumotlarini yuqorida saqlang. Shundan keyin bu yerda 3 ta extract va har biriga 2 tadan savol joyi ochiladi.</p></section>;
  const extracts = [1, 2, 3].map((extractNumber) => ({ extractNumber, questionPositions: [CEFR_PART_FIVE_QUESTION_POSITIONS[(extractNumber - 1) * 2], CEFR_PART_FIVE_QUESTION_POSITIONS[(extractNumber * 2) - 1]] }));
  const count = questions.filter((question) => CEFR_PART_FIVE_QUESTION_POSITIONS.includes(question.position as typeof CEFR_PART_FIVE_QUESTION_POSITIONS[number])).length;
  return <section className="card overflow-hidden ring-1 ring-fuchsia-100"><div className="workspace-panel-heading bg-gradient-to-r from-fuchsia-50 via-white to-violet-50"><div><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">CEFR · Listening Part 5</p><h2 className="mt-1 text-xl font-bold text-slate-900">3 ta extract · 6 ta savol</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Har extract aynan 2 ta savoldan iborat. Umumiy 1–29 raqamlashda bu Part 5 uchun 24–29-savollar; raqamlar boshqa partlarda qaytalanmaydi.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${count === 6 ? 'bg-success-50 text-success-700' : 'bg-fuchsia-100 text-fuchsia-700'}`}>{count}/6 savol</span></div><div className="grid gap-5 bg-slate-50/50 p-5 sm:p-6 lg:grid-cols-3">{extracts.map(({ extractNumber, questionPositions }) => <article key={extractNumber} className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-white shadow-sm"><div className="border-b border-fuchsia-100 bg-fuchsia-50/70 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-fuchsia-700">Extract {extractNumber}</p><p className="mt-1 text-sm font-bold text-slate-800">Savol {questionPositions[0]} va {questionPositions[1]}</p></div><div className="divide-y divide-slate-100">{questionPositions.map((position) => {
    const item = questions.find((question) => question.position === position);
    const creatingHere = !form.id && form.partId === part.id && form.position === position;
    if (!item) return <div key={position} className="p-4"><p className="text-xs font-bold text-slate-500">Savol {position}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Hali qo‘shilmagan.</p>{editable && <button type="button" onClick={() => setForm(emptyQuestion(position, part.id))} className="btn-ghost mt-3 px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Savol {position} ni yozish</button>}{creatingHere && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(24, null))} />}</div>;
    return <div key={item.id}><QuestionRow question={item} parts={parts} cefrExam ieltsExam={false} editable={editable} editing={editingId === item.id} busy={busy === `delete:${item.id}`} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />{editable && editingId === item.id && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(24, null))} />}</div>;
  })}</div></article>)}</div></section>;
}

function CefrReadingObjectiveQuestions({ part, questions, form, setForm, parts, editable, busy, editingId, onSave, onEdit, onDelete, partPosition }: { part: ExamPart | null; questions: EditorQuestion[]; form: QuestionForm; setForm: Dispatch<SetStateAction<QuestionForm>>; parts: ExamPart[]; editable: boolean; busy: string | null; editingId: string | null; onSave: (event: FormEvent) => Promise<void>; onEdit: (question: EditorQuestion) => void; onDelete: (questionId: string) => void; partPosition: 4 | 5 }) {
  const positions = partPosition === 4 ? CEFR_READING_PART_FOUR_QUESTION_POSITIONS : CEFR_READING_PART_FIVE_QUESTION_POSITIONS;
  const tfng = partPosition === 4 && CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS.includes(form.position as typeof CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS[number]);
  const title = partPosition === 4 ? 'A/B/C/D + True / False / Not Given' : 'Kichik text completion + multiple choice';
  const detail = partPosition === 4 ? '21–24 savolda A/B/C/D; 25–29 bayonotda True, False yoki Not Given tanlanadi.' : '30–33 bitta umumiy kichik text ichidagi bo‘sh joylar; 34–35 esa A/B/C/D savollari.';
  if (!part) return <section className="card border border-dashed border-cyan-200 bg-cyan-50/60 p-6"><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR · Reading Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">Avval Part {partPosition} ni yarating</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Passage va Part ma’lumotini yuqorida saqlagandan keyin savol kartalari shu yerda ochiladi.</p></section>;
  const createQuestion = (position: number) => {
    const miniText = partPosition === 5 && CEFR_READING_PART_FIVE_TEXT_POSITIONS.includes(position as typeof CEFR_READING_PART_FIVE_TEXT_POSITIONS[number]);
    setForm(miniText
      ? { ...emptyQuestion(position, part.id), prompt: position === 30 ? 'Kichik textni shu yerga yozing: {{30}} ... {{31}} ... {{32}} ... {{33}}' : `Shared mini-text answer key {{${position}}}`, options: [], answerType: 'text', correctOption: null, wordLimit: '1' }
      : { ...emptyQuestion(position, part.id), options: partPosition === 4 && CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS.includes(position as typeof CEFR_READING_PART_FOUR_TFNG_QUESTION_POSITIONS[number]) ? [...CEFR_TRUE_FALSE_NOT_GIVEN_OPTIONS] : ['', '', '', ''], correctOption: null });
  };
  return <section className="card overflow-hidden ring-1 ring-cyan-100"><div className="workspace-panel-heading bg-gradient-to-r from-cyan-50 via-white to-indigo-50"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">CEFR · Reading Part {partPosition}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{detail}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${questions.length === positions.length ? 'bg-success-50 text-success-700' : 'bg-cyan-100 text-cyan-700'}`}>{questions.length}/{positions.length} savol</span></div><div className="divide-y divide-slate-100">{positions.map((position) => {
    const item = questions.find((question) => question.position === position);
    const creatingHere = !form.id && form.partId === part.id && form.position === position;
    const miniText = partPosition === 5 && CEFR_READING_PART_FIVE_TEXT_POSITIONS.includes(position as typeof CEFR_READING_PART_FIVE_TEXT_POSITIONS[number]);
    if (!item) return <div key={position} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Savol {position}</p><p className="mt-1 text-xs text-slate-500">{miniText ? position === 30 ? 'Bitta kichik textni shu yerda yozing; uning ichiga {{30}}–{{33}} bo‘sh joylarining barchasini qo‘ying.' : `Umumiy kichik textdagi {{${position}}} uchun faqat javob kalitini kiriting.` : tfng ? 'True, False yoki Not Given bayonotini kiriting.' : 'Multiple-choice savolini kiriting.'}</p></div>{editable && <button type="button" onClick={() => createQuestion(position)} className="btn-ghost px-3 py-2 text-xs"><Plus className="h-3.5 w-3.5" />Savolni yozish</button>}</div>{creatingHere && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(positions[0], null))} />}</div>;
    return <div key={item.id}><QuestionRow question={item} parts={parts} cefrExam ieltsExam={false} editable={editable} editing={editingId === item.id} busy={busy === `delete:${item.id}`} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />{editable && editingId === item.id && <QuestionFormFields form={form} setForm={setForm} busy={busy === 'question'} onSubmit={onSave} englishExam cefrExam parts={parts} fixedPart={part} onCancel={() => setForm(emptyQuestion(positions[0], null))} />}</div>;
  })}</div></section>;
}

function WritingReviewSection({ submissions, grades, setGrades, busy, finalized, onGrade }: { submissions: WritingSubmission[]; grades: Record<string, WritingGradeForm>; setGrades: Dispatch<SetStateAction<Record<string, WritingGradeForm>>>; busy: string | null; finalized: boolean; onGrade: (submission: WritingSubmission) => void }) {
  return <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Delayed writing review</p><h2 className="mt-1 text-xl font-bold text-slate-900">Writing tekshiruvi ({submissions.length})</h2><p className="mt-1 text-sm text-slate-500">Writing baholari kiritilib, contest yakunlanmaguncha final natija va rated reyting o‘zgarmaydi.</p></div>{submissions.length ? <div className="divide-y divide-slate-100">{submissions.map((submission) => { const grade = grades[submission.id] ?? writingGradeFormFrom(submission); return <article key={submission.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{submission.displayName}</p><p className="mt-1 text-xs text-slate-500">Part {submission.partPosition}: {submission.partTitle} · maksimal {submission.maxPoints} ball</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${submission.score === null ? 'bg-sun-50 text-sun-700' : 'bg-success-50 text-success-700'}`}>{submission.score === null ? 'Baholanmagan' : `${submission.score}/${submission.maxPoints} baholangan`}</span></div><div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{submission.content}</div><div className="mt-4 grid gap-4 md:grid-cols-[150px_minmax(0,1fr)_auto]"><Field label="Ball"><input disabled={finalized} min="0" max={submission.maxPoints} type="number" value={grade.score} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, score: event.target.value } }))} className="input" /></Field><Field label="Feedback (ixtiyoriy)"><input disabled={finalized} value={grade.feedback} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, feedback: event.target.value } }))} className="input" placeholder="Ishtirokchiga izoh" /></Field><div className="flex items-end"><button type="button" disabled={finalized || busy !== null} onClick={() => onGrade(submission)} className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50">{busy === `grade:${submission.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{submission.score === null ? 'Baholash' : 'Yangilash'}</button></div></div></article>; })}</div> : <div className="p-6 text-sm text-slate-500">Yuborilgan writing javoblari yo‘q.</div>}</section>;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
