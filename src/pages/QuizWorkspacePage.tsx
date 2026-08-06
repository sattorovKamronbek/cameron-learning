import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Clock, ChevronLeft, ChevronRight, Flag,
  CheckCircle2, Circle, AlertCircle, Trophy, Users, ListChecks,
  PanelRightClose, PanelRightOpen, X, Award, Zap,
} from 'lucide-react';
import { Link } from '@/router';
import { QuestionRenderer, type QuestionAnswer } from '@/components/workspace/QuestionRenderer';
import {
  getQuestionsForSubject, type Question,
} from '@/data/quizQuestions';
import {
  subjectRatings, getRatingColorData, getDivisionsForSubject,
} from '@/data/ratings';
import { getContest, getContestCategory, formatDuration, type Contest } from '@/data/contests';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function QuizWorkspacePage({ slug }: { slug: string }) {
  const contest = getContest(slug);
  return contest ? <QuizWorkspace contest={contest} /> : <NotFoundPage />;
}

function QuizWorkspace({ contest }: { contest: Contest }) {

  const cat = getContestCategory(contest.subjectSlug);
  const questions = useMemo(() => getQuestionsForSubject(contest.subjectSlug), [contest.subjectSlug]);
  const subjectRating = subjectRatings.find((r) => r.subjectSlug === contest.subjectSlug);
  const divisions = getDivisionsForSubject(contest.subjectSlug);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = Object.values(answers).reduce((sum, a) => sum + a.pointsEarned, 0);

  const diff = Math.max(0, new Date(contest.endTime).getTime() - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const isUrgent = diff < 30 * 60 * 1000;

  const handleAnswer = (answer: QuestionAnswer) => {
    setAnswers((prev) => ({ ...prev, [answer.questionId]: answer }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setShowSummary(true);
  };

  const questionStatus = (q: Question): 'answered' | 'current' | 'unanswered' => {
    if (answers[q.id]) return 'answered';
    if (q.index === currentQuestion.index) return 'current';
    return 'unanswered';
  };

  if (showSummary) {
    return (
      <QuizSummary
        contest={contest}
        questions={questions}
        answers={answers}
        correctCount={correctCount}
        answeredCount={answeredCount}
        totalPoints={totalPoints}
        earnedPoints={earnedPoints}
        subjectRating={subjectRating}
        cat={cat}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <Link
            to={`/contests/${contest.slug}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <div className="hidden h-4 w-px bg-slate-700 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            {cat && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700">
                <cat.icon className="h-4 w-4 text-white" />
              </span>
            )}
            <div>
              <p className="text-sm font-bold leading-tight">{contest.name}</p>
              <p className="text-[10px] text-slate-400">
                {contest.subject} · {formatDuration(contest.durationMinutes)} · {questions.length} questions
              </p>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums ${
          isUrgent ? 'bg-error-500/20 text-error-300' : 'bg-slate-800 text-slate-200'
        }`}>
          <Clock className="h-4 w-4" />
          {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        {/* Panel toggle */}
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
        >
          {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          <span className="hidden lg:inline">Navigator</span>
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center — Question */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="mx-auto max-w-3xl p-6 lg:p-8">
            {/* Progress header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white">
                  {currentQuestion.index}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Question {currentIdx + 1} of {questions.length}
                  </p>
                  <p className="text-xs text-slate-400">
                    {answeredCount} answered · {earnedPoints} / {totalPoints} points
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-electric-500 transition-all duration-500"
                    style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-500">
                  {Math.round((answeredCount / questions.length) * 100)}%
                </span>
              </div>
            </div>

            {/* Question card */}
            <div className="card p-6 lg:p-8">
              <QuestionRenderer
                question={currentQuestion}
                onAnswer={handleAnswer}
                submitted={submitted}
              />
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex gap-2">
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="btn-primary px-5 py-2.5 text-sm"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    className="btn px-5 py-2.5 text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    <Trophy className="h-4 w-4" />
                    Submit contest
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar — Question Navigator */}
        {rightOpen && (
          <aside className="w-72 flex-shrink-0 border-l border-slate-200 bg-white">
            <QuestionNavigator
              questions={questions}
              currentIdx={currentIdx}
              answers={answers}
              onSelect={setCurrentIdx}
              answeredCount={answeredCount}
              correctCount={correctCount}
              totalPoints={totalPoints}
              earnedPoints={earnedPoints}
              onSubmit={handleSubmit}
              submitted={submitted}
              division={subjectRating?.division}
              divisions={divisions}
              subjectName={contest.subject}
              ratingValue={subjectRating?.currentRating}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

/* ============ Question Navigator ============ */

function QuestionNavigator({
  questions, currentIdx, answers, onSelect,
  answeredCount, correctCount, totalPoints, earnedPoints,
  onSubmit, submitted, division, divisions, subjectName, ratingValue,
}: {
  questions: Question[];
  currentIdx: number;
  answers: Record<string, QuestionAnswer>;
  onSelect: (i: number) => void;
  answeredCount: number;
  correctCount: number;
  totalPoints: number;
  earnedPoints: number;
  onSubmit: () => void;
  submitted: boolean;
  division?: { name: string; color: string };
  divisions: { id: string; name: string; minRating: number; maxRating: number; color: string }[];
  subjectName: string;
  ratingValue?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Timer + division info */}
      <div className="border-b border-slate-100 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{subjectName} Contest</p>
        {division && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`chip bg-slate-100 ${division.color}`}>
              {division.name}
            </span>
            {ratingValue !== undefined && (
              <span
                className="text-sm font-extrabold tabular-nums"
                style={{ color: getRatingColorData(ratingValue).hex }}
              >
                {ratingValue}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress summary */}
      <div className="border-b border-slate-100 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-900">{answeredCount}/{questions.length}</p>
            <p className="text-[10px] text-slate-400">Answered</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-success-600">{correctCount}</p>
            <p className="text-[10px] text-slate-400">Correct</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Points earned</span>
            <span className="font-bold text-slate-700">{earnedPoints} / {totalPoints}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-success-500 to-electric-500 transition-all duration-500"
              style={{ width: `${(earnedPoints / totalPoints) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions</p>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, i) => {
            const isAnswered = !!answers[q.id];
            const isCorrect = answers[q.id]?.isCorrect;
            const isCurrent = i === currentIdx;
            return (
              <button
                key={q.id}
                onClick={() => onSelect(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                    : submitted
                    ? isCorrect
                    ? 'bg-success-500/15 text-success-600 ring-1 ring-success-500/20'
                    : isAnswered
                    ? 'bg-error-500/15 text-error-600 ring-1 ring-error-500/20'
                    : 'bg-slate-100 text-slate-400'
                    : isAnswered
                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                {q.index}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-1.5 text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-indigo-100 ring-1 ring-indigo-200" /> Answered
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-slate-100" /> Unanswered
          </div>
          {submitted && (
            <>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-success-500/15 ring-1 ring-success-500/20" /> Correct
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-error-500/15 ring-1 ring-error-500/20" /> Incorrect
              </div>
            </>
          )}
        </div>
      </div>

      {/* Division progress */}
      {divisions.length > 0 && ratingValue !== undefined && (
        <div className="border-t border-slate-100 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Division</p>
          <div className="mt-2 flex gap-1">
            {divisions.map((d) => {
              const isCurrent = ratingValue >= d.minRating && ratingValue <= d.maxRating;
              return (
                <div
                  key={d.id}
                  className={`h-1.5 flex-1 rounded-full ${isCurrent ? 'bg-indigo-500' : 'bg-slate-200'}`}
                />
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {divisions.find((d) => ratingValue >= d.minRating && ratingValue <= d.maxRating)?.name ?? divisions[0].name}
          </p>
        </div>
      )}

      {/* Submit button */}
      <div className="border-t border-slate-100 p-4">
        <button
          onClick={onSubmit}
          disabled={submitted}
          className="btn w-full py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          <Trophy className="h-4 w-4" />
          {submitted ? 'Submitted' : 'Submit contest'}
        </button>
        {!submitted && answeredCount < questions.length && (
          <p className="mt-2 text-center text-[10px] text-slate-400">
            {questions.length - answeredCount} questions unanswered
          </p>
        )}
      </div>
    </div>
  );
}

/* ============ Quiz Summary ============ */

function QuizSummary({
  contest, questions, answers, correctCount, answeredCount,
  totalPoints, earnedPoints, subjectRating, cat,
}: {
  contest: ReturnType<typeof getContest> extends infer T ? NonNullable<T> : never;
  questions: Question[];
  answers: Record<string, QuestionAnswer>;
  correctCount: number;
  answeredCount: number;
  totalPoints: number;
  earnedPoints: number;
  subjectRating?: { currentRating: number; peakRating: number; subjectName: string };
  cat?: { icon: typeof Trophy; color: string };
}) {
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const oldRating = subjectRating?.currentRating ?? 1500;
  const ratingDelta = Math.round((earnedPoints / totalPoints) * 60 - 20);
  const newRating = oldRating + ratingDelta;
  const oldColor = getRatingColorData(oldRating);
  const newColor = getRatingColorData(newRating);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <Link
          to={`/contests/${contest.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to contest
        </Link>
      </div>

      <div className="mx-auto max-w-3xl p-6 lg:p-10">
        {/* Hero result card */}
        <div className="card overflow-hidden">
          <div className={`relative bg-gradient-to-br ${cat?.color ?? 'from-indigo-600 to-indigo-800'} p-8 text-center text-white`}>
            <div className="absolute inset-0 bg-grid-dark opacity-5" />
            <div className="relative">
              <Trophy className="mx-auto h-12 w-12 text-white/80" />
              <h1 className="mt-4 font-display text-2xl font-extrabold">Contest Submitted!</h1>
              <p className="mt-1 text-sm text-white/70">{contest.name}</p>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            {/* Score summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryStat icon={CheckCircle2} label="Correct" value={`${correctCount}/${questions.length}`} color="text-success-600" bg="bg-success-500/10" />
              <SummaryStat icon={ListChecks} label="Answered" value={`${answeredCount}/${questions.length}`} color="text-indigo-600" bg="bg-indigo-50" />
              <SummaryStat icon={Zap} label="Accuracy" value={`${accuracy}%`} color="text-electric-600" bg="bg-electric-50" />
              <SummaryStat icon={Award} label="Points" value={`${earnedPoints}`} color="text-sun-600" bg="bg-sun-500/10" />
            </div>

            {/* Rating change */}
            {subjectRating && (
              <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{subjectRating.subjectName} Rating Change</p>
                <div className="mt-4 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Before</p>
                    <p className="font-display text-3xl font-extrabold tabular-nums" style={{ color: oldColor.hex }}>
                      {oldRating}
                    </p>
                    <span className="text-xs" style={{ color: oldColor.hex }}>{oldColor.name}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <ChevronRight className="h-6 w-6 text-slate-500" />
                    <span className={`text-lg font-extrabold ${ratingDelta >= 0 ? 'text-success-400' : 'text-error-400'}`}>
                      {ratingDelta >= 0 ? '+' : ''}{ratingDelta}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">After</p>
                    <p className="font-display text-3xl font-extrabold tabular-nums" style={{ color: newColor.hex }}>
                      {newRating}
                    </p>
                    <span className="text-xs" style={{ color: newColor.hex }}>{newColor.name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Question breakdown */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900">Question Breakdown</h3>
              <div className="mt-3 space-y-2">
                {questions.map((q) => {
                  const ans = answers[q.id];
                  const isCorrect = ans?.isCorrect;
                  const isAnswered = !!ans;
                  return (
                    <Link
                      key={q.id}
                      to={`/contests/${contest.slug}/quiz`}
                      onClick={(e) => e.preventDefault()}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                    >
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isCorrect ? 'bg-success-500/15 text-success-600' : isAnswered ? 'bg-error-500/15 text-error-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {q.index}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{q.prompt}</p>
                        <p className="text-xs text-slate-400">{q.type.replace('-', ' ')} · {q.points} pts</p>
                      </div>
                      <span className={`chip text-xs ${isCorrect ? 'bg-success-500/10 text-success-600' : isAnswered ? 'bg-error-500/10 text-error-600' : 'bg-slate-100 text-slate-400'}`}>
                        {isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Skipped'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/contests" className="btn-ghost flex-1 justify-center">
                <ListChecks className="h-4 w-4" />
                More contests
              </Link>
              <Link to="/profile" className="btn-primary flex-1 justify-center">
                <Trophy className="h-4 w-4" />
                View my ratings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon, label, value, color, bg,
}: {
  icon: typeof CheckCircle2; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center">
      <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="mt-2 text-xl font-extrabold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
