import type { LucideIcon } from 'lucide-react';
import {
  Code2, Database, Cpu, Brain, FlaskConical, BookOpen,
  Globe, LineChart, Languages, Scale, Atom, Sigma,
} from 'lucide-react';

export type Subject = {
  slug: string;
  name: string;
  shortName: string;
  category: 'programming' | 'academic';
  icon: LucideIcon;
  blurb: string;
  description: string;
  color: string;
  accent: string;
  topics: string[];
};

export const subjects: Subject[] = [
  {
    slug: 'web-development',
    name: 'Web Development',
    shortName: 'Web Dev',
    category: 'programming',
    icon: Code2,
    blurb: 'HTML, CSS, JavaScript, React, and full-stack web apps.',
    description:
      'Build modern, responsive websites and web applications from the ground up. Cover everything from semantic HTML and CSS layouts to interactive JavaScript and component-driven React interfaces.',
    color: 'from-indigo-500 to-indigo-700',
    accent: '#6366f1',
    topics: ['HTML & CSS', 'JavaScript', 'React', 'Node.js', 'Responsive Design', 'APIs'],
  },
  {
    slug: 'data-science',
    name: 'Data Science',
    shortName: 'Data Science',
    category: 'programming',
    icon: LineChart,
    blurb: 'Python, statistics, machine learning, and data visualization.',
    description:
      'Turn raw data into insight. Learn the Python data stack, statistical foundations, and machine learning techniques to analyze, visualize, and model real-world datasets.',
    color: 'from-electric-500 to-electric-700',
    accent: '#3b82f6',
    topics: ['Python', 'Pandas', 'Statistics', 'Machine Learning', 'Visualization', 'SQL'],
  },
  {
    slug: 'databases',
    name: 'Databases & SQL',
    shortName: 'Databases',
    category: 'programming',
    icon: Database,
    blurb: 'Relational design, SQL queries, and database internals.',
    description:
      'Master how data is stored, modeled, and retrieved. From writing efficient SQL queries to designing normalized schemas and understanding indexes and transactions.',
    color: 'from-slate-600 to-slate-800',
    accent: '#475569',
    topics: ['SQL', 'PostgreSQL', 'Schema Design', 'Indexes', 'Normalization', 'NoSQL'],
  },
  {
    slug: 'computer-science',
    name: 'Computer Science',
    shortName: 'CS Fundamentals',
    category: 'programming',
    icon: Cpu,
    blurb: 'Algorithms, data structures, and computational thinking.',
    description:
      'Build a strong foundation in the theory that powers all software. Study data structures, algorithms, complexity, and how computers actually execute your code.',
    color: 'from-indigo-600 to-electric-700',
    accent: '#4f46e5',
    topics: ['Algorithms', 'Data Structures', 'Big-O', 'Recursion', 'Graphs', 'Bitwise Ops'],
  },
  {
    slug: 'ai-machine-learning',
    name: 'AI & Machine Learning',
    shortName: 'AI / ML',
    category: 'programming',
    icon: Brain,
    blurb: 'Neural networks, deep learning, and applied AI.',
    description:
      'Explore how machines learn. From linear regression to deep neural networks and large language models, understand the math and tools behind modern AI.',
    color: 'from-electric-600 to-indigo-700',
    accent: '#2563eb',
    topics: ['Neural Networks', 'Deep Learning', 'NLP', 'PyTorch', 'Computer Vision', 'Transformers'],
  },
  {
    slug: 'mathematics',
    name: 'Mathematics',
    shortName: 'Math',
    category: 'academic',
    icon: Sigma,
    blurb: 'Algebra, calculus, discrete math, and linear algebra.',
    description:
      'From high school algebra to university-level calculus and beyond. Build the quantitative reasoning that underpins science, engineering, and computing.',
    color: 'from-electric-500 to-electric-800',
    accent: '#3b82f6',
    topics: ['Algebra', 'Calculus', 'Linear Algebra', 'Discrete Math', 'Probability', 'Geometry'],
  },
  {
    slug: 'physics',
    name: 'Physics',
    shortName: 'Physics',
    category: 'academic',
    icon: Atom,
    blurb: 'Mechanics, electromagnetism, thermodynamics, and modern physics.',
    description:
      'Understand the laws that govern the universe. Study classical mechanics, electricity and magnetism, thermodynamics, and the frontiers of modern physics.',
    color: 'from-indigo-600 to-electric-800',
    accent: '#4f46e5',
    topics: ['Mechanics', 'Electromagnetism', 'Thermodynamics', 'Optics', 'Quantum', 'Relativity'],
  },
  {
    slug: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chemistry',
    category: 'academic',
    icon: FlaskConical,
    blurb: 'Organic, inorganic, physical, and analytical chemistry.',
    description:
      'Explore matter and its transformations. From atomic structure and bonding to reaction mechanisms and the chemistry that powers life and industry.',
    color: 'from-electric-400 to-indigo-500',
    accent: '#60a5fa',
    topics: ['Atomic Structure', 'Bonding', 'Organic', 'Stoichiometry', 'Acids & Bases', 'Kinetics'],
  },
  {
    slug: 'biology',
    name: 'Biology',
    shortName: 'Biology',
    category: 'academic',
    icon: BookOpen,
    blurb: 'Cell biology, genetics, evolution, and ecology.',
    description:
      'Discover the science of life. Understand cells, genetics, evolution, and ecosystems from the molecular level up to the biosphere.',
    color: 'from-success-500 to-electric-600',
    accent: '#10b981',
    topics: ['Cell Biology', 'Genetics', 'Evolution', 'Ecology', 'Physiology', 'Microbiology'],
  },
  {
    slug: 'economics',
    name: 'Economics',
    shortName: 'Economics',
    category: 'academic',
    icon: Scale,
    blurb: 'Microeconomics, macroeconomics, and financial theory.',
    description:
      'Learn how markets, money, and incentives shape the world. Study supply and demand, monetary policy, trade, and the principles of economic decision-making.',
    color: 'from-sun-500 to-sun-600',
    accent: '#f59e0b',
    topics: ['Microeconomics', 'Macroeconomics', 'Trade', 'Game Theory', 'Finance', 'Econometrics'],
  },
  {
    slug: 'history',
    name: 'History',
    shortName: 'History',
    category: 'academic',
    icon: Globe,
    blurb: 'World history, civilizations, and historical analysis.',
    description:
      'Understand how the past shaped the present. Survey major civilizations, pivotal events, and the methods historians use to interpret evidence.',
    color: 'from-slate-500 to-slate-700',
    accent: '#64748b',
    topics: ['Ancient World', 'Medieval', 'Modern Era', 'Revolutions', 'World Wars', 'Historiography'],
  },
  {
    slug: 'languages',
    name: 'Languages & Linguistics',
    shortName: 'Languages',
    category: 'academic',
    icon: Languages,
    blurb: 'Grammar, linguistics, and world languages.',
    description:
      'Explore how humans communicate. Study the structure of language, comparative linguistics, and practical grammar across major world languages.',
    color: 'from-electric-400 to-electric-600',
    accent: '#60a5fa',
    topics: ['Phonetics', 'Syntax', 'Semantics', 'Sociolinguistics', 'Translation', 'Etymology'],
  },
];

export const programmingSubjects = subjects.filter((s) => s.category === 'programming');
export const academicSubjects = subjects.filter((s) => s.category === 'academic');

export function getSubject(slug: string): Subject | undefined {
  return subjects.find((s) => s.slug === slug);
}
