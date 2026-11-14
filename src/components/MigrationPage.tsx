import React, { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, getDocs, collection, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { Subject, Page, Material } from '../types';
import { db as newDb } from '../services/firebaseService';

interface MigrationPageProps {
  user: User | null;
  subjects: Subject[];
  onAddMaterial: (mat: any, pages: Page[]) => void;
}

export const MigrationPage: React.FC<MigrationPageProps> = ({ user, subjects, onAddMaterial }) => {
  const [legacyAuth, setLegacyAuth] = useState<any>(null);
  const [legacyDb, setLegacyDb] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [migrationStatus, setMigrationStatus] = useState<string>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; skipped: number } | null>(null);

  const initializeLegacyApp = async () => {
    try {
      const legacyApp = initializeApp({
        projectId: "ethereal-defender-11ttq",
        apiKey: import.meta.env.VITE_LEGACY_FIREBASE_API_KEY,
        appId: "1:344665794118:web:7fd911ae9aa3e8962e8c47",
        authDomain: "ethereal-defender-11ttq.firebaseapp.com"
      }, 'legacy');
      setLegacyAuth(getAuth(legacyApp));
      setLegacyDb(initializeFirestore(legacyApp, {}, "ai-studio-studybridge-605cbf29-3b2b-40bc-8769-b61ca4bcc204"));
    } catch (e) {
      console.error("Legacy app init error:", e);
      setError("Failed to initialize legacy connection.");
    }
  };

  const handleLegacyLogin = async () => {
    if (!legacyAuth) return;
    try {
      await signInWithEmailAndPassword(legacyAuth, email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startMigration = async () => {
    if (!legacyAuth?.currentUser || !user || !legacyDb) return;
    setMigrationStatus('migrating');
    setError(null);
    
    const collections = ['materials', 'subjects', 'results', 'jobs', 'interactions', 'preferences', 'quizAttempts'];
    let processed = 0;
    let skipped = 0;

    try {
      for (const colName of collections) {
        const legacyColRef = collection(legacyDb, `users/${legacyAuth.currentUser.uid}/${colName}`);
        const snapshot = await getDocs(legacyColRef);
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(newDb);
          const chunk = docs.slice(i, i + 400);
          
          for (const docSnapshot of chunk) {
            const newDocRef = doc(newDb, `users/${user.uid}/${colName}`, docSnapshot.id);
            const existing = await getDoc(newDocRef);
            
            if (existing.exists()) {
              skipped++;
            } else {
              batch.set(newDocRef, docSnapshot.data());
              processed++;
            }

            // If material, check for subcollection 'chunks'
            if (colName === 'materials') {
              const chunksColRef = collection(legacyDb, `users/${legacyAuth.currentUser.uid}/materials/${docSnapshot.id}/chunks`);
              const chunksSnapshot = await getDocs(chunksColRef);
              for (const chunkSnapshot of chunksSnapshot.docs) {
                const newChunkRef = doc(newDb, `users/${user.uid}/materials/${docSnapshot.id}/chunks`, chunkSnapshot.id);
                const existingChunk = await getDoc(newChunkRef);
                if (!existingChunk.exists()) {
                  batch.set(newChunkRef, chunkSnapshot.data());
                  processed++;
                }
              }
            }
          }
          await batch.commit();
        }
      }
      setSummary({ total: processed, skipped });
      setMigrationStatus('complete');
    } catch (e: any) {
      setError(e.message || 'Migration failed.');
      setMigrationStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-bold text-[var(--text)]">Data Migration</h2>
      
      {!user ? (
        <div className="p-4 bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning-border)] rounded-xl text-sm">
          Please sign in to your StudyBridge account above first so we know where to import your data.
        </div>
      ) : !legacyAuth ? (
        <button onClick={initializeLegacyApp} className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition">
          Connect Legacy App
        </button>
      ) : !legacyAuth.currentUser ? (
        <div className="space-y-4 bg-[var(--surface-raised)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-sm text-[var(--text-secondary)]">Sign in with your credentials from the old version:</p>
          <div className="space-y-2">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="block w-full p-2.5 text-sm bg-[var(--input-bg)] text-[var(--text)] border border-[var(--input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="block w-full p-2.5 text-sm bg-[var(--input-bg)] text-[var(--text)] border border-[var(--input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" 
            />
            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleLegacyLogin} 
                className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition"
              >
                Sign In with Email
              </button>
              <button 
                onClick={async () => {
                  try {
                    const provider = new GoogleAuthProvider();
                    await signInWithPopup(legacyAuth, provider);
                  } catch (e: any) {
                    setError(e.message);
                  }
                }} 
                className="px-4 py-2 bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--hover)] transition"
              >
                Sign In with Google
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">Connected to legacy account: <strong>{legacyAuth.currentUser.email || legacyAuth.currentUser.uid}</strong></p>
          {migrationStatus === 'idle' && (
            <button onClick={startMigration} className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-xl text-sm font-medium hover:bg-[var(--primary-hover)] transition">
              Start Migration Now
            </button>
          )}
          {migrationStatus === 'migrating' && (
            <div className="flex items-center gap-2 text-sm text-[var(--primary-accent)] font-medium">
              <Loader2 className="animate-spin w-4 h-4" /> Migrating all your materials, chunks, subjects and results...
            </div>
          )}
          {migrationStatus === 'error' && (
            <div className="text-[var(--danger)] text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error} 
              <button onClick={startMigration} className="underline font-medium ml-2">Retry</button>
            </div>
          )}
          {migrationStatus === 'complete' && summary && (
            <div className="bg-[var(--success-bg)] text-[var(--success)] p-4 rounded-xl text-sm space-y-2 border border-[var(--success-border)]">
              <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Migration complete!</p>
              <p>Documents copied into new database: <strong>{summary.total}</strong></p>
              <p>Documents skipped (already existed): <strong>{summary.skipped}</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
