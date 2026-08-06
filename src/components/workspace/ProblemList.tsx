import {
  CheckCircle2, Circle, AlertCircle, ChevronRight, Clock, Trophy,
} from 'lucide-react';
import type { Problem, SolveStatus } from '@/data/contestProblems';
import { DifficultyBadge } from '@/components/ContestCard';

export function ProblemList({
  problems,
  currentIndex,
  onSelect,
  problemStatus,
}: {
  problems: Problem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  problemStatus: Record<string, SolveStatus>;
}) {
  const solved = problems.filter((p) => problemStatus[p.id] === 'solved').length;
  const attempted = problems.filter((p) => problemStatus[p.id] === 'attempted').length;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900">Problems</h3>
          <span className="chip bg-indigo-50 text-indigo-700">
            {solved}/{problems.length} solved
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success-500 to-electric-500 transition-all duration-500"
            style={{ width: `${(solved / problems.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success-500" />
            {solved} solved
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-sun-500" />
            {attempted} attempted
          </span>
        </div>
      </div>

      {/* Problem list */}
      <div className="flex-1 overflow-y-auto">
        {problems.map((problem, i) => {
          const status = problemStatus[problem.id] ?? 'unsolved';
          const isActive = i === currentIndex;
          return (
            <button
              key={problem.id}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 border-b border-slate-50 p-3 text-left transition-all ${
                isActive
                  ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-200/50'
                  : 'hover:bg-slate-50'
              }`}
            >
              {/* Status icon */}
              <StatusIcon status={status} />

              {/* Problem index */}
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {problem.index}
              </span>

              {/* Problem info */}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${
                  isActive ? 'text-indigo-700' : 'text-slate-700'
                }`}>
                  {problem.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{problem.points} pts</span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <span className="text-[10px] text-slate-400">{problem.tags.length} tags</span>
                </div>
              </div>

              <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-colors ${
                isActive ? 'text-indigo-600' : 'text-slate-300'
              }`} />
            </button>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="border-t border-slate-100 p-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-xs font-bold text-slate-700">{solved + attempted}</p>
            <p className="text-[10px] text-slate-400">Attempts</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-xs font-bold text-slate-700">
              {problems.reduce((sum, p) => sum + p.points, 0)}
            </p>
            <p className="text-[10px] text-slate-400">Total points</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SolveStatus }) {
  if (status === 'solved') {
    return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success-500" />;
  }
  if (status === 'attempted') {
    return <AlertCircle className="h-4 w-4 flex-shrink-0 text-sun-500" />;
  }
  return <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" />;
}
