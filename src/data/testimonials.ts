export type Testimonial = {
  name: string;
  role: string;
  initials: string;
  color: string;
  quote: string;
  subject: string;
};

export const testimonials: Testimonial[] = [
  {
    name: 'Sarah Mitchell',
    role: 'Career changer, now Junior Developer',
    initials: 'SM',
    color: 'from-indigo-500 to-indigo-600',
    quote:
      'I went from knowing nothing about code to landing my first dev job in seven months. The web development roadmap kept me focused when I felt overwhelmed by all the options out there.',
    subject: 'Web Development',
  },
  {
    name: 'Ahmed Hassan',
    role: 'Computer Science student',
    initials: 'AH',
    color: 'from-electric-500 to-electric-600',
    quote:
      'The algorithms course filled in all the gaps my university lectures skipped. I finally understand why certain data structures are faster, not just that they are.',
    subject: 'Computer Science',
  },
  {
    name: 'Lena Vogel',
    role: 'Data Analyst',
    initials: 'LV',
    color: 'from-slate-600 to-slate-800',
    quote:
      'The statistics course changed how I read the news. I catch bad charts and misleading claims everywhere now. It made me better at my job and a sharper thinker.',
    subject: 'Data Science',
  },
  {
    name: 'Marcus Lee',
    role: 'Self-taught programmer',
    initials: 'ML',
    color: 'from-indigo-600 to-electric-600',
    quote:
      'I had bounced between a dozen YouTube tutorials. Cameron gave me a path that actually made sense. The progress tracking kept me coming back every day.',
    subject: 'Web Development',
  },
  {
    name: 'Priya Anand',
    role: 'High school teacher',
    initials: 'PA',
    color: 'from-electric-600 to-indigo-700',
    quote:
      'I use the math and physics lessons to prepare my own classes. The explanations are clearer than most textbooks I have seen. My students benefit too.',
    subject: 'Mathematics',
  },
  {
    name: 'Tom Becker',
    role: 'ML Engineer',
    initials: 'TB',
    color: 'from-slate-700 to-indigo-700',
    quote:
      'The neural networks course builds everything from scratch. That foundation made everything in my day job make more sense. Highly recommend to anyone getting into ML.',
    subject: 'AI & Machine Learning',
  },
];

export const stats = {
  learners: '850K+',
  courses: '172',
  subjects: '12',
  countries: '140+',
};
