export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  author: string;
  tags: string[];
};

export const articles: Article[] = [
  {
    slug: 'how-to-learn-programming-from-scratch',
    title: 'How to Learn Programming From Scratch (and Not Give Up)',
    excerpt:
      'A practical, no-nonsense guide for absolute beginners. Choose a language, avoid tutorial hell, and build real things from week one.',
    category: 'Programming',
    readTime: '8 min',
    date: '2026-07-18',
    author: 'David Okoro',
    tags: ['Beginners', 'Learning', 'Career'],
  },
  {
    slug: 'understanding-big-o-notation',
    title: 'Understanding Big-O Notation Without the Math Anxiety',
    excerpt:
      'Big-O sounds intimidating, but it is just a way to talk about scale. Here is the intuition behind the notation every developer should know.',
    category: 'Computer Science',
    readTime: '6 min',
    date: '2026-07-10',
    author: 'Prof. Elena Rossi',
    tags: ['Algorithms', 'Theory'],
  },
  {
    slug: 'calculus-intuition-derivatives',
    title: 'A Visual Intuition for Derivatives',
    excerpt:
      'Before you memorize the rules, understand what a derivative actually means. A geometric approach that makes calculus click.',
    category: 'Mathematics',
    readTime: '7 min',
    date: '2026-06-28',
    author: 'Prof. James Whitfield',
    tags: ['Calculus', 'Intuition'],
  },
  {
    slug: 'sql-joins-explained-with-venn',
    title: 'SQL Joins, Explained Without the Confusing Venn Diagrams',
    excerpt:
      'Venn diagrams only get you so far. Here is a clearer mental model for inner, left, right, and full joins using real examples.',
    category: 'Databases',
    readTime: '5 min',
    date: '2026-06-15',
    author: 'Marcus Lindqvist',
    tags: ['SQL', 'Practical'],
  },
  {
    slug: 'why-statistics-matters-more-than-calculus',
    title: 'Why Statistics Matters More Than Calculus for Most People',
    excerpt:
      'Calculus gets all the prestige, but statistics is what helps you navigate a world drowning in data. Here is why it should be your priority.',
    category: 'Data Science',
    readTime: '6 min',
    date: '2026-06-02',
    author: 'Dr. Amara Okafor',
    tags: ['Statistics', 'Opinion'],
  },
  {
    slug: 'spaced-repetition-science',
    title: 'The Science of Spaced Repetition (and How to Use It)',
    excerpt:
      'Why cramming fails and spacing works. The research behind effective learning and how to apply it to any subject.',
    category: 'Learning',
    readTime: '9 min',
    date: '2026-05-20',
    author: 'Dr. Helen Park',
    tags: ['Learning', 'Science'],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
