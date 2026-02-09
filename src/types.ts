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

export interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  leetcodeUrl?: string;
  leetcodeNumber: number;
  description: string;
  starterCode: string;
  steps: Step[];
  testCases: TestCase[];
  ankiCards: AnkiCard[];
  similarQuestions?: SimilarQuestion[];
}

export interface ProblemsData {
  patterns: Pattern[];
  problems: Problem[];
}

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
