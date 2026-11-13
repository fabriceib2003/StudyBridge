import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface TermsPageProps {
  theme?: 'light' | 'dark' | 'system';
  setTheme?: (theme: 'light' | 'dark' | 'system') => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ theme: propTheme, setTheme: propSetTheme }) => {
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('studybridge_theme') as any) || 'light';
  });

  const activeTheme = propTheme || localTheme;
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (propSetTheme) {
      propSetTheme(newTheme);
    } else {
      setLocalTheme(newTheme);
      localStorage.setItem('studybridge_theme', newTheme);
      let isDark = newTheme === 'dark';
      if (newTheme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text)' }}>
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between max-w-[720px] mx-auto" style={{ borderColor: 'var(--border)' }}>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to StudyBridge
        </Link>
        <ThemeToggle theme={activeTheme} setTheme={handleThemeChange} />
      </header>

      {/* Main Content */}
      <main className="max-w-[720px] mx-auto px-6 py-12 space-y-8 animate-fadeIn">
        <div className="space-y-2 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5" style={{ color: 'var(--primary)' }}>
            <FileText className="w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Last updated: November 10, 2026
          </p>
        </div>

        <div className="space-y-6 text-[17px] leading-[1.7]" style={{ color: 'var(--muted)' }}>
          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>1. Acceptance of Terms</h2>
            <p>
              By accessing or using StudyBridge, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>2. Acceptable Use</h2>
            <p>
              You agree to use StudyBridge only for lawful educational and study purposes. You agree not to upload malicious files, attempt unauthorized access to system infrastructure, or violate any applicable laws.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>3. User Content & Ownership</h2>
            <p>
              You retain all intellectual property rights and ownership over the study materials, notes, and documents you upload or create within StudyBridge.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>4. AI Outputs & Limitations</h2>
            <p>
              StudyBridge utilizes generative artificial intelligence to synthesize summaries, explanations, quiz questions, and flashcards. AI-generated outputs may occasionally contain inaccuracies or hallucinations. Users should independently verify critical academic or professional information.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>5. Service Availability & Regional Restrictions</h2>
            <p>
              We strive to provide uninterrupted service, but availability may be subject to scheduled maintenance, network conditions, or regional compliance requirements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>6. Account Termination</h2>
            <p>
              You may terminate your account at any time through the Settings page. We reserve the right to suspend or terminate access for violations of these terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>7. Contact Us</h2>
            <p>
              If you have any questions regarding these Terms, please contact us at: <a href="mailto:fabriceib2003@gmail.com" className="font-semibold underline" style={{ color: 'var(--primary)' }}>fabriceib2003@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[720px] mx-auto px-6 py-10 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-12" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
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
