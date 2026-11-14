import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

interface PrivacyPageProps {
  theme?: ThemeMode;
  setTheme?: (theme: ThemeMode) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = () => {
  const { theme: activeTheme, setTheme: handleThemeChange } = useTheme();

  return (
    <div className="min-h-screen font-sans transition-colors bg-[var(--bg-app)] text-[var(--text)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between max-w-[720px] mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary-accent)] transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to StudyBridge
        </Link>
        <ThemeToggle theme={activeTheme} setTheme={handleThemeChange} />
      </header>

      {/* Main Content */}
      <main className="max-w-[720px] mx-auto px-6 py-12 space-y-8 animate-fadeIn">
        <div className="space-y-2 border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-2.5 text-[var(--primary-accent)]">
            <Shield className="w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Privacy Policy</h1>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Last updated: November 10, 2026
          </p>
        </div>

        <div className="space-y-6 text-[17px] leading-[1.7]" style={{ color: 'var(--muted)' }}>
          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>1. Information We Collect</h2>
            <p>
              StudyBridge collects information to provide robust offline-first AI study assistance. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong style={{ color: 'var(--text)' }}>Account Information:</strong> Your account email address and display name used for authentication via Firebase Auth.</li>
              <li><strong style={{ color: 'var(--text)' }}>Study Materials & Extracted Text:</strong> PDFs, slides, images, YouTube captions, and notes you upload, paste, or import.</li>
              <li><strong style={{ color: 'var(--text)' }}>Generated Results:</strong> Summaries, explanations, quizzes, and flashcard sets generated during your study sessions.</li>
              <li><strong style={{ color: 'var(--text)' }}>Usage Logs & Analytics:</strong> AI request counts, inference latency, routing choices (cloud vs on-device), and daily study goals.</li>
              <li><strong style={{ color: 'var(--text)' }}>Region Check Results:</strong> Regional status verification indicators without capturing exact geographic coordinates.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>2. How We Use Your Information</h2>
            <p>
              Collected data is used exclusively to maintain your study library, sync materials securely across your devices, generate AI study content, and monitor application performance.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>3. Google Drive Access & Limited Use Policy</h2>
            <p>
              When you import files from Google Drive, StudyBridge requests access solely through the restrictive <code className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text)' }}>drive.file</code> scope. This grants permission only to open and read the specific files you explicitly select via the Google Picker.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Your Google Drive files, document content, and OAuth tokens are never stored on our servers beyond immediate text extraction and local session caching.</strong>
            </p>
            <div className="p-4 rounded-2xl border space-y-2 text-xs" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <p className="font-semibold" style={{ color: 'var(--primary)' }}>Google API Services User Data Policy — Limited Use Statement:</p>
              <p className="leading-relaxed">
                StudyBridge's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="underline font-medium" style={{ color: 'var(--primary)' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>4. Data Storage & AI Processing</h2>
            <p>
              Data is securely stored using Firebase and Google Cloud Firestore infrastructure with robust encryption in transit and at rest. AI processing is performed either locally on-device (where supported by browser APIs) or securely via Google Gemini models through Firebase AI Logic endpoints.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>5. Data Retention, Export & Deletion</h2>
            <p>
              Your data is retained as long as your account remains active. You can export your complete study archive in JSON format or permanently delete all your data and request history at any time under <strong style={{ color: 'var(--text)' }}>Settings &gt; Privacy & Data</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>6. No Sale of Personal Data</h2>
            <p>
              StudyBridge does not sell, trade, or rent your personal information or study notes to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>7. Children's Privacy</h2>
            <p>
              StudyBridge is designed for students and educational use. We do not knowingly collect personal data from children under 13 without parental consent.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>8. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please contact us at: <a href="mailto:fabriceib2003@gmail.com" className="font-semibold underline" style={{ color: 'var(--primary)' }}>fabriceib2003@gmail.com</a>.
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
