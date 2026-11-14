# StudyBridge: Hybrid On-Device + Cloud AI Study Assistant

**Live demo:** https://studydesk.up.railway.app
**Demo video:** [YouTube link]
**Platform:** Web (Chrome), built with Firebase AI Logic hybrid inference
**License:** Apache-2.0

StudyBridge turns textbooks, lecture notes, slides, images and YouTube captions into summaries, explanations, quizzes, flashcards and answers. It runs short, private tasks on the student's own device when Gemini Nano is available, and hands long or complex tasks to the cloud. Saved study material stays available offline.

---

## The Problem

Many students study on slow, expensive or unreliable internet. Cloud-only AI study tools stop working when the connection drops, upload every note to a server, and use data on every request. In Rwanda and similar regions, these are everyday problems, not edge cases.

## The Solution

StudyBridge uses **Firebase AI Logic hybrid inference** to decide, per request, where the AI should run:

- **On the device (Gemini Nano)** for short, simple and private tasks: free, fast, works offline, and the text never leaves the computer.
- **In the cloud (Gemini)** for long documents, quizzes and flashcards, where quality matters more.
- **Saved material works offline everywhere.** Notes and generated results are cached with Firestore offline persistence and sync when the connection returns.

Every result shows where it actually ran and why, so the student always knows what was private and what used data.

---

## Features

| Area | What it does |
|---|---|
| Import | PDF, PPTX, images (OCR), pasted text, YouTube captions (needs internet) |
| AI actions | Summary, Explain Simply (3 levels), Quiz, Flashcards, Ask AI (free-form questions on selected sources) |
| Study Desk | Subjects, source selection, custom instruction box, saved results list |
| Offline | Saved material and results open offline, edits queue and sync later |
| Private subjects | Optional on-device-only mode, never falls back to the cloud |
| Transparency | Route badge, "why this route" line, data-saved meter, analytics |
| Accounts | Email/password sign-in, per-user data, export and delete |
| Product polish | Light/dark/system theme, responsive layout, installable PWA |

---

## How Firebase AI Logic Is Used

AI runs **in the browser** through the `firebase/ai` SDK. There is no server-side Gemini key and no AI proxy route.

### Where it is imported and called

| File | Role |
|---|---|
| `src/services/firebaseService.ts` | Initializes Firebase, Firestore with offline persistence, **App Check (reCAPTCHA Enterprise)**, Remote Config, and the `ai` instance (`getAI` with `GoogleAIBackend`) |
| `src/services/aiService.ts` | `determineRoute()` chooses the inference mode; `executeAIRequest()` calls `getGenerativeModel(ai, { mode, ... })` and `generateContentStream()`; on-device availability is detected without throwing |
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

The badge on each result shows the inference source reported by the SDK. If the SDK does not report one, the app shows the mode that was requested and a small note. It never labels a cloud request "On-device". If on-device AI is unavailable, Auto mode uses the cloud when online, and shows a friendly message when offline.

### Other Firebase products used

- **App Check** (reCAPTCHA Enterprise; debug tokens supported for local testing)
- **Remote Config** (router thresholds)
- **Firestore** (per-user data under `users/{uid}`, offline persistence, security rules in `firestore.rules`)
- **Authentication** (email/password)

---

## Offline Behavior

| Situation | What happens |
|---|---|
| Signed in, connection drops | Stays signed in. Saved subjects, materials and results open from the local cache. New edits show "Waiting to sync" and upload when back online. |
| Offline, short task, on-device AI available | Runs on-device. |
| Offline, task needs the cloud | Clear message: "You're offline. This needs the cloud. Saved material is still available." |
| Signed out, then offline | Sign-in needs internet. The login screen explains this. Public pages still load from the service worker cache. |
| Sign out | Warns if the device is offline or items have not synced. |

---

## Supported Browsers

| Browser | On-device AI (Gemini Nano) | Cloud AI | Offline study of saved material |
|---|---|---|---|
| Chrome, desktop, supported hardware | Yes, when the model is installed | Yes | Yes |
| Chrome, other devices (weak hardware, Android, iOS) | Not expected to work | Yes | Yes |
| Firefox, Safari, other browsers | No, falls back to cloud | Yes | Yes (browser storage limits apply) |
| Microsoft Edge | Not tested | Yes | Yes |

Chrome's on-device model needs capable hardware and a one-time download of several GB. Check `chrome://on-device-internals` for your device's performance class, and see the [Firebase hybrid inference docs](https://firebase.google.com/docs/ai-logic/hybrid) for current requirements.

---

## Setup Guide

### Prerequisites
- Node.js 20 or later
- A Firebase project with **AI Logic** enabled (Gemini Developer API), **Authentication** (email/password), **Firestore**, **App Check**, and **Remote Config**
- Desktop Chrome with Gemini Nano if you want to test the on-device path

### Steps
1. Clone and install:
   ```bash
   git clone [repo URL]
   cd [repo folder]
   npm install
   ```
2. Copy the environment template and fill in your own values (variable names are listed in `.env.example`; never commit `.env`):
   ```bash
   cp .env.example .env
   ```
3. In the Firebase console:
   - Enable **AI Logic** with the Gemini Developer API.
   - Create a **reCAPTCHA Enterprise** website key for your domain and `localhost`, register it under **App Check**, and set it as `VITE_RECAPTCHA_SITE_KEY`.
   - For local development, set `VITE_APPCHECK_DEBUG=true`, run the app, and register the debug token printed in the console under **App Check, Manage debug tokens**.
   - Create Firestore in `(default)` and publish `firestore.rules`.
   - Enable **Email/Password** and add your domain under **Authorized domains**.
4. Run locally:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```

### Optional features
- **YouTube captions** need the small Node endpoint in `server.ts` and a `FIREBASE_SERVICE_ACCOUNT` variable (server only).
- **Google Drive import** is limited to owner accounts while the OAuth consent screen is in Testing mode.

---

## Security and Privacy

- No Gemini API key exists in the client or server. AI calls go through Firebase AI Logic and are protected by App Check.
- Firestore rules allow each user to read and write only `users/{their uid}/...`.
- Users can export or delete all their data in Settings, Privacy & Data.
- The repository contains no secrets. Firebase web configuration values are public by design.

---

## How This Maps to the Judging Criteria

| Criterion | Where to look |
|---|---|
| **Technological implementation** | Browser-side `getGenerativeModel` with all four `InferenceMode` values, streaming, Remote Config thresholds, App Check, Firestore offline persistence, honest source reporting, Readiness panel (`/about`, owner only) |
| **Design** | Complete product: accounts, subjects, import, saved library, quiz and flashcard viewers, themes, responsive layout, installable PWA |
| **Potential impact** | Students on slow or costly internet: offline study, private on-device mode, lower data use |
| **Quality of the idea** | The router decides what needs the cloud and shows its reasoning, instead of treating on-device AI as a hidden fallback |

---

## What Was Built During the Competition

The project was created and developed during the submission period (Nov 11 to Nov 30, 2026), using Google AI Studio for code generation, with manual configuration and testing. Built during this period:

- The whole application: authentication, per-user Firestore data, import pipeline, AI actions, quiz and flashcard viewers, library, analytics, settings, theming, PWA setup
- Firebase AI Logic hybrid routing, App Check, Remote Config and the Readiness panel
- Offline persistence, sync status and sign-out safeguards

Third-party libraries (React, Tailwind CSS, pdf.js, Tesseract.js, KaTeX and others) are used under their own open-source licenses. [List any other pre-existing code or assets, or write "None".]

---

## Known Limitations

- On-device inference needs capable desktop hardware. Where it is unavailable, the app uses the cloud when online and says so.
- Gemini Nano is smaller than the cloud model, so on-device answers are shorter and simpler. Quizzes and flashcards prefer the cloud for that reason.
- The cloud model currently used is `[model name from aiService.ts]`. Preview models can change.
- YouTube import works only for videos that have captions and needs internet.
- Signing in always needs an internet connection. Offline use requires an existing session on the device.

---

## License

Licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
