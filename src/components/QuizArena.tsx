import React, { useState } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Award, 
  RotateCcw,
  ArrowLeft
} from 'lucide-react';
import { MarkdownViewer } from './MarkdownViewer';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizArenaProps {
  questions: Question[];
  subjectName: string;
  onClose: () => void;
}

export const QuizArena: React.FC<QuizArenaProps> = ({
  questions,
  subjectName,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto my-12 shadow-sm">
        <p className="text-[var(--muted)] text-sm">No quiz questions available.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          Back to Study Desk
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isSubmitted) return;
    setSelectedOption(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
    if (selectedOption === currentQ.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsSubmitted(false);
    setScore(0);
    setIsCompleted(false);
  };

  if (isCompleted) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 text-center space-y-6 max-w-2xl mx-auto my-12 shadow-xl animate-fadeIn transition-colors">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-quiz-bg)] border border-[var(--accent-quiz-border)] text-[var(--accent-quiz)] flex items-center justify-center mx-auto shadow-sm">
          <Award className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-[var(--text)]">Quiz Completed!</h3>
          <p className="text-xs text-[var(--muted)]">Subject: {subjectName}</p>
        </div>

        <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6 max-w-xs mx-auto space-y-1 shadow-sm">
          <div className="text-4xl font-extrabold text-[var(--text)]">{score} / {questions.length}</div>
          <div className="text-sm font-semibold text-[var(--success)]">{percentage}% Correct Score</div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Quiz
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-semibold text-[var(--primary-text)] shadow-sm transition-colors"
          >
            Back to Study Desk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-quiz-bg)] border border-[var(--accent-quiz-border)] text-[var(--accent-quiz)] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <span>Practice Quiz</span>
              <span className="text-xs font-normal text-[var(--muted)] hidden sm:inline">
                ({subjectName})
              </span>
            </h3>
            <p className="text-xs font-medium text-[var(--muted)]">
              Question {currentIndex + 1} of {questions.length}
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

      {/* Question prompt */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm transition-colors">
        <div className="text-base sm:text-lg font-bold text-[var(--text)] leading-relaxed">
          <MarkdownViewer 
            content={currentQ.question} 
            className="[&_p]:text-[var(--text)] [&_p]:text-base sm:[&_p]:text-lg [&_p]:font-bold [&_p]:leading-relaxed [&_strong]:text-[var(--text)] [&_.katex]:text-inherit"
          />
        </div>

        {/* Options list */}
        <div className="space-y-2.5">
          {currentQ.options.map((option, idx) => {
            let stateClass = "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)]";
            if (selectedOption === idx) {
              stateClass = "bg-[var(--primary-soft-bg)] border-[var(--primary)] text-[var(--text)] font-semibold shadow-sm ring-1 ring-[var(--primary)]";
            }
            if (isSubmitted) {
              if (idx === currentQ.correctAnswer) {
                stateClass = "bg-[var(--success-bg)] border-[var(--success)] text-[var(--text)] font-semibold shadow-sm";
              } else if (selectedOption === idx && idx !== currentQ.correctAnswer) {
                stateClass = "bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--text)] font-semibold shadow-sm";
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between text-xs sm:text-sm font-medium ${stateClass}`}
              >
                <div className="flex-1 overflow-x-auto pr-2">
                  <MarkdownViewer 
                    content={option} 
                    className="[&_p]:mb-0 [&_.katex]:text-inherit"
                  />
                </div>
                {isSubmitted && idx === currentQ.correctAnswer && (
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 ml-2" />
                )}
                {isSubmitted && selectedOption === idx && idx !== currentQ.correctAnswer && (
                  <XCircle className="w-5 h-5 text-[var(--danger)] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation box after submission */}
        {isSubmitted && (
          <div className="bg-[var(--info-bg)] border border-[var(--info-border)] p-4 rounded-2xl space-y-1 animate-fadeIn">
            <span className="text-[11px] font-bold text-[var(--info)] uppercase tracking-wider">Explanation</span>
            <div className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              <MarkdownViewer content={currentQ.explanation} />
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] px-6 py-4 rounded-2xl shadow-sm transition-colors">
        <div className="text-xs font-medium text-[var(--muted)]">
          Score: <span className="text-[var(--text)] font-bold">{score}</span> / {questions.length}
        </div>

        {!isSubmitted ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOption === null}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              selectedOption === null 
                ? 'bg-[var(--surface-raised)] text-[var(--muted)] cursor-not-allowed' 
                : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-sm'
            }`}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-semibold text-[var(--primary-text)] shadow-sm transition-all"
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
