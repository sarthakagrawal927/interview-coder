import { useMemo } from 'react';
import data from '../data/problems.json';

export function useProblems() {
  const { patterns, problems } = data;

  const getById = (id) => {
    return problems.find(p => p.id === id) || null;
  };

  const getByPattern = (patternId) => {
    return problems.filter(p => p.pattern === patternId);
  };

  const search = (query) => {
    if (!query) return problems;
    const q = query.toLowerCase();
    return problems.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.pattern.toLowerCase().includes(q) ||
      p.difficulty.toLowerCase().includes(q)
    );
  };

  const getPatternStats = useMemo(() => {
    const stats = {};
    for (const pattern of patterns) {
      const patternProblems = problems.filter(p => p.pattern === pattern.id);
      stats[pattern.id] = {
        total: patternProblems.length,
        problems: patternProblems,
      };
    }
    return stats;
  }, []);

  const getAllAnkiCards = () => {
    const cards = [];
    for (const problem of problems) {
      if (problem.ankiCards) {
        for (const card of problem.ankiCards) {
          cards.push({
            ...card,
            problemId: problem.id,
            problemTitle: problem.title,
            pattern: problem.pattern,
          });
        }
      }
    }
    return cards;
  };

  return {
    patterns,
    problems,
    getById,
    getByPattern,
    search,
    getPatternStats,
    getAllAnkiCards,
  };
}
