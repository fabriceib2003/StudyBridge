export type Subject = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isPrivate?: boolean;
  hasPendingWrites?: boolean;
  createdAt?: number;
};

export type MaterialStatus = 'Ready' | 'Extracting' | 'Queued' | 'Failed' | 'Queued (waiting for connection)' | string;

export type Page = {
  pageNumber?: number;
  text: string;
  image?: string; // base64 or object URL
  hasVisualDiagrams?: boolean;
};

export type Material = {
  id: string;
  subjectId: string;
  title: string;
  content?: string;
  contentPreview?: string;
  pages?: Page[];
  pageCount?: number;
  hasImages?: boolean;
  status: MaterialStatus;
  errorMessage?: string;
  chunksCount?: number;
  createdAt: number;
  updatedAt: number;
  keepOriginal?: boolean;
  hasPendingWrites?: boolean;
  type?: string;
  sourceUrl?: string;
};

export type SavedResult = {
  id: string;
  subjectId: string;
  title: string;
  preview?: string;
  type: 'summarize' | 'summary' | 'explain' | 'explanation' | 'quiz' | 'flashcards' | 'answer';
  content: string;
  prompt?: string;
  materialIds?: string[];
  route: InferenceRoute;
  inferenceModeUsed?: string;
  routingReason?: string;
  latencyMs: number;
  ttftMs?: number;
  timestamp: number;
  hasPendingWrites?: boolean;
  level?: 'Beginner' | 'Student' | 'Advanced';
  focus?: string;
  quizData?: {
    title?: string;
    questions: {
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
      topic?: string;
      difficulty?: string;
    }[];
  };
  flashcardData?: {
    title?: string;
    cards: {
      front: string;
      back: string;
      topic?: string;
    }[];
  };
  lastScore?: {
    score: number;
    total: number;
    percentage: number;
    timestamp: number;
  };
  settings?: {
    focus?: string;
    count?: number;
    difficulty?: 'Easy' | 'Mixed' | 'Hard';
    style?: 'Overview' | 'Exam revision' | 'Formulas only';
    length?: 'Short' | 'Detailed';
  };
  followUps?: {
    id: string;
    question: string;
    answer: string;
    timestamp: number;
  }[];
};

export type GenerationSettings = {
  focus?: string;
  count?: number;
  difficulty?: 'Easy' | 'Mixed' | 'Hard';
  style?: 'Overview' | 'Exam revision' | 'Formulas only';
  length?: 'Short' | 'Detailed';
};

export type ActionType = 'explain' | 'summarize' | 'quiz' | 'flashcards' | 'custom' | 'answer';

export type InferenceRoute = 'on-device' | 'cloud' | 'unknown';

export type OnDeviceAIStatus = 'available' | 'downloadable' | 'downloading' | 'unsupported';

export type RoutingMode = 'auto' | 'force-on-device' | 'force-cloud';

export type AIInteraction = {
  id: string;
  materialId?: string;
  subjectId: string;
  actionType: ActionType;
  prompt: string;
  response: string;
  route: InferenceRoute;
  inferenceModeUsed: string;
  routingReason: string;
  latencyMs: number;
  ttftMs?: number;
  dataSavedBytes: number;
  bytesSent: number;
  bytesReceived: number;
  timestamp: number;
  hasPendingWrites?: boolean;
  quizData?: {
    questions: {
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
    }[];
  };
  flashcardData?: {
    cards: {
      front: string;
      back: string;
    }[];
  };
};

export type UserStats = {
  totalRequests: number;
  onDeviceCount: number;
  cloudCount: number;
  totalLatencyMs: number;
  totalDataSavedBytes: number;
  totalBytesSent: number;
  totalBytesReceived: number;
};

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';

export type Job = {
  id: string;
  type: ActionType;
  subjectId: string;
  materialIds: string[];
  status: JobStatus;
  progressText: string;
  error?: string;
  resultId?: string;
  createdAt: number;
  updatedAt: number;
};


