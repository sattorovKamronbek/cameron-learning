import type { Difficulty } from '@/data/contests';

export type ContestStyle = 'ICPC' | 'IOI' | 'Codeforces' | 'LeetCode';

export type ProgrammingLanguage = {
  id: string;
  name: string;
  extension: string;
  monacoId: string;
  template: string;
};

export type TestCase = {
  id: string;
  input: string;
  output: string;
  isHidden: boolean;
};

export type Problem = {
  id: string;
  index: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  statement: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; output: string; explanation?: string }[];
  hiddenTests: TestCase[];
  hints: string[];
  editorial: string | null;
  timeLimitMs: number;
  memoryLimitMB: number;
  points: number;
};

export type SolveStatus = 'solved' | 'attempted' | 'unsolved';

export type SubmissionRecord = {
  id: string;
  problemId: string;
  problemIndex: string;
  problemTitle: string;
  language: string;
  verdict: Verdict;
  timeMs: number;
  memoryKB: number;
  timestamp: string;
  contestTimeMinutes: number;
};

export type Verdict =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Pending';

export type LeaderboardEntry = {
  rank: number;
  handle: string;
  initials: string;
  country: string;
  solved: number;
  penalty: number;
  totalPoints: number;
  problemStatus: Record<string, SolveStatus>;
  isYou?: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  severity: 'info' | 'warning';
};

export type Clarification = {
  id: string;
  question: string;
  answer: string;
  problemIndex: string;
  timestamp: string;
};

export const contestStyles: Record<ContestStyle, {
  name: string;
  description: string;
  scoring: string;
  icon: string;
}> = {
  ICPC: {
    name: 'ICPC',
    description: 'Penalty-based team format. First to solve each problem gets bonus.',
    scoring: 'Solved count + 20min penalty per wrong submission',
    icon: 'Trophy',
  },
  IOI: {
    name: 'IOI',
    description: 'Partial scoring per problem. Subtasks award proportional points.',
    scoring: 'Sum of subtask scores (0–100 per problem)',
    icon: 'Award',
  },
  Codeforces: {
    name: 'Codeforces',
    description: 'Dynamic scoring. Problem value decreases over time.',
    scoring: 'Points = maxPoints - timeDecay - wrongPenalty',
    icon: 'Flame',
  },
  LeetCode: {
    name: 'LeetCode',
    description: 'Simple accepted count with time-based ranking tiebreak.',
    scoring: 'Problems solved, ranked by finish time',
    icon: 'Zap',
  },
};

export const languages: ProgrammingLanguage[] = [
  {
    id: 'cpp', name: 'C++', extension: 'cpp', monacoId: 'cpp',
    template: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    int n;\n    cin >> n;\n    cout << n << "\\n";\n    return 0;\n}\n',
  },
  {
    id: 'python', name: 'Python', extension: 'py', monacoId: 'python',
    template: 'import sys\ninput = sys.stdin.readline\n\ndef main():\n    n = int(input())\n    print(n)\n\nif __name__ == "__main__":\n    main()\n',
  },
  {
    id: 'java', name: 'Java', extension: 'java', monacoId: 'java',
    template: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println(n);\n    }\n}\n',
  },
  {
    id: 'javascript', name: 'JavaScript', extension: 'js', monacoId: 'javascript',
    template: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on("line", (line) => {\n    const n = parseInt(line);\n    console.log(n);\n});\n',
  },
  {
    id: 'go', name: 'Go', extension: 'go', monacoId: 'go',
    template: 'package main\n\nimport "fmt"\n\nfunc main() {\n    var n int\n    fmt.Scan(&n)\n    fmt.Println(n)\n}\n',
  },
  {
    id: 'rust', name: 'Rust', extension: 'rs', monacoId: 'rust',
    template: 'use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    let line = stdin.lock().lines().next().unwrap().unwrap();\n    let n: i32 = line.trim().parse().unwrap();\n    println!("{}", n);\n}\n',
  },
  {
    id: 'kotlin', name: 'Kotlin', extension: 'kt', monacoId: 'kotlin',
    template: 'fun main() {\n    val n = readLine()!!.toInt()\n    println(n)\n}\n',
  },
  {
    id: 'csharp', name: 'C#', extension: 'cs', monacoId: 'csharp',
    template: 'using System;\n\nclass Program {\n    static void Main() {\n        int n = int.Parse(Console.ReadLine());\n        Console.WriteLine(n);\n    }\n}\n',
  },
  {
    id: 'php', name: 'PHP', extension: 'php', monacoId: 'php',
    template: "<?php\n$n = intval(trim(fgets(STDIN)));\necho $n . \"\\n\";\n",
  },
];

export function getLanguage(id: string): ProgrammingLanguage | undefined {
  return languages.find((l) => l.id === id);
}

export const verdictColors: Record<Verdict, string> = {
  'Accepted': 'bg-success-500/10 text-success-600 ring-success-500/20',
  'Wrong Answer': 'bg-error-500/10 text-error-600 ring-error-500/20',
  'Time Limit Exceeded': 'bg-sun-500/10 text-sun-600 ring-sun-500/20',
  'Memory Limit Exceeded': 'bg-sun-500/10 text-sun-600 ring-sun-500/20',
  'Runtime Error': 'bg-error-500/10 text-error-600 ring-error-500/20',
  'Compilation Error': 'bg-slate-100 text-slate-600 ring-slate-200',
  'Pending': 'bg-indigo-50 text-indigo-600 ring-indigo-200',
};

export const verdictShort: Record<Verdict, string> = {
  'Accepted': 'AC',
  'Wrong Answer': 'WA',
  'Time Limit Exceeded': 'TLE',
  'Memory Limit Exceeded': 'MLE',
  'Runtime Error': 'RE',
  'Compilation Error': 'CE',
  'Pending': '...',
};

export const problems: Problem[] = [
  {
    id: 'p1', index: 'A', title: 'Sum of Two Numbers',
    difficulty: 'Easy', tags: ['Implementation', 'Math'],
    statement: 'You are given two integers $a$ and $b$. Print their sum.\n\nThis is a warmup problem to verify your setup is working correctly.',
    constraints: ['$-10^9 \\le a, b \\le 10^9$'],
    inputFormat: 'A single line containing two space-separated integers $a$ and $b$.',
    outputFormat: 'A single integer — the sum $a + b$.',
    examples: [
      { input: '3 5', output: '8', explanation: '3 + 5 = 8' },
      { input: '-10 20', output: '10', explanation: '-10 + 20 = 10' },
    ],
    hiddenTests: [
      { id: 't1', input: '1000000000 1000000000', output: '2000000000', isHidden: true },
      { id: 't2', input: '-1000000000 -1000000000', output: '-2000000000', isHidden: true },
      { id: 't3', input: '0 0', output: '0', isHidden: true },
    ],
    hints: ['Use 64-bit integers to avoid overflow in some languages.'],
    editorial: null,
    timeLimitMs: 1000, memoryLimitMB: 256, points: 100,
  },
  {
    id: 'p2', index: 'B', title: 'Maximum Subarray Sum',
    difficulty: 'Medium', tags: ['DP', 'Arrays', 'Kadane'],
    statement: 'Given an array of $n$ integers (possibly negative), find the maximum sum of any contiguous subarray.\n\nA subarray is a contiguous part of the array. The subarray can be empty (sum = 0) only if explicitly allowed — for this problem, the subarray must be non-empty.',
    constraints: ['$1 \\le n \\le 2 \\times 10^5$', '$-10^9 \\le a_i \\le 10^9$'],
    inputFormat: 'The first line contains $n$. The second line contains $n$ space-separated integers.',
    outputFormat: 'A single integer — the maximum subarray sum.',
    examples: [
      { input: '5\n1 -2 3 4 -1', output: '7', explanation: 'Subarray [3, 4] has the maximum sum = 7' },
      { input: '3\n-1 -2 -3', output: '-1', explanation: 'The best single-element subarray is [-1]' },
    ],
    hiddenTests: [
      { id: 't1', input: '6\n-1 2 3 -4 5 1', output: '7', isHidden: true },
      { id: 't2', input: '1\n0', output: '0', isHidden: true },
      { id: 't3', input: '4\n-2 -1 -3 -4', output: '-1', isHidden: true },
    ],
    hints: [
      'Think about Kadane\'s algorithm: keep a running sum and reset it when it goes negative.',
      'Be careful: the subarray must be non-empty, so initialize with the first element.',
    ],
    editorial: null,
    timeLimitMs: 2000, memoryLimitMB: 256, points: 200,
  },
  {
    id: 'p3', index: 'C', title: 'Shortest Path in DAG',
    difficulty: 'Hard', tags: ['Graphs', 'Shortest Path', 'DAG', 'Topological Sort'],
    statement: 'You are given a directed acyclic graph (DAG) with $n$ vertices and $m$ edges. Each edge has a weight $w$. Find the shortest path from vertex 1 to vertex $n$.\n\nIt is guaranteed that the graph is a DAG (no cycles). If vertex $n$ is unreachable from vertex 1, output $-1$.',
    constraints: ['$2 \\le n \\le 10^5$', '$0 \\le m \\le 3 \\times 10^5$', '$1 \\le w \\le 10^9$'],
    inputFormat: 'First line: $n$ and $m$. Next $m$ lines: $u$, $v$, $w$ — a directed edge from $u$ to $v$ with weight $w$.',
    outputFormat: 'A single integer — the shortest distance from 1 to $n$, or $-1$ if unreachable.',
    examples: [
      { input: '4 4\n1 2 3\n2 3 1\n1 3 10\n3 4 2', output: '6', explanation: 'Path: 1→2→3→4, cost = 3+1+2 = 6' },
      { input: '3 1\n1 2 5', output: '-1', explanation: 'Vertex 3 is unreachable from 1' },
    ],
    hiddenTests: [
      { id: 't1', input: '2 0', output: '-1', isHidden: true },
      { id: 't2', input: '5 6\n1 2 1\n2 3 1\n3 5 1\n1 4 5\n4 5 2\n2 4 1', output: '3', isHidden: true },
    ],
    hints: [
      'Since the graph is a DAG, you can topologically sort and relax edges in topological order.',
      'Use a standard relaxation approach: dist[v] = min(dist[v], dist[u] + w).',
    ],
    editorial: null,
    timeLimitMs: 2000, memoryLimitMB: 512, points: 350,
  },
  {
    id: 'p4', index: 'D', title: 'Count Good Substrings',
    difficulty: 'Medium', tags: ['Strings', 'Sliding Window', 'Two Pointers'],
    statement: 'Given a string $s$ of length $n$ and an integer $k$, count the number of substrings of length exactly $k$ that contain at most $k-1$ distinct characters.\n\nA substring is a contiguous sequence of characters within the string.',
    constraints: ['$1 \\le n \\le 10^6$', '$1 \\le k \\le n$', 'String $s$ contains only lowercase English letters.',
    ],
    inputFormat: 'First line: string $s$. Second line: integer $k$.',
    outputFormat: 'A single integer — the count of good substrings.',
    examples: [
      { input: 'aababc\n3', output: '3', explanation: 'Good substrings: "aab" (2 distinct), "aba" (2 distinct... wait, 3). Let me recalculate: "aab" has 2 distinct (≤2), "aba" has 2 distinct, "bab" has 2 distinct. Answer = 3.' },
      { input: 'aaaa\n2', output: '3', explanation: 'All length-2 substrings: "aa", "aa", "aa" — each has 1 distinct (≤1). Answer = 3.' },
    ],
    hiddenTests: [
      { id: 't1', input: 'abcabc\n3', output: '0', isHidden: true },
      { id: 't2', input: 'a\n1', output: '1', isHidden: true },
    ],
    hints: [
      'Use a sliding window of size $k$ with a frequency map.',
      'Track the number of distinct characters in the current window.',
    ],
    editorial: null,
    timeLimitMs: 1500, memoryLimitMB: 256, points: 250,
  },
  {
    id: 'p5', index: 'E', title: 'Modular Exponentiation',
    difficulty: 'Hard', tags: ['Math', 'Number Theory', 'Modular Arithmetic'],
    statement: 'Given three integers $a$, $b$, and $m$, compute $a^b \\bmod m$.\n\nSince the result can be very large, you must compute it modulo $m$. Use fast exponentiation (binary exponentiation).',
    constraints: ['$1 \\le a \\le 10^{18}$', '$0 \\le b \\le 10^{18}$', '$1 \\le m \\le 10^9 + 7$'],
    inputFormat: 'A single line with three space-separated integers: $a$, $b$, $m$.',
    outputFormat: 'A single integer — $a^b \\bmod m$.',
    examples: [
      { input: '2 10 1000', output: '24', explanation: '$2^{10} = 1024$, $1024 \\bmod 1000 = 24$' },
      { input: '3 0 7', output: '1', explanation: 'Any number to the power 0 is 1' },
    ],
    hiddenTests: [
      { id: 't1', input: '1000000000000000000 1000000000000000000 1000000007', output: '494444444', isHidden: true },
      { id: 't2', input: '1 1000000000 1', output: '0', isHidden: true },
    ],
    hints: [
      'Use binary exponentiation: $a^b = (a^{b/2})^2$ if $b$ is even, $a \\cdot a^{b-1}$ if $b$ is odd.',
      'Be careful with overflow — multiply modulo $m$ at each step.',
    ],
    editorial: null,
    timeLimitMs: 1000, memoryLimitMB: 256, points: 300,
  },
  {
    id: 'p6', index: 'F', title: 'Bracket Sequence Validator',
    difficulty: 'Expert', tags: ['Stack', 'Strings', 'Greedy'],
    statement: 'Given a string $s$ consisting of the characters `(`, `)`, `{`, `}`, `[`, and `]`, determine if the bracket sequence is valid.\n\nA sequence is valid if:\n- Every opening bracket has a matching closing bracket of the same type.\n- Brackets are closed in the correct order (LIFO).\n- The string is non-empty and fully matched.\n\nIf valid, output "YES". Otherwise, output "NO".',
    constraints: ['$1 \\le |s| \\le 10^6$'],
    inputFormat: 'A single line containing the bracket string $s$.',
    outputFormat: '"YES" if the sequence is valid, "NO" otherwise.',
    examples: [
      { input: '()[]{}', output: 'YES' },
      { input: '([)]', output: 'NO', explanation: 'Brackets are not closed in the correct order' },
      { input: '{[]}', output: 'YES' },
    ],
    hiddenTests: [
      { id: 't1', input: '(', output: 'NO', isHidden: true },
      { id: 't2', input: '(((())))', output: 'YES', isHidden: true },
    ],
    hints: [
      'Use a stack. Push opening brackets, pop and match on closing brackets.',
      'At the end, the stack must be empty.',
    ],
    editorial: null,
    timeLimitMs: 1000, memoryLimitMB: 256, points: 400,
  },
];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}

export const initialLeaderboard: LeaderboardEntry[] = [
  { rank: 1, handle: 'alex_code', initials: 'AC', country: 'US', solved: 5, penalty: 312, totalPoints: 1200, problemStatus: { p1: 'solved', p2: 'solved', p3: 'solved', p4: 'solved', p5: 'solved', p6: 'unsolved' } },
  { rank: 2, handle: 'neural_net', initials: 'NN', country: 'JP', solved: 4, penalty: 456, totalPoints: 950, problemStatus: { p1: 'solved', p2: 'solved', p3: 'solved', p4: 'solved', p5: 'unsolved', p6: 'unsolved' } },
  { rank: 3, handle: 'data_miner', initials: 'DM', country: 'DE', solved: 4, penalty: 523, totalPoints: 920, problemStatus: { p1: 'solved', p2: 'solved', p3: 'unsolved', p4: 'solved', p5: 'solved', p6: 'unsolved' } },
  { rank: 4, handle: 'white_hat', initials: 'WH', country: 'UK', solved: 3, penalty: 287, totalPoints: 700, problemStatus: { p1: 'solved', p2: 'solved', p3: 'solved', p4: 'unsolved', p5: 'unsolved', p6: 'unsolved' } },
  { rank: 5, handle: 'math_wiz', initials: 'MW', country: 'IN', solved: 3, penalty: 401, totalPoints: 650, problemStatus: { p1: 'solved', p2: 'solved', p3: 'unsolved', p4: 'unsolved', p5: 'solved', p6: 'unsolved' } },
  { rank: 6, handle: 'quantum_leap', initials: 'QL', country: 'FR', solved: 2, penalty: 198, totalPoints: 450, problemStatus: { p1: 'solved', p2: 'solved', p3: 'unsolved', p4: 'unsolved', p5: 'unsolved', p6: 'unsolved' } },
  { rank: 7, handle: 'you', initials: 'YO', country: 'US', solved: 1, penalty: 45, totalPoints: 100, problemStatus: { p1: 'solved', p2: 'attempted', p3: 'unsolved', p4: 'unsolved', p5: 'unsolved', p6: 'unsolved' }, isYou: true },
  { rank: 8, handle: 'bond_maker', initials: 'BM', country: 'BR', solved: 1, penalty: 89, totalPoints: 100, problemStatus: { p1: 'solved', p2: 'unsolved', p3: 'unsolved', p4: 'unsolved', p5: 'unsolved', p6: 'unsolved' } },
  { rank: 9, handle: 'gene_dna', initials: 'GD', country: 'AU', solved: 0, penalty: 0, totalPoints: 0, problemStatus: { p1: 'unsolved', p2: 'unsolved', p3: 'unsolved', p4: 'unsolved', p5: 'unsolved', p6: 'unsolved' } },
];

export const initialSubmissions: SubmissionRecord[] = [
  { id: 's1', problemId: 'p1', problemIndex: 'A', problemTitle: 'Sum of Two Numbers', language: 'C++', verdict: 'Accepted', timeMs: 12, memoryKB: 2048, timestamp: new Date(Date.now() - 45 * 60000).toISOString(), contestTimeMinutes: 45 },
  { id: 's2', problemId: 'p2', problemIndex: 'B', problemTitle: 'Maximum Subarray Sum', language: 'C++', verdict: 'Wrong Answer', timeMs: 15, memoryKB: 3120, timestamp: new Date(Date.now() - 38 * 60000).toISOString(), contestTimeMinutes: 52 },
  { id: 's3', problemId: 'p2', problemIndex: 'B', problemTitle: 'Maximum Subarray Sum', language: 'C++', verdict: 'Time Limit Exceeded', timeMs: 2000, memoryKB: 4096, timestamp: new Date(Date.now() - 30 * 60000).toISOString(), contestTimeMinutes: 60 },
];

export const initialAnnouncements: Announcement[] = [
  { id: 'a1', title: 'Contest started', body: 'The contest has officially begun. Good luck to all participants! You have 3 hours to solve 6 problems.', timestamp: new Date(Date.now() - 60 * 60000).toISOString(), severity: 'info' },
  { id: 'a2', title: 'Problem B updated', body: 'A clarification has been added to Problem B: the subarray must be non-empty. The statement has been updated accordingly.', timestamp: new Date(Date.now() - 35 * 60000).toISOString(), severity: 'warning' },
  { id: 'a3', title: 'Test data note', body: 'For Problem E, the modulo $m$ can be as large as $10^9 + 7$. Make sure your solution handles 64-bit intermediate values correctly.', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), severity: 'info' },
];

export const initialClarifications: Clarification[] = [
  { id: 'c1', problemIndex: 'B', question: 'Can the subarray be empty?', answer: 'No, the subarray must be non-empty. The statement has been clarified.', timestamp: new Date(Date.now() - 35 * 60000).toISOString() },
  { id: 'c2', problemIndex: 'C', question: 'Can there be multiple edges between the same pair of vertices?', answer: 'Yes, parallel edges are allowed. Consider all of them when computing shortest paths.', timestamp: new Date(Date.now() - 20 * 60000).toISOString() },
  { id: 'c3', problemIndex: 'D', question: 'Is the comparison case-sensitive?', answer: 'The string contains only lowercase letters, so case sensitivity does not apply.', timestamp: new Date(Date.now() - 10 * 60000).toISOString() },
];

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatMemory(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatContestTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
