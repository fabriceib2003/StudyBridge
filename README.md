# StudyBridge: Hybrid On-Device + Cloud AI Study Assistant

| | |
|---|---|
| **Live app** | https://studybridge-app.up.railway.app |
| **Demo video** | https://youtu.be/IiJdGPegnmc |
| **Code** | https://github.com/fabriceib2003/StudyDesk-app |
| **Platform** | Web (Chrome), built with Firebase AI Logic hybrid inference |
| **License** | Apache-2.0 |
| **Built for** | #BuildHybridAI 2026 |

StudyBridge turns textbooks, lecture notes, slides, images and YouTube captions into summaries, explanations, quizzes, flashcards and answers. A router decides, for each request, whether the AI runs on the student's own device (Gemini Nano, where Chrome supports it) or in the cloud, and every result shows where it ran and why. Saved study material stays available offline.

---

## The Problem

Many students study on slow, expensive or unreliable internet. Cloud-only AI study tools stop working when the connection drops, upload every note to a server, and use data on every request. In Rwanda and similar regions these are everyday conditions.

## The Solution

StudyBridge uses **Firebase AI Logic hybrid inference** to choose, per request, where the AI runs:

- **On the device (Gemini Nano)** for short, simple and private tasks: free, fast, works offline, and the text never leaves the computer.
- **In the cloud (Gemini)** for long documents, quizzes and flashcards, where quality matters more.
- **Saved material works offline on every browser.** Notes and generated results are cached with Firestore offline persistence and sync when the connection returns.

Each result carries a label showing the inference source and a "why this route" line, so the student knows what stayed private and what used data.

---

## Demo Video

Watch it here: https://youtu.be/IiJdGPegnmc

The video shows the app running on Chrome with the live deployment: importing a PDF, generating a summary, explanation, quiz and flashcards, the routing labels, offline mode (saved results still open, sign-out warning, clear message when a task needs the cloud), subjects and analytics.

**Honest note about the recording:** it was recorded on a laptop where Chrome's on-device model was not usable, so AI requests in the video run through the cloud path of Firebase AI Logic, or show the "on-device AI unavailable" behavior. The routing code for the on-device path is in the repository (see below).

---

## Features

| Area | What it does |
|---|---|
| Import | PDF, PPTX, images (OCR), pasted text, YouTube captions (needs internet) |
| AI actions | Summary, Explain Simply (3 levels), Quiz, Flashcards, Ask AI (questions on selected sources), follow-up questions on any result |
| Study Desk | Subjects with colors, source selection, custom instruction box, saved results with filters and pagination |
| Materials | Subjects shown as folders, materials inside, paginated |
| Offline | Saved material and results open offline, edits queue and sync later |
| Private subjects | Optional on-device-only mode that never falls back to the cloud |
| Transparency | Route badge, "why this route" line, data-saved meter, analytics |
| Accounts | Email/password and Google sign-in, per-user data, export and delete |
| Product polish | Light/dark/system theme, responsive layout, installable PWA, public About, Privacy and Terms pages |

---

## How Firebase AI Logic Is Used

AI runs **in the browser** through the `firebase/ai` SDK. There is no server-side Gemini key and no AI proxy route.

### Where it is imported and called

| File | Role |
|---|---|
| `src/services/firebaseService.ts` | Initializes Firebase, Firestore with offline persistence, **App Check (reCAPTCHA Enterprise)**, Remote Config, and the `ai` instance (`getAI` with `GoogleAIBackend`) |
| `src/services/aiService.ts` | `determineRoute()` chooses the inference mode; `executeAIRequest()` calls `getGenerativeModel(ai, { mode, ... })` and `generateContentStream()`; on-device availability is detected with `LanguageModel.availability()` without throwing |
| `src/components/AboutPage.tsx` | Owner-only Readiness panel that runs a real AI Logic call, shows the inference source and the raw on-device availability value, and reports App Check state |

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

The badge on each result shows the inference source reported by the SDK. If the SDK does not report one, the app shows the mode that was requested and a small note. A cloud request is never labeled "On-device". If on-device AI is unavailable, Auto mode uses the cloud when online and shows a friendly message when offline.

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
| Offline, task needs the cloud | Clear message: "You're offline. This needs the cloud. Saved material is still available." |
| Signed out, then offline | Sign-in needs internet. The login screen explains this. Public pages load from the service worker cache. |
| Sign out | Warns if the device is offline or items have not synced. |

---

## Supported Browsers

| Browser | On-device AI (Gemini Nano) | Cloud AI | Offline study of saved material |
|---|---|---|---|
| Chrome, desktop, supported hardware with the model installed | Yes | Yes | Yes |
| Chrome, other devices (weak hardware, Android, iOS) | Not expected to work | Yes | Yes |
| Firefox, Safari, other browsers | No, falls back to cloud | Yes | Yes (browser storage limits apply) |
| Microsoft Edge | Not tested | Yes | Yes |

Chrome's on-device model needs capable hardware and a one-time download of several GB. Check `chrome://on-device-internals` for your device's status, and see the [Firebase hybrid inference docs](https://firebase.google.com/docs/ai-logic/hybrid) for current requirements.

---

## Try It (For Judges)

1. Open https://studybridge-app.up.railway.app in Chrome.
2. Sign in with the test account given in the Devpost testing instructions (credentials are not stored in this repository), or create your own account.
3. Open the Study Desk, pick a subject with sample material, and run Summarize, Explain Simply, Quiz or Flashcards.
4. Read the route badge and the "why this route" line on each result.
5. To see offline behavior: after loading the app, turn on airplane mode, then open a saved result. Reconnect afterwards.

On a computer without Gemini Nano, requests go to the cloud and are labeled that way.

---

## Setup Guide

### Prerequisites
- Node.js 20 or later
- A Firebase project with **AI Logic** (Gemini Developer API), **Authentication**, **Firestore**, **App Check** and **Remote Config** enabled
- Desktop Chrome with Gemini Nano if you want to test the on-device path

### Environment variables

Copy `.env.example` to `.env` for local development. On a host such as Railway, set the same names in the service's Variables panel and redeploy, because Vite reads `VITE_` values at build time. Never commit `.env`.

| Variable | Where it runs | Required | Purpose |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Browser (public) | Yes | Firebase web API key used for Auth, Firestore and AI Logic |
| `VITE_RECAPTCHA_SITE_KEY` | Browser (public) | Yes, production | reCAPTCHA Enterprise site key registered in Firebase App Check |
| `VITE_APPCHECK_DEBUG` | Browser | No | Set `true` only for local development to print an App Check debug token. Keep `false` in production |
| `VITE_GOOGLE_API_KEY` | Browser (public) | Drive import only | Google API key restricted to the Picker and Drive APIs |
| `VITE_GOOGLE_CLIENT_ID` | Browser (public) | Drive import only | OAuth web client ID |
| `VITE_GOOGLE_PROJECT_NUMBER` | Browser (public) | Drive import only | Google Cloud project number used by the Picker |
| `FIREBASE_SERVICE_ACCOUNT` | Server only (secret) | YouTube captions only | Service account JSON used by `server.ts` to verify user tokens |

No Gemini API key is needed, because AI runs through Firebase AI Logic. Do not add a `VITE_` prefix to any secret.

The Firebase `projectId`, `appId` and `authDomain` are set in `src/services/firebaseService.ts`. If you fork the project, replace them with your own Firebase web app's values.

### Steps
1. Clone and install:
   ```bash
   git clone https://github.com/fabriceib2003/StudyDesk-app.git
   cd StudyDesk-app
   npm install --legacy-peer-deps
   ```
2. Create `.env` from `.env.example` and fill in your own values.
3. In the Firebase console:
   - Enable **AI Logic** with the Gemini Developer API.
   - Create a **reCAPTCHA Enterprise** website key for your domain and `localhost`, register it under **App Check**, and set it as `VITE_RECAPTCHA_SITE_KEY`.
   - For local development set `VITE_APPCHECK_DEBUG=true`, run the app, and register the debug token printed in the browser console under **App Check, Manage debug tokens**. Keep that token private and delete it when finished.
   - Create Firestore in `(default)` and publish `firestore.rules`.
   - Enable **Email/Password** (and Google) and add your domain under **Authorized domains**.
4. Run locally:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```

### Optional features
- **YouTube captions** need the Node endpoint in `server.ts` and the `FIREBASE_SERVICE_ACCOUNT` variable (server only). They work only for videos that have captions.
- **Google Drive import** is limited to the owner account while the OAuth consent screen is in Testing mode.

---

## Security and Privacy

- No Gemini API key exists in the client or server. AI calls go through Firebase AI Logic and are protected by App Check.
- Firestore rules allow each user to read and write only `users/{their uid}/...`.
- Users can export or delete all their data in Settings, Privacy & Data.
- Google Drive access uses only the `drive.file` scope for files the user picks. Files and tokens are not stored after extraction.
- The repository contains no secrets. Firebase web configuration values are public by design.
- Privacy Policy, Terms of Service and About pages are public at `/privacy`, `/terms` and `/about`.

---

## How This Maps to the Judging Criteria

| Criterion | Where to look |
|---|---|
| **Technological implementation** | Browser-side `getGenerativeModel` with all four `InferenceMode` values, streaming, Remote Config thresholds, App Check, Firestore offline persistence, honest source reporting, owner Readiness panel at `/about` |
| **Design** | A complete product: accounts, subjects, import, saved results, quiz and flashcard viewers, folders, themes, responsive layout, installable PWA |
| **Potential impact** | Students on slow or costly internet: offline study, private on-device mode, lower data use |
| **Quality of the idea** | The router decides what needs the cloud and explains its choice, instead of hiding on-device AI as a silent fallback |

---

## What Was Built During the Competition

The project was created and developed during the submission period (Nov 11 to Nov 30, 2026), using Google AI Studio for code generation, with manual configuration, debugging and testing. Built during this period:

- The whole application: authentication, per-user Firestore data, import pipeline, AI actions, quiz and flashcard viewers, results list, materials folders, analytics, settings, theming and PWA setup
- Firebase AI Logic hybrid routing, App Check, Remote Config and the Readiness panel
- Offline persistence, sync status and sign-out safeguards
- Public About, Privacy and Terms pages

Third-party libraries (React, Tailwind CSS, pdf.js, Tesseract.js, KaTeX and others) are used under their own open-source licenses. No other pre-existing code or assets were used.

---

## Known Limitations

- On-device inference needs Chrome with Gemini Nano installed on capable desktop hardware. Where it is unavailable, the app uses the cloud when online and says so. The demo video was recorded on a machine where the cloud path ran.
- Gemini Nano is smaller than the cloud model, so on-device answers are shorter and simpler. Quizzes and flashcards prefer the cloud for that reason.
- The cloud model currently used is `[model name from aiService.ts]`. Preview models can change.
- YouTube import works only for videos with captions and needs internet.
- Signing in needs an internet connection. Offline use requires an existing session on the device.

---

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
