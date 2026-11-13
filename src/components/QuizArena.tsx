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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto my-12 shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-sm">No quiz questions available.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-6 max-w-2xl mx-auto my-12 shadow-xl animate-fadeIn transition-colors">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-orange-500/20 text-white">
          <Award className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Completed!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Subject: {subjectName}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 max-w-xs mx-auto space-y-1 shadow-sm">
          <div className="text-4xl font-extrabold text-slate-900 dark:text-white">{score} / {questions.length}</div>
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{percentage}% Correct Score</div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Quiz
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-colors"
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
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Practice Quiz</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 hidden sm:inline">
                ({subjectName})
              </span>
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Question {currentIndex + 1} of {questions.length}
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

      {/* Question prompt */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm transition-colors">
        <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
          <MarkdownViewer 
            content={currentQ.question} 
            className="[&_p]:text-slate-900 dark:[&_p]:text-slate-100 [&_p]:text-base sm:[&_p]:text-lg [&_p]:font-bold [&_p]:leading-relaxed [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_.katex]:text-slate-900 dark:[&_.katex]:text-slate-100"
          />
        </div>

        {/* Options list */}
        <div className="space-y-2.5">
          {currentQ.options.map((option, idx) => {
            let stateClass = "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600";
            if (selectedOption === idx) {
              stateClass = "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 font-semibold shadow-sm ring-1 ring-blue-500";
            }
            if (isSubmitted) {
              if (idx === currentQ.correctAnswer) {
                stateClass = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-semibold shadow-sm";
              } else if (selectedOption === idx && idx !== currentQ.correctAnswer) {
                stateClass = "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 font-semibold shadow-sm";
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 ml-2" />
                )}
                {isSubmitted && selectedOption === idx && idx !== currentQ.correctAnswer && (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation box after submission */}
        {isSubmitted && (
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 p-4 rounded-2xl space-y-1 animate-fadeIn">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Explanation</span>
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <MarkdownViewer content={currentQ.explanation} />
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-4 rounded-2xl shadow-sm transition-colors">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Score: <span className="text-slate-900 dark:text-white font-bold">{score}</span> / {questions.length}
        </div>

        {!isSubmitted ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOption === null}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              selectedOption === null 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-all"
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
