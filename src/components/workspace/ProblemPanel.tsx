import { useState } from 'react';
import {
  Clock, MemoryStick, Lightbulb, BookOpen, ChevronDown, ChevronUp,
  Tag, FileText, FileOutput, FileInput, Lock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import type { Problem } from '@/data/contestProblems';
import { DifficultyBadge } from '@/components/ContestCard';

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Problem header */}
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-soft">
                {problem.index}
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {problem.title}
                </h2>
                <p className="text-xs text-slate-400">Problem {problem.index} · {problem.points} points</p>
              </div>
            </div>
            <DifficultyBadge difficulty={problem.difficulty} />
          </div>

          {/* Meta tags */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip bg-slate-100 text-slate-600">
              <Clock className="h-3 w-3" />
              {problem.timeLimitMs}ms
            </span>
            <span className="chip bg-slate-100 text-slate-600">
              <MemoryStick className="h-3 w-3" />
              {problem.memoryLimitMB}MB
            </span>
            {problem.tags.map((tag) => (
              <span key={tag} className="chip bg-indigo-50 text-indigo-700">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Problem content */}
      <div className="space-y-6 p-5">
        {/* Statement */}
        <Section icon={FileText} title="Statement">
          <div className="prose-sm space-y-3 text-sm leading-relaxed text-slate-700">
            {problem.statement.split('\n\n').map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: renderMath(para) }} />
            ))}
          </div>
        </Section>

        {/* Constraints */}
        <Section icon={AlertTriangle} title="Constraints">
          <ul className="space-y-1.5">
            {problem.constraints.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                <span dangerouslySetInnerHTML={{ __html: renderMath(c) }} />
              </li>
            ))}
          </ul>
        </Section>

        {/* Input format */}
        <Section icon={FileInput} title="Input">
          <p
            className="text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: renderMath(problem.inputFormat) }}
          />
        </Section>

        {/* Output format */}
        <Section icon={FileOutput} title="Output">
          <p
            className="text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: renderMath(problem.outputFormat) }}
          />
        </Section>

        {/* Examples */}
        <Section icon={BookOpen} title="Examples" defaultOpen>
          <div className="space-y-4">
            {problem.examples.map((ex, i) => (
              <ExampleBlock
                key={i}
                label={`Sample ${i + 1}`}
                input={ex.input}
                output={ex.output}
                explanation={ex.explanation}
              />
            ))}
          </div>
        </Section>

        {/* Hidden tests */}
        <Section icon={Lock} title={`Hidden Tests (${problem.hiddenTests.length})`}>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Lock className="h-4 w-4 text-slate-400" />
              <span>{problem.hiddenTests.length} hidden test cases</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Hidden tests are used by the judge to evaluate your submission. They include edge cases
              and large inputs that are not shown here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {problem.hiddenTests.map((t) => (
                <span key={t.id} className="chip bg-white text-slate-500 ring-1 ring-slate-200">
                  <Lock className="h-2.5 w-2.5" />
                  Test {t.id}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* Hints */}
        <Section icon={Lightbulb} title="Hints" defaultOpen>
          <div className="space-y-3">
            {problem.hints.map((hint, i) => (
              <HintBlock key={i} index={i + 1} hint={hint} />
            ))}
          </div>
        </Section>

        {/* Editorial */}
        <Section icon={FileText} title="Editorial">
          {problem.editorial ? (
            <div className="text-sm leading-relaxed text-slate-700">{problem.editorial}</div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-electric-50 p-5 text-center ring-1 ring-indigo-100">
              <Lock className="mx-auto h-6 w-6 text-indigo-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">Editorial locked</p>
              <p className="mt-1 text-xs text-slate-500">
                The editorial will be available after the contest ends.
              </p>
            </div>
          )}
        </Section>

        <div className="h-4" />
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, children, defaultOpen = false,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || title === 'Statement' || title === 'Examples' || title === 'Hints');
  return (
    <div className="rounded-2xl ring-1 ring-slate-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon className="h-4 w-4 text-indigo-500" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ExampleBlock({
  label, input, output, explanation,
}: {
  label: string;
  input: string;
  output: string;
  explanation?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="grid sm:grid-cols-2">
        <div className="border-b border-slate-100 sm:border-b-0 sm:border-r">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Input</div>
          <pre className="px-3 pb-3 font-mono text-xs text-slate-700 whitespace-pre-wrap">{input}</pre>
        </div>
        <div>
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Output</div>
          <pre className="px-3 pb-3 font-mono text-xs text-slate-700 whitespace-pre-wrap">{output}</pre>
        </div>
      </div>
      {explanation && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <span className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: renderMath(explanation) }} />
        </div>
      )}
    </div>
  );
}

function HintBlock({ index, hint }: { index: number; hint: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-2xl bg-sun-500/5 p-4 ring-1 ring-sun-500/15">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-sun-700">
          <Lightbulb className="h-4 w-4 text-sun-500" />
          Hint {index}
        </span>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-sun-600 ring-1 ring-sun-500/20 transition-colors hover:bg-sun-50"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
      {revealed && (
        <p
          className="mt-2 text-sm leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: renderMath(hint) }}
        />
      )}
      {!revealed && (
        <p className="mt-2 text-xs text-slate-400">
          Click "Reveal" to see this hint. Use hints wisely — they may affect your score.
        </p>
      )}
    </div>
  );
}

function renderMath(text: string): string {
  return text
    .replace(/\$([^$]+)\$/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700">$1</code>')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\ne/g, '≠')
    .replace(/\\times/g, '×')
    .replace(/\\bmod/g, 'mod')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥');
}
