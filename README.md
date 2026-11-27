# StudyBridge: Hybrid On-Device + Cloud AI Study Assistant

**Live app:** https://studybridge-app.up.railway.app
**Demo video (YouTube):** https://youtu.be/KSLwzlMFIb0
**Code:** https://github.com/fabriceib2003/StudyBridge.git
**Platform:** Web (Chrome), built with Firebase AI Logic hybrid inference
**License:** Apache-2.0
**Built for:** #BuildHybridAI 2026

StudyBridge turns textbooks, lecture notes, slides, images and YouTube captions into summaries, explanations, quizzes, flashcards and answers. A router decides, per request, whether the AI runs on the student's own device (Gemini Nano, where Chrome supports it) or in the cloud (Gemini), and every result shows where it ran and why. Saved study material stays available offline and syncs when the connection returns.

---

## For Judges: Quick Start

1. Open https://studybridge-app.up.railway.app in desktop Chrome.
2. Sign in with the demo account. **The credentials are in the Devpost "Testing instructions" field.**
3. The demo account already contains a subject with study material. Open **Study Desk**, tick a source, and run **Explain Simply**, **Summarize**, **5-Q Quiz Arena** or **Flashcards**.
4. Check the route badge and the "Why this route" line on each result.
5. To see offline behavior, open DevTools, Network, set **Offline**, and open a saved result. Saved material, quizzes and flashcards still work. New AI tasks show a clear message when they need the cloud.
6. Watch the 3-minute demo: https://youtu.be/IiJdGPegnmc

Notes for testing:
- Google Drive import is limited to the owner account while the Google OAuth consent screen is in Testing mode. Upload files, paste text or use a YouTube link instead.
- On-device inference requires Chrome with Gemini Nano installed on capable hardware. On other devices, StudyBridge uses the cloud when online. See **Known Limitations**.

---

## The Problem

Many students study on slow, expensive or unreliable internet. Cloud-only AI study tools stop working when the connection drops, upload every note to a server, and use data on every request. In Rwanda and similar regions, this is an everyday problem.

## The Solution

StudyBridge uses **Firebase AI Logic hybrid inference** to decide where each request runs:

- **On the device (Gemini Nano)** for short, simple and private tasks: free, fast, works offline, and the text never leaves the computer.
- **In the cloud (Gemini)** for long documents, quizzes and flashcards, where quality matters more.
- **Saved material works offline everywhere**, through Firestore offline persistence and a service worker.

Every result shows the source that actually answered and the reason for the choice, so students know what was private and what used data.

---

## Features

| Area | What it does |
|---|---|
| Import | PDF, PPTX, images (OCR), pasted text, YouTube captions (needs internet). Google Drive for owner accounts. |
| AI actions | Summary, Explain Simply (3 levels), Quiz, Flashcards, Ask AI (free-form questions on selected sources) |
| Study Desk | Subjects with colors, source selection, custom instruction box, saved results with filters and pagination |
| Materials | Subjects shown as folders, with their materials inside |
| Offline | Saved material and results open offline, edits queue and sync later |
| Private subjects | Optional on-device-only mode that never falls back to the cloud |
| Transparency | Route badge, "why this route" line, data-saved meter, analytics |
| Accounts | Email/password and Google sign-in, per-user data, export and delete |
| Product polish | Light/dark/system theme, responsive layout, installable PWA |

---

## How Firebase AI Logic Is Used

AI runs **in the browser** through the `firebase/ai` SDK. There is no server-side Gemini key and no AI proxy route.

### Where it is imported and called

| File | Role |
|---|---|
| `src/services/firebaseService.ts` | Initializes Firebase, Firestore with offline persistence, **App Check (reCAPTCHA Enterprise)**, Remote Config, and the `ai` instance (`getAI` with `GoogleAIBackend`) |
| `src/services/aiService.ts` | `determineRoute()` chooses the inference mode. `executeAIRequest()` calls `getGenerativeModel(ai, { mode, ... })` and `generateContentStream()`. On-device availability is detected without throwing. |
| `src/components/AboutPage.tsx` | Owner-only Readiness panel that runs a real AI Logic call, shows the inference source, and reports App Check state |

### Hybrid routing table

| Condition | Rule | `InferenceMode` |
|---|---|---|
| Device offline | On-device only | `ONLY_ON_DEVICE` |
| Private subject or "Force On-device" | On-device only | `ONLY_ON_DEVICE` |
| "Force Cloud" | Cloud only | `ONLY_IN_CLOUD` |
| Auto, short or simple input | Prefer on-device | `PREFER_ON_DEVICE` |
| Auto, long document, quiz, flashcards | Prefer cloud | `PREFER_IN_CLOUD` |

Router thresholds (short-text limit, long-document limit, default mode) come from **Firebase Remote Config**, with in-code defaults if it is unavailable.

### Honest labeling

The badge on each result shows the inference source reported by the SDK. If the SDK does not report one, the app shows the requested mode and a small note. It never labels a cloud request "On-device". When on-device AI is unavailable, Auto mode uses the cloud if online, and shows a clear message if offline.

### Other Firebase products used

- **App Check** (reCAPTCHA Enterprise; debug tokens for local development)
- **Remote Config** (router thresholds)
- **Firestore** (per-user data under `users/{uid}`, offline persistence, rules in `firestore.rules`)
- **Authentication** (email/password and Google)

---

## Offline Behavior

| Situation | What happens |
|---|---|
| Signed in, connection drops | Stays signed in. Saved subjects, materials and results open from the local cache. New edits show "Waiting to sync" and upload when back online. |
| Offline, short task, on-device AI available | Runs on-device. |
| Offline, task needs the cloud | Message: "You're offline. This needs the cloud. Saved material is still available." |
| Sign out while offline | A warning explains you cannot sign back in until you are online. |
| Signed out, then offline | Sign-in needs internet. Public pages still load from the service worker cache. |

---

## Supported Browsers

| Browser | On-device AI (Gemini Nano) | Cloud AI | Offline study of saved material |
|---|---|---|---|
| Chrome, desktop, supported hardware | Yes, when the model is installed and stable | Yes | Yes |
| Chrome, other devices (weak hardware, Android, iOS) | Not expected to work | Yes | Yes |
| Firefox, Safari, other browsers | No, falls back to cloud | Yes | Yes (browser storage limits apply) |
| Microsoft Edge | Not tested | Yes | Yes |

Chrome's on-device model needs capable hardware and a one-time download of several GB. See the [Firebase hybrid inference docs](https://firebase.google.com/docs/ai-logic/hybrid) for current requirements.

---

## Environment Variables

Copy `.env.example` to `.env` for local development. On a host such as Railway, set the same names in the service's Variables panel and redeploy, because Vite reads `VITE_` values at build time. Never commit `.env`.

| Variable | Where it runs | Required | Purpose |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Browser (public) | Yes | Firebase web API key for Auth, Firestore and AI Logic |
| `VITE_RECAPTCHA_SITE_KEY` | Browser (public) | Yes, production | reCAPTCHA Enterprise site key registered in Firebase App Check |
| `VITE_APPCHECK_DEBUG` | Browser | No | `true` only for local development, to print an App Check debug token. Keep `false` in production |
| `VITE_GOOGLE_API_KEY` | Browser (public) | Only for Drive import | Google API key restricted to the Picker and Drive APIs |
| `VITE_GOOGLE_CLIENT_ID` | Browser (public) | Only for Drive import | OAuth web client ID |
| `VITE_GOOGLE_PROJECT_NUMBER` | Browser (public) | Only for Drive import | Google Cloud project number used by the Picker |
| `FIREBASE_SERVICE_ACCOUNT` | Server only (secret) | Only for YouTube captions | Service account JSON used by `server.ts` to verify user tokens |

No Gemini API key is needed, because AI runs through Firebase AI Logic. Never add a `VITE_` prefix to a secret.

The Firebase `projectId`, `appId` and `authDomain` are set in `src/services/firebaseService.ts`. If you fork the project, replace them with your own Firebase web app's config.

---

## Setup Guide

### Prerequisites
- Node.js 20 or later
- A Firebase project with **AI Logic** (Gemini Developer API), **Authentication**, **Firestore**, **App Check** and **Remote Config**
- Desktop Chrome with Gemini Nano if you want to test the on-device path

### Steps
1. Clone and install:
   ```bash
   git clone [GitHub repo URL]
   cd [repo folder]
   npm install --legacy-peer-deps
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env
   ```
3. In the Firebase console:
   - Enable **AI Logic** with the Gemini Developer API.
   - Create a **reCAPTCHA Enterprise** website key for your domain and `localhost`, register it under **App Check**, and set it as `VITE_RECAPTCHA_SITE_KEY`.
   - For local development, set `VITE_APPCHECK_DEBUG=true`, run the app, and register the debug token printed in the console under **App Check, Manage debug tokens**.
   - Create Firestore in `(default)` and publish `firestore.rules`.
   - Enable **Email/Password** and add your domain under **Authorized domains**.
4. Run locally with `npm run dev`, or build with `npm run build`.

### Optional features
- **YouTube captions** need the Node endpoint in `server.ts` and `FIREBASE_SERVICE_ACCOUNT` (server only).
- **Google Drive import** works for owner accounts while the OAuth consent screen is in Testing mode.

---

## Security and Privacy

- No Gemini API key exists in the client or the server. AI calls go through Firebase AI Logic and are protected by App Check.
- Firestore rules let each user read and write only `users/{their uid}/...`.
- Users can export or delete all their data in Settings, Privacy & Data.
- The repository contains no secrets. Firebase web configuration values are public by design.
- Privacy Policy: `/privacy`. Terms: `/terms`. About: `/about`.

---

## How This Maps to the Judging Criteria

| Criterion | Where to look |
|---|---|
| **Technological implementation** | Browser-side `getGenerativeModel` with all four `InferenceMode` values, streaming, Remote Config thresholds, App Check, Firestore offline persistence, honest source reporting |
| **Design** | A complete product: accounts, subjects and folders, import, saved results, quiz and flashcard viewers, themes, responsive layout, installable PWA |
| **Potential impact** | Students on slow or costly internet: offline study, a private on-device mode, lower data use |
| **Quality of the idea** | The router decides what needs the cloud and shows its reasoning, instead of hiding on-device AI as a fallback |

---

## What Was Built During the Competition

The project was created and developed during the submission period (Nov 11 to Nov 30, 2026), using Google AI Studio for code generation, with manual configuration, debugging and testing. Built during this period:

- The whole application: authentication, per-user Firestore data, import pipeline, AI actions, quiz and flashcard viewers, saved results, folders, analytics, settings, theming, PWA setup
- Firebase AI Logic hybrid routing, App Check, Remote Config and the Readiness panel
- Offline persistence, sync status and sign-out safeguards

Third-party libraries (React, Tailwind CSS, pdf.js, Tesseract.js, KaTeX and others) are used under their own open-source licenses. Pre-existing code: [none / list].

---

## Known Limitations

- On-device inference needs capable desktop hardware and a stable Gemini Nano install. During development, Chrome on the recording machine reported the model process crashing, so the demo video shows the cloud path and the offline behavior of saved material. Where on-device AI is unavailable, the app uses the cloud when online and says so.
- Gemini Nano is smaller than the cloud model, so on-device answers are shorter and simpler. Quizzes and flashcards prefer the cloud for that reason.
- The cloud model currently used is `[model name from aiService.ts]`. Preview models can change.
- YouTube import works only for videos with captions and needs internet.
- Signing in needs an internet connection. Offline use requires an existing session on the device.

---

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
