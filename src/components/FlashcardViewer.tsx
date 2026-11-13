import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { MarkdownViewer } from './MarkdownViewer';

interface FlashcardViewerProps {
  cards: { front: string; back: string }[];
  subjectName: string;
  onClose: () => void;
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({
  cards,
  subjectName,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Keyboard navigation support: Left (prev), Right (next), Space (flip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % cards.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards.length, onClose]);

  if (!cards || cards.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto my-12 shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-sm">No flashcards generated yet.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          Back to Study Desk
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Interactive Flashcards</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 hidden sm:inline">
                ({subjectName})
              </span>
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Card {currentIndex + 1} of {cards.length}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>

      {/* Flip Card Container */}
      <div 
        onClick={() => setIsFlipped(!isFlipped)}
        role="button"
        tabIndex={0}
        aria-label="Flashcard - click to flip"
        className={`w-full min-h-[320px] sm:min-h-[360px] border-2 rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-between text-center cursor-pointer shadow-lg hover:shadow-xl relative overflow-hidden group transition-all duration-300 ${
          !isFlipped 
            ? 'bg-gradient-to-b from-purple-50/60 via-white to-white dark:from-purple-950/20 dark:via-slate-900 dark:to-slate-900 border-purple-200/80 dark:border-purple-900/60 hover:border-purple-400 dark:hover:border-purple-600' 
            : 'bg-gradient-to-b from-teal-50/60 via-white to-white dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 dark:hover:border-teal-600'
        }`}
      >
        {/* Top Flip Indicator */}
        <div className="w-full flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold border transition-colors ${
            !isFlipped
              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
              : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60'
          }`}>
            <Sparkles className="w-3 h-3" />
            {isFlipped ? 'Answer / Explanation' : 'Question / Term'}
          </span>

          <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
            <RotateCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
            <span>{isFlipped ? 'Showing Back' : 'Showing Front'}</span>
          </div>
        </div>

        {/* Card Content */}
        <div className="max-w-xl w-full my-auto py-6 overflow-y-auto max-h-[220px] px-2 flex items-center justify-center">
          <div className="w-full text-center">
            <MarkdownViewer 
              content={isFlipped ? currentCard.back : currentCard.front} 
              className="[&_p]:text-slate-900 dark:[&_p]:text-slate-100 [&_p]:text-lg sm:[&_p]:text-xl md:[&_p]:text-2xl [&_p]:font-bold [&_p]:leading-relaxed [&_p]:text-center [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_.katex]:text-slate-900 dark:[&_.katex]:text-slate-100"
            />
          </div>
        </div>

        {/* Bottom Helper */}
        <div className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5 opacity-70" />
          Click anywhere or press Space to flip
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Dots Pagination */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[260px]">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex(i);
              }}
              title={`Go to card ${i + 1}`}
              aria-label={`Go to card ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex 
                  ? 'bg-blue-600 dark:bg-blue-500 w-6' 
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 w-2'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
