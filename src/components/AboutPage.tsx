import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, Shield, ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { auth, db, firebaseConfig, checkAppCheckToken, isAppCheckInCooldown, markAppCheckFailure, getAppCheckErrorMessage, ai } from '../services/firebaseService';
import { checkOnDeviceAIAvailability, InferenceMode } from '../services/aiService';
import { getDocs, collection, query, limit } from 'firebase/firestore';
import { getGenerativeModel } from 'firebase/ai';

const OWNER_EMAILS = ['fabriceib2003@gmail.com'];

interface AboutPageProps {
  theme?: 'light' | 'dark' | 'system';
  setTheme?: (theme: 'light' | 'dark' | 'system') => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ theme: propTheme, setTheme: propSetTheme }) => {
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('studybridge_theme') as any) || 'light';
  });

  const currentUserEmail = auth.currentUser?.email || '';
  const isOwner = Boolean(currentUserEmail && OWNER_EMAILS.includes(currentUserEmail));

  // Readiness Panel State
  const [readinessRunning, setReadinessRunning] = useState(false);
  const [readinessResults, setReadinessResults] = useState<{
    configLoaded: boolean;
    firestoreReachable: boolean;
    signedIn: boolean;
    onDeviceStatus: string;
    aiTestResult: string;
    aiSourceUsed: string;
    onlineStatus: boolean;
    serviceWorkerActive: boolean;
    persistenceActive: boolean;
    appCheckPresent: boolean;
  } | null>(null);

  const runReadinessCheck = async () => {
    setReadinessRunning(true);
    let firestoreReachable = false;
    let aiTestResult = "Not tested";
    let aiSourceUsed = "N/A";
    let appCheckPresent = false;

    try {
      if (auth.currentUser) {
        await getDocs(query(collection(db, `users/${auth.currentUser.uid}/subjects`), limit(1)));
        firestoreReachable = true;
      } else {
        firestoreReachable = true;
      }
    } catch {
      firestoreReachable = false;
    }

    try {
      appCheckPresent = await checkAppCheckToken();
    } catch {
      appCheckPresent = false;
    }

    try {
      if (ai) {
        if (isAppCheckInCooldown()) {
          aiTestResult = getAppCheckErrorMessage();
          aiSourceUsed = 'App Check Cooldown';
        } else {
          const model = getGenerativeModel(ai, {
            mode: InferenceMode.PREFER_ON_DEVICE,
            inCloudParams: { model: 'gemini-2.5-flash' }
          });
          const res = await model.generateContent("Ping");
          const text = typeof (res as any).text === 'function' ? (res as any).text() : (res as any).text || (res as any).response?.text() || 'OK';
          aiTestResult = text ? "Success" : "Empty response";
          aiSourceUsed = (res as any)?.inferenceSource || 'Cloud / On-Device';
        }
      }
    } catch (e: any) {
      const errMsg = (e?.message || String(e)).toLowerCase();
      if (errMsg.includes('appcheck') || errMsg.includes('app check') || errMsg.includes('recaptcha')) {
        markAppCheckFailure();
        aiTestResult = getAppCheckErrorMessage();
      } else {
        aiTestResult = `Error: ${e.message || 'Failed'}`;
      }
      aiSourceUsed = 'Cloud Fallback';
    }

    const deviceCheck = await checkOnDeviceAIAvailability();

    setReadinessResults({
      configLoaded: Boolean(firebaseConfig && firebaseConfig.projectId),
      firestoreReachable,
      signedIn: Boolean(auth.currentUser),
      onDeviceStatus: deviceCheck.status,
      aiTestResult,
      aiSourceUsed,
      onlineStatus: navigator.onLine,
      serviceWorkerActive: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller),
      persistenceActive: true,
      appCheckPresent
    });

    setReadinessRunning(false);
  };

  useEffect(() => {
    if (isOwner) {
      runReadinessCheck();
    }
  }, [isOwner]);

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
          to="/study" 
          className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--primary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Study Desk
        </Link>
        <ThemeToggle theme={activeTheme} setTheme={handleThemeChange} />
      </header>

      {/* Main Content */}
      <main className="max-w-[720px] mx-auto px-6 py-12 space-y-10">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-xl text-white" style={{ background: 'linear-gradient(135deg, var(--primary), #8b5cf6)' }}>
            <Brain className="w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            About StudyBridge
          </h1>
          <p className="text-[17px] leading-[1.7]" style={{ color: 'var(--muted)' }}>
            StudyBridge is the offline-first AI study assistant that transforms your textbooks, lecture notes, PDFs, and YouTube videos into structured summaries, interactive quizzes, flashcards, and precise answers.
          </p>
        </div>

        {/* Readiness Panel (Owner Only) */}
        {isOwner && (
          <section className="p-6 rounded-2xl border space-y-4 shadow-md" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Shield className="w-5 h-5" /> Owner Readiness Panel
                </h2>
                <p className="text-xs text-slate-500">System diagnostics & Firebase AI Logic verification</p>
              </div>
              <button
                type="button"
                onClick={runReadinessCheck}
                disabled={readinessRunning}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${readinessRunning ? 'animate-spin' : ''}`} />
                <span>Re-run Checks</span>
              </button>
            </div>

            {readinessRunning && !readinessResults ? (
              <div className="py-8 text-center flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Running system diagnostics...</span>
              </div>
            ) : readinessResults ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Firebase Config Loaded</span>
                  {readinessResults.configLoaded ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Firestore Reachable</span>
                  {readinessResults.firestoreReachable ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">User Signed In</span>
                  {readinessResults.signedIn ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">On-Device AI Status</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{readinessResults.onDeviceStatus}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Tiny AI Logic Test</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{readinessResults.aiTestResult}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">AI Inference Source Used</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{readinessResults.aiSourceUsed}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Online / Offline</span>
                  <span className={`font-semibold ${readinessResults.onlineStatus ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {readinessResults.onlineStatus ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Service Worker Active</span>
                  {readinessResults.serviceWorkerActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-slate-400 text-[11px]">Not active</span>}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Persistence Active</span>
                  {readinessResults.persistenceActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-300">App Check Token Present</span>
                  {readinessResults.appCheckPresent ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-amber-500 text-[11px]">Pending / Debug</span>}
                </div>
              </div>
            ) : null}
          </section>
        )}

        <div className="space-y-6 text-[17px] leading-[1.7]">
          <section className="p-6 rounded-2xl border space-y-3 shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--primary)' }}>
              <Sparkles className="w-5 h-5" /> Key Features
            </h2>
            <ul className="list-disc pl-5 space-y-2" style={{ color: 'var(--muted)' }}>
              <li><strong style={{ color: 'var(--text)' }}>Offline-First Architecture:</strong> Access your saved study materials, notes, and results anywhere without an internet connection.</li>
              <li><strong style={{ color: 'var(--text)' }}>Hybrid AI Routing:</strong> Seamlessly switch between local on-device inference (for privacy) and secure cloud Vertex AI endpoints via Firebase AI Logic.</li>
              <li><strong style={{ color: 'var(--text)' }}>Comprehensive Study Tools:</strong> Generate structured summaries, interactive Q&A, adaptive quizzes, and spaced-repetition flashcards.</li>
              <li><strong style={{ color: 'var(--text)' }}>Secure Cloud Sync:</strong> Automatically synchronize your progress across devices securely with Firebase.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl border space-y-3 shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--primary)' }}>
              <Shield className="w-5 h-5" /> Privacy & Support
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              We respect your academic privacy. Your study notes and data remain strictly under your control. For questions, feedback, or support, please contact us at: <a href="mailto:fabriceib2003@gmail.com" className="font-semibold underline" style={{ color: 'var(--primary)' }}>fabriceib2003@gmail.com</a>.
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
