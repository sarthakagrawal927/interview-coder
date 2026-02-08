import { useState, useMemo, useCallback } from 'react';
import { useProblems } from '../hooks/useProblems';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import {
  RotateCcw,
  Brain,
  CheckCircle2,
  Filter,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function AnkiReview() {
  const { getAllAnkiCards, patterns } = useProblems();
  const { getDueCards, reviewCard, getReviewStats } = useSpacedRepetition();

  const allCards = getAllAnkiCards();
  const [patternFilter, setPatternFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const filteredAllCards = useMemo(() => {
    if (patternFilter === 'all') return allCards;
    return allCards.filter(c => c.pattern === patternFilter);
  }, [allCards, patternFilter]);

  const dueCards = getDueCards(filteredAllCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const currentCard = dueCards[currentIndex] || null;
  const reviewStats = getReviewStats();

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleReview = useCallback((quality) => {
    if (!currentCard) return;
    reviewCard(currentCard.id, quality);
    setReviewedCount(prev => prev + 1);
    setIsFlipped(false);

    if (currentIndex + 1 >= dueCards.length) {
      setSessionComplete(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentCard, currentIndex, dueCards.length, reviewCard]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewedCount(0);
    setSessionComplete(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Anki Review</h1>
          <p className="mt-1 text-sm sm:text-base text-gray-400">
            Spaced repetition flashcards to reinforce your learning.
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">
              {patternFilter === 'all' ? 'All Patterns' : patterns.find(p => p.id === patternFilter)?.name}
            </span>
            <span className="sm:hidden">Filter</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {showFilter && (
            <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
              <button
                onClick={() => { setPatternFilter('all'); setShowFilter(false); handleRestart(); }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800 ${
                  patternFilter === 'all' ? 'text-blue-400' : 'text-gray-300'
                }`}
              >
                All Patterns
              </button>
              {patterns.map(p => {
                const count = allCards.filter(c => c.pattern === p.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setPatternFilter(p.id); setShowFilter(false); handleRestart(); }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800 ${
                      patternFilter === p.id ? 'text-blue-400' : 'text-gray-300'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-gray-500">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">{dueCards.length}</div>
          <div className="text-xs text-gray-500">Due Today</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">{reviewedCount}</div>
          <div className="text-xs text-gray-500">Reviewed</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">{reviewStats.streak}</div>
          <div className="text-xs text-gray-500">Day Streak</div>
        </div>
      </div>

      {/* Progress Bar */}
      {dueCards.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>{reviewedCount} reviewed</span>
            <span>{dueCards.length} total due</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{
                width: `${Math.min((reviewedCount / dueCards.length) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Card Area */}
      {sessionComplete ? (
        <SessionComplete
          reviewedCount={reviewedCount}
          onRestart={handleRestart}
        />
      ) : dueCards.length === 0 ? (
        <EmptyState />
      ) : currentCard ? (
        <div>
          {/* Card Info */}
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">
              Card {currentIndex + 1} of {dueCards.length}
            </span>
            <span className="text-gray-700">|</span>
            <span className="text-gray-500 truncate">{currentCard.problemTitle}</span>
          </div>

          {/* Flashcard */}
          <div
            onClick={!isFlipped ? handleFlip : undefined}
            className={`relative min-h-[240px] sm:min-h-[300px] w-full cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
              isFlipped
                ? 'border-blue-500/30 bg-blue-500/5'
                : 'border-gray-800 bg-gray-900 hover:border-gray-700'
            }`}
          >
            <div className="flex min-h-[240px] sm:min-h-[300px] flex-col items-center justify-center p-5 sm:p-8 text-center">
              {!isFlipped ? (
                <>
                  <Brain className="mb-4 h-7 w-7 sm:h-8 sm:w-8 text-gray-600" />
                  <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                    {currentCard.front}
                  </p>
                  <p className="mt-4 sm:mt-6 text-sm text-gray-500">
                    Click to reveal answer
                  </p>
                </>
              ) : (
                <>
                  <div className="whitespace-pre-wrap text-left text-sm leading-relaxed text-gray-200 w-full">
                    {currentCard.back}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Review Buttons */}
          {isFlipped && (
            <div className="mt-4 sm:mt-6 grid grid-cols-4 gap-2 sm:gap-3">
              <ReviewButton
                label="Again"
                sublabel="< 1 min"
                color="red"
                onClick={() => handleReview(0)}
              />
              <ReviewButton
                label="Hard"
                sublabel="< 6 min"
                color="yellow"
                onClick={() => handleReview(1)}
              />
              <ReviewButton
                label="Good"
                sublabel="< 10 min"
                color="blue"
                onClick={() => handleReview(2)}
              />
              <ReviewButton
                label="Easy"
                sublabel="4 days"
                color="green"
                onClick={() => handleReview(3)}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ReviewButton({ label, sublabel, color, onClick }) {
  const colors = {
    red: 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
    green: 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-2 sm:p-3 text-center transition-colors ${colors[color]}`}
    >
      <div className="text-xs sm:text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-[10px] sm:text-xs opacity-60">{sublabel}</div>
    </button>
  );
}

function SessionComplete({ reviewedCount, onRestart }) {
  return (
    <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 sm:p-12 text-center">
      <Sparkles className="mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 text-green-400" />
      <h2 className="text-xl sm:text-2xl font-bold text-white">Session Complete!</h2>
      <p className="mt-2 text-sm sm:text-base text-gray-400">
        You reviewed <span className="font-semibold text-green-400">{reviewedCount}</span> cards.
        Great work!
      </p>
      <button
        onClick={onRestart}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        <RotateCcw className="h-4 w-4" />
        Review Again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 sm:p-12 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 text-gray-600" />
      <h2 className="text-lg sm:text-xl font-semibold text-white">All caught up!</h2>
      <p className="mt-2 text-sm sm:text-base text-gray-400">
        No cards are due for review right now. Come back later or solve more problems to generate new cards.
      </p>
    </div>
  );
}
