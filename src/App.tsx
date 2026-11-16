import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, clearFirestoreLocalCacheOnSignOut } from './services/firebaseService';
import { doc, getDoc } from 'firebase/firestore';
import { clearAllMaterialPagesLocal } from './services/mediaStorage';
import { 
  subscribeSubjects, 
  addSubjectFirestore, 
  updateSubjectFirestore,
  deleteSubjectFirestore,
  deleteSubjectWithOptions,
  subscribeMaterials,
  saveMaterialWithChunks,
  deleteMaterialFirestore,
  moveMaterialSubject,
  subscribeInteractions,
  addInteractionFirestore,
  clearInteractionsFirestore,
  subscribeResults,
  getPreferences,
  updatePreferences
} from './services/firestoreService';
import { Subject, Material, AIInteraction, RoutingMode, UserStats, Page, SavedResult, OnDeviceAIStatus } from './types';
import { Navbar } from './components/Navbar';
import { StudyDesk } from './components/StudyDesk';
import { MaterialLibrary } from './components/MaterialLibrary';
import { Dashboard } from './components/Dashboard';
import { ProfilePage } from './components/ProfilePage';
import { SettingsPage } from './components/SettingsPage';
import { ResultPage } from './components/ResultPage';
import { AuthScreen } from './components/AuthScreen';
import { checkOnDeviceAIAvailability } from './services/aiService';
import { performRegionCheck, isGeolocationAvailable, RegionState } from './services/regionService';
import { BlockedRegionScreen } from './components/BlockedRegionScreen';
import { RegionExplanationModal } from './components/RegionExplanationModal';
import { AboutPage } from './components/AboutPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TermsPage } from './components/TermsPage';
import { HomePage } from './components/HomePage';
import { FAIL_OPEN, RESTRICTION_CODE } from './config/regionRestriction';
import { Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import { Modal } from './components/Modal';
import { useTheme } from './contexts/ThemeContext';
import 'katex/dist/katex.min.css';


export default function App() {
  const { theme, isDark, setTheme, syncThemeFromPreferences, registerFirestoreSaver } = useTheme();

  if (!import.meta.env.VITE_FIREBASE_API_KEY) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--danger-border)] rounded-3xl p-8 shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--danger-bg)] text-[var(--danger)] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Configuration Error</h1>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            <code>VITE_FIREBASE_API_KEY</code> is missing from environment variables. Please add <code>VITE_FIREBASE_API_KEY</code> to your <code>.env</code> file or host environment variables and restart.
          </p>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const prefsLoadedForUidRef = React.useRef<string | null>(null);
  const userRef = React.useRef<User | null>(null);
  const explicitSignOutRef = React.useRef<boolean>(false);
  const firestoreUnsubsRef = React.useRef<Array<() => void>>([]);

  // App state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [manualMode, setManualMode] = useState<RoutingMode>('auto');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingWriteCount, setPendingWriteCount] = useState<number>(0);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sign-out warning modal state
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [signOutOfflineAtPrompt, setSignOutOfflineAtPrompt] = useState<boolean>(false);
  const [signOutPendingAtPrompt, setSignOutPendingAtPrompt] = useState<number>(0);

  const hasPendingSync = !isOnline || pendingWriteCount > 0;

  // Preferences state
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [answerLength, setAnswerLength] = useState<'short' | 'detailed'>('detailed');
  const [studyLanguage, setStudyLanguage] = useState<string>('English');
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [reminders, setReminders] = useState<boolean>(true);

  // On-device AI capability check (available, downloadable, downloading, unsupported)
  const [deviceAiStatus, setDeviceAiStatus] = useState<OnDeviceAIStatus>('unsupported');
  const [isDeviceAiAvailable, setIsDeviceAiAvailable] = useState<boolean>(false);
  const [deviceAiDetails, setDeviceAiDetails] = useState<string>('');
  const [browserName, setBrowserName] = useState<string>('');

  // Regional restriction state & Firestore switch
  const [regionState, setRegionState] = useState<RegionState | null>(null);
  const [showRegionPrompt, setShowRegionPrompt] = useState<boolean>(false);
  const [isCheckingRegion, setIsCheckingRegion] = useState<boolean>(false);
  const [regionRestrictionEnabled, setRegionRestrictionEnabled] = useState<boolean>(false);
  const OWNER_EMAILS = ['fabriceib2003@gmail.com'];
  const isOwner = user?.email && OWNER_EMAILS.includes(user.email);

  useEffect(() => {
    if (!user) {
      setRegionRestrictionEnabled(false);
      return;
    }
    getDoc(doc(db, 'appConfig/regionRestriction'))
      .then((snap) => {
        if (snap.exists()) {
          setRegionRestrictionEnabled(Boolean(snap.data()?.enabled));
        } else {
          setRegionRestrictionEnabled(false);
        }
      })
      .catch(() => {
        setRegionRestrictionEnabled(false);
      });
  }, [user]);

  const handleTriggerRegionCheck = async (): Promise<void> => {
    if (!user) return;
    setIsCheckingRegion(true);
    try {
      const res = await performRegionCheck(user.uid);
      setRegionState(res);
    } finally {
      setIsCheckingRegion(false);
    }
  };

  const handleConfirmRegionPrompt = async () => {
    sessionStorage.setItem('studybridge_region_prompted', 'true');
    setShowRegionPrompt(false);
    await handleTriggerRegionCheck();
  };

  // Region check on login & app load, and every 30 minutes while open (owner accounts never restricted)
  useEffect(() => {
    if (!regionRestrictionEnabled || isOwner) {
      setRegionState(null);
      setShowRegionPrompt(false);
      return;
    }
    if (!user) {
      setRegionState(null);
      setShowRegionPrompt(false);
      return;
    }

    const prompted = sessionStorage.getItem('studybridge_region_prompted') === 'true';
    if (!prompted) {
      isGeolocationAvailable().then((allowed) => {
        if (!allowed && FAIL_OPEN) {
          sessionStorage.setItem('studybridge_region_prompted', 'true');
          handleTriggerRegionCheck();
        } else {
          setShowRegionPrompt(true);
        }
      });
    } else {
      handleTriggerRegionCheck();
    }

    const interval = setInterval(() => {
      performRegionCheck(user.uid).then(setRegionState);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, regionRestrictionEnabled, isOwner]);

  // Register Firestore theme saver for logged-in user
  useEffect(() => {
    if (!user) {
      registerFirestoreSaver(null);
      return;
    }
    registerFirestoreSaver((newTheme) => {
      updatePreferences(user.uid, { theme: newTheme }).catch(() => {});
    });
    return () => registerFirestoreSaver(null);
  }, [user, registerFirestoreSaver]);

  // Check on-device AI capability on load (never throws)
  const refreshDeviceAiCapability = () => {
    checkOnDeviceAIAvailability()
      .then(res => {
        setDeviceAiStatus(res.status);
        setIsDeviceAiAvailable(res.available);
        setDeviceAiDetails(res.details);
        setBrowserName(res.browserName);
      })
      .catch(() => {
        setDeviceAiStatus('unsupported');
        setIsDeviceAiAvailable(false);
        setDeviceAiDetails("Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.");
      });
  };

  useEffect(() => {
    refreshDeviceAiCapability();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDeviceAiCapability();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auth observer & cleanup (offline/network errors never sign the user out)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (!explicitSignOutRef.current && userRef.current && typeof navigator !== 'undefined' && !navigator.onLine) {
          // Treat offline/network token failure as still signed in
          setAuthLoading(false);
          return;
        }
        explicitSignOutRef.current = false;
        userRef.current = null;
        setUser(null);
        prefsLoadedForUidRef.current = null;
        setPendingWriteCount(0);
        setSubjects([]);
        setMaterials([]);
        setInteractions([]);
        setSavedResults([]);
      } else {
        explicitSignOutRef.current = false;
        userRef.current = currentUser;
        setUser(currentUser);
        try {
          const prefs = await getPreferences(currentUser.uid);
          if (prefs) {
            if (prefs.routingMode) setManualMode(prefs.routingMode);
            if (prefs.theme) syncThemeFromPreferences(prefs.theme);
            if (prefs.fontSize) setFontSize(prefs.fontSize);
            if (prefs.answerLength) setAnswerLength(prefs.answerLength);
            if (prefs.studyLanguage) setStudyLanguage(prefs.studyLanguage);
            if (prefs.dailyStudyGoal) setDailyGoal(prefs.dailyStudyGoal);
            if (prefs.remindersEnabled !== undefined) setReminders(prefs.remindersEnabled);
          }
          prefsLoadedForUidRef.current = currentUser.uid;
        } catch (e) {
          console.error("Error loading preferences:", e);
          prefsLoadedForUidRef.current = currentUser.uid;
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [syncThemeFromPreferences]);

  // Real-time Firestore sync with metadata.hasPendingWrites count tracking
  useEffect(() => {
    if (!user?.uid) {
      firestoreUnsubsRef.current = [];
      setPendingWriteCount(0);
      return;
    }

    let subPendingCount = 0;
    let matPendingCount = 0;
    let resPendingCount = 0;
    let intPendingCount = 0;

    const updateGlobalSync = () => {
      setPendingWriteCount(subPendingCount + matPendingCount + resPendingCount + intPendingCount);
    };

    const unsubSubjects = subscribeSubjects(user.uid, (list, _pending, pendingCount) => {
      setSubjects(list);
      subPendingCount = pendingCount;
      updateGlobalSync();
    });

    const unsubMaterials = subscribeMaterials(user.uid, (list, _pending, pendingCount) => {
      setMaterials(list);
      matPendingCount = pendingCount;
      updateGlobalSync();
    });

    const unsubResults = subscribeResults(user.uid, (list, _pending, pendingCount) => {
      setSavedResults(list);
      resPendingCount = pendingCount;
      updateGlobalSync();
    });

    const unsubInteractions = subscribeInteractions(user.uid, (list, _pending, pendingCount) => {
      setInteractions(list);
      intPendingCount = pendingCount;
      updateGlobalSync();
    });

    const unsubs = [unsubSubjects, unsubMaterials, unsubResults, unsubInteractions].filter(Boolean);
    firestoreUnsubsRef.current = unsubs;

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore unsubscribe error
        }
      });
      firestoreUnsubsRef.current = [];
    };
  }, [user?.uid]);

  // Sync online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save preferences changes to Firestore
  useEffect(() => {
    if (studyLanguage) {
      localStorage.setItem('studybridge_study_language', studyLanguage);
    }
    if (!user || prefsLoadedForUidRef.current !== user.uid) return;
    updatePreferences(user.uid, {
      routingMode: manualMode,
      theme,
      fontSize,
      answerLength,
      studyLanguage,
      dailyStudyGoal: dailyGoal,
      remindersEnabled: reminders
    }).catch(err => console.error("Error saving preferences:", err));
  }, [user, manualMode, theme, fontSize, answerLength, studyLanguage, dailyGoal, reminders]);

  const handleAddSubject = async (newSub: Omit<Subject, 'id'>) => {
    if (!user) return;
    return await addSubjectFirestore(user.uid, newSub);
  };

  const handleUpdateSubject = async (id: string, updates: Partial<Subject>) => {
    if (!user) return;
    await updateSubjectFirestore(user.uid, id, updates);
  };

  const handleDeleteSubject = async (id: string) => {
    if (!user) return;
    await deleteSubjectFirestore(user.uid, id);
  };

  const handleDeleteSubjectWithOptions = async (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => {
    if (!user) return;
    await deleteSubjectWithOptions(user.uid, id, action, targetSubjectId);
  };

  const handleMoveMaterial = async (materialId: string, newSubjectId: string) => {
    if (!user) return;
    await moveMaterialSubject(user.uid, materialId, newSubjectId);
  };

  const handleAddMaterial = async (newMat: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'status'>, pages: Page[]) => {
    if (!user) return;
    // Combine text and diagram notes from pages
    const content = pages.map(p => p.text).join('\n\n');
    await saveMaterialWithChunks(user.uid, newMat, content, pages);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!user) return;
    await deleteMaterialFirestore(user.uid, id);
    if (selectedMaterial?.id === id) {
      setSelectedMaterial(null);
    }
  };

  const handleAddInteraction = async (interaction: AIInteraction) => {
    if (!user) return;
    await addInteractionFirestore(user.uid, interaction);
  };

  const handleClearHistory = async () => {
    if (!user) return;
    await clearInteractionsFirestore(user.uid);
    setInteractions([]);
  };

  const handleExportData = () => {
    const data = {
      user: { uid: user?.uid, email: user?.email },
      subjects,
      materials,
      interactions,
      preferences: { manualMode, theme, fontSize, answerLength, studyLanguage, dailyGoal, reminders }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studybridge_export_${user?.uid || 'data'}.json`;
    a.click();
  };

  const handleDeleteAllData = async () => {
    if (!user) return;
    await handleClearHistory();
    for (const s of subjects) {
      await deleteSubjectFirestore(user.uid, s.id);
    }
    for (const m of materials) {
      await deleteMaterialFirestore(user.uid, m.id);
    }
  };

  const clearUserAppCaches = async () => {
    await clearAllMaterialPagesLocal();
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [
          'studybridge_subjects_v2',
          'studybridge_materials_v2',
          'studybridge_interactions_v2',
          'studybridge_manual_route_v2',
          'studybridge_study_language',
          'studybridge_drive_connected'
        ];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('result_') || k.startsWith('result_cache_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
      if (typeof sessionStorage !== 'undefined') {
        const sessionKeysToRemove: string[] = [
          'studybridge_instruction',
          'studybridge_toast',
          'google_drive_token',
          'studybridge_region_prompted'
        ];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (
            k &&
            (k.startsWith('studybridge_selected_mats_') ||
              k.startsWith('result_') ||
              k.startsWith('result_cache_'))
          ) {
            sessionKeysToRemove.push(k);
          }
        }
        sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
      }
    } catch (e) {
      console.warn('Could not clear local app storage caches:', e);
    }
  };

  const executeSignOut = async (shouldCleanCaches: boolean) => {
    setIsSigningOut(true);
    explicitSignOutRef.current = true;
    prefsLoadedForUidRef.current = null;
    try {
      if (shouldCleanCaches) {
        // Unsubscribe active listeners before terminating Firestore
        firestoreUnsubsRef.current.forEach((unsub) => {
          try {
            unsub();
          } catch {
            // ignore
          }
        });
        firestoreUnsubsRef.current = [];
        setSubjects([]);
        setMaterials([]);
        setInteractions([]);
        setSavedResults([]);
        setSelectedMaterial(null);
        setPendingWriteCount(0);

        await signOut(auth);
        await clearFirestoreLocalCacheOnSignOut();
        await clearUserAppCaches();
      } else {
        // Offline or unsynced items: skip cleanup and preserve local cache
        await signOut(auth);
      }
    } finally {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  const handleRequestSignOut = async () => {
    const currentlyOffline = (typeof navigator !== 'undefined' && !navigator.onLine) || !isOnline;
    if (currentlyOffline || pendingWriteCount > 0) {
      setSignOutOfflineAtPrompt(currentlyOffline);
      setSignOutPendingAtPrompt(pendingWriteCount);
      setIsSignOutModalOpen(true);
      return;
    }
    await executeSignOut(true);
  };

  const handleConfirmSignOut = async () => {
    const currentlyOffline = (typeof navigator !== 'undefined' && !navigator.onLine) || !isOnline;
    const shouldCleanCaches = !currentlyOffline && pendingWriteCount === 0;
    await executeSignOut(shouldCleanCaches);
  };

  // Compute stats strictly from logged-in user's interactions
  const stats: UserStats = interactions.reduce((acc, curr) => {
    acc.totalRequests += 1;
    if (curr.route === 'on-device') {
      acc.onDeviceCount += 1;
    } else {
      acc.cloudCount += 1;
    }
    acc.totalLatencyMs += curr.latencyMs;
    acc.totalDataSavedBytes += curr.dataSavedBytes;
    acc.totalBytesSent += (curr.bytesSent || 0);
    acc.totalBytesReceived += (curr.bytesReceived || 0);
    return acc;
  }, {
    totalRequests: 0,
    onDeviceCount: 0,
    cloudCount: 0,
    totalLatencyMs: 0,
    totalDataSavedBytes: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0
  });

  if (authLoading) {
    return (
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-accent)]" />
        </div>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!isOnline && user ? <Navigate to="/study" replace /> : <HomePage user={user} theme={theme} setTheme={setTheme} />} />
        <Route path="/login" element={!isOnline && user ? <Navigate to="/study" replace /> : <AuthScreen darkMode={isDark} />} />
        <Route path="/about" element={<AboutPage theme={theme} setTheme={setTheme} />} />
        <Route path="/privacy" element={<PrivacyPage theme={theme} setTheme={setTheme} />} />
        <Route path="/terms" element={<TermsPage theme={theme} setTheme={setTheme} />} />
        
        {/* Protected Routes Wrapper */}
        <Route path="/*" element={
          !user ? <Navigate to="/login" replace /> : (
            <div className={`min-h-screen bg-[var(--bg-app)] text-[var(--text)] flex flex-col font-sans transition-colors selection:bg-[var(--primary)] selection:text-[var(--primary-text)] ${fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-sm'}`}>
              <RegionExplanationModal
                isOpen={showRegionPrompt}
                onConfirm={handleConfirmRegionPrompt}
                isLoading={isCheckingRegion}
              />

              <Modal
                isOpen={isSignOutModalOpen}
                onClose={() => !isSigningOut && setIsSignOutModalOpen(false)}
                title="Sign out?"
                icon={<AlertTriangle className="w-5 h-5 text-[var(--warning)]" />}
                isConfirmation
                maxWidth="confirmation"
                isDestructiveActionRunning={isSigningOut}
                footer={
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSignOutModalOpen(false)}
                      disabled={isSigningOut}
                      className="bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSignOut}
                      disabled={isSigningOut}
                      className="bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] text-[var(--primary-text)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSigningOut && <Loader2 className="w-4 h-4 animate-spin" />}
                      Sign out anyway
                    </button>
                  </>
                }
              >
                <div className="space-y-2.5 text-sm leading-relaxed">
                  {signOutOfflineAtPrompt && (
                    <p className="text-[var(--text)]">
                      You&apos;re offline. If you sign out you can&apos;t sign back in until you&apos;re online.
                    </p>
                  )}
                  {signOutPendingAtPrompt > 0 && (
                    <p className="text-[var(--warning)] font-medium">
                      {signOutPendingAtPrompt} {signOutPendingAtPrompt === 1 ? "item hasn't" : "items haven't"} synced yet.
                    </p>
                  )}
                </div>
              </Modal>

              <Navbar
                user={user}
                manualMode={manualMode}
                setManualMode={setManualMode}
                onSignOut={handleRequestSignOut}
                hasPendingSync={hasPendingSync}
              />

              {!isOnline && (
                <div className="bg-[var(--warning-bg)] border-b border-[var(--warning-border)] text-[var(--warning)] px-4 py-2 text-xs font-medium">
                  <div className="max-w-[960px] mx-auto flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Offline mode: your saved material is available. New AI tasks need the cloud unless on-device AI is available.</span>
                  </div>
                </div>
              )}

              <main className="flex-1 pb-20 md:pb-12">
                <Routes>
                  <Route path="study" element={
                    <StudyDesk
                      subjects={subjects}
                      materials={materials}
                      manualMode={manualMode}
                      isOnline={isOnline}
                      answerLength={answerLength}
                      onAddInteraction={handleAddInteraction}
                      selectedMaterial={selectedMaterial}
                      clearSelectedMaterial={() => setSelectedMaterial(null)}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                      onAddSubject={handleAddSubject}
                      onUpdateSubject={handleUpdateSubject}
                      onDeleteSubjectWithOptions={handleDeleteSubjectWithOptions}
                      savedResults={savedResults}
                      onAddMaterial={handleAddMaterial}
                      isDeviceAiAvailable={isDeviceAiAvailable}
                      studyLanguage={studyLanguage}
                    />
                  } />
                  <Route path="materials" element={
                    <MaterialLibrary
                      materials={materials}
                      subjects={subjects}
                      onAddMaterial={handleAddMaterial}
                      onDeleteMaterial={handleDeleteMaterial}
                      onSelectMaterial={(mat) => setSelectedMaterial(mat)}
                      onAddSubject={handleAddSubject}
                      onUpdateSubject={handleUpdateSubject}
                      onDeleteSubjectWithOptions={handleDeleteSubjectWithOptions}
                      onMoveMaterial={handleMoveMaterial}
                      isDeviceAiAvailable={isDeviceAiAvailable}
                    />
                  } />
                  <Route path="results/:id" element={
                    <ResultPage
                      subjects={subjects}
                      materials={materials}
                      isOnline={isOnline}
                      onAddMaterial={handleAddMaterial}
                    />
                  } />
                  <Route path="analytics" element={
                    <Dashboard
                      stats={stats}
                      interactions={interactions}
                      subjects={subjects}
                      onNavigateDesk={() => {}}
                      onClearHistory={handleClearHistory}
                    />
                  } />
                  <Route path="profile" element={
                    <ProfilePage
                      user={user}
                      subjects={subjects}
                      materials={materials}
                      interactions={interactions}
                      stats={stats}
                    />
                  } />
                  <Route path="settings/*" element={
                    <SettingsPage
                      user={user}
                      manualMode={manualMode}
                      setManualMode={setManualMode}
                      theme={theme}
                      setTheme={setTheme}
                      fontSize={fontSize}
                      setFontSize={setFontSize}
                      answerLength={answerLength}
                      setAnswerLength={setAnswerLength}
                      studyLanguage={studyLanguage}
                      setStudyLanguage={setStudyLanguage}
                      dailyGoal={dailyGoal}
                      setDailyGoal={setDailyGoal}
                      reminders={reminders}
                      setReminders={setReminders}
                      onClearHistory={handleClearHistory}
                      onExportData={handleExportData}
                      onDeleteAllData={handleDeleteAllData}
                      onSignOut={handleRequestSignOut}
                      isDeviceAiAvailable={isDeviceAiAvailable}
                      deviceAiDetails={deviceAiDetails}
                      deviceAiStatus={deviceAiStatus}
                      browserName={browserName}
                      onRefreshDeviceAi={refreshDeviceAiCapability}
                    />
                  } />
                  <Route path="*" element={<Navigate to="/study" replace />} />
                </Routes>
              </main>
            </div>
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
