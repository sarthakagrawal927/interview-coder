// ─── Interview Categories ───────────────────────────────────────────────────

export type InterviewCategory = 'dsa' | 'lld' | 'hld' | 'behavioral';

export interface CategoryConfig {
  id: InterviewCategory;
  name: string;
  icon: string;
  description: string;
  color: string; // tailwind color prefix e.g. "blue", "purple"
  hasCodeEditor: boolean;
  hasTestCases: boolean;
}

export const CATEGORIES: CategoryConfig[] = [
  { id: 'dsa', name: 'DSA', icon: 'Code2', description: 'Data Structures & Algorithms', color: 'blue', hasCodeEditor: true, hasTestCases: true },
  { id: 'lld', name: 'LLD', icon: 'Boxes', description: 'Low-Level Design / OOP', color: 'purple', hasCodeEditor: true, hasTestCases: false },
  { id: 'hld', name: 'HLD', icon: 'Network', description: 'System Design', color: 'orange', hasCodeEditor: false, hasTestCases: false },
  { id: 'behavioral', name: 'Behavioral', icon: 'Users', description: 'Behavioral Interviews', color: 'green', hasCodeEditor: false, hasTestCases: false },
];

export function getCategoryConfig(id: InterviewCategory): CategoryConfig {
  return CATEGORIES.find(c => c.id === id)!;
}

// ─── Shared Types ───────────────────────────────────────────────────────────

export interface Pattern {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Step {
  title: string;
  hint?: string;
  approach?: string;
  code?: string;
  complexity?: string;
}

export interface TestCase {
  args: unknown[];
  expected: unknown;
  description: string;
}

export interface AnkiCard {
  id: string;
  front: string;
  back: string;
}

export interface MCQCard {
  id: string;
  problemId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface SimilarQuestion {
  title: string;
  titleSlug: string;
  difficulty: string;
}

// ─── DSA Problem ────────────────────────────────────────────────────────────

export interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  category?: InterviewCategory;
  leetcodeUrl?: string;
  leetcodeNumber: number;
  description: string;
  starterCode: string;
  steps: Step[];
  testCases: TestCase[];
  ankiCards: AnkiCard[];
  similarQuestions?: SimilarQuestion[];
}

// ─── LLD Problem ────────────────────────────────────────────────────────────

export interface LLDProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  category: 'lld';
  description: string;
  requirements: string[];
  keyClasses: string[];
  designPatterns: string[];
  starterCode?: string;
  solutionCode?: string;
  steps: Step[];
  ankiCards: AnkiCard[];
}

// ─── HLD Problem ────────────────────────────────────────────────────────────

export interface HLDProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  category: 'hld';
  description: string;
  requirements: string[];
  keyComponents: string[];
  concepts: string[];
  steps: Step[];
  ankiCards: AnkiCard[];
}

// ─── Behavioral Question ────────────────────────────────────────────────────

export interface BehavioralQuestion {
  id: string;
  question: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string; // category name like "Leadership"
  category: 'behavioral';
  description: string;
  assessing: string;
  starHints: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  tips: string[];
  ankiCards: AnkiCard[];
}

// ─── Union type for any problem across categories ───────────────────────────

export type AnyProblem = Problem | LLDProblem | HLDProblem | BehavioralQuestion;

// ─── Data container (per category) ──────────────────────────────────────────

export interface ProblemsData {
  patterns: Pattern[];
  problems: Problem[];
}

export interface LLDData {
  patterns: Pattern[];
  problems: LLDProblem[];
}

export interface HLDData {
  patterns: Pattern[];
  problems: HLDProblem[];
}

export interface BehavioralData {
  categories: Pattern[];
  questions: BehavioralQuestion[];
}

// ─── Progress / Review (shared across all categories) ───────────────────────

export interface ProgressEntry {
  status?: string;
  lastAttempted?: string;
  notes?: string;
  code?: string;
  language?: string;
  bookmarked?: boolean;
}

export interface Progress {
  [problemId: string]: ProgressEntry;
}

export interface ReviewData {
  [cardId: string]: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    lastReview: string;
  };
}

export interface AnkiCardWithMeta extends AnkiCard {
  problemId: string;
  problemTitle: string;
  pattern: string;
}

export type Language = 'javascript' | 'typescript';
