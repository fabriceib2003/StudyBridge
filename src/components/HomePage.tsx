import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Sparkles, BookOpen, Layers, ArrowRight, Sun, Moon, Monitor } from 'lucide-react';
import { User } from 'firebase/auth';

import { ThemeToggle } from './ThemeToggle';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

interface HomePageProps {
  user: User | null;
  theme?: ThemeMode;
  setTheme?: (theme: ThemeMode) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <div className="min-h-screen font-sans transition-colors flex flex-col bg-[var(--bg-app)] text-[var(--text)] overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 max-w-[960px] mx-auto w-full">
        <div
          onClick={() => navigate(user ? '/study' : '/')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0"
        >
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-md text-[var(--primary-text)] shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--content-flashcards))' }}
          >
            <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-bold text-sm sm:text-base tracking-tight whitespace-nowrap">StudyBridge</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Mobile (<640px): compact icon-only theme toggle */}
          <button
            type="button"
            onClick={cycleTheme}
            className="sm:hidden p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
            aria-label={`Switch theme (current: ${theme})`}
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4" />
            ) : theme === 'dark' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
          </button>

          {/* Desktop (>=640px): full ThemeToggle */}
          <div className="hidden sm:block">
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>

          {user ? (
            <button
              onClick={() => navigate('/study')}
              className="hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              Open Study Desk
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-[800px] w-full mx-auto px-4 py-8 sm:px-6 sm:py-16 text-center space-y-8 sm:space-y-12">
        <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--primary-accent)]">
            <Sparkles className="w-3.5 h-3.5 shrink-0" /> Offline-First AI Study Assistant
          </div>
          <h1 className="text-[2rem] sm:text-6xl font-extrabold tracking-tight leading-[1.15] sm:leading-tight text-[var(--text)]">
            Study smarter, online or offline
          </h1>
          <p className="text-sm sm:text-[17px] leading-relaxed sm:leading-[1.7] max-w-xl mx-auto text-[var(--muted)]">
            Transform textbooks, PDFs, notes, and videos into structured summaries, quizzes, flashcards, and instant answers.
          </p>
          <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            {user ? (
              <button
                onClick={() => navigate('/study')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-bold text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Open Study Desk <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-bold text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  Get started <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-bold text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--hover)] shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-4 sm:pt-8 text-left">
          <div className="p-4 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5 sm:space-y-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">Multi-Format Import</h3>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Import PDFs, slides, images, YouTube captions, and Google Drive files effortlessly.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5 sm:space-y-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">AI Study Tools</h3>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Generate concise summaries, adaptive quizzes, and flashcards instantly.
            </p>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5 sm:space-y-3 shadow-sm min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">Study Offline</h3>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Access your saved notes, flashcards, and study materials anywhere without internet.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[960px] mx-auto px-4 py-6 sm:px-6 sm:py-10 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 w-full text-center sm:text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-6">
          <Link to="/about" className="hover:underline whitespace-nowrap">About</Link>
          <Link to="/privacy" className="hover:underline whitespace-nowrap">Privacy Policy</Link>
          <Link to="/terms" className="hover:underline whitespace-nowrap">Terms of Service</Link>
        </div>
        <p className="break-words">© {new Date().getFullYear()} StudyBridge. Contact: fabriceib2003@gmail.com</p>
      </footer>
    </div>
  );
};
