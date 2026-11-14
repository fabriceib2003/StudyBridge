import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  BookOpen, 
  Cpu, 
  Cloud, 
  Zap, 
  ArrowRight, 
  HelpCircle, 
  Layers, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Settings, 
  FolderPlus, 
  Lock, 
  Image as ImageIcon, 
  Eye, 
  X, 
  Copy, 
  FileText, 
  Check, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  ExternalLink,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Subject, Material, ActionType, RoutingMode, AIInteraction, Page, SavedResult, GenerationSettings } from '../types';
import { executeAIRequest, determineRoute, getRouteLabel, isFirebaseConfigured } from '../services/aiService';
import { loadMaterialContent, addResultFirestore, saveMaterialWithChunks, deleteResultFirestore } from '../services/firestoreService';
import { getMaterialPagesLocal } from '../services/mediaStorage';
import { auth } from '../services/firebaseService';
import { QuizArena } from './QuizArena';
import { FlashcardViewer } from './FlashcardViewer';
import { ManageSubjectsModal } from './ManageSubjectsModal';
import { MarkdownViewer } from './MarkdownViewer';
import { Modal } from './Modal';

interface StudyDeskProps {
  subjects: Subject[];
  materials: Material[];
  manualMode: RoutingMode;
  isOnline: boolean;
  answerLength?: 'short' | 'detailed';
  onAddInteraction: (interaction: AIInteraction) => void;
  selectedMaterial: Material | null;
  clearSelectedMaterial: () => void;
  onOpenSettings: () => void;
  onAddSubject: (subject: Omit<Subject, 'id'>) => Promise<any>;
  onUpdateSubject?: (id: string, updates: Partial<Subject>) => Promise<any>;
  onDeleteSubjectWithOptions?: (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => Promise<any>;
  savedResults?: SavedResult[];
  onAddMaterial?: (material: any, pages: any[]) => void;
  isDeviceAiAvailable?: boolean;
  studyLanguage?: string;
}

export const StudyDesk: React.FC<StudyDeskProps> = ({
  subjects,
  materials,
  manualMode,
  isOnline,
  answerLength = 'detailed',
  onAddInteraction,
  selectedMaterial,
  clearSelectedMaterial,
  onOpenSettings,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubjectWithOptions,
  savedResults = [],
  onAddMaterial,
  isDeviceAiAvailable = false,
  studyLanguage = 'English'
}) => {
  const navigate = useNavigate();

  // Active Subject
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');

  // Subject management modals / inline
  const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);
  const [isInlineCreatingSubject, setIsInlineCreatingSubject] = useState(false);
  const [inlineSubName, setInlineSubName] = useState('');
  const [inlineSubIsPrivate, setInlineSubIsPrivate] = useState(false);

  // Material Source Selection (ticked material chips)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(() => {
    const firstSubId = subjects[0]?.id || '';
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`studybridge_selected_mats_${firstSubId}`) : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    const initialReady = materials.filter(m => m.subjectId === firstSubId && m.status === 'Ready');
    return initialReady.map(m => m.id);
  });
  const [combinedMaterialContent, setCombinedMaterialContent] = useState<string>('');
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(false);
  const prevSubjectIdRef = useRef<string>(selectedSubjectId);
  const prevReadyMatIdsRef = useRef<string[]>([]);

  // Default tick ready materials when subject changes, and auto-tick newly imported materials
  useEffect(() => {
    const readyMaterials = materials.filter(m => m.subjectId === selectedSubjectId && m.status === 'Ready');
    const readyIds = readyMaterials.map(m => m.id);

    // If subject changed, reset to all ready materials
    if (prevSubjectIdRef.current !== selectedSubjectId) {
      prevSubjectIdRef.current = selectedSubjectId;
      setSelectedMaterialIds(readyIds);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`studybridge_selected_mats_${selectedSubjectId}`, JSON.stringify(readyIds));
      }
      prevReadyMatIdsRef.current = readyIds;
      return;
    }

    // Auto-tick newly imported materials in the active subject
    const newReadyIds = readyIds.filter(id => !prevReadyMatIdsRef.current.includes(id));
    if (newReadyIds.length > 0) {
      setSelectedMaterialIds(prev => {
        const updated = Array.from(new Set([...prev, ...newReadyIds]));
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`studybridge_selected_mats_${selectedSubjectId}`, JSON.stringify(updated));
        }
        return updated;
      });
    }
    prevReadyMatIdsRef.current = readyIds;
  }, [selectedSubjectId, materials]);

  // Instruction input (persisted in session)
  const [instructionText, setInstructionText] = useState<string>(() => sessionStorage.getItem('studybridge_instruction') || '');
  useEffect(() => {
    sessionStorage.setItem('studybridge_instruction', instructionText);
  }, [instructionText]);

  // Explain Simply options
  const [explainFocus, setExplainFocus] = useState<string>('');
  const [explainLevel, setExplainLevel] = useState<'Beginner' | 'Student' | 'Advanced'>('Student');

  // AI execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastActionType, setLastActionType] = useState<ActionType | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    count: 10,
    difficulty: 'Mixed',
    style: 'Overview',
    length: 'Detailed'
  });

  // Current In-flight / Latest Result
  const [currentResult, setCurrentResult] = useState<{
    id?: string;
    response: string;
    route: 'on-device' | 'cloud' | 'unknown';
    inferenceModeUsed: string;
    routingReason: string;
    latencyMs: number;
    ttftMs?: number;
    dataSavedBytes: number;
    bytesSent: number;
    bytesReceived: number;
    quizData?: any;
    flashcardData?: any;
    actionType: ActionType;
  } | null>(null);

  // Saved Result Card ID generated for latest run
  const [latestSavedResultId, setLatestSavedResultId] = useState<string | null>(null);
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null);
  const [savedAsNoteId, setSavedAsNoteId] = useState<string | null>(null);

  // Active Sub-views (Quiz Arena / Flashcards)
  const [activeView, setActiveView] = useState<'desk' | 'quiz' | 'flashcards'>('desk');
  const [streamingSeconds, setStreamingSeconds] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Streaming timer effect
  useEffect(() => {
    let timer: any = null;
    if (isGenerating) {
      setStreamingSeconds(0);
      const startTime = Date.now();
      timer = setInterval(() => {
        setStreamingSeconds((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  // Visual diagrams viewer
  const [materialPages, setMaterialPages] = useState<Page[]>([]);
  const [showVisualsModal, setShowVisualsModal] = useState<boolean>(false);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Pagination, Deletion & Toast for Saved Study Results
  const location = useLocation();
  const [activeFilter, setActiveFilter] = useState<'All' | 'Summary' | 'Explanation' | 'Quiz' | 'Flashcards' | 'Answers'>('All');
  const extractTopTopics = (text: string, n: number): string => {
    // Basic topic extraction logic - could be improved
    const words = text.split(/\s+/).filter(w => w.length > 5);
    return Array.from(new Set(words)).slice(0, n).join(', ');
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState<number>(1);
  const [materialsPage, setMaterialsPage] = useState<number>(1);
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);
  const [resultToDelete, setResultToDelete] = useState<string | null>(null);
  const RESULTS_PER_PAGE = 5;
  const MATERIALS_PER_PAGE = 6;

  // Listen for toast messages from navigation (e.g. "Deleted" from ResultPage)
  useEffect(() => {
    const toast = (location.state as any)?.toast || sessionStorage.getItem('studybridge_toast');
    if (toast) {
      setToastMessage(toast);
      sessionStorage.removeItem('studybridge_toast');
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Reset pagination when switching subject
  useEffect(() => {
    setResultsPage(1);
    setMaterialsPage(1);
  }, [selectedSubjectId]);

  const handleDeleteResult = (e: React.MouseEvent, resId: string) => {
    e.stopPropagation();
    setResultToDelete(resId);
  };

  const handleConfirmDeleteFromDesk = async () => {
    if (!resultToDelete || !auth.currentUser) return;
    const resId = resultToDelete;
    setDeletingResultId(resId);
    try {
      await deleteResultFirestore(auth.currentUser.uid, resId);
      setToastMessage("Deleted");
      setTimeout(() => setToastMessage(null), 3000);
      setResultToDelete(null);
    } catch (err) {
      console.error("Failed to delete study result:", err);
    } finally {
      setDeletingResultId(null);
    }
  };

  // Sync selected material from navigation
  useEffect(() => {
    if (selectedMaterial) {
      setSelectedSubjectId(selectedMaterial.subjectId);
      setSelectedMaterialIds([selectedMaterial.id]);
    }
  }, [selectedMaterial]);

  // Keep selectedSubjectId valid
  useEffect(() => {
    if (subjects.length > 0 && !subjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  // Fetch and combine contents of ticked materials
  useEffect(() => {
    const fetchTickedContents = async () => {
      if (selectedMaterialIds.length === 0) {
        setCombinedMaterialContent('');
        setMaterialPages([]);
        return;
      }

      setIsLoadingMaterials(true);
      const uid = auth.currentUser?.uid || '';
      const textParts: string[] = [];
      const collectedPages: Page[] = [];

      for (const matId of selectedMaterialIds) {
        const mat = materials.find(m => m.id === matId);
        if (!mat) continue;

        try {
          const text = await loadMaterialContent(uid, matId);
          textParts.push(`=== Source: ${mat.title} ===\n${text || mat.contentPreview || ''}`);
        } catch (e) {
          console.warn("Could not load chunk for material:", matId, e);
          if (mat.contentPreview) {
            textParts.push(`=== Source: ${mat.title} ===\n${mat.contentPreview}`);
          }
        }

        try {
          const pages = await getMaterialPagesLocal(matId);
          if (pages && pages.length > 0) {
            collectedPages.push(...pages);
          }
        } catch {
          // ignore
        }
      }

      setCombinedMaterialContent(textParts.join('\n\n'));
      setMaterialPages(collectedPages);
      setIsLoadingMaterials(false);
    };

    fetchTickedContents();
  }, [selectedMaterialIds, materials]);

  const activeSubject = subjects.find(s => s.id === selectedSubjectId);
  const subjectMaterials = materials.filter(m => m.subjectId === selectedSubjectId);

  // Effective text to be used by AI: ticked materials combined + optional quick text
  const effectiveText = [combinedMaterialContent, instructionText.trim()].filter(Boolean).join('\n\n');

  // Real route preview
  const livePreviewDecision = determineRoute(
    effectiveText || 'Sample text', 
    'explain', 
    manualMode, 
    isOnline, 
    activeSubject?.isPrivate,
    isDeviceAiAvailable
  );
  const livePreviewLabel = getRouteLabel(livePreviewDecision.route, {
    routingReason: livePreviewDecision.routingReason
  });

  const handleToggleMaterial = (matId: string) => {
    const mat = materials.find(m => m.id === matId);
    if (mat && mat.status !== 'Ready') return; // Materials not ready cannot be ticked
    setSelectedMaterialIds(prev => {
      const next = prev.includes(matId) ? prev.filter(id => id !== matId) : [...prev, matId];
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`studybridge_selected_mats_${selectedSubjectId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleInlineSubjectCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineSubName.trim()) return;
    try {
      const created = await onAddSubject({
        name: inlineSubName.trim(),
        color: 'from-blue-600 to-indigo-600',
        icon: 'BookOpen',
        isPrivate: isDeviceAiAvailable ? inlineSubIsPrivate : false
      });
      setInlineSubName('');
      setInlineSubIsPrivate(false);
      setIsInlineCreatingSubject(false);
      if (created?.id) {
        setSelectedSubjectId(created.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async (actionType: ActionType) => {
    if (!effectiveText.trim()) {
      alert("Please select at least one study material chip or type quick notes below.");
      return;
    }

    if (!isFirebaseConfigured()) {
      setErrorMessage("Firebase is not initialized.");
      return;
    }

    // Block AI requests for private subjects if on-device AI is not available
    if (activeSubject?.isPrivate && !isDeviceAiAvailable) {
      setErrorMessage("This subject is marked Private and requires on-device AI to protect your privacy. On-device AI is not available in this browser, and private subjects are never sent to the cloud. To study this subject, switch to Chrome on desktop with on-device AI enabled, or change the subject to standard mode in Manage Subjects.");
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setCurrentResult(null);
    setLatestSavedResultId(null);
    setErrorMessage(null);
    setLastActionType(actionType);
    setProgressStatus("Preparing AI analysis...");

    const subjectName = activeSubject?.name || 'General Study';

    try {
      const result = await executeAIRequest({
        text: effectiveText,
        actionType,
        subjectName,
        isSubjectPrivate: activeSubject?.isPrivate,
        manualMode,
        isOnline,
        answerLength,
        explainFocus,
        explainLevel,
        instructionText: instructionText.trim() || undefined,
        studyLanguage: studyLanguage || (typeof localStorage !== 'undefined' ? localStorage.getItem('studybridge_study_language') : null) || 'English',
        abortSignal: controller.signal,
        onProgress: (status) => setProgressStatus(status),
        onStream: (chunk) => {
          if (controller.signal.aborted) return;
          setCurrentResult((prev) => prev ? { ...prev, response: chunk } : {
            response: chunk,
            route: 'unknown',
            inferenceModeUsed: 'InferenceMode.STREAMING',
            routingReason: 'Streaming tokens from AI engine...',
            latencyMs: 0,
            dataSavedBytes: 0,
            bytesSent: 0,
            bytesReceived: 0,
            actionType
          });
        }
      });

      if (controller.signal.aborted) return;

      const fullResult = { ...result, actionType };
      setCurrentResult(fullResult);

      const interaction: AIInteraction = {
        id: 'int-' + Date.now(),
        subjectId: selectedSubjectId || 'sub-general',
        actionType,
        prompt: actionType === 'answer' ? instructionText.trim() : (effectiveText.substring(0, 120) + (effectiveText.length > 120 ? '...' : '')),
        response: result.response,
        route: result.route,
        inferenceModeUsed: result.inferenceModeUsed,
        routingReason: result.routingReason,
        latencyMs: result.latencyMs,
        ttftMs: result.ttftMs,
        dataSavedBytes: result.dataSavedBytes,
        bytesSent: result.bytesSent,
        bytesReceived: result.bytesReceived,
        timestamp: Date.now(),
        ...(result.quizData ? { quizData: result.quizData } : {}),
        ...(result.flashcardData ? { flashcardData: result.flashcardData } : {})
      };
      onAddInteraction(interaction);

      // Save to Firestore saved results for all valid AI actions
      if (['summarize', 'explain', 'quiz', 'flashcards', 'answer'].includes(actionType)) {
        if (!result.response || !result.response.trim()) {
          // Do not save empty answers
          return;
        }

        let normalizedType: 'summary' | 'explanation' | 'quiz' | 'flashcards' | 'answer' = 'summary';
        let title = '';

        if (actionType === 'answer') {
          normalizedType = 'answer';
          const cleanQ = instructionText.trim().replace(/^[^a-zA-Z0-9]+/, '').replace(/[?.,!]+$/, '').trim();
          const shortQ = cleanQ.length > 50 ? cleanQ.slice(0, 50).trim() + '...' : cleanQ;
          const baseTitle = `Answer: ${shortQ || 'Question'}`;
          title = baseTitle;
          const sameTitleCount = savedResults.filter(r => r.title === baseTitle || r.title.startsWith(baseTitle + ' #')).length;
          if (sameTitleCount > 0) {
            title = `${baseTitle} #${sameTitleCount + 1}`;
          }
        } else {
          normalizedType = actionType === 'summarize' ? 'summary' : actionType === 'explain' ? 'explanation' : actionType === 'quiz' ? 'quiz' : actionType === 'flashcards' ? 'flashcards' : 'answer';
          const typeLabel = normalizedType === 'summary' ? 'Summary' : normalizedType === 'explanation' ? 'Explanation' : normalizedType === 'quiz' ? 'Quiz' : normalizedType === 'flashcards' ? 'Flashcards' : 'Answer';

          const firstTicked = materials.find(m => selectedMaterialIds.includes(m.id));
          const sourceName = explainFocus || firstTicked?.title || activeSubject?.name || 'Study Material';
          const count = result.quizData ? result.quizData.questions.length : result.flashcardData ? result.flashcardData.cards.length : 0;

          let baseTitle = `${typeLabel}: ${sourceName}`;
          if (normalizedType === 'flashcards' && count > 0) {
            baseTitle = `${typeLabel}: ${sourceName} (${count})`;
          } else if (normalizedType === 'quiz' && count > 0) {
            baseTitle = `${typeLabel}: ${sourceName} (${count})`;
          }

          title = baseTitle;
          const sameTitleCount = savedResults.filter(r => r.title === baseTitle || r.title.startsWith(baseTitle + ' #')).length;
          if (sameTitleCount > 0) {
            title = `${baseTitle} #${sameTitleCount + 1}`;
          }
        }

        if (auth.currentUser) {
          const resId = await addResultFirestore(auth.currentUser.uid, {
            subjectId: selectedSubjectId,
            title,
            type: normalizedType as any,
            content: result.response,
            prompt: instructionText.trim() || undefined,
            materialIds: selectedMaterialIds,
            route: result.route,
            inferenceModeUsed: result.inferenceModeUsed,
            routingReason: result.routingReason,
            latencyMs: result.latencyMs,
            ttftMs: result.ttftMs,
            timestamp: Date.now(),
            settings: generationSettings,
            level: actionType === 'explain' ? explainLevel : undefined,
            focus: actionType === 'explain' ? explainFocus : undefined,
            ...(result.quizData ? { quizData: result.quizData } : {}),
            ...(result.flashcardData ? { flashcardData: result.flashcardData } : {})
          });
          setLatestSavedResultId(resId);
          setCurrentResult(prev => prev ? { ...prev, id: resId } : null);

          if (actionType === 'answer') {
            showToast('Answer saved');
          } else {
            const firstTicked = materials.find(m => selectedMaterialIds.includes(m.id));
            const sourceName = explainFocus || firstTicked?.title || activeSubject?.name || 'Study Material';
            const count = result.quizData ? result.quizData.questions.length : result.flashcardData ? result.flashcardData.cards.length : 0;
            const msg = `${count > 0 ? count + ' ' : ''}${actionType}s covering ${sourceName}`;
            showToast(msg);
          }
        }
      }


    } catch (e: any) {
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      console.error(e);
      const rawMsg = e instanceof Error ? e.message : String(e);
      if (rawMsg.toLowerCase().includes('timeout') || rawMsg.toLowerCase().includes('timed out')) {
        setErrorMessage("The AI request timed out across available models. Try selecting fewer study materials or click Retry.");
      } else {
        setErrorMessage(rawMsg);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsGenerating(false);
        setProgressStatus(null);
      }
    }
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setProgressStatus(null);
    setCurrentResult(null);
    showToast('Generation cancelled');
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResultId(id);
    setTimeout(() => setCopiedResultId(null), 2000);
  };

  const handleSaveResultAsNote = async (res: SavedResult | { content: string; title?: string }) => {
    if (!auth.currentUser) return;
    try {
      const noteTitle = res.title || `Study Note (${new Date().toLocaleDateString()})`;
      await saveMaterialWithChunks(
        auth.currentUser.uid,
        {
          subjectId: selectedSubjectId,
          title: noteTitle,
          pageCount: 1,
          hasImages: false
        },
        res.content,
        [{ pageNumber: 1, text: res.content, hasVisualDiagrams: false }]
      );
      setSavedAsNoteId(res.title || 'current');
      setTimeout(() => setSavedAsNoteId(null), 3000);
    } catch (err) {
      console.error("Failed to save as note:", err);
    }
  };

  if (activeView === 'quiz' && currentResult?.quizData) {
    return (
      <QuizArena 
        questions={currentResult.quizData.questions}
        subjectName={activeSubject?.name || 'Study Subject'}
        onClose={() => setActiveView('desk')}
      />
    );
  }

  if (activeView === 'flashcards' && currentResult?.flashcardData) {
    return (
      <FlashcardViewer 
        cards={currentResult.flashcardData.cards}
        subjectName={activeSubject?.name || 'Study Subject'}
        onClose={() => setActiveView('desk')}
      />
    );
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Study Desk</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select materials from your subject to analyze, summarize, explain simply, or generate practice tests.
          </p>
        </div>

        <button
          onClick={() => setIsManageSubjectsOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          Manage Subjects
        </button>
      </div>

      {/* Subject Switcher Bar with always-visible "+ New subject" */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Active Subject:</span>
            
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  setIsInlineCreatingSubject(true);
                } else {
                  setSelectedSubjectId(e.target.value);
                  setSelectedMaterialIds([]);
                }
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-semibold cursor-pointer shadow-sm"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isPrivate ? '(Private: On-Device)' : ''}
                </option>
              ))}
              <option value="__NEW__" className="text-blue-600 font-bold">+ New subject</option>
            </select>

            <button
              onClick={() => setIsInlineCreatingSubject(prev => !prev)}
              className="px-2.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium flex items-center gap-1 border border-blue-200 dark:border-blue-800/50 transition-colors"
              title="Add subject without leaving page"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Subject</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {materialPages.some(p => !!p.image) && (
              <button
                type="button"
                onClick={() => setShowVisualsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                View Diagrams ({materialPages.filter(p => !!p.image).length})
              </button>
            )}
            
            {activeSubject?.isPrivate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                <Lock className="w-3 h-3" /> Private Subject
              </span>
            )}
          </div>
        </div>

        {/* Inline New Subject Creation */}
        {isInlineCreatingSubject && (
          <form onSubmit={handleInlineSubjectCreate} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-2.5 animate-fadeIn">
            <div className="flex items-center gap-2 flex-1 w-full">
              <FolderPlus className="w-4 h-4 text-blue-500 shrink-0" />
              <input
                type="text"
                required
                value={inlineSubName}
                onChange={(e) => setInlineSubName(e.target.value)}
                placeholder="New subject title..."
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <label 
                className={`flex items-center gap-1 text-xs select-none ${!isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={!isDeviceAiAvailable ? "Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer." : "Keep this subject private (runs only on-device)"}
              >
                <input
                  type="checkbox"
                  disabled={!isDeviceAiAvailable}
                  checked={inlineSubIsPrivate}
                  onChange={(e) => setInlineSubIsPrivate(e.target.checked)}
                  className="rounded text-blue-600 w-3 h-3 disabled:cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5 text-amber-500" /> Private
                </span>
              </label>

              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsInlineCreatingSubject(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Source Material Selection Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {selectedMaterialIds.length} of {subjectMaterials.filter(m => m.status === 'Ready').length} sources selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const readyIds = subjectMaterials.filter(m => m.status === 'Ready').map(m => m.id);
                  setSelectedMaterialIds(readyIds);
                  if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(`studybridge_selected_mats_${selectedSubjectId}`, JSON.stringify(readyIds));
                  }
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select all
              </button>
              <button
                onClick={() => {
                  setSelectedMaterialIds([]);
                  if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(`studybridge_selected_mats_${selectedSubjectId}`, JSON.stringify([]));
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-white underline"
              >
                Clear
              </button>
            </div>
          </div>

          {subjectMaterials.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No materials in "{activeSubject?.name || 'this subject'}" yet.
              </p>
              <button
                onClick={() => navigate('/materials')}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Import materials in Library &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {subjectMaterials
                  .slice((materialsPage - 1) * MATERIALS_PER_PAGE, materialsPage * MATERIALS_PER_PAGE)
                  .map((mat) => {
                    const isSelected = selectedMaterialIds.includes(mat.id);
                    const isReady = mat.status === 'Ready';
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        disabled={!isReady}
                        title={!isReady ? `${mat.title} (${mat.status || 'Processing'})` : mat.title}
                        onClick={() => handleToggleMaterial(mat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                          !isReady
                            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-dashed border-slate-200 dark:border-slate-800'
                            : isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected && isReady ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate flex-1 text-left">{mat.title}</span>
                        {!isReady && (
                          <span className="text-[10px] text-slate-400 shrink-0 italic">
                            ({mat.status || 'Extracting'})
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
              {subjectMaterials.length > MATERIALS_PER_PAGE && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Showing {(materialsPage - 1) * MATERIALS_PER_PAGE + 1}–{Math.min(materialsPage * MATERIALS_PER_PAGE, subjectMaterials.length)} of {subjectMaterials.length} materials
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={materialsPage === 1}
                      onClick={() => setMaterialsPage(prev => Math.max(1, prev - 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-1">
                      {materialsPage} / {Math.ceil(subjectMaterials.length / MATERIALS_PER_PAGE)}
                    </span>
                    <button
                      disabled={materialsPage >= Math.ceil(subjectMaterials.length / MATERIALS_PER_PAGE)}
                      onClick={() => setMaterialsPage(prev => Math.min(Math.ceil(subjectMaterials.length / MATERIALS_PER_PAGE), prev + 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoadingMaterials && (
            <div className="flex items-center gap-1.5 text-xs text-blue-500 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading text & diagrams from selected sources...</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Study Desk Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls, Quick Text, AI Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            
            {/* Shared Instruction Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tell the AI what you need (optional)
                </label>
                <span className={`text-[10px] ${instructionText.length > 500 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {instructionText.length}/500
                </span>
              </div>
              <textarea
                rows={3}
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value.slice(0, 500))}
                placeholder="e.g. Compare AASHTO and USCS, explain Atterberg limits..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('answer')}
                  disabled={isGenerating || selectedMaterialIds.length === 0 || !instructionText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Ask AI
                </button>
                <button
                  onClick={() => setInstructionText('')}
                  className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                  title="Clear instruction"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Explain Simply Controls (Audience level only) */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                Explain Simply Audience
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Beginner', 'Student', 'Advanced'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setExplainLevel(lvl)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium text-center transition-all ${
                      explainLevel === lvl
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Route Preview with Unified Route Label */}
            <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs ${livePreviewLabel.bgClass} ${livePreviewLabel.borderClass} ${livePreviewLabel.colorClass}`}>
              <Zap className="w-4 h-4 shrink-0 text-amber-500" />
              <div className="truncate">
                <span className="font-semibold">Route Preview:</span> {livePreviewLabel.name} — {livePreviewLabel.subText}
              </div>
            </div>

            {/* Private Subject Blocked Banner */}
            {activeSubject?.isPrivate && !isDeviceAiAvailable && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Private Subject — AI Requests Blocked
                </span>
                <p className="text-[11px] leading-relaxed">
                  This subject is marked Private and requires on-device AI. On-device AI is not available in this browser, and requests for private subjects are never sent to the cloud.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Execute AI Action
                </span>
                {selectedMaterialIds.length === 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Select at least one source
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction('explain')}
                  disabled={isGenerating || selectedMaterialIds.length === 0 || !effectiveText.trim() || (activeSubject?.isPrivate && !isDeviceAiAvailable)}
                  title={activeSubject?.isPrivate && !isDeviceAiAvailable ? "Private subjects require on-device AI, which is unavailable in this browser." : undefined}
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  Explain Simply
                </button>

                <button
                  onClick={() => handleAction('summarize')}
                  disabled={isGenerating || selectedMaterialIds.length === 0 || !effectiveText.trim() || (activeSubject?.isPrivate && !isDeviceAiAvailable)}
                  title={activeSubject?.isPrivate && !isDeviceAiAvailable ? "Private subjects require on-device AI, which is unavailable in this browser." : undefined}
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                >
                  <BookOpen className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  Summarize
                </button>

                <button
                  onClick={() => handleAction('quiz')}
                  disabled={isGenerating || selectedMaterialIds.length === 0 || !effectiveText.trim() || (activeSubject?.isPrivate && !isDeviceAiAvailable)}
                  title={activeSubject?.isPrivate && !isDeviceAiAvailable ? "Private subjects require on-device AI, which is unavailable in this browser." : undefined}
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                >
                  <HelpCircle className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                  5-Q Quiz Arena
                </button>

                <button
                  onClick={() => handleAction('flashcards')}
                  disabled={isGenerating || selectedMaterialIds.length === 0 || !effectiveText.trim() || (activeSubject?.isPrivate && !isDeviceAiAvailable)}
                  title={activeSubject?.isPrivate && !isDeviceAiAvailable ? "Private subjects require on-device AI, which is unavailable in this browser." : undefined}
                  className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                >
                  <Layers className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                  Flashcards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fixed-Height AI Output Panel & Latest Result Card */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4 flex flex-col">
            
            {/* Header Status Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2 shrink-0">
              <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                AI Output & Academic Reasoning
              </span>

              {currentResult && !isGenerating && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const label = getRouteLabel(currentResult.route, {
                      latencyMs: currentResult.latencyMs,
                      ttftMs: currentResult.ttftMs,
                      routingReason: currentResult.routingReason
                    });
                    return (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${label.bgClass} ${label.colorClass} ${label.borderClass}`}>
                        {label.isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                        {label.badgeText}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Error Box */}
            {errorMessage && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 space-y-3 animate-fadeIn shrink-0">
                <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>AI Execution Error</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{errorMessage}</p>
                <button
                  onClick={() => handleAction(lastActionType!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isGenerating && !currentResult && !errorMessage && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3 text-center shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ready to study</p>
                  <p className="text-xs max-w-sm">Tick one or more material chips on the left, then click Summarize or Explain Simply.</p>
                </div>
              </div>
            )}

            {/* Streaming State (Fixed height ~260px desktop, ~220px mobile) */}
            {isGenerating && (
              <div className="relative h-[220px] sm:h-[260px] bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
                {/* Top fade gradient */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-slate-50 dark:from-slate-950 to-transparent pointer-events-none z-10" />

                {/* Status line & thin progress bar */}
                <div className="space-y-2 shrink-0 z-20">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                      <span>
                        Generating {lastActionType === 'summarize' ? 'summary' : lastActionType === 'explain' ? 'explanation' : lastActionType || 'study material'}... ({Math.floor(streamingSeconds)}s)
                      </span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 hidden sm:inline">{progressStatus || 'Streaming AI output'}</span>
                      <button
                        type="button"
                        onClick={handleCancelGeneration}
                        className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {/* Thin progress bar */}
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4" />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="flex-1 min-h-0 flex items-end overflow-hidden pt-4">
                  <div className="w-full font-mono text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line line-clamp-4 select-none">
                    {currentResult?.response ? (
                      lastActionType === 'flashcards' ? (
                        (() => {
                          const cardCount = (currentResult.response.match(/"front"\s*:/g) || []).length;
                          return cardCount > 0
                            ? `Building flashcard deck... ${cardCount} card${cardCount === 1 ? '' : 's'} drafted (${currentResult.response.length} chars)`
                            : `Receiving flashcard data (${currentResult.response.length} chars)...`;
                        })()
                      ) : lastActionType === 'quiz' ? (
                        (() => {
                          const qCount = (currentResult.response.match(/"question"\s*:/g) || []).length;
                          return qCount > 0
                            ? `Building practice quiz... ${qCount} question${qCount === 1 ? '' : 's'} drafted (${currentResult.response.length} chars)`
                            : `Receiving quiz data (${currentResult.response.length} chars)...`;
                        })()
                      ) : (
                        currentResult.response
                          .replace(/[*#$`_~[\]()>{}]/g, '')
                          .split('\n')
                          .filter(Boolean)
                          .slice(-4)
                          .join('\n')
                      )
                    ) : (
                      progressStatus || 'Initializing generation...'
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Finished Result State (Fixed height container with result card) */}
            {currentResult && !isGenerating && !errorMessage && (
              <div className="h-[240px] sm:h-[280px] bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between overflow-hidden">
                
                {/* Top info */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${
                      currentResult.actionType === 'summarize' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      currentResult.actionType === 'explain' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      currentResult.actionType === 'quiz' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      currentResult.actionType === 'flashcards' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                      'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                    }`}>
                      {currentResult.actionType === 'summarize' ? 'summary' :
                       currentResult.actionType === 'explain' ? 'explanation' :
                       currentResult.actionType === 'quiz' ? 'quiz' :
                       currentResult.actionType === 'flashcards' ? 'flashcards' :
                       'Answer'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const rLabel = getRouteLabel(currentResult.route, {
                          latencyMs: currentResult.latencyMs,
                          ttftMs: currentResult.ttftMs
                        });
                        return (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rLabel.bgClass} ${rLabel.colorClass} ${rLabel.borderClass}`}>
                            {rLabel.isDevice ? <Cpu className="w-2.5 h-2.5" /> : <Cloud className="w-2.5 h-2.5" />}
                            {rLabel.badgeText}
                          </span>
                        );
                      })()}
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <Cloud className="w-2.5 h-2.5" />
                        Saved
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {(currentResult.actionType === 'answer' || currentResult.actionType === 'custom')
                      ? (instructionText.trim() || 'Answer')
                      : (latestSavedResultId ? savedResults.find(r => r.id === latestSavedResultId)?.title || `${currentResult.actionType} result` : `${currentResult.actionType} result`)}
                  </h3>

                  {/* 3-line plain-text preview with Markdown and LaTeX symbols stripped */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 select-none">
                    {currentResult.response.replace(/[*#$`_~[\]()>{}]/g, '').trim()}
                  </div>
                </div>

                {/* Bottom Actions & Meta */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Secondary Copy button for summary and explanation only */}
                    {(currentResult.actionType === 'summarize' || currentResult.actionType === 'explain') && (
                      <button
                        onClick={() => handleCopyText(currentResult.response, 'current')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-medium cursor-pointer min-h-[36px]"
                        title="Copy content"
                      >
                        {copiedResultId === 'current' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedResultId === 'current' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {/* Exactly ONE Primary Open Button */}
                  <div>
                    <button
                      onClick={() => {
                        if (currentResult.actionType === 'quiz') setActiveView('quiz');
                        else if (currentResult.actionType === 'flashcards') setActiveView('flashcards');
                        else if (latestSavedResultId) navigate(`/results/${latestSavedResultId}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm cursor-pointer whitespace-nowrap min-h-[36px]"
                    >
                      <span>
                        {currentResult.actionType === 'summarize' ? 'Open summary' :
                         currentResult.actionType === 'explain' ? 'Open explanation' :
                         currentResult.actionType === 'flashcards' ? `Open flashcards (${currentResult.flashcardData?.cards?.length || 0})` :
                         currentResult.actionType === 'quiz' ? 'Start quiz' :
                         'Open answer'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Meta Bar (time in seconds & route) */}
            {currentResult && !isGenerating && !errorMessage && (
              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
                <span>
                  Time: <strong>{((currentResult.latencyMs || 0) / 1000).toFixed(1)}s</strong>
                </span>
                <span className="truncate max-w-xs">{currentResult.routingReason}</span>
              </div>
            )}

          </div>

          {/* Saved Result Cards for Active Subject */}
          {(() => {
            const subjectResults = savedResults.filter(r => r.subjectId === selectedSubjectId);
            const filteredResults = activeFilter === 'All' 
              ? subjectResults 
              : subjectResults.filter(r => {
                  if (activeFilter === 'Summary') return r.type === 'summary';
                  if (activeFilter === 'Explanation') return r.type === 'explanation';
                  if (activeFilter === 'Quiz') return r.type === 'quiz';
                  if (activeFilter === 'Flashcards') return r.type === 'flashcards';
                  if (activeFilter === 'Answers') return r.type === 'answer' || (r.type as string) === 'custom';
                  return true;
                });
            if (subjectResults.length === 0) return null;
            const totalResultsPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE));
            const currentPage = Math.min(resultsPage, totalResultsPages);
            const paginatedResults = filteredResults.slice((currentPage - 1) * RESULTS_PER_PAGE, currentPage * RESULTS_PER_PAGE);

            return (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(['All', 'Summary', 'Explanation', 'Quiz', 'Flashcards', 'Answers'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => { setActiveFilter(filter); setResultsPage(1); }}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          activeFilter === filter 
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    {activeFilter} Results ({filteredResults.length})
                  </span>

                  {totalResultsPages > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">
                        Page {currentPage} of {totalResultsPages}
                      </span>
                      <button
                        onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <button
                        onClick={() => setResultsPage(p => Math.min(totalResultsPages, p + 1))}
                        disabled={currentPage >= totalResultsPages}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paginatedResults.map((res) => {
                    const label = getRouteLabel(res.route, { latencyMs: res.latencyMs, ttftMs: res.ttftMs });
                    const isDeleting = deletingResultId === res.id;

                    // Normalize type and assign distinct color tokens + icons
                    const rawType = (res.type || '').trim().toLowerCase();
                    const isSummary = rawType === 'summary' || rawType === 'summarize';
                    const isExplanation = rawType === 'explanation' || rawType === 'explain';
                    const isQuiz = rawType === 'quiz';
                    const isFlashcards = rawType === 'flashcards' || rawType === 'flashcard';
                    const isAnswer = rawType === 'answer' || rawType === 'custom';

                    const typeName = isSummary ? 'Summary' : isExplanation ? 'Explanation' : isQuiz ? 'Quiz' : isFlashcards ? 'Flashcards' : 'Answer';
                    const badgeColorClass = isSummary 
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                      : isExplanation 
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' 
                      : isQuiz 
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' 
                      : isFlashcards
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                      : 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';

                    const typeIcon = isSummary 
                      ? <BookOpen className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      : isExplanation 
                      ? <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      : isQuiz 
                      ? <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      : isFlashcards
                      ? <Layers className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                      : <HelpCircle className="w-3 h-3 text-slate-600 dark:text-slate-400 shrink-0" />;

                    // Real titles: if existing title is a fragment, display fallback
                    let displayTitle = res.title;
                    if (!displayTitle || displayTitle.length < 3 || (!displayTitle.includes(':') && !displayTitle.includes('Summary') && !displayTitle.includes('Explanation') && !displayTitle.includes('Quiz') && !displayTitle.includes('Flashcards') && !displayTitle.includes('Answer'))) {
                      displayTitle = `${typeName}: Study Material`;
                    }

                    // Explicit action link mapping per type: never fall back to Start quiz
                    const cardCount = res.flashcardData?.cards?.length || 0;
                    const actionLabel = isSummary 
                      ? 'Open summary' 
                      : isExplanation 
                      ? 'Open explanation' 
                      : isQuiz 
                        ? (res.lastScore ? `Retake quiz - last score ${res.lastScore.score}/${res.lastScore.total}` : 'Start quiz')
                        : isFlashcards && cardCount > 0 
                          ? `Open flashcards (${cardCount})` 
                          : isFlashcards
                            ? 'Open flashcards'
                            : 'Open answer';

                    const handleOpenResult = () => {
                      if (isQuiz) {
                        navigate(`/results/${res.id}`);
                      } else if (isFlashcards) {
                        navigate(`/results/${res.id}`);
                      } else {
                        navigate(`/results/${res.id}`);
                      }
                    };

                    return (
                      <div
                        key={res.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${badgeColorClass}`}>
                              {typeIcon}
                              {typeName}
                            </span>
                            
                            <div className="flex items-center gap-1.5">
                              {/* Sync Status Badge */}
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                res.hasPendingWrites
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              }`}>
                                <Cloud className="w-2.5 h-2.5" />
                                {res.hasPendingWrites ? 'Waiting to sync' : 'Saved'}
                              </span>

                              {/* Delete Study Result Option */}
                              <button
                                onClick={(e) => handleDeleteResult(e, res.id)}
                                disabled={isDeleting}
                                title="Delete study result from cloud and device"
                                aria-label="Delete study result"
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2" title={displayTitle}>
                            {displayTitle}
                          </h4>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {res.content.replace(/[*#$`_~[\]()>{}]/g, '')}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {new Date(res.timestamp).toLocaleDateString()}
                          </span>

                          <button
                            onClick={handleOpenResult}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                          >
                            <span>{actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                </div>

                {/* Bottom Pagination Bar when total pages > 1 */}
                {totalResultsPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Showing {(currentPage - 1) * RESULTS_PER_PAGE + 1}–{Math.min(currentPage * RESULTS_PER_PAGE, subjectResults.length)} of {subjectResults.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalResultsPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setResultsPage(i + 1)}
                          className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${
                            currentPage === i + 1
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => setResultsPage(p => Math.min(totalResultsPages, p + 1))}
                        disabled={currentPage >= totalResultsPages}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Visual Diagrams Modal */}
      <Modal
        isOpen={showVisualsModal}
        onClose={() => setShowVisualsModal(false)}
        title="Visual Diagrams & Slides"
        subtitle={`Slide ${activePageIndex + 1} of ${materialPages.length} — captured for visual study`}
        maxWidth="form"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activePageIndex === 0}
                onClick={() => setActivePageIndex(prev => Math.max(0, prev - 1))}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-xs font-medium min-h-[44px] flex items-center gap-1 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={activePageIndex === materialPages.length - 1}
                onClick={() => setActivePageIndex(prev => Math.min(materialPages.length - 1, prev + 1))}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-xs font-medium min-h-[44px] flex items-center gap-1 cursor-pointer"
              >
                Next
              </button>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Page {activePageIndex + 1} of {materialPages.length}
            </span>
          </div>
        }
      >
        {materialPages[activePageIndex]?.image ? (
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 p-2 flex items-center justify-center max-h-[350px]">
            <img
              src={materialPages[activePageIndex].image}
              alt={`Slide ${activePageIndex + 1}`}
              className="max-h-[330px] w-auto object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            This page contains pure text.
          </div>
        )}
      </Modal>

      {/* Manage Subjects Modal */}
      <ManageSubjectsModal
        isOpen={isManageSubjectsOpen}
        onClose={() => setIsManageSubjectsOpen(false)}
        subjects={subjects}
        materials={materials}
        onAddSubject={onAddSubject}
        onUpdateSubject={onUpdateSubject || (async () => {})}
        onDeleteSubjectWithOptions={onDeleteSubjectWithOptions || (async () => {})}
        isDeviceAiAvailable={isDeviceAiAvailable}
      />

      {/* Delete Result Confirmation Dialog */}
      <Modal
        isOpen={Boolean(resultToDelete)}
        onClose={() => !deletingResultId && setResultToDelete(null)}
        title="Delete this result?"
        subtitle="This can't be undone."
        maxWidth="confirmation"
        isConfirmation={true}
        isDestructiveActionRunning={Boolean(deletingResultId)}
        closeOnOverlayClick={!deletingResultId}
        closeOnEsc={!deletingResultId}
        showCloseButton={!deletingResultId}
        footer={
          <>
            <button
              type="button"
              onClick={() => !deletingResultId && setResultToDelete(null)}
              disabled={Boolean(deletingResultId)}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteFromDesk}
              disabled={Boolean(deletingResultId)}
              className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {deletingResultId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Are you sure you want to permanently delete this study result from your desk? This action cannot be undone.
        </p>
      </Modal>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-200 text-xs font-semibold animate-slideUp">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
