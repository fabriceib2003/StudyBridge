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
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto my-12 shadow-sm">
        <p className="text-[var(--muted)] text-sm">No flashcards generated yet.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow-sm transition-colors"
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
      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-flashcards-bg)] border border-[var(--accent-flashcards-border)] text-[var(--accent-flashcards)] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <span>Interactive Flashcards</span>
              <span className="text-xs font-normal text-[var(--muted)] hidden sm:inline">
                ({subjectName})
              </span>
            </h3>
            <p className="text-xs font-medium text-[var(--muted)]">
              Card {currentIndex + 1} of {cards.length}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-xs font-semibold text-[var(--text-secondary)] transition-colors shadow-sm flex items-center gap-1.5"
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
            ? 'bg-gradient-to-b from-[var(--accent-flashcards-bg)] via-[var(--surface)] to-[var(--surface)] border-[var(--accent-flashcards-border)] hover:border-[var(--accent-flashcards)]' 
            : 'bg-gradient-to-b from-[var(--accent-summary-bg)] via-[var(--surface)] to-[var(--surface)] border-[var(--accent-summary-border)] hover:border-[var(--accent-summary)]'
        }`}
      >
        {/* Top Flip Indicator */}
        <div className="w-full flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold border transition-colors ${
            !isFlipped
              ? 'bg-[var(--accent-flashcards-bg)] text-[var(--accent-flashcards)] border-[var(--accent-flashcards-border)]'
              : 'bg-[var(--accent-summary-bg)] text-[var(--accent-summary)] border-[var(--accent-summary-border)]'
          }`}>
            <Sparkles className="w-3 h-3" />
            {isFlipped ? 'Answer / Explanation' : 'Question / Term'}
          </span>

          <div className="bg-[var(--surface-raised)] border border-[var(--border)] px-3 py-1 rounded-full text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 shadow-sm">
            <RotateCw className="w-3.5 h-3.5 text-[var(--muted)] group-hover:rotate-180 transition-transform duration-500" />
            <span>{isFlipped ? 'Showing Back' : 'Showing Front'}</span>
          </div>
        </div>

        {/* Card Content */}
        <div className="max-w-xl w-full my-auto py-6 overflow-y-auto max-h-[220px] px-2 flex items-center justify-center">
          <div className="w-full text-center">
            <MarkdownViewer 
              content={isFlipped ? currentCard.back : currentCard.front} 
              className="[&_p]:text-[var(--text)] [&_p]:text-lg sm:[&_p]:text-xl md:[&_p]:text-2xl [&_p]:font-bold [&_p]:leading-relaxed [&_p]:text-center [&_strong]:text-[var(--text)] [&_.katex]:text-inherit"
            />
          </div>
        </div>

        {/* Bottom Helper */}
        <div className="text-xs font-medium text-[var(--muted)] flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5 opacity-70" />
          Click anywhere or press Space to flip
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors shadow-sm"
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
                  ? 'bg-[var(--primary)] w-6' 
                  : 'bg-[var(--chart-track)] hover:bg-[var(--border-strong)] w-2'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-semibold text-[var(--primary-text)] transition-colors shadow-sm"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
