import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Sparkles, BookOpen, Layers, ArrowRight } from 'lucide-react';
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

  return (
    <div className="min-h-screen font-sans transition-colors flex flex-col bg-[var(--bg-app)] text-[var(--text)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between max-w-[960px] mx-auto w-full">
        <div 
          onClick={() => navigate(user ? '/study' : '/')} 
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md text-[var(--primary-text)]" style={{ background: 'linear-gradient(135deg, var(--primary), var(--content-flashcards))' }}>
            <Brain className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight">StudyBridge</span>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle theme={theme} setTheme={setTheme} />

          {user ? (
            <button
              onClick={() => navigate('/study')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-md transition-all cursor-pointer"
            >
              Open Study Desk
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-md transition-all cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-[800px] mx-auto px-6 py-16 text-center space-y-12">
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--primary-accent)]">
            <Sparkles className="w-3.5 h-3.5" /> Offline-First AI Study Assistant
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-[var(--text)]">
            Study smarter, online or offline
          </h1>
          <p className="text-[17px] leading-[1.7] max-w-xl mx-auto text-[var(--muted)]">
            Transform textbooks, PDFs, notes, and videos into structured summaries, quizzes, flashcards, and instant answers.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            {user ? (
              <button
                onClick={() => navigate('/study')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-lg transition-all cursor-pointer"
              >
                Open Study Desk <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-lg transition-all cursor-pointer"
                >
                  Get started <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--hover)] shadow-sm transition-all cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-3 gap-6 pt-8 text-left">
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">Multi-Format Import</h3>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Import PDFs, slides, images, YouTube captions, and Google Drive files effortlessly.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text)]">AI Study Tools</h3>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Generate concise summaries, adaptive quizzes, and flashcards instantly.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary)] text-[var(--primary-text)] font-bold">
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
      <footer className="max-w-[960px] mx-auto px-6 py-10 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-4 w-full" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <div className="flex items-center gap-6">
          <Link to="/about" className="hover:underline">About</Link>
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
        </div>
        <p>© {new Date().getFullYear()} StudyBridge. Contact: fabriceib2003@gmail.com</p>
      </footer>
    </div>
  );
};
