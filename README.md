# StudyBridge: Offline-First AI Study Assistant

## What StudyBridge Is & Its Value
StudyBridge is a progressive, offline-first AI study companion designed to empower students and researchers to transform textbooks, lecture notes, PDFs, and YouTube videos into structured summaries, interactive Q&A, adaptive quizzes, and spaced-repetition flashcards. 

### Core Value Proposition
- **Privacy-First On-Device AI:** Runs locally on browser-supported Gemini Nano models via Firebase AI Logic so sensitive notes never leave your device.
- **Robust Cloud Fallback & Hybrid Routing:** Automatically scales to cloud models (`gemini-2.5-flash`) via Firebase AI Logic for complex multi-page synthesis, quizzes, and flashcards.
- **Offline Resilience:** Fully operational offline with IndexedDB caching and persistent Firestore synchronization.

---

## How Firebase AI Logic Is Used

Firebase AI Logic is integrated directly in the browser via `firebase/ai` SDK.

### Key Files and Functions
1. **`src/services/firebaseService.ts`**:
   - Initializes Firebase App, Firestore (with offline persistence), App Check (`ReCaptchaV3Provider`), and Remote Config.
   - Exports `ai` instance initialized with `new GoogleAIBackend()`.
2. **`src/services/aiService.ts`**:
   - `determineRoute(...)`: Implements smart hybrid routing rules using Firebase AI Logic `InferenceMode`.
   - `executeAIRequest(...)`: Calls `getGenerativeModel(ai, { mode, inCloudParams: ... })` and executes `generateContentStream(...)`. Reads `finalResponse.inferenceSource` to report actual inference source.
   - `checkOnDeviceAIAvailability(...)`: Non-throwing detector for Gemini Nano availability.

### Hybrid Routing Table
| Condition / Trigger | Routing Rule | Firebase AI Logic InferenceMode |
|---------------------|--------------|----------------------------------|
| Offline (`!isOnline`) | Strict On-Device | `InferenceMode.ONLY_ON_DEVICE` |
| Private Subject / Override | Strict On-Device | `InferenceMode.ONLY_ON_DEVICE` |
| Forced Cloud Override | Strict Cloud | `InferenceMode.ONLY_IN_CLOUD` |
| Auto Short / Simple Input | Prefer On-Device | `InferenceMode.PREFER_ON_DEVICE` |
| Auto Long Doc / Quiz / Flashcards | Prefer Cloud | `InferenceMode.PREFER_IN_CLOUD` |

---

## Setup Guide
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure your keys:
   ```bash
   cp .env.example .env
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

---

## Supported Browsers Table
| Browser | On-Device AI (Gemini Nano) | Cloud AI (Firebase AI Logic) | Offline Storage / IndexedDB |
|---|---|---|---|
| **Google Chrome (Desktop)** | Supported (with flags enabled) | Fully Supported | Fully Supported |
| **Microsoft Edge** | Supported | Fully Supported | Fully Supported |
| **Mozilla Firefox** | Fallback to Cloud | Fully Supported | Fully Supported |
| **Apple Safari** | Fallback to Cloud | Fully Supported | Fully Supported |

---

## What Was Built During the Competition
- **Real Browser Hybrid AI Integration**: Integrated `firebase/ai` with explicit `InferenceMode` routing and streaming responses.
- **Firebase App Check & Remote Config**: Secured endpoints with reCAPTCHA v3 App Check and dynamic remote thresholds.
- **Readiness Diagnostics Panel**: Built-in verification suite for Firestore, App Check, persistence, service worker, and AI Logic execution.
- **Offline-First Study Workspace**: Local IndexedDB multi-page chunk storage paired with Firestore real-time sync.
