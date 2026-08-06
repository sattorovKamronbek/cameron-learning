import { useState, useRef, useEffect } from 'react';
import {
  Play, Send, RotateCcw, ChevronDown, Cpu, Zap, Clock, MemoryStick,
  CheckCircle2, XCircle, Terminal, Settings2,
} from 'lucide-react';
import { languages, getLanguage, type ProgrammingLanguage, type Verdict, verdictColors, formatTime, formatMemory } from '@/data/contestProblems';
import { DifficultyBadge } from '@/components/ContestCard';
import { LoadingDots } from '@/components/LoadingState';

type RunResult = {
  status: 'idle' | 'running' | 'done' | 'error';
  output: string;
  exitCode?: number;
  timeMs?: number;
  memoryKB?: number;
  verdict?: Verdict;
  compileOutput?: string;
};

export type SubmitResult = {
  status: 'idle' | 'submitting' | 'done';
  verdict?: Verdict;
  timeMs?: number;
  memoryKB?: number;
  passedTests?: number;
  totalTests?: number;
  message?: string;
};

export function CodeEditor({
  problemTitle,
  problemDifficulty,
  timeLimitMs,
  memoryLimitMB,
  onSubmit,
}: {
  problemTitle: string;
  problemDifficulty: import('@/data/contests').Difficulty;
  timeLimitMs: number;
  memoryLimitMB: number;
  onSubmit: (language: string, code: string) => SubmitResult;
}) {
  const [langId, setLangId] = useState('cpp');
  const [code, setCode] = useState(() => getLanguage('cpp')!.template);
  const [customInput, setCustomInput] = useState('');
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [runResult, setRunResult] = useState<RunResult>({ status: 'idle', output: '' });
  const [submitResult, setSubmitResult] = useState<SubmitResult>({ status: 'idle' });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lang = getLanguage(langId)!;

  const switchLanguage = (newLangId: string) => {
    const newLang = getLanguage(newLangId);
    if (!newLang) return;
    setLangId(newLangId);
    setCode(newLang.template);
    setLangMenuOpen(false);
  };

  const syncScroll = () => {
    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

  const handleRun = () => {
    setRunResult({ status: 'running', output: '' });
    setActiveTab('output');
    setTimeout(() => {
      const simulatedOutput = simulateRun(langId, customInput);
      setRunResult({
        status: 'done',
        output: simulatedOutput.output,
        exitCode: 0,
        timeMs: simulatedOutput.timeMs,
        memoryKB: simulatedOutput.memoryKB,
      });
    }, 1200);
  };

  const handleSubmit = () => {
    setSubmitResult({ status: 'submitting' });
    setActiveTab('output');
    setTimeout(() => {
      const result = onSubmit(lang.name, code);
      setSubmitResult(result);
    }, 1800);
  };

  const handleReset = () => {
    setCode(lang.template);
    setRunResult({ status: 'idle', output: '' });
    setSubmitResult({ status: 'idle' });
  };

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 transition-colors hover:bg-slate-700"
            >
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              {lang.name}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {langMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl bg-slate-800 shadow-lift ring-1 ring-slate-700">
                  {languages.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => switchLanguage(l.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                        l.id === langId ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLimitMs}ms
            </span>
            <span className="inline-flex items-center gap-1">
              <MemoryStick className="h-3 w-3" />
              {memoryLimitMB}MB
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            title="Reset code"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleRun}
            disabled={runResult.status === 'running'}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-electric-400 ring-1 ring-electric-500/30 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            {runResult.status === 'running' ? (
              <LoadingDots />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitResult.status === 'submitting'}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-electric-500 px-4 py-1.5 text-xs font-bold text-white shadow-glow transition-all hover:shadow-glow-blue disabled:opacity-60"
          >
            {submitResult.status === 'submitting' ? (
              <LoadingDots />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={lineNumbersRef}
          className="select-none overflow-hidden bg-slate-900 py-3 text-right font-mono text-xs text-slate-600"
          style={{ width: '44px', flexShrink: 0 }}
        >
          {lineNumbers.map((n) => (
            <div key={n} className="px-2 leading-5">{n}</div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          onScroll={syncScroll}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200 outline-none"
          style={{ tabSize: 4 }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newCode = code.substring(0, start) + '    ' + code.substring(end);
              setCode(newCode);
              requestAnimationFrame(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 4;
              });
            }
          }}
        />
      </div>

      {/* I/O Console */}
      <div className="border-t border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'input' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Custom Input
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === 'output' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              Output
              {runResult.status === 'running' && (
                <LoadingDots className="ml-1" />
              )}
            </button>
          </div>
          {(runResult.status === 'done' || submitResult.status === 'done') && (
            <div className="flex items-center gap-3 text-[11px]">
              {runResult.timeMs !== undefined && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Clock className="h-3 w-3" />
                  {formatTime(runResult.timeMs)}
                </span>
              )}
              {runResult.memoryKB !== undefined && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <MemoryStick className="h-3 w-3" />
                  {formatMemory(runResult.memoryKB)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-3">
          {activeTab === 'input' ? (
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter custom input here..."
              spellCheck={false}
              className="h-28 w-full resize-none rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300 outline-none ring-1 ring-slate-800 placeholder:text-slate-600 focus:ring-indigo-500/50"
            />
          ) : (
            <OutputConsole
              runResult={runResult}
              submitResult={submitResult}
              difficulty={problemDifficulty}
              problemTitle={problemTitle}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OutputConsole({
  runResult, submitResult, difficulty,
}: {
  runResult: RunResult;
  submitResult: SubmitResult;
  difficulty: import('@/data/contests').Difficulty;
  problemTitle: string;
}) {
  if (submitResult.status === 'submitting') {
    return (
      <div className="flex h-28 items-center justify-center gap-3 text-sm text-slate-400">
        <LoadingDots />
        Submitting and judging...
      </div>
    );
  }

  if (submitResult.status === 'done' && submitResult.verdict) {
    const isAccepted = submitResult.verdict === 'Accepted';
    return (
      <div className="space-y-3">
        <div className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${verdictColors[submitResult.verdict]}`}>
          {isAccepted ? (
            <CheckCircle2 className="h-5 w-5 text-success-500" />
          ) : (
            <XCircle className="h-5 w-5 text-error-500" />
          )}
          <div className="flex-1">
            <p className="text-sm font-bold">{submitResult.verdict}</p>
            {submitResult.passedTests !== undefined && submitResult.totalTests !== undefined && (
              <p className="text-xs opacity-80">
                {submitResult.passedTests} / {submitResult.totalTests} test cases passed
              </p>
            )}
            {submitResult.message && (
              <p className="text-xs opacity-80">{submitResult.message}</p>
            )}
          </div>
          <div className="flex gap-4 text-xs">
            {submitResult.timeMs !== undefined && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(submitResult.timeMs)}
              </span>
            )}
            {submitResult.memoryKB !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MemoryStick className="h-3 w-3" />
                {formatMemory(submitResult.memoryKB)}
              </span>
            )}
          </div>
        </div>
        {isAccepted && (
          <div className="flex items-center gap-2 rounded-lg bg-success-500/10 px-3 py-2 text-xs text-success-600">
            <Zap className="h-3.5 w-3.5" />
            Nice work! Problem solved.
          </div>
        )}
      </div>
    );
  }

  if (runResult.status === 'running') {
    return (
      <div className="flex h-28 items-center justify-center gap-3 text-sm text-slate-400">
        <LoadingDots />
        Compiling and running...
      </div>
    );
  }

  if (runResult.status === 'done') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="chip bg-success-500/10 text-success-600 ring-1 ring-success-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Compiled
          </span>
          {runResult.timeMs !== undefined && (
            <span className="text-slate-400">Execution: {formatTime(runResult.timeMs)}</span>
          )}
          {runResult.memoryKB !== undefined && (
            <span className="text-slate-400">Memory: {formatMemory(runResult.memoryKB)}</span>
          )}
        </div>
        <pre className="h-20 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300 ring-1 ring-slate-800">
          {runResult.output || '(no output)'}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex h-28 items-center justify-center text-center text-sm text-slate-500">
      <div>
        <Terminal className="mx-auto h-6 w-6 text-slate-600" />
        <p className="mt-2">Run your code to see output here</p>
      </div>
    </div>
  );
}

function simulateRun(langId: string, input: string): { output: string; timeMs: number; memoryKB: number } {
  const lines = input.trim().split('\n');
  const firstLine = lines[0] || '0';
  const nums = firstLine.trim().split(/\s+/).map(Number);
  const sum = nums.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);

  return {
    output: String(sum),
    timeMs: Math.floor(Math.random() * 30) + 5,
    memoryKB: Math.floor(Math.random() * 2000) + 1500,
  };
}
