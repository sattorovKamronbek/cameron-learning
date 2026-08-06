import type { LucideIcon } from 'lucide-react';
import {
  Code2, BarChart3, Brain, GraduationCap,
} from 'lucide-react';

export type RoadmapStep = {
  title: string;
  description: string;
  topics: string[];
  est: string;
};

export type Roadmap = {
  slug: string;
  title: string;
  goal: string;
  description: string;
  icon: LucideIcon;
  color: string;
  steps: RoadmapStep[];
};

export const roadmaps: Roadmap[] = [
  {
    slug: 'become-a-web-developer',
    title: 'Become a Web Developer',
    goal: 'Job-ready frontend & full-stack developer',
    description:
      'A structured path from your first line of HTML to building and deploying full applications. Follow these steps in order and build a portfolio along the way.',
    icon: Code2,
    color: 'from-indigo-500 to-indigo-700',
    steps: [
      {
        title: 'Foundations: HTML & CSS',
        description: 'Learn to structure and style web pages. Build a static landing page.',
        topics: ['HTML5', 'CSS3', 'Flexbox', 'Grid', 'Responsive'],
        est: '2–3 weeks',
      },
      {
        title: 'JavaScript Essentials',
        description: 'Master the programming language of the web.',
        topics: ['ES6+', 'DOM', 'Events', 'Async', 'Fetch'],
        est: '4–6 weeks',
      },
      {
        title: 'Git & Version Control',
        description: 'Track changes and collaborate with others.',
        topics: ['Git basics', 'Branching', 'GitHub', 'Pull requests'],
        est: '1 week',
      },
      {
        title: 'React & Modern Frontend',
        description: 'Build dynamic component-driven UIs.',
        topics: ['React', 'Hooks', 'Routing', 'State', 'APIs'],
        est: '5–7 weeks',
      },
      {
        title: 'Backend & APIs',
        description: 'Understand servers, databases, and REST.',
        topics: ['Node.js', 'Express', 'REST', 'Auth', 'PostgreSQL'],
        est: '4–6 weeks',
      },
      {
        title: 'Deploy & Portfolio',
        description: 'Ship real projects and showcase your work.',
        topics: ['Deployment', 'CI/CD', 'Portfolio', 'Interview prep'],
        est: '2–3 weeks',
      },
    ],
  },
  {
    slug: 'become-a-data-scientist',
    title: 'Become a Data Scientist',
    goal: 'Analyze data and build ML models',
    description:
      'Go from spreadsheets to sophisticated machine learning. This path balances math foundations with practical, hands-on Python projects.',
    icon: BarChart3,
    color: 'from-electric-500 to-electric-700',
    steps: [
      {
        title: 'Python Programming',
        description: 'Get comfortable writing Python for data work.',
        topics: ['Python', 'Syntax', 'Functions', 'Libraries'],
        est: '2–3 weeks',
      },
      {
        title: 'Math Foundations',
        description: 'Build the statistics and linear algebra you will rely on.',
        topics: ['Statistics', 'Probability', 'Linear Algebra'],
        est: '4–6 weeks',
      },
      {
        title: 'Data Analysis with Pandas',
        description: 'Clean, transform, and explore datasets.',
        topics: ['Pandas', 'NumPy', 'EDA', 'Visualization'],
        est: '3–5 weeks',
      },
      {
        title: 'SQL & Databases',
        description: 'Query the data that lives in databases.',
        topics: ['SQL', 'Joins', 'Aggregation', 'Window functions'],
        est: '2–3 weeks',
      },
      {
        title: 'Machine Learning',
        description: 'Train and evaluate predictive models.',
        topics: ['scikit-learn', 'Regression', 'Classification', 'Validation'],
        est: '5–7 weeks',
      },
      {
        title: 'Deep Learning & Projects',
        description: 'Build neural networks and a capstone portfolio.',
        topics: ['PyTorch', 'Neural Networks', 'NLP', 'Portfolio'],
        est: '6–8 weeks',
      },
    ],
  },
  {
    slug: 'become-an-ml-engineer',
    title: 'Become an ML Engineer',
    goal: 'Ship machine learning to production',
    description:
      'For those who want to take models beyond notebooks and into real systems. Focuses on deep learning, MLOps, and deployment.',
    icon: Brain,
    color: 'from-slate-600 to-slate-800',
    steps: [
      {
        title: 'Strong Python & Math',
        description: 'Solidify prerequisites before diving deep.',
        topics: ['Python', 'Linear Algebra', 'Calculus', 'Statistics'],
        est: '4–6 weeks',
      },
      {
        title: 'Classical ML',
        description: 'Master traditional algorithms first.',
        topics: ['scikit-learn', 'Trees', 'Ensembles', 'Evaluation'],
        est: '3–5 weeks',
      },
      {
        title: 'Deep Learning',
        description: 'Build and train neural networks.',
        topics: ['PyTorch', 'CNNs', 'RNNs', 'Transformers'],
        est: '6–8 weeks',
      },
      {
        title: 'MLOps',
        description: 'Deploy, monitor, and scale models.',
        topics: ['Docker', 'Serving', 'Monitoring', 'CI/CD'],
        est: '4–6 weeks',
      },
      {
        title: 'Specialization & Portfolio',
        description: 'Go deep in NLP, vision, or recommendations.',
        topics: ['LLMs', 'Computer Vision', 'RecSys', 'Capstone'],
        est: '6–10 weeks',
      },
    ],
  },
  {
    slug: 'master-academic-fundamentals',
    title: 'Master Academic Fundamentals',
    goal: 'Build a strong base across core subjects',
    description:
      'A well-rounded path for students who want to strengthen their foundation in the subjects that underpin science and engineering.',
    icon: GraduationCap,
    color: 'from-indigo-600 to-electric-600',
    steps: [
      {
        title: 'Mathematics Core',
        description: 'Algebra, calculus, and linear algebra.',
        topics: ['Algebra', 'Calculus I', 'Linear Algebra'],
        est: '8–12 weeks',
      },
      {
        title: 'Physics',
        description: 'Mechanics and electromagnetism.',
        topics: ['Mechanics', 'Electromagnetism', 'Thermodynamics'],
        est: '6–8 weeks',
      },
      {
        title: 'Chemistry',
        description: 'General and organic chemistry.',
        topics: ['Atomic Structure', 'Bonding', 'Organic'],
        est: '5–7 weeks',
      },
      {
        title: 'Computer Science',
        description: 'Computational thinking and programming.',
        topics: ['Python', 'Algorithms', 'Data Structures'],
        est: '6–8 weeks',
      },
      {
        title: 'Statistics & Data',
        description: 'Apply math to real data.',
        topics: ['Statistics', 'Probability', 'Data Analysis'],
        est: '4–6 weeks',
      },
    ],
  },
];

export function getRoadmap(slug: string): Roadmap | undefined {
  return roadmaps.find((r) => r.slug === slug);
}
