import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dsa-prep-anki';

function loadAnkiData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnkiData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// SM-2 Algorithm implementation
function sm2(cardState, quality) {
  // quality: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
  // Map our 0-3 scale to SM-2's 0-5 scale
  const q = quality === 0 ? 0 : quality === 1 ? 2 : quality === 2 ? 4 : 5;

  let { ease, interval, repetitions } = cardState;

  if (q < 3) {
    // Failed review - reset
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }
    repetitions += 1;
  }

  // Update ease factor
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ease,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: new Date().toISOString(),
  };
}

export function useSpacedRepetition() {
  const [ankiData, setAnkiData] = useState(loadAnkiData);

  const getCardState = useCallback((cardId) => {
    return ankiData[cardId] || {
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: new Date().toISOString(),
      lastReview: null,
    };
  }, [ankiData]);

  const getDueCards = useCallback((allCards) => {
    const now = new Date();
    return allCards.filter(card => {
      const state = ankiData[card.id];
      if (!state) return true; // New card, always due
      return new Date(state.nextReview) <= now;
    });
  }, [ankiData]);

  const reviewCard = useCallback((cardId, quality) => {
    setAnkiData(prev => {
      const cardState = prev[cardId] || {
        ease: 2.5,
        interval: 0,
        repetitions: 0,
      };
      const newState = sm2(cardState, quality);
      const next = { ...prev, [cardId]: newState };
      saveAnkiData(next);
      return next;
    });
  }, []);

  const getReviewStats = useCallback(() => {
    const values = Object.values(ankiData);
    const now = new Date();
    return {
      totalReviewed: values.filter(v => v.lastReview).length,
      dueToday: values.filter(v => new Date(v.nextReview) <= now).length,
      streak: calculateStreak(values),
    };
  }, [ankiData]);

  return {
    getCardState,
    getDueCards,
    reviewCard,
    getReviewStats,
    ankiData,
  };
}

function calculateStreak(values) {
  if (values.length === 0) return 0;

  const reviewDates = values
    .filter(v => v.lastReview)
    .map(v => new Date(v.lastReview).toDateString());

  const uniqueDates = [...new Set(reviewDates)].sort((a, b) => new Date(b) - new Date(a));

  if (uniqueDates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    if (uniqueDates.includes(checkDate.toDateString())) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
