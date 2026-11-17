import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, Shield, ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { auth, db, firebaseConfig, getAppCheckDiagnostics, AppCheckDiagnostics, isAppCheckInCooldown, markAppCheckFailure, ai } from '../services/firebaseService';
import { checkOnDeviceAIAvailability, InferenceMode } from '../services/aiService';
import { getDocs, collection, query, limit } from 'firebase/firestore';
import { getGenerativeModel, ThinkingLevel } from 'firebase/ai';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

const OWNER_EMAILS = ['fabriceib2003@gmail.com'];

interface AboutPageProps {
  theme?: ThemeMode;
  setTheme?: (theme: ThemeMode) => void;
}

export const AboutPage: React.FC<AboutPageProps> = () => {
  const { theme: activeTheme, setTheme: handleThemeChange } = useTheme();

  const currentUserEmail = auth.currentUser?.email || '';
  const isOwner = Boolean(currentUserEmail && OWNER_EMAILS.includes(currentUserEmail));

  // Readiness Panel State
  const [readinessRunning, setReadinessRunning] = useState(false);
  const [readinessResults, setReadinessResults] = useState<{
    configLoaded: boolean;
    firestoreReachable: boolean;
    signedIn: boolean;
    onDeviceStatus: string;
    rawAvailability?: string;
    chromeVersion?: string;
    details?: string;
    aiTestResult: string;
    aiTestSuccess: boolean;
    aiSourceUsed: string;
    onlineStatus: boolean;
    serviceWorkerActive: boolean;
    persistenceActive: boolean;
    appCheck: AppCheckDiagnostics;
  } | null>(null);

  const runReadinessCheck = async () => {
    setReadinessRunning(true);
    let firestoreReachable = false;
    let aiTestResult = "Not tested";
    let aiTestSuccess = false;
    let aiSourceUsed = "None";

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

    const appCheck = await getAppCheckDiagnostics();

    try {
      if (ai) {
        if (isAppCheckInCooldown()) {
          aiTestResult = "Throttled (App Check cooldown: 10s)";
          aiSourceUsed = "None (Cooldown Active)";
          aiTestSuccess = false;
        } else {
          const diagnosticModels = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
          let lastDiagErr: any = null;
          for (const modelName of diagnosticModels) {
            try {
              const model = getGenerativeModel(ai, {
                mode: InferenceMode.PREFER_ON_DEVICE,
                inCloudParams: {
                  model: modelName,
                  generationConfig: {
                    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                    maxOutputTokens: 32
                  }
                }
              });
              const res = await model.generateContent("Ping", { timeout: 12000 });
              const text = typeof (res as any).text === 'function' ? (res as any).text() : (res as any).text || (res as any).response?.text() || 'OK';
              aiTestResult = text ? "Success (Operational)" : "Empty response";
              aiSourceUsed = (res as any)?.inferenceSource || `Cloud (${modelName})`;
              aiTestSuccess = Boolean(text);
              lastDiagErr = null;
              break;
            } catch (diagErr: any) {
              lastDiagErr = diagErr;
              const msg = (diagErr?.message || String(diagErr)).toLowerCase();
              if (msg.includes('appcheck') || msg.includes('app check') || msg.includes('recaptcha') || msg.includes('403') || msg.includes('401')) {
                throw diagErr;
              }
            }
          }
          if (lastDiagErr) throw lastDiagErr;
        }
      }
    } catch (e: any) {
      const errMsg = (e?.message || String(e)).toLowerCase();
      if (errMsg.includes('appcheck') || errMsg.includes('app check') || errMsg.includes('recaptcha') || errMsg.includes('403') || errMsg.includes('401')) {
        markAppCheckFailure();
        aiTestResult = "Blocked by App Check enforcement";
      } else {
        const cleanErr = e?.message ? e.message.split('(')[0].trim() : 'Call failed';
        aiTestResult = cleanErr.length > 35 ? cleanErr.slice(0, 32) + '...' : cleanErr;
      }
      aiSourceUsed = "None (Call Failed)";
      aiTestSuccess = false;
    }

    const deviceCheck = await checkOnDeviceAIAvailability();

    let persistenceActive = false;
    try {
      persistenceActive = typeof window !== 'undefined' && 'indexedDB' in window && Boolean(window.indexedDB);
    } catch {
      persistenceActive = false;
    }

    setReadinessResults({
      configLoaded: Boolean(firebaseConfig && firebaseConfig.projectId),
      firestoreReachable,
      signedIn: Boolean(auth.currentUser),
      onDeviceStatus: deviceCheck.status,
      rawAvailability: deviceCheck.rawAvailability,
      chromeVersion: deviceCheck.chromeVersion,
      details: deviceCheck.details,
      aiTestResult,
      aiTestSuccess,
      aiSourceUsed,
      onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
      serviceWorkerActive: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller),
      persistenceActive,
      appCheck
    });

    setReadinessRunning(false);
  };

  useEffect(() => {
    if (isOwner) {
      runReadinessCheck();
    }
  }, [isOwner]);

  return (
    <div className="min-h-screen font-sans transition-colors bg-[var(--bg-app)] text-[var(--text)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between max-w-[720px] mx-auto">
        <Link 
          to="/study" 
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary-accent)] transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Study Desk
        </Link>
        <ThemeToggle theme={activeTheme} setTheme={handleThemeChange} />
      </header>

      {/* Main Content */}
      <main className="max-w-[720px] mx-auto px-6 py-12 space-y-10">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-xl text-[var(--primary-text)]" style={{ background: 'linear-gradient(135deg, var(--primary), var(--content-flashcards))' }}>
            <Brain className="w-10 h-10" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text)]">
            About StudyBridge
          </h1>
          <p className="text-[17px] leading-[1.7] text-[var(--muted)]">
            StudyBridge is the offline-first AI study assistant that transforms your textbooks, lecture notes, PDFs, and YouTube videos into structured summaries, interactive quizzes, flashcards, and precise answers.
          </p>
        </div>

        {/* Readiness Panel (Owner Only) */}
        {isOwner && (
          <section className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--primary-accent)]">
                  <Shield className="w-5 h-5" /> Owner Readiness Panel
                </h2>
                <p className="text-xs text-[var(--muted)]">System diagnostics & Firebase AI Logic verification</p>
              </div>
              <button
                type="button"
                onClick={runReadinessCheck}
                disabled={readinessRunning}
                className="px-3 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${readinessRunning ? 'animate-spin' : ''}`} />
                <span>Re-run Checks</span>
              </button>
            </div>

            {readinessRunning && !readinessResults ? (
              <div className="py-8 text-center flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--primary-accent)]" />
                <span>Running system diagnostics...</span>
              </div>
            ) : readinessResults ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Firebase Config Loaded</span>
                  {readinessResults.configLoaded ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Firestore Reachable</span>
                  {readinessResults.firestoreReachable ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">User Signed In</span>
                  {readinessResults.signedIn ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">On-Device AI Status</span>
                  <span className="font-bold text-[var(--primary-accent)] uppercase tracking-wider">{readinessResults.onDeviceStatus}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Raw availability() / Chrome</span>
                  <span className="font-mono text-xs text-[var(--text)]">{readinessResults.rawAvailability || 'N/A'} (Chrome {readinessResults.chromeVersion || 'N/A'})</span>
                </div>

                {readinessResults.details && (
                  <div className="col-span-1 sm:col-span-2 p-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)] text-[11px] leading-relaxed">
                    <strong>Why unsupported:</strong> {readinessResults.details}
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Tiny AI Logic Test</span>
                  <span className={`font-semibold flex items-center gap-1.5 ${
                    readinessResults.aiTestSuccess
                      ? 'text-[var(--success)]'
                      : 'text-[var(--danger)] text-[11px]'
                  }`}>
                    {readinessResults.aiTestSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                        <span>{readinessResults.aiTestResult}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
                        <span className="text-right max-w-[210px] truncate" title={readinessResults.aiTestResult}>{readinessResults.aiTestResult}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">AI Inference Source Used</span>
                  <span className={`font-mono text-xs ${
                    readinessResults.aiTestSuccess
                      ? 'text-[var(--accent-flashcards)] font-semibold'
                      : 'text-[var(--muted)] italic'
                  }`}>
                    {readinessResults.aiSourceUsed}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Online / Offline</span>
                  <span className={`font-semibold ${readinessResults.onlineStatus ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                    {readinessResults.onlineStatus ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Service Worker Active</span>
                  {readinessResults.serviceWorkerActive ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <span className="text-[var(--muted)] text-[11px]">Not active</span>}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">Persistence Active</span>
                  {readinessResults.persistenceActive ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <XCircle className="w-4 h-4 text-[var(--danger)]" />}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] gap-2">
                  <span className="font-medium text-[var(--text-secondary)]">Host &amp; App Check Mode</span>
                  <div className="text-right">
                    <div className="font-mono text-[11px] font-semibold text-[var(--text)]">
                      {readinessResults.appCheck.hostname}{readinessResults.appCheck.inIframe ? ' (iframe)' : ''}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      Mode: {readinessResults.appCheck.modeLabel}
                    </div>
                  </div>
                </div>

                <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
                  <span className="font-medium text-[var(--text-secondary)]">App Check Status</span>
                  <div className="flex flex-col sm:items-end gap-1">
                    {readinessResults.appCheck.statusKind === 'active' ? (
                      <span className="flex items-center gap-1.5 text-[var(--success)] font-semibold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                        <span>{readinessResults.appCheck.statusLabel}</span>
                      </span>
                    ) : readinessResults.appCheck.statusKind === 'skipped' ? (
                      <span className="text-[var(--muted)] text-[11px] font-medium bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                        {readinessResults.appCheck.statusLabel}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[var(--danger)] font-semibold text-xs">
                        <XCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
                        <span>{readinessResults.appCheck.statusLabel}</span>
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--muted)]">
                      Token obtained: <strong>{readinessResults.appCheck.tokenObtained ? 'Yes' : 'No'}</strong>
                      {readinessResults.appCheck.tokenObtained && (
                        <>
                          {' '}· Expires:{' '}
                          {readinessResults.appCheck.tokenExpiresAt
                            ? new Date(readinessResults.appCheck.tokenExpiresAt).toLocaleString()
                            : 'Unavailable'}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {readinessResults.appCheck.statusKind === 'missing_key' && (
                  <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Missing reCAPTCHA Enterprise Site Key</p>
                    <p>
                      <code>VITE_RECAPTCHA_SITE_KEY</code> is not set for host <code>{readinessResults.appCheck.hostname}</code>. Set <code>VITE_RECAPTCHA_SITE_KEY</code> in your deployment environment variables and rebuild so Firebase App Check can issue tokens.
                    </p>
                  </div>
                )}

                {readinessResults.appCheck.statusKind === 'skipped' && !readinessResults.aiTestSuccess && (
                  <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">App Check skipped in AI Studio preview iframe</p>
                    <p>
                      Your Firebase Console currently enforces App Check on AI requests. To test in preview, set <code>VITE_APPCHECK_DEBUG=true</code> and register the debug token printed in the browser console under Firebase Console &rarr; App Check.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        <div className="space-y-6 text-[17px] leading-[1.7]">
          <section className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--primary-accent)]">
              <Sparkles className="w-5 h-5" /> Key Features
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[var(--muted)]">
              <li><strong className="text-[var(--text)]">Offline-First Architecture:</strong> Access your saved study materials, notes, and results anywhere without an internet connection.</li>
              <li><strong className="text-[var(--text)]">Hybrid AI Routing:</strong> Seamlessly switch between local on-device inference (for privacy) and secure cloud Vertex AI endpoints via Firebase AI Logic.</li>
              <li><strong className="text-[var(--text)]">Comprehensive Study Tools:</strong> Generate structured summaries, interactive Q&A, adaptive quizzes, and spaced-repetition flashcards.</li>
              <li><strong className="text-[var(--text)]">Secure Cloud Sync:</strong> Automatically synchronize your progress across devices securely with Firebase.</li>
            </ul>
          </section>

          <section className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] space-y-3 shadow-sm">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--primary-accent)]">
              <Shield className="w-5 h-5" /> Privacy & Support
            </h2>
            <p className="text-[var(--muted)]">
              We respect your academic privacy. Your study notes and data remain strictly under your control. For questions, feedback, or support, please contact us at: <a href="mailto:fabriceib2003@gmail.com" className="font-semibold underline text-[var(--primary-accent)]">fabriceib2003@gmail.com</a>.
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
