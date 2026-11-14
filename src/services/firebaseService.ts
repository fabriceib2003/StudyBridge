import { initializeApp, getApps } from "firebase/app";
import { 
  Auth,
  getAuth, 
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  setPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  Firestore,
  initializeFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager,
  terminate,
  clearIndexedDbPersistence
} from "firebase/firestore";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from "firebase/app-check";
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig } from "firebase/remote-config";

export const firebaseConfig = {
  projectId: "centered-rope-494521-g9",
  appId: "1:543098383526:web:062de0805765e368f2d867",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "centered-rope-494521-g9.firebaseapp.com"
};

// Initialize Firebase App safely
let app: any = null;
try {
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
  } else {
    app = initializeApp({
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId,
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain
    });
  }
} catch (e) {
  console.error("Firebase app init error:", e);
}

export { app };

// App Check failure cooldown tracking (10-second cooldown per Task 2)
let appCheckCooldownUntil = 0;
const APP_CHECK_FRIENDLY_ERROR = "Security verification (App Check) is temporarily unavailable. Please wait 10 seconds before trying again.";

export function isAppCheckInCooldown(): boolean {
  return Date.now() < appCheckCooldownUntil;
}

export function getAppCheckErrorMessage(): string {
  return APP_CHECK_FRIENDLY_ERROR;
}

export function markAppCheckFailure(): void {
  appCheckCooldownUntil = Date.now() + 10000;
}

export type AppCheckMode =
  | 'recaptcha_enterprise'
  | 'debug'
  | 'skipped'
  | 'missing_site_key'
  | 'init_error';

export interface AppCheckDiagnostics {
  hostname: string;
  inIframe: boolean;
  mode: AppCheckMode;
  modeLabel: string;
  statusLabel: string;
  statusKind: 'active' | 'skipped' | 'missing_key' | 'failed';
  tokenObtained: boolean;
  tokenExpiresAt: number | null;
}

function formatShortAppCheckError(err: unknown): string {
  const raw =
    (err as any)?.code ||
    (err as any)?.message ||
    String(err || 'Unknown error');
  const cleaned = String(raw)
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^AppCheck:\s*/i, '')
    .trim();
  return cleaned.length > 60 ? cleaned.slice(0, 57) + '...' : cleaned;
}

function parseJwtExpiryMillis(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    // Ignore malformed JWT
  }
  return null;
}

// Initialize Firebase App Check with ReCaptchaEnterpriseProvider BEFORE Auth and Firestore
let appCheck: any = null;
const appCheckContext: {
  hostname: string;
  inIframe: boolean;
  mode: AppCheckMode;
  modeLabel: string;
  initError: string | null;
} = {
  hostname: typeof window !== 'undefined' ? window.location.hostname : '',
  inIframe: false,
  mode: 'skipped',
  modeLabel: 'Skipped (local or AI Studio preview only)',
  initError: null
};

try {
  if (typeof window !== 'undefined' && app) {
    const hostname = window.location.hostname;
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }

    appCheckContext.hostname = hostname;
    appCheckContext.inIframe = inIframe;

    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isAiStudioPreviewIframe = hostname.endsWith('.run.app') && inIframe;
    const isDebugFlag = import.meta.env.VITE_APPCHECK_DEBUG === 'true';
    const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

    if (isLocalhost || isDebugFlag) {
      if (typeof self !== 'undefined') {
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      console.info(
        '[App Check] Debug token flow enabled. Register the printed App Check debug token in Firebase Console > App Check.'
      );
      appCheckContext.mode = 'debug';
      appCheckContext.modeLabel = 'Debug token';
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey || 'debug-token-only'),
        isTokenAutoRefreshEnabled: true
      });
    } else if (isAiStudioPreviewIframe) {
      appCheckContext.mode = 'skipped';
      appCheckContext.modeLabel = 'Skipped (AI Studio preview iframe)';
      appCheck = null;
    } else if (!siteKey) {
      appCheckContext.mode = 'missing_site_key';
      appCheckContext.modeLabel = 'reCAPTCHA Enterprise (missing site key)';
      appCheckContext.initError = 'VITE_RECAPTCHA_SITE_KEY is missing';
      appCheck = null;
    } else {
      appCheckContext.mode = 'recaptcha_enterprise';
      appCheckContext.modeLabel = 'reCAPTCHA Enterprise';
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
  }
} catch (e) {
  const shortErr = formatShortAppCheckError(e);
  appCheckContext.mode = 'init_error';
  appCheckContext.modeLabel = 'Initialization failed';
  appCheckContext.initError = shortErr;
  console.warn("App Check initialization warning:", e);
}

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  authInstance = getAuth(app);
  setPersistence(authInstance, indexedDBLocalPersistence)
    .catch(() => setPersistence(authInstance, browserLocalPersistence))
    .catch((err) => console.warn("Auth persistence setup warning:", err));
}

export const auth = authInstance;

function createFirestoreInstance(): Firestore {
  return initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
}

// Initialize Firestore with offline persistence
export let db: Firestore = createFirestoreInstance();

/**
 * Terminates Firestore and wipes its IndexedDB persistence cache on confirmed
 * online sign-out, then re-initializes a clean Firestore instance for future logins.
 */
export async function clearFirestoreLocalCacheOnSignOut(): Promise<void> {
  const currentDb = db;
  try {
    await terminate(currentDb);
  } catch (err) {
    console.warn("Firestore terminate warning:", err);
  }
  try {
    await clearIndexedDbPersistence(currentDb);
  } catch (err) {
    console.warn("Firestore clearIndexedDbPersistence warning:", err);
  }
  try {
    db = createFirestoreInstance();
  } catch (err) {
    console.warn("Firestore re-initialize warning:", err);
  }
}

export const googleProvider = new GoogleAuthProvider();

export function isAppCheckActive(): boolean {
  return Boolean(appCheck);
}

export async function getAppCheckDiagnostics(): Promise<AppCheckDiagnostics> {
  const base = {
    hostname: appCheckContext.hostname || '(unknown)',
    inIframe: appCheckContext.inIframe,
    mode: appCheckContext.mode,
    modeLabel: appCheckContext.modeLabel
  };

  if (appCheckContext.mode === 'skipped') {
    return {
      ...base,
      statusLabel: 'Skipped (local or AI Studio preview only)',
      statusKind: 'skipped',
      tokenObtained: false,
      tokenExpiresAt: null
    };
  }

  if (appCheckContext.mode === 'missing_site_key') {
    return {
      ...base,
      statusLabel: 'Missing site key',
      statusKind: 'missing_key',
      tokenObtained: false,
      tokenExpiresAt: null
    };
  }

  if (appCheckContext.mode === 'init_error' || !appCheck) {
    return {
      ...base,
      statusLabel: `Failed: ${appCheckContext.initError || 'Not initialized'}`,
      statusKind: 'failed',
      tokenObtained: false,
      tokenExpiresAt: null
    };
  }

  try {
    const tokenRes = await getToken(appCheck, false);
    if (tokenRes && tokenRes.token) {
      const expiresAt = parseJwtExpiryMillis(tokenRes.token);
      return {
        ...base,
        statusLabel:
          appCheckContext.mode === 'debug'
            ? 'Active (debug token)'
            : 'Active (reCAPTCHA Enterprise)',
        statusKind: 'active',
        tokenObtained: true,
        tokenExpiresAt: expiresAt
      };
    }
    return {
      ...base,
      statusLabel: 'Failed: Empty token returned',
      statusKind: 'failed',
      tokenObtained: false,
      tokenExpiresAt: null
    };
  } catch (err) {
    return {
      ...base,
      statusLabel: `Failed: ${formatShortAppCheckError(err)}`,
      statusKind: 'failed',
      tokenObtained: false,
      tokenExpiresAt: null
    };
  }
}

export async function getAppCheckStatus(): Promise<AppCheckDiagnostics['statusKind']> {
  const diag = await getAppCheckDiagnostics();
  return diag.statusKind;
}

export async function checkAppCheckToken(): Promise<boolean> {
  if (isAppCheckInCooldown()) {
    return false;
  }
  if (appCheckContext.mode === 'skipped') {
    return true;
  }
  if (!appCheck) {
    return false;
  }
  try {
    const tokenRes = await getToken(appCheck, false);
    if (!tokenRes || !tokenRes.token) {
      markAppCheckFailure();
      return false;
    }
    return true;
  } catch {
    markAppCheckFailure();
    return false;
  }
}

// Initialize Remote Config
export let remoteConfig: RemoteConfig | null = null;
try {
  remoteConfig = getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.PROD ? 3600000 : 0; // 1 hour in production, 0 in dev
  remoteConfig.defaultConfig = {
    short_text_limit: 800,
    long_document_limit: 4000,
    default_routing_mode: 'auto'
  };
  fetchAndActivate(remoteConfig).catch(err => console.warn("Remote config fetch warning:", err));
} catch (e) {
  console.warn("Remote config init warning:", e);
}

export function getRemoteConfigValue(key: string, defaultValue: any): any {
  if (!remoteConfig) return defaultValue;
  try {
    const val = getValue(remoteConfig, key);
    if (val && val.asString()) {
      const str = val.asString();
      if (!isNaN(Number(str))) return Number(str);
      return str;
    }
  } catch {}
  return defaultValue;
}

// Initialize Firebase AI Logic with Gemini Developer API backend
export const ai = app
  ? getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: true
    })
  : null;
