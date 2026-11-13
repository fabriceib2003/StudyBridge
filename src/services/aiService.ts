import { ActionType, InferenceRoute, RoutingMode, OnDeviceAIStatus } from "../types";
import { getCachedSection, setCachedSection } from "./firestoreService";
import { auth, ai, getRemoteConfigValue, checkAppCheckToken, isAppCheckInCooldown, markAppCheckFailure, getAppCheckErrorMessage } from "./firebaseService";
import { getGenerativeModel, InferenceMode, InferenceSource } from "firebase/ai";

export { InferenceMode, InferenceSource };

export function isFirebaseConfigured(): boolean {
  return true;
}

/**
 * Shared route label & styling helper used across Route Preview, cards, and analytics
 */
export function getRouteLabel(route: InferenceRoute, meta?: {
  inferenceModeUsed?: string;
  latencyMs?: number;
  ttftMs?: number;
  routingReason?: string;
  compact?: boolean;
}): {
  name: string;
  badgeText: string;
  subText: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  isDevice: boolean;
} {
  const isDevice = route === 'on-device';
  const name = isDevice ? 'On-Device (Nano)' : route === 'cloud' ? 'Cloud (Firebase AI)' : 'Hybrid Router';
  const formatSecs = (ms?: number) => {
    if (!ms || isNaN(ms)) return '';
    return `${(ms / 1000).toFixed(1)}s`;
  };
  const speed = meta?.latencyMs ? formatSecs(meta.latencyMs) : '';
  const ttft = meta?.ttftMs ? `TTFT: ${formatSecs(meta.ttftMs)}` : '';
  const timing = [ttft, speed].filter(Boolean).join(' · ');

  return {
    name,
    badgeText: isDevice ? `On-Device ${timing ? `(${timing})` : ''}` : `Cloud ${timing ? `(${timing})` : ''}`,
    subText: meta?.routingReason || (isDevice ? 'Local on-device inference' : 'Firebase AI Logic cloud model'),
    colorClass: isDevice ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300',
    bgClass: isDevice ? 'bg-emerald-500/10' : 'bg-indigo-500/10',
    borderClass: isDevice ? 'border-emerald-500/20' : 'border-indigo-500/20',
    isDevice
  };
}

/**
 * Detect user's current browser name
 */
export function detectBrowserName(): string {
  if (typeof navigator === 'undefined') return 'Current Browser';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Google Chrome';
  if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Apple Safari';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  return 'Current Browser';
}

/**
 * Real check of whether on-device AI is available in this browser environment
 * Never throws if the API is missing.
 */
export async function checkOnDeviceAIAvailability(): Promise<{
  status: OnDeviceAIStatus;
  available: boolean;
  details: string;
  browserName: string;
}> {
  const browserName = detectBrowserName();
  try {
    if (typeof window === 'undefined') {
      return {
        status: 'unsupported',
        available: false,
        details: "Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.",
        browserName
      };
    }
    const aiApi = (window as any).ai?.languageModel;
    if (!aiApi) {
      return {
        status: 'unsupported',
        available: false,
        details: "Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.",
        browserName
      };
    }

    let rawStatus = 'no';
    if (typeof aiApi.capabilities === 'function') {
      const caps = await aiApi.capabilities();
      rawStatus = caps?.available || 'no';
    } else if (typeof aiApi.availability === 'function') {
      rawStatus = await aiApi.availability();
    }

    if (rawStatus === 'readily' || rawStatus === 'available' || rawStatus === 'yes') {
      return {
        status: 'available',
        available: true,
        details: `Available and ready for on-device inference in ${browserName}.`,
        browserName
      };
    }

    if (rawStatus === 'after-download' || rawStatus === 'downloadable') {
      return {
        status: 'downloadable',
        available: false,
        details: `On-device AI model is available for download in ${browserName}.`,
        browserName
      };
    }

    if (rawStatus === 'downloading') {
      return {
        status: 'downloading',
        available: false,
        details: `On-device AI model is currently downloading in ${browserName}.`,
        browserName
      };
    }

    return {
      status: 'unsupported',
      available: false,
      details: "Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.",
      browserName
    };
  } catch {
    return {
      status: 'unsupported',
      available: false,
      details: "Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.",
      browserName
    };
  }
}

/**
 * Downloads on-device AI model when status is downloadable
 */
export async function downloadOnDeviceAI(onProgress?: (percent: number) => void): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const aiApi = (window as any).ai?.languageModel;
    if (!aiApi || typeof aiApi.create !== 'function') return false;

    const session = await aiApi.create({
      monitor(m: any) {
        if (m && typeof m.addEventListener === 'function') {
          m.addEventListener('downloadprogress', (e: any) => {
            if (e && typeof e.loaded === 'number' && typeof e.total === 'number' && e.total > 0) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress?.(percent);
            }
          });
        }
      }
    });

    if (session && typeof session.destroy === 'function') {
      try { session.destroy(); } catch (_) {}
    }
    return true;
  } catch (err) {
    console.warn("Failed to download on-device AI:", err);
    return false;
  }
}

export interface AIRoutingDecision {
  route: InferenceRoute;
  inferenceModeUsed: InferenceMode;
  routingReason: string;
}

/**
 * Smart Router: determines on-device vs cloud routing using Firebase AI Logic InferenceMode
 * Rules:
 * - offline -> ONLY_ON_DEVICE
 * - Private subject or Force On-device -> ONLY_ON_DEVICE
 * - Force Cloud -> ONLY_IN_CLOUD
 * - Auto short/simple -> PREFER_ON_DEVICE
 * - Auto long, quiz, flashcards, image descriptions -> PREFER_IN_CLOUD
 */
export function determineRoute(
  text: string,
  actionType: ActionType,
  manualMode: RoutingMode,
  isOnline: boolean,
  isSubjectPrivate?: boolean,
  isOnDeviceSupported?: boolean
): AIRoutingDecision {
  const textLength = text.length;
  const shortLimit = getRemoteConfigValue('short_text_limit', 800);

  // 1. Offline -> ONLY_ON_DEVICE
  if (!isOnline) {
    return {
      route: 'on-device',
      inferenceModeUsed: InferenceMode.ONLY_ON_DEVICE,
      routingReason: 'Device is offline: Strictly routed to on-device inference.'
    };
  }

  // 2. Private subject or Force On-device -> ONLY_ON_DEVICE
  if (isSubjectPrivate) {
    return {
      route: 'on-device',
      inferenceModeUsed: InferenceMode.ONLY_ON_DEVICE,
      routingReason: 'Subject marked Private: Strictly routed to on-device inference for privacy.'
    };
  }

  if (manualMode === 'force-on-device') {
    return {
      route: 'on-device',
      inferenceModeUsed: InferenceMode.ONLY_ON_DEVICE,
      routingReason: 'Forced strictly to On-Device by user override.'
    };
  }

  // 3. Force Cloud -> ONLY_IN_CLOUD
  if (manualMode === 'force-cloud') {
    return {
      route: 'cloud',
      inferenceModeUsed: InferenceMode.ONLY_IN_CLOUD,
      routingReason: 'Forced strictly to Cloud by user override.'
    };
  }

  // 4. Auto mode
  // Auto short/simple -> PREFER_ON_DEVICE; Auto long, quiz, flashcards, image descriptions -> PREFER_IN_CLOUD
  const isComplexTask = actionType === 'quiz' || actionType === 'flashcards' || actionType === 'custom' || textLength > shortLimit;

  if (isComplexTask) {
    return {
      route: 'cloud',
      inferenceModeUsed: InferenceMode.PREFER_IN_CLOUD,
      routingReason: 'Auto mode: Long document, quiz, or flashcards prefers high-capacity cloud model via Firebase AI Logic.'
    };
  } else {
    return {
      route: 'on-device',
      inferenceModeUsed: InferenceMode.PREFER_ON_DEVICE,
      routingReason: 'Auto mode: Short input and standard query prefers fast on-device inference.'
    };
  }
}

export function estimateDataSaved(input: string, output: string, route: InferenceRoute): number {
  if (route === 'on-device') {
    return new TextEncoder().encode(input + output).length;
  }
  return 0;
}

export function cleanAndParseJSON(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new Error("The AI service returned an empty response. Please click Retry in a moment.");
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 1. Direct standard parse attempt
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Fix backslashes for LaTeX math inside JSON strings
  try {
    let s = cleaned;
    s = s.replace(/\\\\/g, '\u0000');
    s = s.replace(/\\"/g, '\u0001');
    s = s.replace(/\\([rftb][a-zA-Z]+)/g, '\\\\$1');
    s = s.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
    s = s.replace(/\u0001/g, '\\"');
    s = s.replace(/\u0000/g, '\\\\');
    s = s.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(s);
  } catch {}

  // 3. Regex fallback extraction for cards or questions
  const cards: { front: string; back: string; topic?: string }[] = [];
  const cardRegex = /"front"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"back"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(cleaned)) !== null) {
    const front = cardMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    const back = cardMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    cards.push({ front, back });
  }
  if (cards.length > 0) {
    return { cards };
  }

  const questions: any[] = [];
  const qRegex = /"question"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"options"\s*:\s*\[([\s\S]*?)\][\s\S]*?"correctAnswer"\s*:\s*(\d+)[\s\S]*?"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let qMatch;
  while ((qMatch = qRegex.exec(cleaned)) !== null) {
    const question = qMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    const rawOptions = qMatch[2];
    const options: string[] = [];
    const optRegex = /"((?:[^"\\]|\\.)*)"/g;
    let optMatch;
    while ((optMatch = optRegex.exec(rawOptions)) !== null) {
      options.push(optMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'));
    }
    const correctAnswer = parseInt(qMatch[3], 10) || 0;
    const explanation = qMatch[4].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    if (options.length >= 2) {
      questions.push({ question, options, correctAnswer, explanation });
    }
  }
  if (questions.length > 0) {
    return { questions };
  }

  throw new Error("Failed to parse structured AI output. Please click Retry.");
}

async function computeHash(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch {}
  }
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return 'djb_' + (hash >>> 0).toString(16);
}

export function buildPrompt(options: {
  actionType: ActionType;
  subjectName: string;
  text: string;
  answerLength?: 'short' | 'detailed';
  explainFocus?: string;
  explainLevel?: 'Beginner' | 'Student' | 'Advanced';
  instructionText?: string;
  studyLanguage?: string;
}): string {
  const langRule = options.studyLanguage && options.studyLanguage !== 'English'
    ? `IMPORTANT: You must write your entire response in ${options.studyLanguage}.`
    : `Write your response in English.`;

  if (options.actionType === 'summarize') {
    return `You are StudyBridge, an expert academic study assistant. Provide a clear, comprehensive, highly structured summary of the study material below.

STRICT INSTRUCTIONS:
1. Provide a professional, high-yield summary highlighting core concepts, definitions, formulas, and key takeaways.
2. Structure with clear Markdown headings (##) and bullet points.
3. Include LaTeX math notation ($...$ inline, $$...$$ block) for any equations or formulas.
4. ${langRule}

STUDY MATERIAL:
${options.text}`;
  }

  if (options.actionType === 'explain') {
    const level = options.explainLevel || 'Student';
    const focus = options.explainFocus ? ` Focus on: ${options.explainFocus}.` : '';
    return `You are StudyBridge, an expert academic tutor. Explain the following study concept at a ${level} level.${focus}

STRICT INSTRUCTIONS:
1. Break down the concept clearly with definitions, practical examples, and clear explanations.
2. Use Markdown headings and bullet points.
3. Include LaTeX math notation ($...$ inline, $$...$$ block) where relevant.
4. ${langRule}

CONCEPT / MATERIAL:
${options.text}`;
  }

  if (options.actionType === 'quiz') {
    return `You are StudyBridge, an expert academic exam creator. Create a multiple-choice practice quiz based on the study material below.

STRICT INSTRUCTIONS:
1. Generate exactly 5 challenging, high-quality multiple-choice questions.
2. Return ONLY valid JSON matching this exact structure with no markdown code block formatting or extra text:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why this answer is correct",
      "topic": "Key topic name"
    }
  ]
}
3. ${langRule}

STUDY MATERIAL:
${options.text}`;
  }

  if (options.actionType === 'flashcards') {
    return `You are StudyBridge, an expert academic educator. Create a deck of spaced-repetition study flashcards based on the study material below.

STRICT INSTRUCTIONS:
1. Generate between 8 and 12 high-yield flashcards covering key terms, definitions, formulas, and concepts.
2. Return ONLY valid JSON matching this exact structure with no markdown code block formatting or extra text:
{
  "cards": [
    {
      "front": "Question or term",
      "back": "Detailed answer or definition",
      "topic": "Key topic name"
    }
  ]
}
3. ${langRule}

STUDY MATERIAL:
${options.text}`;
  }

  if (options.actionType === 'answer') {
    return `You are StudyBridge, an expert academic study assistant. Answer the user's question using ONLY the provided study material.

STRICT INSTRUCTIONS:
1. Answer directly and precisely.
2. Use Markdown and LaTeX math notation ($...$ inline, $$...$$ block) where relevant.
3. ${langRule}

USER QUESTION:
${options.instructionText || ''}

STUDY MATERIAL:
${options.text}`;
  }

  return `You are StudyBridge. Analyze the following material and provide a detailed study response.\n\nMaterial:\n${options.text}`;
}

export interface ExecuteAIOptions {
  text: string;
  actionType: ActionType;
  subjectName: string;
  isSubjectPrivate?: boolean;
  manualMode: RoutingMode;
  isOnline: boolean;
  answerLength?: 'short' | 'detailed';
  explainFocus?: string;
  explainLevel?: 'Beginner' | 'Student' | 'Advanced';
  instructionText?: string;
  studyLanguage?: string;
  onProgress?: (status: string) => void;
  onStream?: (chunk: string) => void;
}

export async function executeAIRequest(options: ExecuteAIOptions): Promise<{
  response: string;
  route: InferenceRoute;
  inferenceModeUsed: string;
  routingReason: string;
  latencyMs: number;
  ttftMs: number;
  dataSavedBytes: number;
  bytesSent: number;
  bytesReceived: number;
  quizData?: any;
  flashcardData?: any;
}> {
  if (isAppCheckInCooldown()) {
    throw new Error(getAppCheckErrorMessage());
  }

  const startTime = performance.now();
  const prompt = buildPrompt({ ...options });
  const promptBytes = new TextEncoder().encode(prompt).length;

  const isOffline = typeof navigator !== 'undefined' ? (!navigator.onLine || !options.isOnline) : !options.isOnline;
  const { available: onDeviceAvailable } = await checkOnDeviceAIAvailability();

  if (isOffline && !onDeviceAvailable) {
    throw new Error("You're offline. This needs the cloud. Saved material is still available.");
  }

  if (options.isSubjectPrivate && !onDeviceAvailable) {
    throw new Error("This subject is marked Private and requires on-device AI to protect your study privacy. On-device AI is not available in this browser, and requests for private subjects are never sent to the cloud. Please use Chrome on a desktop computer with on-device AI enabled.");
  }

  if (options.manualMode === 'force-on-device' && !onDeviceAvailable) {
    throw new Error("On-device AI isn't available in this browser. To use on-device AI, use Chrome on a desktop computer with on-device AI enabled.");
  }

  // Verify App Check token before AI call when online
  if (!isOffline) {
    const appCheckValid = await checkAppCheckToken();
    if (!appCheckValid && (options.manualMode === 'force-cloud' || !onDeviceAvailable)) {
      throw new Error(getAppCheckErrorMessage());
    }
  }

  const decision = determineRoute(
    options.text,
    options.actionType,
    options.manualMode,
    !isOffline,
    options.isSubjectPrivate,
    onDeviceAvailable
  );

  let actualRoute: InferenceRoute = decision.route;
  let actualMode: string = decision.inferenceModeUsed;
  let actualReason = decision.routingReason;
  let fullText = "";
  let ttftMs = 0;
  let bytesReceived = 0;

  if (!ai) {
    throw new Error("Firebase AI Logic is not initialized.");
  }

  const model = getGenerativeModel(ai, {
    mode: decision.inferenceModeUsed as InferenceMode,
    inCloudParams: {
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: (options.actionType === 'quiz' || options.actionType === 'flashcards') ? 0.2 : 0.7,
        maxOutputTokens: 2500,
        ...(options.actionType === 'quiz' || options.actionType === 'flashcards' ? { responseMimeType: 'application/json' } : {})
      }
    }
  });

  let streamResult;
  try {
    streamResult = await model.generateContentStream(prompt);
  } catch (err: any) {
    const errMsg = (err?.message || String(err)).toLowerCase();
    if (errMsg.includes('appcheck') || errMsg.includes('app-check') || errMsg.includes('recaptcha')) {
      markAppCheckFailure();
      throw new Error(getAppCheckErrorMessage());
    }
    throw err;
  }

  let accumulated = "";

  try {
    for await (const chunk of streamResult.stream) {
      if (!ttftMs) {
        ttftMs = Math.round(performance.now() - startTime);
      }
      const chunkText = chunk.text();
      if (chunkText) {
        accumulated = chunkText;
        options.onStream?.(accumulated);
      }
    }
  } catch (err: any) {
    const errMsg = (err?.message || String(err)).toLowerCase();
    if (errMsg.includes('appcheck') || errMsg.includes('app-check') || errMsg.includes('recaptcha')) {
      markAppCheckFailure();
      throw new Error(getAppCheckErrorMessage());
    }
    throw err;
  }

  const finalResponse = await streamResult.response;
  fullText = accumulated || finalResponse.text();
  bytesReceived = new TextEncoder().encode(fullText).length;

  const rawSource = (finalResponse as any)?.inferenceSource;
  if (rawSource === InferenceSource.ON_DEVICE || rawSource === 'on_device') {
    actualRoute = 'on-device';
    actualMode = InferenceMode.ONLY_ON_DEVICE;
    actualReason = 'Executed locally on-device via browser Firebase AI Logic (Nano).';
  } else if (rawSource === InferenceSource.IN_CLOUD || rawSource === 'in_cloud') {
    actualRoute = 'cloud';
    actualMode = decision.inferenceModeUsed === InferenceMode.PREFER_ON_DEVICE ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD;
    actualReason = decision.inferenceModeUsed === InferenceMode.PREFER_ON_DEVICE 
      ? 'Auto hybrid: On-device unavailable, routed to Cloud via Firebase AI Logic.' 
      : 'Executed via Firebase AI Logic Cloud model.';
  } else {
    actualRoute = decision.route;
    actualMode = decision.inferenceModeUsed;
  }

  const latencyMs = Math.round(performance.now() - startTime);

  let quizData: any = undefined;
  let flashcardData: any = undefined;

  if (options.actionType === 'quiz') {
    quizData = cleanAndParseJSON(fullText);
    const count = quizData?.questions?.length || 0;
    const topics = Array.from(new Set((quizData?.questions || []).map((q: any) => q.topic).filter(Boolean))).slice(0, 4).join(', ');
    fullText = `Generated ${count}-question practice quiz${topics ? ` covering ${topics}` : ''} for ${options.subjectName}. Click below to launch the Quiz Arena!`;
  } else if (options.actionType === 'flashcards') {
    flashcardData = cleanAndParseJSON(fullText);
    const count = flashcardData?.cards?.length || 0;
    const topics = Array.from(new Set((flashcardData?.cards || []).map((c: any) => c.topic).filter(Boolean))).slice(0, 4).join(', ');
    fullText = `Generated ${count} interactive flashcards${topics ? ` covering ${topics}` : ''} for ${options.subjectName}. Click below to open the Flashcard Viewer!`;
  }

  return {
    response: fullText,
    route: actualRoute,
    inferenceModeUsed: actualMode,
    routingReason: actualReason,
    latencyMs,
    ttftMs: ttftMs || latencyMs,
    dataSavedBytes: actualRoute === 'on-device' ? promptBytes + bytesReceived : 0,
    bytesSent: promptBytes,
    bytesReceived,
    quizData,
    flashcardData
  };
}
