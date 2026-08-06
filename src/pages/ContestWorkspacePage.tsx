import { useState, useMemo } from 'react';
import {
  ArrowLeft, Trophy, Users, Flame, Menu, X, PanelLeftClose, PanelRightClose,
  PanelLeftOpen, PanelRightOpen, Code2, ListChecks, Info,
} from 'lucide-react';
import { Link } from '@/router';
import { ProblemList } from '@/components/workspace/ProblemList';
import { ProblemPanel } from '@/components/workspace/ProblemPanel';
import { CodeEditor } from '@/components/workspace/CodeEditor';
import { ContestInfoPanel } from '@/components/workspace/ContestInfoPanel';
import {
  problems, initialLeaderboard, initialSubmissions, initialAnnouncements,
  initialClarifications, type SolveStatus, type SubmissionRecord,
  type Verdict,
} from '@/data/contestProblems';
import type { SubmitResult } from '@/components/workspace/CodeEditor';
import { getContest, getContestCategory, formatDuration, type Contest } from '@/data/contests';
import { NotFoundPage } from '@/pages/NotFoundPage';

type PanelView = 'problem' | 'editor';
type SidebarState = 'both' | 'left' | 'right' | 'none';

export function ContestWorkspacePage({ slug }: { slug: string }) {
  const contest = getContest(slug);
  return contest ? <ContestWorkspace contest={contest} /> : <NotFoundPage />;
}

function ContestWorkspace({ contest }: { contest: Contest }) {

  const cat = getContestCategory(contest.subjectSlug);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [problemStatus, setProblemStatus] = useState<Record<string, SolveStatus>>({
    p1: 'solved', p2: 'attempted',
  });
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(initialSubmissions);
  const [mobileView, setMobileView] = useState<PanelView>('problem');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const problem = problems[currentIndex];

  const handleSubmit = (language: string, _code: string): SubmitResult => {
    const isCorrect = Math.random() > 0.4;
    const verdict: Verdict = isCorrect ? 'Accepted' : ['Wrong Answer', 'Time Limit Exceeded', 'Runtime Error'][Math.floor(Math.random() * 3)] as Verdict;

    const newSub: SubmissionRecord = {
      id: `s${Date.now()}`,
      problemId: problem.id,
      problemIndex: problem.index,
      problemTitle: problem.title,
      language,
      verdict,
      timeMs: Math.floor(Math.random() * 100) + 5,
      memoryKB: Math.floor(Math.random() * 3000) + 1500,
      timestamp: new Date().toISOString(),
      contestTimeMinutes: 60 + Math.floor(Math.random() * 30),
    };

    setSubmissions((prev) => [newSub, ...prev]);

    if (verdict === 'Accepted') {
      setProblemStatus((prev) => ({ ...prev, [problem.id]: 'solved' }));
    } else if (problemStatus[problem.id] !== 'solved') {
      setProblemStatus((prev) => ({ ...prev, [problem.id]: 'attempted' }));
    }

    return {
      status: 'done',
      verdict,
      timeMs: newSub.timeMs,
      memoryKB: newSub.memoryKB,
      passedTests: verdict === 'Accepted' ? problem.hiddenTests.length + problem.examples.length : Math.floor(Math.random() * 3),
      totalTests: problem.hiddenTests.length + problem.examples.length,
      message: verdict === 'Accepted' ? 'All test cases passed!' : `Failed on test case ${Math.floor(Math.random() * 3) + 1}`,
    };
  };

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
                {formatDuration(contest.durationMinutes)} · {contest.participants.toLocaleString()} participants
              </p>
            </div>
          </div>
        </div>

        {/* Mobile view toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-800 p-1 lg:hidden">
          <button
            onClick={() => setMobileView('problem')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mobileView === 'problem' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Problem
          </button>
          <button
            onClick={() => setMobileView('editor')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              mobileView === 'editor' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
        </div>

        {/* Desktop panel toggles */}
        <div className="hidden items-center gap-2 lg:flex">
          <button
            onClick={() => setLeftOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
            title="Toggle problem list"
          >
            {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
            Problems
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
            title="Toggle contest info"
          >
            {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            Contest Info
          </button>
        </div>

        {/* Mobile contest info button */}
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 lg:hidden"
        >
          {rightOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        </button>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Problem list */}
        {leftOpen && (
          <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 lg:block">
            <ProblemList
              problems={problems}
              currentIndex={currentIndex}
              onSelect={setCurrentIndex}
              problemStatus={problemStatus}
            />
          </aside>
        )}

        {/* Center — Problem panel + Code editor */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Desktop: split view */}
          <div className="hidden flex-1 overflow-hidden lg:flex">
            <div className="flex-1 overflow-hidden border-r border-slate-200">
              <ProblemPanel problem={problem} />
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <CodeEditor
                problemTitle={problem.title}
                problemDifficulty={problem.difficulty}
                timeLimitMs={problem.timeLimitMs}
                memoryLimitMB={problem.memoryLimitMB}
                onSubmit={handleSubmit}
              />
            </div>
          </div>

          {/* Mobile: single panel */}
          <div className="flex-1 overflow-hidden lg:hidden">
            {mobileView === 'problem' ? (
              <ProblemPanel problem={problem} />
            ) : (
              <CodeEditor
                problemTitle={problem.title}
                problemDifficulty={problem.difficulty}
                timeLimitMs={problem.timeLimitMs}
                memoryLimitMB={problem.memoryLimitMB}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          {/* Mobile problem selector strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-200 bg-white px-3 py-2 lg:hidden">
            {problems.map((p, i) => {
              const status = problemStatus[p.id] ?? 'unsolved';
              const isActive = i === currentIndex;
              return (
                <button
                  key={p.id}
                  onClick={() => { setCurrentIndex(i); setMobileView('problem'); }}
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : status === 'solved'
                      ? 'bg-success-500/15 text-success-600'
                      : status === 'attempted'
                      ? 'bg-sun-500/15 text-sun-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p.index}
                </button>
              );
            })}
          </div>
        </main>

        {/* Right sidebar — Contest info */}
        {rightOpen && (
          <aside className="fixed inset-y-0 right-0 z-30 w-72 border-l border-slate-200 bg-white shadow-lift lg:relative lg:top-0 lg:shadow-none">
            <ContestInfoPanel
              endTimeIso={contest.endTime}
              leaderboard={initialLeaderboard}
              submissions={submissions}
              announcements={initialAnnouncements}
              clarifications={initialClarifications}
              contestStyle="Codeforces"
              yourHandle="you"
            />
          </aside>
        )}
      </div>
    </div>
  );
}
