import { useState, useRef } from 'react';
import {
  Check, X, CircleDot, CheckSquare, ToggleLeft, TextCursorInput, Hash,
  PenLine, ArrowLeftRight, ArrowDownUp, ImageIcon, Headphones, Video,
  CheckCircle2, AlertCircle, ChevronUp, ChevronDown, Play, Pause, Volume2,
} from 'lucide-react';
import type {
  Question, MultipleChoiceQuestion, MultipleSelectQuestion,
  TrueFalseQuestion, FillBlankQuestion, NumericalQuestion,
  EssayQuestion, MatchingQuestion, OrderingQuestion,
  ImageQuestion, AudioQuestion, VideoQuestion,
} from '@/data/quizQuestions';
import { getQuestionTypeMeta } from '@/data/quizQuestions';

export type QuestionAnswer = {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  answer: unknown;
};

export function QuestionRenderer({
  question,
  onAnswer,
  submitted,
}: {
  question: Question;
  onAnswer: (answer: QuestionAnswer) => void;
  submitted: boolean;
}) {
  switch (question.type) {
    case 'multiple-choice':
      return <MultipleChoice q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'multiple-select':
      return <MultipleSelect q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'true-false':
      return <TrueFalse q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'fill-blank':
      return <FillBlank q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'numerical':
      return <Numerical q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'essay':
      return <Essay q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'matching':
      return <Matching q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'ordering':
      return <Ordering q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'image':
      return <ImageQuestionView q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'audio':
      return <AudioQuestionView q={question} onAnswer={onAnswer} submitted={submitted} />;
    case 'video':
      return <VideoQuestionView q={question} onAnswer={onAnswer} submitted={submitted} />;
    default:
      return null;
  }
}

/* ============ Shared UI ============ */

function QuestionHeader({ question }: { question: Question }) {
  const meta = getQuestionTypeMeta(question.type);
  const Icon = iconMap[meta.icon] ?? CircleDot;
  return (
    <div className="flex items-center gap-2">
      <span className={`chip ${meta.color}`}>
        <Icon className="h-3 w-3" />
        {meta.shortName}
      </span>
      <span className="chip bg-slate-100 text-slate-500">{question.points} pts</span>
      <span className="chip bg-slate-100 text-slate-500">{question.topic}</span>
    </div>
  );
}

const iconMap: Record<string, typeof Check> = {
  CircleDot, CheckSquare, ToggleLeft, TextCursorInput, Hash,
  PenLine, ArrowLeftRight, ArrowDownUp, ImageIcon, Headphones, Video,
};

function OptionRow({
  index, text, selected, correct, showResult, onClick,
}: {
  index: number;
  text: string;
  selected: boolean;
  correct: boolean;
  showResult: boolean;
  onClick: () => void;
}) {
  const isWrong = showResult && selected && !correct;
  const isRight = showResult && correct;
  return (
    <button
      onClick={onClick}
      disabled={showResult}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
        isRight
          ? 'border-success-500 bg-success-500/5'
          : isWrong
          ? 'border-error-500 bg-error-500/5'
          : selected
          ? 'border-indigo-400 bg-indigo-50/60'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      } ${showResult ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
        isRight ? 'bg-success-500 text-white' : isWrong ? 'bg-error-500 text-white' : selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        {String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1 text-sm font-medium text-slate-700">{text}</span>
      {isRight && <CheckCircle2 className="h-5 w-5 text-success-500" />}
      {isWrong && <AlertCircle className="h-5 w-5 text-error-500" />}
    </button>
  );
}

/* ============ Multiple Choice ============ */

function MultipleChoice({
  q, onAnswer, submitted,
}: { q: MultipleChoiceQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    if (submitted) return;
    setSelected(i);
    onAnswer({
      questionId: q.id,
      isCorrect: i === q.correctIndex,
      pointsEarned: i === q.correctIndex ? q.points : 0,
      answer: i,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <OptionRow
            key={i}
            index={i}
            text={opt}
            selected={selected === i}
            correct={i === q.correctIndex}
            showResult={submitted}
            onClick={() => handleSelect(i)}
          />
        ))}
      </div>
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Multiple Select ============ */

function MultipleSelect({
  q, onAnswer, submitted,
}: { q: MultipleSelectQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    if (submitted) return;
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
    const isCorrect =
      next.size === q.correctIndices.length &&
      q.correctIndices.every((idx) => next.has(idx));
    onAnswer({
      questionId: q.id,
      isCorrect,
      pointsEarned: isCorrect ? q.points : 0,
      answer: Array.from(next).sort(),
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <p className="text-xs text-slate-400">Select all correct answers.</p>
      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            disabled={submitted}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
              submitted && q.correctIndices.includes(i)
                ? 'border-success-500 bg-success-500/5'
                : submitted && selected.has(i) && !q.correctIndices.includes(i)
                ? 'border-error-500 bg-error-500/5'
                : selected.has(i)
                ? 'border-indigo-400 bg-indigo-50/60'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
              selected.has(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {selected.has(i) ? <CheckSquare className="h-4 w-4" /> : <span className="text-xs font-bold">{String.fromCharCode(65 + i)}</span>}
            </span>
            <span className="flex-1 text-sm font-medium text-slate-700">{opt}</span>
            {submitted && q.correctIndices.includes(i) && <CheckCircle2 className="h-5 w-5 text-success-500" />}
          </button>
        ))}
      </div>
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ True / False ============ */

function TrueFalse({
  q, onAnswer, submitted,
}: { q: TrueFalseQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [selected, setSelected] = useState<boolean | null>(null);

  const handleSelect = (val: boolean) => {
    if (submitted) return;
    setSelected(val);
    onAnswer({
      questionId: q.id,
      isCorrect: val === q.correctAnswer,
      pointsEarned: val === q.correctAnswer ? q.points : 0,
      answer: val,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => {
          const isCorrect = val === q.correctAnswer;
          const isSelected = selected === val;
          return (
            <button
              key={String(val)}
              onClick={() => handleSelect(val)}
              disabled={submitted}
              className={`flex items-center justify-center gap-2 rounded-2xl border p-5 text-base font-bold transition-all ${
                submitted && isCorrect
                  ? 'border-success-500 bg-success-500/5 text-success-700'
                  : submitted && isSelected && !isCorrect
                  ? 'border-error-500 bg-error-500/5 text-error-700'
                  : isSelected
                  ? 'border-indigo-400 bg-indigo-50/60 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {val ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {val ? 'True' : 'False'}
            </button>
          );
        })}
      </div>
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Fill in the Blank ============ */

function FillBlank({
  q, onAnswer, submitted,
}: { q: FillBlankQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [value, setValue] = useState('');

  const check = (v: string) => {
    const normalized = q.caseSensitive ? v.trim() : v.trim().toLowerCase();
    const accepted = q.caseSensitive
      ? q.acceptedAnswers
      : q.acceptedAnswers.map((a) => a.toLowerCase());
    return accepted.some((a) => a === normalized);
  };

  const handleChange = (v: string) => {
    if (submitted) return;
    setValue(v);
    onAnswer({
      questionId: q.id,
      isCorrect: check(v),
      pointsEarned: check(v) ? q.points : 0,
      answer: v,
    });
  };

  const isCorrect = submitted && check(value);

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={submitted}
        placeholder={q.placeholder}
        className={`w-full rounded-2xl border-2 px-4 py-3 text-sm font-medium outline-none transition-all ${
          submitted
            ? isCorrect
              ? 'border-success-500 bg-success-500/5'
              : 'border-error-500 bg-error-500/5'
            : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
        }`}
      />
      {submitted && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">
            Accepted answers: <span className="text-success-600">{q.acceptedAnswers.join(', ')}</span>
          </p>
          {q.explanation && <p className="mt-1 text-slate-500">{q.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/* ============ Numerical Answer ============ */

function Numerical({
  q, onAnswer, submitted,
}: { q: NumericalQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [value, setValue] = useState('');

  const check = (v: string) => {
    const num = parseFloat(v);
    if (isNaN(num)) return false;
    return Math.abs(num - q.correctAnswer) <= q.tolerance;
  };

  const handleChange = (v: string) => {
    if (submitted) return;
    setValue(v);
    onAnswer({
      questionId: q.id,
      isCorrect: check(v),
      pointsEarned: check(v) ? q.points : 0,
      answer: v,
    });
  };

  const isCorrect = submitted && check(value);

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={submitted}
            placeholder="Enter a number..."
            className={`w-full rounded-2xl border-2 px-4 py-3 pr-16 text-sm font-medium outline-none transition-all ${
              submitted
                ? isCorrect
                  ? 'border-success-500 bg-success-500/5'
                  : 'border-error-500 bg-error-500/5'
                : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
            }`}
          />
          {q.unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              {q.unit}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">Tolerance: ±{q.tolerance}{q.unit ?? ''}</p>
      {submitted && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">
            Correct answer: <span className="text-success-600">{q.correctAnswer}{q.unit ?? ''}</span>
          </p>
          {q.explanation && <p className="mt-1 text-slate-500">{q.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/* ============ Essay ============ */

function Essay({
  q, onAnswer, submitted,
}: { q: EssayQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [text, setText] = useState('');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleChange = (v: string) => {
    if (submitted) return;
    setText(v);
    onAnswer({
      questionId: q.id,
      isCorrect: words >= q.minWords,
      pointsEarned: Math.min(q.points, Math.round((words / q.minWords) * q.points)),
      answer: v,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="rounded-2xl border border-slate-200">
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          disabled={submitted}
          rows={8}
          placeholder="Write your response here..."
          className="w-full resize-none rounded-2xl p-4 text-sm leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
          <span className={`text-xs font-semibold ${words < q.minWords ? 'text-slate-400' : 'text-success-600'}`}>
            {words} / {q.minWords}-{q.maxWords} words
          </span>
          {submitted ? (
            <span className="chip bg-indigo-50 text-indigo-700">Pending review</span>
          ) : (
            <span className="text-xs text-slate-400">Auto-graded on word count · Full review after contest</span>
          )}
        </div>
      </div>
      {q.rubric.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Grading Rubric</p>
          <ul className="mt-2 space-y-1.5">
            {q.rubric.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-indigo-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============ Matching ============ */

function Matching({
  q, onAnswer, submitted,
}: { q: MatchingQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [pairs, setPairs] = useState<Record<number, number>>({});

  const handleSelect = (leftIdx: number, rightIdx: number) => {
    if (submitted) return;
    const next = { ...pairs, [leftIdx]: rightIdx };
    setPairs(next);
    const allMatched = q.leftItems.every((_, i) => next[i] !== undefined);
    if (allMatched) {
      const isCorrect = q.leftItems.every((_, i) => next[i] === q.correctPairs[i]);
      onAnswer({
        questionId: q.id,
        isCorrect,
        pointsEarned: isCorrect ? q.points : 0,
        answer: next,
      });
    }
  };

  const isCorrect = submitted && q.leftItems.every((_, i) => pairs[i] === q.correctPairs[i]);

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="space-y-2">
        {q.leftItems.map((left, i) => {
          const selectedRight = pairs[i];
          const correctRight = q.correctPairs[i];
          const isRight = submitted && selectedRight === correctRight;
          const isWrong = submitted && selectedRight !== undefined && selectedRight !== correctRight;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`flex-1 rounded-xl border p-3 text-sm font-medium ${
                isRight ? 'border-success-500 bg-success-500/5' : isWrong ? 'border-error-500 bg-error-500/5' : 'border-slate-200 bg-white'
              }`}>
                {left}
              </div>
              <ArrowLeftRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              <select
                value={selectedRight ?? ''}
                onChange={(e) => handleSelect(i, parseInt(e.target.value))}
                disabled={submitted}
                className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-medium outline-none transition-all ${
                  submitted
                    ? isRight
                      ? 'border-success-500 bg-success-500/5'
                      : 'border-error-500 bg-error-500/5'
                    : 'border-slate-200 focus:border-indigo-400'
                }`}
              >
                <option value="">Select...</option>
                {q.rightItems.map((right, j) => (
                  <option key={j} value={j}>{right}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {submitted && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-700">Correct matches:</p>
          <ul className="mt-1 space-y-0.5">
            {q.leftItems.map((left, i) => (
              <li key={i} className="text-slate-600">
                {left} → <span className="font-semibold text-success-600">{q.rightItems[q.correctPairs[i]]}</span>
              </li>
            ))}
          </ul>
          {q.explanation && <p className="mt-2 text-slate-500">{q.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/* ============ Ordering ============ */

function Ordering({
  q, onAnswer, submitted,
}: { q: OrderingQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [order, setOrder] = useState<number[]>(q.items.map((_, i) => i));

  const move = (from: number, to: number) => {
    if (submitted) return;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    const isCorrect = next.every((origIdx, pos) => q.correctOrder[pos] === origIdx);
    onAnswer({
      questionId: q.id,
      isCorrect,
      pointsEarned: isCorrect ? q.points : 0,
      answer: next,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <p className="text-xs text-slate-400">Use the arrows to reorder. Top = first.</p>
      <div className="space-y-2">
        {order.map((origIdx, pos) => {
          const isCorrectPos = submitted && q.correctOrder[pos] === origIdx;
          const isWrongPos = submitted && q.correctOrder[pos] !== origIdx;
          return (
            <div
              key={origIdx}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${
                isCorrectPos ? 'border-success-500 bg-success-500/5' : isWrongPos ? 'border-error-500 bg-error-500/5' : 'border-slate-200'
              }`}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                {pos + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-slate-700">{q.items[origIdx]}</span>
              {!submitted && (
                <div className="flex gap-1">
                  <button
                    onClick={() => move(pos, pos - 1)}
                    disabled={pos === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(pos, pos + 1)}
                    disabled={pos === order.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
              {submitted && isCorrectPos && <CheckCircle2 className="h-5 w-5 text-success-500" />}
              {submitted && isWrongPos && <AlertCircle className="h-5 w-5 text-error-500" />}
            </div>
          );
        })}
      </div>
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Image Question ============ */

function ImageQuestionView({
  q, onAnswer, submitted,
}: { q: ImageQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    if (submitted) return;
    setSelected(i);
    onAnswer({
      questionId: q.id,
      isCorrect: i === q.correctIndex,
      pointsEarned: i === q.correctIndex ? q.points : 0,
      answer: i,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
          <div className="text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">{q.imageAlt}</p>
          </div>
        </div>
      </div>
      {q.options && (
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <OptionRow
              key={i}
              index={i}
              text={opt}
              selected={selected === i}
              correct={i === q.correctIndex}
              showResult={submitted}
              onClick={() => handleSelect(i)}
            />
          ))}
        </div>
      )}
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Audio Question ============ */

function AudioQuestionView({
  q, onAnswer, submitted,
}: { q: AudioQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [transcription, setTranscription] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    setPlaying((p) => !p);
  };

  const handleSelect = (i: number) => {
    if (submitted) return;
    setSelected(i);
    onAnswer({
      questionId: q.id,
      isCorrect: i === q.correctIndex,
      pointsEarned: i === q.correctIndex ? q.points : 0,
      answer: i,
    });
  };

  const handleTranscribe = (v: string) => {
    if (submitted) return;
    setTranscription(v);
    const accepted = q.acceptedTranscriptions ?? [];
    const isCorrect = accepted.some((a) => a.toLowerCase() === v.trim().toLowerCase());
    onAnswer({
      questionId: q.id,
      isCorrect,
      pointsEarned: isCorrect ? q.points : 0,
      answer: v,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>

      {/* Audio player */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-electric-50 to-indigo-50 p-4 ring-1 ring-electric-200">
        <button
          onClick={togglePlay}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-indigo-600 text-white shadow-soft transition-transform hover:scale-105"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Volume2 className="h-4 w-4 text-electric-500" />
            <span className="text-xs font-semibold text-electric-700">Audio Clip</span>
            <span className="text-xs text-slate-400">· {q.durationSec}s</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/60">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-electric-500 to-indigo-500 transition-all duration-1000 ${playing ? 'w-full' : 'w-0'}`}
              style={{ transitionDuration: playing ? `${q.durationSec * 1000}ms` : '0ms' }}
            />
          </div>
        </div>
      </div>

      {q.questionSubtype === 'multiple-choice' && q.options && (
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <OptionRow
              key={i}
              index={i}
              text={opt}
              selected={selected === i}
              correct={i === q.correctIndex}
              showResult={submitted}
              onClick={() => handleSelect(i)}
            />
          ))}
        </div>
      )}

      {q.questionSubtype === 'transcribe' && (
        <input
          type="text"
          value={transcription}
          onChange={(e) => handleTranscribe(e.target.value)}
          disabled={submitted}
          placeholder="Type what you heard..."
          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      )}

      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Video Question ============ */

function VideoQuestionView({
  q, onAnswer, submitted,
}: { q: VideoQuestion; onAnswer: (a: QuestionAnswer) => void; submitted: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    if (submitted) return;
    setSelected(i);
    onAnswer({
      questionId: q.id,
      isCorrect: i === q.correctIndex,
      pointsEarned: i === q.correctIndex ? q.points : 0,
      answer: i,
    });
  };

  return (
    <div className="space-y-4">
      <QuestionHeader question={q} />
      <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
      <div className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200">
        <div className="flex aspect-video items-center justify-center">
          <div className="text-center">
            <Video className="mx-auto h-12 w-12 text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">Video player · {q.durationSec}s</p>
            <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20">
              <Play className="h-3.5 w-3.5" />
              Play video
            </button>
          </div>
        </div>
      </div>
      {q.questionSubtype === 'multiple-choice' && q.options && (
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <OptionRow
              key={i}
              index={i}
              text={opt}
              selected={selected === i}
              correct={i === q.correctIndex}
              showResult={submitted}
              onClick={() => handleSelect(i)}
            />
          ))}
        </div>
      )}
      {submitted && q.explanation && <Explanation text={q.explanation} />}
    </div>
  );
}

/* ============ Explanation ============ */

function Explanation({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-electric-50 p-4 ring-1 ring-indigo-100">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Explanation
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}
