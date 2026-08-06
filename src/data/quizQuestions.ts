import type { Difficulty } from '@/data/contests';

/* ============ Question Types ============ */

export type QuestionType =
  | 'multiple-choice'
  | 'multiple-select'
  | 'true-false'
  | 'fill-blank'
  | 'numerical'
  | 'essay'
  | 'matching'
  | 'ordering'
  | 'image'
  | 'audio'
  | 'video';

export type QuestionBase = {
  id: string;
  index: number;
  type: QuestionType;
  difficulty: Difficulty;
  points: number;
  subject: string;
  topic: string;
  prompt: string;
  explanation?: string;
};

export type MultipleChoiceQuestion = QuestionBase & {
  type: 'multiple-choice';
  options: string[];
  correctIndex: number;
};

export type MultipleSelectQuestion = QuestionBase & {
  type: 'multiple-select';
  options: string[];
  correctIndices: number[];
};

export type TrueFalseQuestion = QuestionBase & {
  type: 'true-false';
  correctAnswer: boolean;
};

export type FillBlankQuestion = QuestionBase & {
  type: 'fill-blank';
  acceptedAnswers: string[];
  caseSensitive: boolean;
  placeholder: string;
};

export type NumericalQuestion = QuestionBase & {
  type: 'numerical';
  correctAnswer: number;
  tolerance: number;
  unit?: string;
};

export type EssayQuestion = QuestionBase & {
  type: 'essay';
  minWords: number;
  maxWords: number;
  rubric: string[];
};

export type MatchingQuestion = QuestionBase & {
  type: 'matching';
  leftItems: string[];
  rightItems: string[];
  correctPairs: number[];
};

export type OrderingQuestion = QuestionBase & {
  type: 'ordering';
  items: string[];
  correctOrder: number[];
};

export type ImageQuestion = QuestionBase & {
  type: 'image';
  imageUrl: string;
  imageAlt: string;
  questionSubtype: 'multiple-choice' | 'label';
  options?: string[];
  correctIndex?: number;
};

export type AudioQuestion = QuestionBase & {
  type: 'audio';
  audioUrl: string;
  durationSec: number;
  questionSubtype: 'multiple-choice' | 'transcribe';
  options?: string[];
  correctIndex?: number;
  acceptedTranscriptions?: string[];
};

export type VideoQuestion = QuestionBase & {
  type: 'video';
  videoUrl: string;
  durationSec: number;
  questionSubtype: 'multiple-choice' | 'essay';
  options?: string[];
  correctIndex?: number;
};

export type Question =
  | MultipleChoiceQuestion
  | MultipleSelectQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | NumericalQuestion
  | EssayQuestion
  | MatchingQuestion
  | OrderingQuestion
  | ImageQuestion
  | AudioQuestion
  | VideoQuestion;

/* ============ Question Type Metadata ============ */

export type QuestionTypeMeta = {
  type: QuestionType;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  color: string;
};

export const questionTypeMeta: QuestionTypeMeta[] = [
  { type: 'multiple-choice', name: 'Multiple Choice', shortName: 'MCQ', icon: 'CircleDot', description: 'Select one correct answer', color: 'bg-indigo-50 text-indigo-700' },
  { type: 'multiple-select', name: 'Multiple Select', shortName: 'MSQ', icon: 'CheckSquare', description: 'Select all correct answers', color: 'bg-electric-50 text-electric-700' },
  { type: 'true-false', name: 'True / False', shortName: 'T/F', icon: 'ToggleLeft', description: 'Binary true or false choice', color: 'bg-success-50 text-success-700' },
  { type: 'fill-blank', name: 'Fill in the Blank', shortName: 'FITB', icon: 'TextCursorInput', description: 'Type the missing word or phrase', color: 'bg-cyan-50 text-cyan-700' },
  { type: 'numerical', name: 'Numerical Answer', shortName: 'NUM', icon: 'Hash', description: 'Enter a numeric value with tolerance', color: 'bg-purple-50 text-purple-700' },
  { type: 'essay', name: 'Essay', shortName: 'ESS', icon: 'PenLine', description: 'Long-form written response', color: 'bg-sun-50 text-sun-700' },
  { type: 'matching', name: 'Matching', shortName: 'MATCH', icon: 'ArrowLeftRight', description: 'Match items from two columns', color: 'bg-rose-50 text-rose-700' },
  { type: 'ordering', name: 'Ordering', shortName: 'ORD', icon: 'ArrowDownUp', description: 'Arrange items in correct sequence', color: 'bg-teal-50 text-teal-700' },
  { type: 'image', name: 'Image Question', shortName: 'IMG', icon: 'ImageIcon', description: 'Answer based on an image', color: 'bg-indigo-50 text-indigo-700' },
  { type: 'audio', name: 'Audio Question', shortName: 'AUD', icon: 'Headphones', description: 'Listen and respond', color: 'bg-electric-50 text-electric-700' },
  { type: 'video', name: 'Video Question', shortName: 'VID', icon: 'Video', description: 'Watch and respond', color: 'bg-purple-50 text-purple-700' },
];

export function getQuestionTypeMeta(type: QuestionType): QuestionTypeMeta {
  return questionTypeMeta.find((m) => m.type === type) ?? questionTypeMeta[0];
}

/* ============ Mock Question Banks by Subject ============ */

export const mathQuestions: Question[] = [
  {
    id: 'math-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'Mathematics', topic: 'Calculus',
    prompt: 'What is the derivative of f(x) = 3x^3 + 2x^2 - 5x + 7?',
    options: ['9x^2 + 4x - 5', '3x^2 + 4x - 5', '9x^3 + 4x^2 - 5', '9x^2 + 2x - 5'],
    correctIndex: 0,
    explanation: 'Using the power rule: d/dx[3x^3] = 9x^2, d/dx[2x^2] = 4x, d/dx[-5x] = -5. Sum: 9x^2 + 4x - 5.',
  },
  {
    id: 'math-2', index: 2, type: 'numerical', difficulty: 'Medium', points: 150,
    subject: 'Mathematics', topic: 'Linear Algebra',
    prompt: 'Compute the determinant of the matrix [[3, 1], [2, 4]].',
    correctAnswer: 10, tolerance: 0,
    explanation: 'det = (3)(4) - (1)(2) = 12 - 2 = 10.',
  },
  {
    id: 'math-3', index: 3, type: 'fill-blank', difficulty: 'Easy', points: 100,
    subject: 'Mathematics', topic: 'Algebra',
    prompt: 'The quadratic formula gives x = ______ / 2a.',
    acceptedAnswers: ['-b + sqrt(b^2-4ac)', '-b ± √(b²-4ac)'], caseSensitive: false,
    placeholder: 'Enter the expression...',
    explanation: 'The quadratic formula is x = (-b ± √(b²-4ac)) / 2a.',
  },
  {
    id: 'math-4', index: 4, type: 'true-false', difficulty: 'Easy', points: 75,
    subject: 'Mathematics', topic: 'Geometry',
    prompt: 'The sum of angles in any triangle is always 180 degrees.',
    correctAnswer: true,
    explanation: 'In Euclidean geometry, the interior angles of a triangle always sum to 180 degrees.',
  },
  {
    id: 'math-5', index: 5, type: 'ordering', difficulty: 'Hard', points: 200,
    subject: 'Mathematics', topic: 'Logic',
    prompt: 'Arrange these number sets from smallest to largest (by inclusion):',
    items: ['Natural Numbers (N)', 'Integers (Z)', 'Rational Numbers (Q)', 'Real Numbers (R)'],
    correctOrder: [0, 1, 2, 3],
    explanation: 'N is a subset of Z is a subset of Q is a subset of R.',
  },
];

export const physicsQuestions: Question[] = [
  {
    id: 'phy-1', index: 1, type: 'numerical', difficulty: 'Medium', points: 150,
    subject: 'Physics', topic: 'Mechanics',
    prompt: 'A ball is thrown vertically upward at 20 m/s. What is its maximum height? (g = 10 m/s^2)',
    correctAnswer: 20, tolerance: 0.5, unit: 'm',
    explanation: 'v^2 = u^2 - 2gh. At max height v=0: h = u^2/(2g) = 400/20 = 20 m.',
  },
  {
    id: 'phy-2', index: 2, type: 'multiple-choice', difficulty: 'Medium', points: 100,
    subject: 'Physics', topic: 'Electromagnetism',
    prompt: 'Which of the following is NOT a fundamental force?',
    options: ['Gravity', 'Electromagnetic force', 'Normal force', 'Strong nuclear force'],
    correctIndex: 2,
    explanation: 'Normal force is a contact force, not a fundamental force. The four fundamental forces are gravity, electromagnetic, strong, and weak nuclear forces.',
  },
  {
    id: 'phy-3', index: 3, type: 'multiple-select', difficulty: 'Hard', points: 200,
    subject: 'Physics', topic: 'Thermodynamics',
    prompt: 'Which statements about entropy are true?',
    options: [
      'Entropy always increases in an isolated system',
      'Entropy can decrease in a non-isolated system',
      'The second law states total entropy of universe increases',
      'Entropy is conserved like energy',
    ],
    correctIndices: [0, 1, 2],
    explanation: 'Entropy increases in isolated systems (2nd law), but can decrease locally with energy input. It is not conserved.',
  },
  {
    id: 'phy-4', index: 4, type: 'matching', difficulty: 'Hard', points: 250,
    subject: 'Physics', topic: 'Units',
    prompt: 'Match each physical quantity with its SI unit:',
    leftItems: ['Force', 'Energy', 'Power', 'Pressure'],
    rightItems: ['Pascal (Pa)', 'Watt (W)', 'Newton (N)', 'Joule (J)'],
    correctPairs: [2, 3, 1, 0],
    explanation: 'Force = N, Energy = J, Power = W, Pressure = Pa.',
  },
];

export const chemistryQuestions: Question[] = [
  {
    id: 'chem-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'Chemistry', topic: 'Periodic Table',
    prompt: 'What is the atomic number of Carbon?',
    options: ['4', '6', '8', '12'],
    correctIndex: 1,
    explanation: 'Carbon has 6 protons, so its atomic number is 6.',
  },
  {
    id: 'chem-2', index: 2, type: 'fill-blank', difficulty: 'Medium', points: 150,
    subject: 'Chemistry', topic: 'Organic Chemistry',
    prompt: 'The functional group -COOH is called ______ acid.',
    acceptedAnswers: ['carboxylic', 'carboxyl'], caseSensitive: false,
    placeholder: 'Enter the type of acid...',
    explanation: 'The -COOH group is the carboxylic acid functional group.',
  },
  {
    id: 'chem-3', index: 3, type: 'ordering', difficulty: 'Medium', points: 175,
    subject: 'Chemistry', topic: 'Periodic Table',
    prompt: 'Arrange these elements by increasing atomic number:',
    items: ['Hydrogen (H)', 'Lithium (Li)', 'Carbon (C)', 'Oxygen (O)', 'Sodium (Na)'],
    correctOrder: [0, 1, 2, 3, 4],
    explanation: 'H=1, Li=3, C=6, O=8, Na=11. Already in order of increasing atomic number.',
  },
  {
    id: 'chem-4', index: 4, type: 'true-false', difficulty: 'Easy', points: 75,
    subject: 'Chemistry', topic: 'Bonding',
    prompt: 'Ionic bonds involve the sharing of electron pairs between atoms.',
    correctAnswer: false,
    explanation: 'Ionic bonds involve the transfer of electrons, not sharing. Covalent bonds involve sharing.',
  },
];

export const biologyQuestions: Question[] = [
  {
    id: 'bio-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'Biology', topic: 'Cell Biology',
    prompt: 'Which organelle is known as the "powerhouse of the cell"?',
    options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'],
    correctIndex: 2,
    explanation: 'Mitochondria produce ATP through cellular respiration, earning them the title "powerhouse of the cell."',
  },
  {
    id: 'bio-2', index: 2, type: 'multiple-select', difficulty: 'Medium', points: 175,
    subject: 'Biology', topic: 'Genetics',
    prompt: 'Which of the following are stages of mitosis?',
    options: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase', 'Interphase'],
    correctIndices: [0, 1, 2, 3],
    explanation: 'Mitosis has four stages: prophase, metaphase, anaphase, and telophase. Interphase is between divisions.',
  },
  {
    id: 'bio-3', index: 3, type: 'matching', difficulty: 'Medium', points: 200,
    subject: 'Biology', topic: 'Genetics',
    prompt: 'Match each nitrogenous base with its pairing partner in DNA:',
    leftItems: ['Adenine (A)', 'Guanine (G)', 'Cytosine (C)', 'Thymine (T)'],
    rightItems: ['Adenine (A)', 'Guanine (G)', 'Cytosine (C)', 'Thymine (T)'],
    correctPairs: [3, 2, 1, 0],
    explanation: 'A pairs with T, G pairs with C (and vice versa) in DNA.',
  },
];

export const englishQuestions: Question[] = [
  {
    id: 'eng-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'English', topic: 'Grammar',
    prompt: 'Choose the correct sentence:',
    options: [
      'She don\'t like coffee.',
      'She doesn\'t likes coffee.',
      'She doesn\'t like coffee.',
      'She not like coffee.',
    ],
    correctIndex: 2,
    explanation: 'With third person singular, use "doesn\'t" + base verb.',
  },
  {
    id: 'eng-2', index: 2, type: 'fill-blank', difficulty: 'Medium', points: 150,
    subject: 'English', topic: 'Vocabulary',
    prompt: 'Someone who is "eloquent" is able to speak or write ______ and effectively.',
    acceptedAnswers: ['fluently', 'clearly', 'articulately', 'persuasively'], caseSensitive: false,
    placeholder: 'Enter an adverb...',
    explanation: 'Eloquent means fluent, articulate, and persuasive in speech or writing.',
  },
  {
    id: 'eng-3', index: 3, type: 'essay', difficulty: 'Hard', points: 300,
    subject: 'English', topic: 'Writing',
    prompt: 'Write a short essay (150-250 words) arguing whether social media has a net positive or negative effect on society. Support your position with at least two specific examples.',
    minWords: 150, maxWords: 250,
    rubric: ['Clear thesis statement', 'At least two supporting examples', 'Logical organization', 'Grammar and vocabulary accuracy', 'Counter-argument acknowledgment'],
  },
  {
    id: 'eng-4', index: 4, type: 'ordering', difficulty: 'Medium', points: 175,
    subject: 'English', topic: 'Grammar',
    prompt: 'Arrange these words to form a correct sentence:',
    items: ['quickly', 'ran', 'the', 'dog', 'across', 'field', 'the'],
    correctOrder: [2, 3, 1, 0, 4, 6, 5],
    explanation: 'Correct: "The dog ran quickly across the field."',
  },
];

export const ieltsQuestions: Question[] = [
  {
    id: 'ielts-1', index: 1, type: 'audio', difficulty: 'Medium', points: 200,
    subject: 'IELTS', topic: 'Listening',
    prompt: 'Listen to the audio clip and answer: What time does the train to London depart?',
    audioUrl: '', durationSec: 30,
    questionSubtype: 'multiple-choice',
    options: ['9:15 AM', '9:30 AM', '9:45 AM', '10:00 AM'],
    correctIndex: 1,
    explanation: 'The announcement states the train departs at 9:30 AM from platform 3.',
  },
  {
    id: 'ielts-2', index: 2, type: 'multiple-choice', difficulty: 'Medium', points: 150,
    subject: 'IELTS', topic: 'Reading',
    prompt: 'In the passage, what is the author\'s main argument about renewable energy?',
    options: [
      'It is too expensive to implement',
      'It is essential for sustainable development',
      'It should replace fossil fuels immediately',
      'It is unreliable compared to nuclear power',
    ],
    correctIndex: 1,
    explanation: 'The author argues renewable energy is essential for sustainable development.',
  },
  {
    id: 'ielts-3', index: 3, type: 'essay', difficulty: 'Hard', points: 400,
    subject: 'IELTS', topic: 'Writing Task 2',
    prompt: 'Some people believe that universities should focus on academic subjects. Others think vocational training is more important. Discuss both views and give your opinion. Write at least 250 words.',
    minWords: 250, maxWords: 500,
    rubric: ['Task response — addresses all parts', 'Coherence and cohesion', 'Lexical resource', 'Grammatical range and accuracy'],
  },
];

export const satQuestions: Question[] = [
  {
    id: 'sat-1', index: 1, type: 'multiple-choice', difficulty: 'Medium', points: 150,
    subject: 'SAT', topic: 'Math',
    prompt: 'If 3x + 7 = 22, what is the value of x?',
    options: ['3', '5', '7', '15'],
    correctIndex: 1,
    explanation: '3x = 22 - 7 = 15, so x = 5.',
  },
  {
    id: 'sat-2', index: 2, type: 'fill-blank', difficulty: 'Medium', points: 150,
    subject: 'SAT', topic: 'Reading',
    prompt: 'Despite the scientist\'s ______ tone, her data was compelling. (Choose a word meaning "lacking confidence")',
    acceptedAnswers: ['tentative', 'hesitant', 'uncertain', 'diffident'], caseSensitive: false,
    placeholder: 'Enter a word...',
    explanation: 'Tentative means not certain or fixed, showing lack of confidence.',
  },
  {
    id: 'sat-3', index: 3, type: 'numerical', difficulty: 'Hard', points: 200,
    subject: 'SAT', topic: 'Math',
    prompt: 'A circle has area 49pi. What is its circumference in terms of pi?',
    correctAnswer: 14, tolerance: 0.1, unit: 'pi',
    explanation: 'Area = pi*r^2 = 49pi so r = 7. Circumference = 2*pi*r = 14pi.',
  },
];

export const economicsQuestions: Question[] = [
  {
    id: 'econ-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'Economics', topic: 'Microeconomics',
    prompt: 'According to the law of demand, when price increases, quantity demanded:',
    options: ['Increases', 'Decreases', 'Stays the same', 'Becomes zero'],
    correctIndex: 1,
    explanation: 'The law of demand states that price and quantity demanded are inversely related.',
  },
  {
    id: 'econ-2', index: 2, type: 'true-false', difficulty: 'Medium', points: 100,
    subject: 'Economics', topic: 'Game Theory',
    prompt: 'In a prisoner\'s dilemma, both players achieve the best collective outcome by cooperating.',
    correctAnswer: false,
    explanation: 'The Nash equilibrium is for both to defect, even though cooperation would yield a better collective outcome.',
  },
];

export const historyQuestions: Question[] = [
  {
    id: 'hist-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'History', topic: 'World Wars',
    prompt: 'In which year did World War II end?',
    options: ['1943', '1944', '1945', '1946'],
    correctIndex: 2,
    explanation: 'WWII ended in 1945 with Germany\'s surrender in May and Japan\'s in September.',
  },
  {
    id: 'hist-2', index: 2, type: 'ordering', difficulty: 'Medium', points: 175,
    subject: 'History', topic: 'Civilizations',
    prompt: 'Arrange these ancient civilizations by approximate founding date (earliest first):',
    items: ['Roman Republic', 'Ancient Egypt', 'Greek City-States', 'Byzantine Empire'],
    correctOrder: [1, 2, 0, 3],
    explanation: 'Egypt (~3100 BCE), Greek City-States (~800 BCE), Roman Republic (~509 BCE), Byzantine Empire (~330 CE).',
  },
];

export const geographyQuestions: Question[] = [
  {
    id: 'geo-1', index: 1, type: 'multiple-choice', difficulty: 'Easy', points: 100,
    subject: 'Geography', topic: 'Capitals',
    prompt: 'What is the capital of Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'],
    correctIndex: 2,
    explanation: 'Canberra was specifically built as the capital, a compromise between Sydney and Melbourne.',
  },
  {
    id: 'geo-2', index: 2, type: 'matching', difficulty: 'Medium', points: 200,
    subject: 'Geography', topic: 'Rivers',
    prompt: 'Match each river with the continent it primarily flows through:',
    leftItems: ['Nile', 'Amazon', 'Yangtze', 'Danube'],
    rightItems: ['Asia', 'Europe', 'Africa', 'South America'],
    correctPairs: [2, 3, 0, 1],
    explanation: 'Nile to Africa, Amazon to South America, Yangtze to Asia, Danube to Europe.',
  },
];

export const aiQuestions: Question[] = [
  {
    id: 'ai-1', index: 1, type: 'multiple-choice', difficulty: 'Medium', points: 150,
    subject: 'AI & ML', topic: 'Neural Networks',
    prompt: 'What is the purpose of the activation function in a neural network?',
    options: [
      'To initialize weights',
      'To introduce non-linearity',
      'To reduce overfitting',
      'To normalize inputs',
    ],
    correctIndex: 1,
    explanation: 'Activation functions introduce non-linearity, allowing networks to learn complex patterns.',
  },
  {
    id: 'ai-2', index: 2, type: 'multiple-select', difficulty: 'Hard', points: 200,
    subject: 'AI & ML', topic: 'Training',
    prompt: 'Which techniques help reduce overfitting in deep learning?',
    options: ['Dropout', 'Data augmentation', 'L2 regularization', 'Increasing learning rate', 'Early stopping'],
    correctIndices: [0, 1, 2, 4],
    explanation: 'Dropout, data augmentation, L2 regularization, and early stopping all combat overfitting.',
  },
];

export const cyberQuestions: Question[] = [
  {
    id: 'cyber-1', index: 1, type: 'multiple-choice', difficulty: 'Medium', points: 150,
    subject: 'Cyber Security', topic: 'Web Security',
    prompt: 'Which attack injects malicious scripts into a trusted website?',
    options: ['SQL Injection', 'Cross-Site Scripting (XSS)', 'CSRF', 'Buffer Overflow'],
    correctIndex: 1,
    explanation: 'XSS injects client-side scripts into web pages viewed by other users.',
  },
  {
    id: 'cyber-2', index: 2, type: 'true-false', difficulty: 'Easy', points: 100,
    subject: 'Cyber Security', topic: 'Cryptography',
    prompt: 'AES is a symmetric encryption algorithm.',
    correctAnswer: true,
    explanation: 'AES uses the same key for encryption and decryption, making it symmetric.',
  },
];

/* ============ Question Bank by Subject ============ */

export const questionsBySubject: Record<string, Question[]> = {
  mathematics: mathQuestions,
  physics: physicsQuestions,
  chemistry: chemistryQuestions,
  biology: biologyQuestions,
  english: englishQuestions,
  ielts: ieltsQuestions,
  cefr: englishQuestions,
  sat: satQuestions,
  economics: economicsQuestions,
  history: historyQuestions,
  geography: geographyQuestions,
  'ai-ml': aiQuestions,
  'cyber-security': cyberQuestions,
  'data-science': aiQuestions,
};

export function getQuestionsForSubject(slug: string): Question[] {
  return questionsBySubject[slug] ?? mathQuestions;
}
