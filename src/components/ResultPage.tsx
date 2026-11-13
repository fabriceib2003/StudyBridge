import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  RefreshCw, 
  FileText, 
  HelpCircle, 
  Layers, 
  Trash2, 
  MoreVertical, 
  Clock, 
  Cloud, 
  Cpu, 
  Zap, 
  Loader2,
  Send,
  Sparkles
} from 'lucide-react';
import { SavedResult, Subject, Material, ActionType } from '../types';
import { getResultFirestore, deleteResultFirestore, saveMaterialWithChunks, addResultFirestore, updateResultFirestore } from '../services/firestoreService';
import { getRouteLabel, executeAIRequest, cleanAndParseJSON } from '../services/aiService';
import { auth } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { MarkdownViewer } from './MarkdownViewer';
import { QuizArena } from './QuizArena';
import { FlashcardViewer } from './FlashcardViewer';
import { Modal } from './Modal';

interface ResultPageProps {
  subjects: Subject[];
  materials: Material[];
  isOnline: boolean;
  onAddMaterial: (mat: any, pages: any[]) => void;
}

export const ResultPage: React.FC<ResultPageProps> = ({
  subjects,
  materials,
  isOnline,
  onAddMaterial
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<SavedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [savedAsNote, setSavedAsNote] = useState(false);

  // Responsive state for the action bar (below 700px threshold)
  const [isBelow700, setIsBelow700] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth < 700 : false
  );
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modals for Quiz / Flashcards launched from this result
  const [activeModal, setActiveModal] = useState<'quiz' | 'flashcards' | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<any>(null);
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);
  const [copiedFollowUpId, setCopiedFollowUpId] = useState<string | null>(null);

  // Window resize listener for the 700px breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsBelow700(window.innerWidth < 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside and escape key listener for More menu and Delete modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMoreMenu(false);
        if (!isDeleting) {
          setShowDeleteDialog(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting]);

  // Load result from Firestore with safe auth handling
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchResult = async (uid: string) => {
      try {
        setLoading(true);
        const data = await getResultFirestore(uid, id);
        if (isMounted) {
          if (data) {
            setResult(data);
            if (data.flashcardData?.cards?.length) {
              setGeneratedFlashcards(data.flashcardData);
            } else if (data.content) {
              try {
                const parsed = cleanAndParseJSON(data.content);
                if (parsed?.cards?.length) {
                  setGeneratedFlashcards(parsed);
                }
              } catch {
                // ignore
              }
            }

            if (data.quizData?.questions?.length) {
              setGeneratedQuiz(data.quizData);
            } else if (data.content) {
              try {
                const parsed = cleanAndParseJSON(data.content);
                if (parsed?.questions?.length) {
                  setGeneratedQuiz(parsed);
                }
              } catch {
                // ignore
              }
            }
          } else {
            console.warn("Result not found:", id);
            setResult(null);
          }
        }
      } catch (err) {
        console.error("Error loading result:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (auth.currentUser) {
      fetchResult(auth.currentUser.uid);
    } else {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          fetchResult(user.uid);
        } else {
          setLoading(false);
        }
      });
      return () => {
        isMounted = false;
        unsub();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Helper for displaying toast notifications
  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);

    // Floating DOM element so toast survives instant navigation back to Study Desk
    try {
      if (typeof document !== 'undefined') {
        const existing = document.getElementById('studybridge-toast-container');
        if (existing && existing.parentElement) {
          existing.parentElement.removeChild(existing);
        }
        const toastEl = document.createElement('div');
        toastEl.id = 'studybridge-toast-container';
        toastEl.className = `fixed bottom-6 right-6 z-[9999] px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
          isError 
            ? 'bg-rose-600 text-white shadow-rose-600/30' 
            : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-slate-900/30'
        }`;
        toastEl.textContent = text;
        document.body.appendChild(toastEl);
        setTimeout(() => {
          toastEl.style.opacity = '0';
          toastEl.style.transform = 'translateY(10px)';
          setTimeout(() => {
            if (toastEl.parentElement) {
              toastEl.parentElement.removeChild(toastEl);
            }
          }, 300);
        }, 2500);
      }
    } catch (e) {
      console.warn("Could not attach DOM toast:", e);
    }
  };

  // Helper to format latency / duration in seconds (e.g. 352.2s, 1.4s), never milliseconds
  const formatSeconds = (ms?: number | null): string => {
    if (ms === undefined || ms === null || isNaN(ms)) return '';
    const seconds = ms / 1000;
    return `${Number(seconds.toFixed(1))}s`;
  };

  // Helper to get type label: if missing, show "Result", NEVER "Concept Explanation"
  const getTypeLabel = (type?: string | null): string => {
    if (!type || !type.trim()) {
      return 'Result';
    }
    const t = type.trim().toLowerCase();
    if (t === 'summary') return 'Document Summary';
    if (t === 'explanation' || t === 'explain') return 'Concept Explanation';
    if (t === 'quiz') return 'Quiz';
    if (t === 'flashcards' || t === 'flashcard') return 'Flashcards';
    if (t === 'answer' || t === 'custom') return 'Answer';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Follow-up question state
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const handleAskFollowUp = async () => {
    if (!result || !followUpQuestion.trim() || !auth.currentUser || isSubmittingFollowUp) return;
    setIsSubmittingFollowUp(true);
    try {
      const subject = subjects.find(s => s.id === result.subjectId);
      
      // Build 100% relevant context directly based on this result's type and content
      let contextContent = "";
      if (result.type === 'flashcards' || (result.type as string) === 'flashcard') {
        const cards = generatedFlashcards?.cards || result.flashcardData?.cards || [];
        if (cards.length > 0) {
          contextContent = `Flashcard Deck (${result.title}):\n` + 
            cards.map((c: any, i: number) => `Card ${i + 1}:\nFront / Question: ${c.front}\nBack / Answer: ${c.back}`).join('\n\n');
        } else {
          contextContent = result.content;
        }
      } else if (result.type === 'quiz') {
        const questions = generatedQuiz?.questions || result.quizData?.questions || [];
        if (questions.length > 0) {
          contextContent = `Quiz (${result.title}):\n` +
            questions.map((q: any, i: number) => `Question ${i + 1}: ${q.question}\nOptions: ${q.options.join(', ')}\nCorrect Answer: ${q.options[q.correctAnswer] || q.correctAnswer}\nExplanation: ${q.explanation}`).join('\n\n');
        } else {
          contextContent = result.content;
        }
      } else {
        contextContent = `${result.title}\n\n${result.content}`;
      }

      // Include previous follow-up Q&A history on this result if any exist
      let conversationHistory = "";
      if (result.followUps && result.followUps.length > 0) {
        conversationHistory = "\n\n=== Previous Follow-up Discussion on this Result ===\n" +
          result.followUps.map((fu, idx) => `Q${idx + 1}: ${fu.question}\nA${idx + 1}: ${fu.answer}`).join('\n\n');
      }

      const fullContext = `=== Current Study Result Context ===\n${contextContent}${conversationHistory}`;
      
      const res = await executeAIRequest({
        text: fullContext,
        actionType: 'answer',
        subjectName: subject?.name || 'General Study',
        instructionText: followUpQuestion.trim(),
        manualMode: 'auto',
        isOnline,
        studyLanguage: (typeof localStorage !== 'undefined' ? localStorage.getItem('studybridge_study_language') : null) || 'English'
      });

      if (!res.response || !res.response.trim()) {
        showToast('Empty response received. Please try again.', true);
        return;
      }

      const newFollowUp = {
        id: `fu_${Date.now()}`,
        question: followUpQuestion.trim(),
        answer: res.response,
        timestamp: Date.now()
      };

      const updatedFollowUps = [...(result.followUps || []), newFollowUp];

      // Save directly onto THIS result document in Firestore
      if (result.id) {
        await updateResultFirestore(auth.currentUser.uid, result.id, {
          followUps: updatedFollowUps
        });
      }

      // Update state in place without creating a new standalone card on Study Desk
      setResult(prev => prev ? { ...prev, followUps: updatedFollowUps } : null);
      setFollowUpQuestion('');
      showToast('Follow-up answered');
    } catch (err: any) {
      console.error("Follow-up error:", err);
      showToast('Failed to generate follow-up answer.', true);
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleCopy = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsNote = async () => {
    if (!result?.content || !auth.currentUser) return;
    try {
      const typePrefix = result.type === 'summary' ? 'Summary' : result.type === 'explanation' ? 'Explanation' : result.type === 'quiz' ? 'Quiz' : result.type === 'flashcards' ? 'Flashcards' : 'Answer';
      const title = `${typePrefix}: ${result.title || 'Untitled Result'}`;
      await saveMaterialWithChunks(
        auth.currentUser.uid,
        {
          subjectId: result.subjectId || '',
          title,
          pageCount: 1,
          hasImages: false
        },
        result.content,
        [{ pageNumber: 1, text: result.content, hasVisualDiagrams: false }]
      );
      setSavedAsNote(true);
      setTimeout(() => setSavedAsNote(false), 3000);
      showToast('Saved to Materials!');
    } catch (e) {
      console.error("Failed to save as note:", e);
      showToast('Failed to save as note. Please try again.', true);
    }
  };

  const handleRegenerate = async () => {
    if (!result || !auth.currentUser) return;
    setIsRegenerating(true);
    try {
      const subject = subjects.find(s => s.id === result.subjectId);
      const isAnswer = result.type === 'answer' || (result.type as string) === 'custom';
      const isQuiz = result.type === 'quiz';
      const isFlashcards = result.type === 'flashcards' || (result.type as string) === 'flashcard';
      const action: ActionType = result.type === 'summary' 
        ? 'summarize' 
        : isQuiz 
        ? 'quiz' 
        : isFlashcards 
        ? 'flashcards' 
        : isAnswer 
        ? 'answer' 
        : 'explain';

      let promptText = result.prompt || result.content;
      if (!promptText || promptText.startsWith('Generated ') || promptText.length < 20) {
        const mat = materials.find(m => result.materialIds?.includes(m.id));
        promptText = mat ? `Study material: ${mat.title}` : (subject ? `Key concepts for ${subject.name}` : 'Study material');
      }

      const res = await executeAIRequest({
        text: promptText,
        actionType: action,
        subjectName: subject?.name || 'General',
        manualMode: 'auto',
        isOnline,
        explainFocus: result.focus,
        explainLevel: result.level,
        instructionText: isAnswer ? (result.prompt || undefined) : undefined,
        studyLanguage: (typeof localStorage !== 'undefined' ? localStorage.getItem('studybridge_study_language') : null) || 'English'
      });

      if (res.flashcardData) {
        setGeneratedFlashcards(res.flashcardData);
      }
      if (res.quizData) {
        setGeneratedQuiz(res.quizData);
      }

      if (result.id) {
        await updateResultFirestore(auth.currentUser.uid, result.id, {
          content: res.response,
          route: res.route,
          latencyMs: res.latencyMs,
          ttftMs: res.ttftMs,
          timestamp: Date.now(),
          ...(res.quizData ? { quizData: res.quizData } : {}),
          ...(res.flashcardData ? { flashcardData: res.flashcardData } : {})
        });
      }

      setResult(prev => prev ? {
        ...prev,
        content: res.response,
        route: res.route,
        latencyMs: res.latencyMs,
        ttftMs: res.ttftMs,
        timestamp: Date.now(),
        ...(res.quizData ? { quizData: res.quizData } : {}),
        ...(res.flashcardData ? { flashcardData: res.flashcardData } : {})
      } : null);
      showToast('Result regenerated successfully');
    } catch (err: any) {
      console.error("Regeneration failed:", err);
      showToast('Regeneration failed. Please try again.', true);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleMakeQuiz = async () => {
    if (!result?.content) return;
    setIsGeneratingTool(true);
    try {
      const subject = subjects.find(s => s.id === result.subjectId);
      const res = await executeAIRequest({
        text: result.content,
        actionType: 'quiz',
        subjectName: subject?.name || 'Study Material',
        manualMode: 'auto',
        isOnline
      });
      if (res.quizData) {
        setGeneratedQuiz(res.quizData);
        setActiveModal('quiz');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create quiz. Please try again.', true);
    } finally {
      setIsGeneratingTool(false);
    }
  };

  const handleMakeFlashcards = async () => {
    if (!result?.content) return;
    setIsGeneratingTool(true);
    try {
      const subject = subjects.find(s => s.id === result.subjectId);
      const res = await executeAIRequest({
        text: result.content,
        actionType: 'flashcards',
        subjectName: subject?.name || 'Study Material',
        manualMode: 'auto',
        isOnline
      });
      if (res.flashcardData) {
        setGeneratedFlashcards(res.flashcardData);
        setActiveModal('flashcards');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create flashcards. Please try again.', true);
    } finally {
      setIsGeneratingTool(false);
    }
  };

  // Safe delete handler that works for ANY saved result including broken records
  const handleConfirmDelete = async () => {
    const resultDocId = result?.id || id;
    if (!resultDocId) {
      showToast('Cannot find result ID to delete.', true);
      return;
    }

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      showToast('You must be signed in to delete this result.', true);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteResultFirestore(currentUid, resultDocId);
      setShowDeleteDialog(false);
      showToast('Deleted');
      navigate('/study', { replace: true });
    } catch (err: any) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
      showToast('Could not delete result. Please check your connection and try again.', true);
    }
  };

  // Delete Confirmation Dialog Component
  const renderDeleteDialog = () => {
    if (!showDeleteDialog) return null;
    return (
      <Modal
        isOpen={showDeleteDialog}
        onClose={() => !isDeleting && setShowDeleteDialog(false)}
        title="Delete this result?"
        subtitle="This can't be undone."
        maxWidth="confirmation"
        isConfirmation={true}
        isDestructiveActionRunning={isDeleting}
        closeOnOverlayClick={!isDeleting}
        closeOnEsc={!isDeleting}
        showCloseButton={!isDeleting}
        footer={
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setShowDeleteDialog(false)}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Are you sure you want to delete this result? This action is permanent and cannot be undone.
        </p>
      </Modal>
    );
  };

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500">Loading document...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-[960px] mx-auto px-4 py-16 text-center space-y-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Document Not Found</h3>
        <p className="text-xs text-slate-500">This AI result may have been removed or does not exist.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/study')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium whitespace-nowrap"
            style={{ whiteSpace: 'nowrap' }}
          >
            Return to Study Desk
          </button>
          {id && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="px-4 py-2 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl text-xs font-medium whitespace-nowrap"
              style={{ whiteSpace: 'nowrap' }}
            >
              Delete Record
            </button>
          )}
        </div>
        {renderDeleteDialog()}
      </div>
    );
  }

  const subject = subjects.find(s => s.id === result.subjectId);
  const hasContent = Boolean(result.content && result.content.trim().length > 0);
  const isEmptyContent = !hasContent;

  // Format latency & TTFT in seconds
  const latencySec = formatSeconds(result.latencyMs);
  const ttftSec = formatSeconds(result.ttftMs);
  const timingParts = [
    ttftSec ? `TTFT: ${ttftSec}` : '',
    latencySec
  ].filter(Boolean).join(' · ');

  const routeMeta = getRouteLabel(result.route || 'unknown', {
    routingReason: result.routingReason
  });

  const routeBadgeText = result.route === 'on-device'
    ? `On-Device ${timingParts ? `(${timingParts})` : ''}`
    : result.route === 'cloud'
    ? `Cloud ${timingParts ? `(${timingParts})` : ''}`
    : (timingParts ? `AI (${timingParts})` : 'AI');

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* Toast Alert Banner if present */}
      {toastMessage && (
        <div className={`p-3 rounded-2xl text-xs font-medium flex items-center justify-between shadow-sm animate-fadeIn ${
          toastMessage.isError 
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50' 
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
        }`}>
          <span>{toastMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-[11px] underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Action Bar: Exactly one clean row, no wrapping from 320px to 1440px */}
      <div className="flex items-center justify-between w-full gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 flex-nowrap">
        {/* Pinned Left: Back icon button with aria-label & tooltip (no text label) */}
        <button
          type="button"
          onClick={() => navigate('/study')}
          aria-label="Back to Study Desk"
          title="Back to Study Desk"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          style={{ whiteSpace: 'nowrap' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Pinned Right: Actions row */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
          {/* Copy Button */}
          {isBelow700 ? (
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasContent}
              aria-label={copied ? 'Copied' : 'Copy'}
              title={copied ? 'Copied' : 'Copy'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasContent}
              aria-label="Copy"
              title="Copy"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          )}

          {/* Regenerate Button */}
          {isBelow700 ? (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              aria-label={isRegenerating ? 'Regenerating...' : 'Regenerate'}
              title={isRegenerating ? 'Regenerating...' : 'Regenerate'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              aria-label="Regenerate"
              title="Regenerate"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-blue-500' : ''}`} />
              <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>
          )}

          {/* Above 700px: Save as Note, Make Quiz, Make Flashcards in row */}
          {!isBelow700 && (
            <>
              {/* Save as Note */}
              <button
                type="button"
                onClick={handleSaveAsNote}
                disabled={!hasContent}
                aria-label="Save as Note"
                title="Save as Note"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ whiteSpace: 'nowrap' }}
              >
                {savedAsNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                <span>{savedAsNote ? 'Saved to Materials!' : 'Save as Note'}</span>
              </button>

              {/* Make Quiz (only if not already a quiz) */}
              {result.type !== 'quiz' && (
                <button
                  type="button"
                  onClick={handleMakeQuiz}
                  disabled={isGeneratingTool || !hasContent}
                  aria-label="Make quiz from this"
                  title="Make quiz from this"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium shadow-sm transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Make quiz from this</span>
                </button>
              )}

              {/* Make Flashcards (only if not already flashcards) */}
              {result.type !== 'flashcards' && (result.type as string) !== 'flashcard' && (
                <button
                  type="button"
                  onClick={handleMakeFlashcards}
                  disabled={isGeneratingTool || !hasContent}
                  aria-label="Make flashcards from this"
                  title="Make flashcards from this"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium shadow-sm transition-colors shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Make flashcards from this</span>
                </button>
              )}
            </>
          )}

          {/* Delete Button */}
          {isBelow700 ? (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              aria-label="Delete result"
              title="Delete result"
              className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              aria-label="Delete result"
              title="Delete result"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}

          {/* Below 700px: More (three-dot) Menu for Save as Note, Make Quiz, Make Flashcards */}
          {isBelow700 && (
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu(prev => !prev)}
                aria-label="More actions"
                title="More actions"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ whiteSpace: 'nowrap' }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 animate-fadeIn">
                  <button
                    type="button"
                    disabled={!hasContent}
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleSaveAsNote();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors text-left whitespace-nowrap"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {savedAsNote ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <FileText className="w-4 h-4 text-blue-500 shrink-0" />}
                    <span>{savedAsNote ? 'Saved to Materials!' : 'Save as Note'}</span>
                  </button>

                  {result.type !== 'quiz' && (
                    <button
                      type="button"
                      disabled={isGeneratingTool || !hasContent}
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleMakeQuiz();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors text-left whitespace-nowrap"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Make quiz from this</span>
                    </button>
                  )}

                  {result.type !== 'flashcards' && (result.type as string) !== 'flashcard' && (
                    <button
                      type="button"
                      disabled={isGeneratingTool || !hasContent}
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleMakeFlashcards();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors text-left whitespace-nowrap"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                      <span>Make flashcards from this</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Document Header & Metadata Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {subject?.name || 'General Study'}
            </span>

            {/* Type badge: uses result's saved type; if missing, displays "Result", NEVER "Concept Explanation" */}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
              (result.type === 'answer' || (result.type as string) === 'custom')
                ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
            }`}>
              {getTypeLabel(result.type)}
            </span>

            {result.level && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {result.level}
              </span>
            )}
          </div>

          {/* Sync & Route Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync status */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
              result.hasPendingWrites
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              <Cloud className="w-3 h-3" />
              {result.hasPendingWrites ? 'Waiting to sync' : 'Saved to your account'}
            </span>

            {/* Route Label with timing in seconds (e.g. 352.2s), never milliseconds */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${routeMeta.bgClass} ${routeMeta.colorClass} ${routeMeta.borderClass}`}>
              {routeMeta.isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
              {routeBadgeText}
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {result.title || 'Untitled Result'}
        </h1>

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {result.timestamp 
              ? `${new Date(result.timestamp).toLocaleDateString()} at ${new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Saved Result'}
          </span>
          {latencySec && (
            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              {latencySec}
            </span>
          )}
          {result.routingReason && (
            <span className="flex items-center gap-1 truncate">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {result.routingReason}
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Interactive Flashcards, Quiz Arena, or Document View */}
      {(result.type === 'flashcards' || (result.type as string) === 'flashcard') && generatedFlashcards?.cards?.length ? (
        <div className="space-y-4">
          <FlashcardViewer
            cards={generatedFlashcards.cards}
            subjectName={subject?.name || 'Study Material'}
            onClose={() => navigate('/study')}
          />
        </div>
      ) : (result.type === 'quiz') && generatedQuiz?.questions?.length ? (
        <div className="space-y-4">
          <QuizArena
            questions={generatedQuiz.questions}
            subjectName={subject?.name || 'Study Material'}
            onClose={() => navigate('/study')}
          />
        </div>
      ) : (result.type === 'flashcards' || (result.type as string) === 'flashcard') ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Flashcard Deck</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Ready to study? Click below to generate or load the interactive flashcards.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>{isRegenerating ? 'Generating cards...' : 'Load / Generate Flashcards'}</span>
          </button>
        </div>
      ) : (result.type === 'quiz') ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HelpCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Quiz Arena</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Ready for practice? Click below to generate or load the interactive questions.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>{isRegenerating ? 'Generating questions...' : 'Load / Generate Quiz'}</span>
          </button>
        </div>
      ) : isEmptyContent ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              This result is empty
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No content was generated or saved for this record.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              style={{ whiteSpace: 'nowrap' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm min-h-[500px] space-y-6">
          {result.prompt && 
           result.prompt.trim() && 
           !result.prompt.includes('=== Source:') && 
           result.prompt.length <= 300 && (
            <blockquote className="border-l-4 border-slate-400 dark:border-slate-500 pl-4 py-2 italic text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-r-2xl">
              "{result.prompt}"
            </blockquote>
          )}
          <MarkdownViewer content={result.content} />
        </div>
      )}

      {/* Follow-up Questions & Answers Thread (attached directly to this result) */}
      {result.followUps && result.followUps.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Questions & Discussions on this {(result.type === 'flashcards' || (result.type as string) === 'flashcard') ? 'Deck' : result.type === 'quiz' ? 'Quiz' : 'Result'} ({result.followUps.length})
            </h3>
          </div>

          <div className="space-y-4">
            {result.followUps.map((fu, idx) => (
              <div 
                key={fu.id || idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 animate-fadeIn"
              >
                {/* Question */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    Q
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {fu.question}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {fu.timestamp ? new Date(fu.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>

                {/* Answer */}
                <div className="flex items-start gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="flex-1 overflow-x-auto min-w-0">
                    <MarkdownViewer content={fu.answer} />
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fu.answer);
                          setCopiedFollowUpId(fu.id || String(idx));
                          setTimeout(() => setCopiedFollowUpId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {copiedFollowUpId === (fu.id || String(idx)) ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy answer</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask a follow-up input (saves directly into this result) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            {(result.type === 'flashcards' || (result.type as string) === 'flashcard')
              ? 'Ask a question about these flashcards'
              : result.type === 'quiz'
              ? 'Ask a question about this quiz'
              : 'Ask a follow-up question'}
          </span>
          <span className={`text-[10px] ${followUpQuestion.length > 500 ? 'text-rose-500' : 'text-slate-400'}`}>
            {followUpQuestion.length}/500
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={followUpQuestion}
            onChange={(e) => setFollowUpQuestion(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskFollowUp();
              }
            }}
            placeholder={
              (result.type === 'flashcards' || (result.type as string) === 'flashcard')
                ? "Ask a question about these flashcards or terms..."
                : result.type === 'quiz'
                ? "Ask a question about these quiz questions or concepts..."
                : result.type === 'summary'
                ? "Ask a question based on this summary..."
                : "Ask a follow-up question based on this result..."
            }
            disabled={isSubmittingFollowUp}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleAskFollowUp}
            disabled={isSubmittingFollowUp || !followUpQuestion.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all whitespace-nowrap cursor-pointer"
          >
            {isSubmittingFollowUp ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Answers stay saved here on this {(result.type === 'flashcards' || (result.type as string) === 'flashcard') ? 'flashcard deck' : result.type === 'quiz' ? 'quiz' : 'result'} and won't clutter your main Study Desk.
        </p>
      </div>

      {/* Delete Confirmation Dialog */}
      {renderDeleteDialog()}

      {/* Modals for Quiz / Flashcards */}
      {activeModal === 'quiz' && generatedQuiz && (
        <QuizArena
          questions={generatedQuiz.questions}
          subjectName={subject?.name || 'Study Material'}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'flashcards' && generatedFlashcards && (
        <FlashcardViewer
          cards={generatedFlashcards.cards}
          subjectName={subject?.name || 'Study Material'}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};
