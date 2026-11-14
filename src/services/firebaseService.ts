import { initializeApp, getApps } from "firebase/app";
import { 
  getAuth, 
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
  initializeFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAI, GoogleAIBackend } from "firebase/ai";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from "firebase/app-check";
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig } from "firebase/remote-config";

export const firebaseConfig = {
  projectId: "centered-rope-494521-g9",
  appId: "1:543098383526:web:062de0805765e368f2d867",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB3YW5iqPobvPdGOXoGyRzIXQI-xfjNhlc",
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
export const auth = getAuth(app);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const googleProvider = new GoogleAuthProvider();

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

// Initialize Firebase App Check with ReCaptchaEnterpriseProvider
let appCheck: any = null;
try {
  if (typeof window !== 'undefined' && app) {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPreview = hostname.includes('run.app');
    const isDebugMode = isLocalhost || import.meta.env.VITE_APPCHECK_DEBUG === 'true';

    // Keep debug-token behavior on localhost or when VITE_APPCHECK_DEBUG is "true"
    if (isDebugMode && typeof self !== 'undefined') {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    // Initialize App Check on production (e.g. studydesk.up.railway.app) or when debug is requested/localhost.
    // In preview (run.app), bypass unless VITE_APPCHECK_DEBUG="true" to prevent 403 errors from unregistered tokens.
    const shouldInitialize = !isPreview || isDebugMode;
    if (shouldInitialize) {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6Lc-Dh8uAAAAAC8aF0lQhxsJph6qF8dO6FJfu_BK";
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
  }
} catch (e) {
  console.warn("App Check initialization warning:", e);
}

export async function checkAppCheckToken(): Promise<boolean> {
  if (isAppCheckInCooldown()) {
    return false;
  }
  if (!appCheck) return true; // Debug / bypass mode
  try {
    const tokenRes = await getToken(appCheck, false);
    if (!tokenRes || !tokenRes.token) {
      markAppCheckFailure();
      return false;
    }
    return true;
  } catch (err) {
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
export const ai = app ? getAI(app, { backend: new GoogleAIBackend() }) : null;
