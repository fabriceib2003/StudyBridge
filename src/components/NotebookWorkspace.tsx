import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FolderPlus, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Layers, 
  Search, 
  Filter, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Cpu, 
  Cloud, 
  Zap, 
  Lock, 
  MoreVertical, 
  ArrowRightLeft, 
  Eye, 
  X, 
  FileText, 
  AlertTriangle,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Send,
  MessageSquare
} from 'lucide-react';
import { Subject, Material, SavedResult, Page, ActionType } from '../types';
import { useJobs, BackgroundJob } from '../services/jobService';
import { getRouteLabel, executeAIRequest, determineRoute } from '../services/aiService';
import { loadMaterialContent, saveMaterialWithChunks } from '../services/firestoreService';
import { getMaterialPagesLocal } from '../services/mediaStorage';
import { auth } from '../services/firebaseService';
import { MarkdownViewer } from './MarkdownViewer';
import { QuizArena } from './QuizArena';
import { FlashcardViewer } from './FlashcardViewer';
import { ManageSubjectsModal } from './ManageSubjectsModal';
import { extractText, transcribeAudio } from '../services/materialExtractor';
import { Modal } from './Modal';

interface NotebookWorkspaceProps {
  subjects: Subject[];
  materials: Material[];
  savedResults: SavedResult[];
  isOnline: boolean;
  onAddSubject: (subject: Omit<Subject, 'id'>) => Promise<any>;
  onUpdateSubject: (id: string, updates: Partial<Subject>) => Promise<any>;
  onDeleteSubjectWithOptions: (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => Promise<any>;
  onAddMaterial: (material: any, pages: Page[]) => Promise<any>;
  onDeleteMaterial: (id: string) => Promise<any>;
  onMoveMaterial: (materialId: string, newSubjectId: string) => Promise<any>;
  onDeleteResult: (resultId: string) => Promise<any>;
}

export const NotebookWorkspace: React.FC<NotebookWorkspaceProps> = ({
  subjects,
  materials,
  savedResults,
  isOnline,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubjectWithOptions,
  onAddMaterial,
  onDeleteMaterial,
  onMoveMaterial,
  onDeleteResult
}) => {
  const { id: routeSubjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, startJob, cancelJob, retryJob, resumeJob, removeJob } = useJobs();

  // Active Subject ID
  const activeSubjectId = routeSubjectId || subjects[0]?.id || '';
  const activeSubject = subjects.find(s => s.id === activeSubjectId);
  const subjectMaterials = materials.filter(m => m.subjectId === activeSubjectId);
  const subjectResults = savedResults.filter(r => r.subjectId === activeSubjectId);
  const subjectJobs = jobs.filter(j => j.subjectId === activeSubjectId);

  // Left Panel Sources state
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const [newPages, setNewPages] = useState<Page[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(activeSubjectId);
  const [previewTab, setPreviewTab] = useState<'visuals' | 'text'>('visuals');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Material Card menu
  const [activeMaterialMenuId, setActiveMaterialMenuId] = useState<string | null>(null);
  const [movingMaterial, setMovingMaterial] = useState<Material | null>(null);
  const [targetMoveSubjectId, setTargetMoveSubjectId] = useState<string>('');
  const [inspectingMaterial, setInspectingMaterial] = useState<Material | null>(null);
  const [inspectingPages, setInspectingPages] = useState<Page[]>([]);
  const [isLoadingInspect, setIsLoadingInspect] = useState(false);
  const [inspectSlideIndex, setInspectSlideIndex] = useState(0);

  // Center Panel Chat / Ask notes state
  const [chatPrompt, setChatPrompt] = useState('');
  const [activeCenterView, setActiveCenterView] = useState<'chat' | 'result'>('chat');
  const [viewingResult, setViewingResult] = useState<SavedResult | null>(null);
  
  // Explain Simply advanced parameters
  const [explainFocus, setExplainFocus] = useState('');
  const [explainLevel, setExplainLevel] = useState<'Beginner' | 'Student' | 'Advanced'>('Student');
  const [answerLength, setAnswerLength] = useState<'short' | 'detailed'>('detailed');

  // Right Panel Studio state
  const [studioSearch, setStudioSearch] = useState('');
  const [studioTypeFilter, setStudioTypeFilter] = useState<'all' | 'summary' | 'explanation' | 'quiz' | 'flashcards'>('all');
  const [activeStudioMenuId, setActiveStudioMenuId] = useState<string | null>(null);

  // Subject switcher / management
  const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);
  const [isInlineCreatingSubject, setIsInlineCreatingSubject] = useState(false);
  const [inlineSubName, setInlineSubName] = useState('');
  const [inlineSubIsPrivate, setInlineSubIsPrivate] = useState(false);

  // Mobile Tab state ('sources' | 'chat' | 'studio')
  const [mobileTab, setMobileTab] = useState<'sources' | 'chat' | 'studio'>('chat');

  // Quizzes / Flashcards modal viewer
  const [activeArenaModal, setActiveArenaModal] = useState<'quiz' | 'flashcards' | null>(null);
  const [arenaQuizData, setArenaQuizData] = useState<any>(null);
  const [arenaFlashcardData, setArenaFlashcardData] = useState<any>(null);

  // Sync selectedMaterialIds when activeSubjectId changes
  useEffect(() => {
    setSelectedMaterialIds(subjectMaterials.map(m => m.id));
  }, [activeSubjectId, materials.length]);

  useEffect(() => {
    if (subjects.length > 0 && (!activeSubject || !subjects.some(s => s.id === activeSubjectId))) {
      navigate(`/subject/${subjects[0].id}`, { replace: true });
    }
  }, [subjects, activeSubjectId]);

  const handleSelectAllSources = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedMaterialIds(subjectMaterials.map(m => m.id));
    } else {
      setSelectedMaterialIds([]);
    }
  };

  const handleToggleMaterialCheckbox = (id: string) => {
    setSelectedMaterialIds(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 35 * 1024 * 1024) {
      alert("File size exceeds 35MB limit.");
      return;
    }

    try {
      setExtractionProgress("Starting document analysis...");
      let pages: Page[] = [];
      if (file.type.startsWith('audio/')) {
        const text = await transcribeAudio(file, setExtractionProgress);
        pages = [{ pageNumber: 1, text, hasVisualDiagrams: false }];
      } else {
        pages = await extractText(file, setExtractionProgress);
      }
      
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
      setNewTitle(cleanTitle);
      setNewPages(pages);
      setExtractionProgress(null);
      if (pages.some(p => !!p.image)) {
        setPreviewTab('visuals');
      } else {
        setPreviewTab('text');
      }
      setActiveSlideIndex(0);
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`);
      setExtractionProgress(null);
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a title.");
      return;
    }
    try {
      await onAddMaterial({
        subjectId: activeSubjectId,
        title: newTitle.trim(),
        pageCount: newPages.length,
        hasImages: newPages.some(p => !!p.image)
      }, newPages);
      setIsAddingMaterial(false);
      setNewPages([]);
      setNewTitle('');
    } catch (err: any) {
      alert(`Failed to save material: ${err.message}`);
    }
  };

  const handleCreateSubjectInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineSubName.trim()) return;
    try {
      const created = await onAddSubject({
        name: inlineSubName.trim(),
        color: 'from-blue-600 to-indigo-600',
        icon: 'BookOpen',
        isPrivate: inlineSubIsPrivate
      });
      setInlineSubName('');
      setInlineSubIsPrivate(false);
      setIsInlineCreatingSubject(false);
      if (created?.id) {
        navigate(`/subject/${created.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunAction = async (type: 'summary' | 'explanation' | 'quiz' | 'flashcards' | 'ask', customPrompt?: string) => {
    if (selectedMaterialIds.length === 0 && !customPrompt?.trim() && !chatPrompt.trim()) {
      alert("Please select at least one source material checkbox on the left.");
      return;
    }

    const promptText = customPrompt || chatPrompt;
    let title = '';
    if (type === 'summary') title = `Summary (${activeSubject?.name || 'Subject'})`;
    else if (type === 'explanation') title = `Explanation: ${explainFocus || 'Core Concepts'}`;
    else if (type === 'quiz') title = `Practice Quiz (${activeSubject?.name || 'Subject'})`;
    else if (type === 'flashcards') title = `Flashcards (${activeSubject?.name || 'Subject'})`;
    else title = `Ask: "${promptText.substring(0, 30)}..."`;

    try {
      await startJob({
        subjectId: activeSubjectId,
        type,
        title,
        materialIds: selectedMaterialIds,
        prompt: promptText,
        explainFocus,
        explainLevel,
        answerLength
      });
      setChatPrompt('');
      setActiveCenterView('chat');
    } catch (err: any) {
      alert(`Failed to start background job: ${err.message}`);
    }
  };

  const handleOpenInspect = async (mat: Material) => {
    setInspectingMaterial(mat);
    setIsLoadingInspect(true);
    setInspectSlideIndex(0);
    setActiveMaterialMenuId(null);
    try {
      const localPages = await getMaterialPagesLocal(mat.id);
      if (localPages && localPages.length > 0) {
        setInspectingPages(localPages);
      } else if (mat.pages && mat.pages.length > 0) {
        setInspectingPages(mat.pages);
      } else {
        setInspectingPages([{
          pageNumber: 1,
          text: mat.content || mat.contentPreview || 'No text extracted.',
          hasVisualDiagrams: false
        }]);
      }
    } catch (e) {
      console.warn("Could not load local pages:", e);
    } finally {
      setIsLoadingInspect(false);
    }
  };

  const handleConfirmMoveMaterial = async () => {
    if (!movingMaterial || !targetMoveSubjectId) return;
    try {
      await onMoveMaterial(movingMaterial.id, targetMoveSubjectId);
      setMovingMaterial(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Studio items
  const filteredStudioResults = subjectResults.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(studioSearch.toLowerCase()) || 
                          res.content.toLowerCase().includes(studioSearch.toLowerCase());
    const matchesType = studioTypeFilter === 'all' || res.type === studioTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 flex flex-col h-[calc(100vh-4rem)] animate-fadeIn">
      
      {/* Top Bar: Subject Switcher & Quick Actions */}
      <div className="bg-[var(--surface)] border border-[var(--border)] p-3.5 rounded-2xl shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        
        {/* Subject Switcher */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs font-semibold text-[var(--text-secondary)] shrink-0">Subject:</span>
          
          <select
            value={activeSubjectId}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsInlineCreatingSubject(true);
              } else {
                navigate(`/subject/${e.target.value}`);
              }
            }}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] font-bold cursor-pointer focus:outline-none focus:border-[var(--primary)] shadow-sm"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isPrivate ? '(Private)' : ''}
              </option>
            ))}
            <option value="__NEW__" className="text-[var(--primary-accent)] font-bold">+ New subject</option>
          </select>

          <button
            onClick={() => setIsInlineCreatingSubject(prev => !prev)}
            className="px-3 py-2 rounded-xl bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] hover:bg-[var(--hover)] text-xs font-semibold flex items-center gap-1 border border-[var(--primary-soft-border)] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Subject</span>
          </button>

          <button
            onClick={() => setIsManageSubjectsOpen(true)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] text-xs font-medium transition-colors shadow-sm"
          >
            Manage
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden items-center bg-[var(--surface-raised)] p-1 rounded-xl w-full justify-around">
          <button
            onClick={() => setMobileTab('sources')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'sources' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)]'}`}
          >
            Sources ({subjectMaterials.length})
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'chat' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)]'}`}
          >
            Workspace
          </button>
          <button
            onClick={() => setMobileTab('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'studio' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)]'}`}
          >
            Studio ({subjectResults.length})
          </button>
        </div>

        {/* Subject Privacy / Stats */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>{subjectMaterials.length} sources</span>
          <span>·</span>
          <span>{subjectResults.length} generated items</span>
          {activeSubject?.isPrivate && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warning)] bg-[var(--warning-bg)] px-2 py-0.5 rounded-full border border-[var(--warning-border)]">
              <Lock className="w-3 h-3" /> Private (On-device)
            </span>
          )}
        </div>
      </div>

      {/* Inline Subject Creation Banner */}
      {isInlineCreatingSubject && (
        <form onSubmit={handleCreateSubjectInline} className="bg-[var(--primary-soft-bg)] border border-[var(--primary-soft-border)] p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 shrink-0 mb-4 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1 w-full">
            <FolderPlus className="w-4 h-4 text-[var(--primary-accent)] shrink-0" />
            <input
              type="text"
              required
              value={inlineSubName}
              onChange={(e) => setInlineSubName(e.target.value)}
              placeholder="New Subject Name (e.g. Quantum Physics, Organic Chemistry)..."
              className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] font-medium"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inlineSubIsPrivate}
                onChange={(e) => setInlineSubIsPrivate(e.target.checked)}
                className="rounded text-[var(--primary)] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-[var(--warning)]" /> Private
              </span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow"
            >
              Create Subject
            </button>
            <button
              type="button"
              onClick={() => setIsInlineCreatingSubject(false)}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Three Panel Notebook Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        
        {/* 1. LEFT PANEL: SOURCES (Collapsible, Resizable) */}
        <div className={`lg:col-span-3 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-4 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'sources' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                Sources ({subjectMaterials.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAddingMaterial(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Source
              </button>
            </div>
          </div>

          {/* Select All Checkbox Bar */}
          {subjectMaterials.length > 0 && (
            <div className="flex items-center justify-between py-2.5 px-2 border-b border-[var(--border-subtle)] shrink-0 text-xs text-[var(--muted)]">
              <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={selectedMaterialIds.length === subjectMaterials.length && subjectMaterials.length > 0}
                  onChange={handleSelectAllSources}
                  className="rounded text-[var(--primary)] w-4 h-4 focus:ring-[var(--primary)]"
                />
                <span>Select all ({selectedMaterialIds.length}/{subjectMaterials.length})</span>
              </label>
            </div>
          )}

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
            {subjectMaterials.length === 0 ? (
              <div className="text-center py-16 space-y-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] flex items-center justify-center mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[var(--text-secondary)]">No sources added yet</p>
                <p className="text-[11px] text-[var(--muted)]">Upload PDFs, slides, textbooks, or notes to ground your AI notebook workspace.</p>
                <button
                  onClick={() => setIsAddingMaterial(true)}
                  className="px-3.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow"
                >
                  + Add Source
                </button>
              </div>
            ) : (
              subjectMaterials.map(mat => {
                const isTicked = selectedMaterialIds.includes(mat.id);
                const isMenuOpen = activeMaterialMenuId === mat.id;

                return (
                  <div
                    key={mat.id}
                    className={`p-3 rounded-2xl border transition-all space-y-2 relative ${
                      isTicked 
                        ? 'bg-[var(--primary-soft-bg)] border-[var(--primary-soft-border)]' 
                        : 'bg-[var(--surface-subtle)] border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0 select-none">
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleToggleMaterialCheckbox(mat.id)}
                          className="mt-0.5 rounded text-[var(--primary)] w-4 h-4 focus:ring-[var(--primary)] shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[var(--text)] truncate">
                            {mat.title}
                          </h4>
                          <p className="text-[10px] text-[var(--muted)] line-clamp-1 mt-0.5">
                            {mat.contentPreview || 'Processed & indexed'}
                          </p>
                        </div>
                      </label>

                      {/* Card Menu Button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setActiveMaterialMenuId(isMenuOpen ? null : mat.id)}
                          className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--hover)]"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-6 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 z-30 text-xs">
                            <button
                              onClick={() => handleOpenInspect(mat)}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--hover)] text-[var(--text-secondary)]"
                            >
                              <Eye className="w-3.5 h-3.5 text-[var(--primary-accent)]" /> View Visuals
                            </button>
                            <button
                              onClick={() => {
                                setMovingMaterial(mat);
                                setTargetMoveSubjectId(mat.subjectId);
                                setActiveMaterialMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--hover)] text-[var(--text-secondary)]"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--info)]" /> Move to subject...
                            </button>
                            <button
                              onClick={() => {
                                setActiveMaterialMenuId(null);
                                if (confirm(`Delete material "${mat.title}"?`)) {
                                  onDeleteMaterial(mat.id);
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--danger-bg)] text-[var(--danger)]"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--border-subtle)]">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        mat.status === 'Ready' ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'
                      }`}>
                        {mat.status}
                      </span>
                      {mat.hasImages && <span className="text-[var(--info)] font-medium">📷 Has Visuals</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. CENTER PANEL: CHAT / "ASK YOUR NOTES" & QUICK ACTIONS */}
        <div className={`lg:col-span-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-5 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Header switch between Chat and Result viewer */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--primary-accent)]" />
              <h3 className="text-sm font-bold text-[var(--text)]">
                {activeCenterView === 'chat' ? `Notebook Workspace (${activeSubject?.name || 'Subject'})` : viewingResult?.title}
              </h3>
            </div>

            {activeCenterView === 'result' && (
              <button
                onClick={() => setActiveCenterView('chat')}
                className="px-3 py-1 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-xs font-semibold text-[var(--text-secondary)]"
              >
                &larr; Back to Chat
              </button>
            )}
          </div>

          {/* Center Content Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {activeCenterView === 'result' && viewingResult ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between bg-[var(--surface-subtle)] p-3.5 rounded-2xl border border-[var(--border)] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-text)] uppercase text-[10px]">
                      {viewingResult.type}
                    </span>
                    <span className="text-[var(--muted)]">
                      {new Date(viewingResult.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Route & timing metadata */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const label = getRouteLabel(viewingResult.route, {
                        latencyMs: viewingResult.latencyMs,
                        ttftMs: viewingResult.ttftMs
                      });
                      return (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${label.bgClass} ${label.colorClass} ${label.borderClass}`}>
                          {label.isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                          {label.badgeText}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-[var(--surface-subtle)] p-5 rounded-2xl border border-[var(--border)]">
                  <MarkdownViewer content={viewingResult.content} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Welcome banner / Grounded AI prompt */}
                <div className="bg-[var(--primary)] rounded-2xl p-5 text-[var(--primary-text)] shadow-lg space-y-2">
                  <div className="inline-flex items-center gap-1.5 bg-[var(--primary-hover)] border border-[var(--primary-soft-border)] text-[var(--primary-text)] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" />
                    Grounded in {selectedMaterialIds.length} ticked source{selectedMaterialIds.length === 1 ? '' : 's'}
                  </div>
                  <h4 className="text-base font-bold tracking-tight">Ask your notes or generate study tools instantly</h4>
                  <p className="text-[var(--primary-text)] opacity-90 text-xs leading-relaxed">
                    Answers and summaries are synthesized strictly from your selected source materials with full citations and math markdown.
                  </p>
                </div>

                {/* Quick-action chips */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                    Quick AI Actions
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => handleRunAction('summary')}
                      className="p-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <BookOpen className="w-4 h-4 text-[var(--accent-summary)] group-hover:scale-110 transition-transform" />
                      Summarize
                    </button>

                    <button
                      onClick={() => handleRunAction('explanation')}
                      className="p-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-[var(--primary-accent)] group-hover:scale-110 transition-transform" />
                      Explain Simply
                    </button>

                    <button
                      onClick={() => handleRunAction('quiz')}
                      className="p-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <HelpCircle className="w-4 h-4 text-[var(--accent-quiz)] group-hover:scale-110 transition-transform" />
                      Quiz Arena
                    </button>

                    <button
                      onClick={() => handleRunAction('flashcards')}
                      className="p-3 rounded-2xl bg-[var(--surface-subtle)] hover:bg-[var(--hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <Layers className="w-4 h-4 text-[var(--accent-flashcards)] group-hover:scale-110 transition-transform" />
                      Flashcards
                    </button>
                  </div>
                </div>

                {/* Explain Simply Advanced Customizers */}
                <div className="bg-[var(--surface-subtle)] p-4 rounded-2xl border border-[var(--border)] space-y-3">
                  <span className="text-xs font-semibold text-[var(--text)] block">
                    Explain Simply Customization (Focus & Level)
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={explainFocus}
                      onChange={(e) => setExplainFocus(e.target.value)}
                      placeholder="Focus topic (e.g. Photosynthesis, Bayes theorem)..."
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />

                    <select
                      value={explainLevel}
                      onChange={(e: any) => setExplainLevel(e.target.value)}
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] font-medium focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                    >
                      <option value="Beginner">Beginner level</option>
                      <option value="Student">Student level</option>
                      <option value="Advanced">Advanced level</option>
                    </select>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Bottom Chat Input & Route Preview */}
          <div className="pt-3 border-t border-[var(--border-subtle)] shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--muted)] px-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[var(--warning)]" />
                <span>Route Preview: <strong className="text-[var(--text-secondary)]">{activeSubject?.isPrivate ? 'On-Device (Private)' : 'Hybrid Cloud / On-Device'}</strong></span>
              </div>
              <span>{selectedMaterialIds.length} source{selectedMaterialIds.length === 1 ? '' : 's'} selected</span>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatPrompt.trim()) return;
                handleRunAction('ask', chatPrompt);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="Ask anything about your ticked notes..."
                className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl px-4 py-3 text-xs sm:text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatPrompt.trim()}
                className="px-5 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-[var(--primary-text)] rounded-2xl text-xs font-semibold shadow-md flex items-center justify-center shrink-0 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 3. RIGHT PANEL: STUDIO (Grouped list of generated items + background jobs) */}
        <div className={`lg:col-span-3 bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-4 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'studio' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
              Studio ({subjectResults.length})
            </span>
            <span className="text-[10px] text-[var(--muted)] font-medium">Background jobs survive navigation</span>
          </div>

          {/* Search & Type Filter */}
          <div className="py-2.5 space-y-2 border-b border-[var(--border-subtle)] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={studioSearch}
                onChange={(e) => setStudioSearch(e.target.value)}
                placeholder="Search Studio items..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {(['all', 'summary', 'explanation', 'quiz', 'flashcards'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setStudioTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize shrink-0 transition-colors ${
                    studioTypeFilter === type
                      ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow'
                      : 'bg-[var(--surface-raised)] text-[var(--muted)] hover:bg-[var(--hover-strong)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Studio List & Background Jobs */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            
            {/* Active Background Jobs for this subject */}
            {subjectJobs.map(job => (
              <div 
                key={job.id} 
                className="bg-[var(--primary-soft-bg)] border border-[var(--primary-soft-border)] rounded-2xl p-3.5 space-y-2 shadow-sm animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--primary-accent)] bg-[var(--primary-soft-bg)] px-2 py-0.5 rounded-full">
                    Job: {job.type}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    job.status === 'running' ? 'bg-[var(--warning-bg)] text-[var(--warning)] animate-pulse' :
                    job.status === 'failed' ? 'bg-[var(--danger-bg)] text-[var(--danger)]' :
                    job.status === 'interrupted' ? 'bg-[var(--accent-flashcards-bg)] text-[var(--accent-flashcards)]' : 'bg-[var(--surface-raised)] text-[var(--muted)]'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[var(--text)] truncate">
                  {job.title}
                </h4>

                <p className="text-[11px] text-[var(--text-secondary)] font-mono">
                  {job.progressText}
                </p>

                {job.status === 'running' && (
                  <div className="w-full bg-[var(--chart-track)] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[var(--primary)] h-full animate-indeterminate w-full" />
                  </div>
                )}

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[var(--primary-soft-border)]">
                  {job.status === 'running' && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="px-2.5 py-1 bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] text-[var(--primary-text)] rounded-lg text-[10px] font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === 'failed' && (
                    <button
                      onClick={() => retryJob(job.id)}
                      className="px-2.5 py-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  {job.status === 'interrupted' && (
                    <button
                      onClick={() => resumeJob(job.id)}
                      className="px-2.5 py-1 bg-[var(--accent-flashcards)] text-[var(--primary-text)] rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  )}
                  <button
                    onClick={() => removeJob(job.id)}
                    className="p-1 text-[var(--muted)] hover:text-[var(--danger)]"
                    title="Dismiss job"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Generated Studio Results */}
            {filteredStudioResults.length === 0 && subjectJobs.length === 0 ? (
              <div className="text-center py-16 space-y-2 px-2 text-[var(--muted)]">
                <Sparkles className="w-8 h-8 opacity-40 mx-auto" />
                <p className="text-xs font-semibold">No generated items yet</p>
                <p className="text-[11px]">Run a summary, explanation, quiz, or flashcards from the center workspace.</p>
              </div>
            ) : (
              filteredStudioResults.map(res => {
                const label = getRouteLabel(res.route, { latencyMs: res.latencyMs, ttftMs: res.ttftMs });
                const isMenuOpen = activeStudioMenuId === res.id;

                return (
                  <div
                    key={res.id}
                    className="bg-[var(--surface-subtle)] border border-[var(--border)] rounded-2xl p-3.5 space-y-2 relative shadow-sm hover:border-[var(--border-strong)] transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--primary-accent)] bg-[var(--primary-soft-bg)] px-2 py-0.5 rounded-full">
                        {res.type}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${label.bgClass} ${label.colorClass} ${label.borderClass}`}>
                          {label.isDevice ? <Cpu className="w-2.5 h-2.5" /> : <Cloud className="w-2.5 h-2.5" />}
                          {label.badgeText}
                        </span>
                      </div>
                    </div>

                    <h4 
                      onClick={() => {
                        setViewingResult(res);
                        setActiveCenterView('result');
                        setMobileTab('chat');
                      }}
                      className="text-xs font-bold text-[var(--text)] truncate cursor-pointer hover:text-[var(--primary-accent)]"
                    >
                      {res.title}
                    </h4>

                    <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed font-sans">
                      {res.content.slice(0, 120)}...
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--muted)]">
                      <span>{new Date(res.timestamp).toLocaleDateString()}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewingResult(res);
                            setActiveCenterView('result');
                            setMobileTab('chat');
                          }}
                          className="font-semibold text-[var(--primary-accent)] hover:underline"
                        >
                          Open &rarr;
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete result "${res.title}"?`)) {
                              onDeleteResult(res.id);
                            }
                          }}
                          className="text-[var(--muted)] hover:text-[var(--danger)] p-0.5"
                          title="Delete result"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Add Material Modal */}
      {/* Add Material Modal */}
      <Modal
        isOpen={isAddingMaterial}
        onClose={() => setIsAddingMaterial(false)}
        title="Add Study Source"
        maxWidth="form"
      >
        {extractionProgress ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary-accent)]" />
            <p className="text-xs font-medium text-[var(--text-secondary)]">{extractionProgress}</p>
          </div>
        ) : newPages.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center space-y-3 relative bg-[var(--surface-subtle)]">
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.mp3,.wav,.m4a"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <FolderPlus className="w-10 h-10 text-[var(--primary-accent)] mx-auto" />
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Click or drop study file here</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">Supports PDF, slides, images, and audio notes</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveMaterial} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Material Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-base sm:text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] min-h-[44px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Extracted Preview ({newPages.length} pages)</label>
              <textarea
                rows={6}
                value={newPages.map(p => p.text).join('\n\n')}
                onChange={(e) => setNewPages([{ pageNumber: 1, text: e.target.value }])}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-3 text-base sm:text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setNewPages([])}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover)] min-h-[44px]"
              >
                Choose Different File
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-sm font-semibold shadow min-h-[44px]"
              >
                Save Source
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Move Material Modal */}
      <Modal
        isOpen={Boolean(movingMaterial)}
        onClose={() => setMovingMaterial(null)}
        title="Move Source to Subject"
        maxWidth="confirmation"
        isConfirmation={true}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMovingMaterial(null)}
              className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMoveMaterial}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold"
            >
              Move
            </button>
          </>
        }
      >
        <div className="space-y-3 pt-1">
          <select
            value={targetMoveSubjectId}
            onChange={(e) => setTargetMoveSubjectId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-2.5 text-base sm:text-xs text-[var(--text)] font-medium min-h-[44px]"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Inspect Visuals Modal */}
      <Modal
        isOpen={Boolean(inspectingMaterial)}
        onClose={() => setInspectingMaterial(null)}
        title={inspectingMaterial?.title || 'Material'}
        maxWidth="form"
      >
        {isLoadingInspect ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--primary-accent)]" /></div>
        ) : (
          <div className="space-y-4">
            {inspectingPages[inspectSlideIndex]?.image && (
              <div className="flex justify-center bg-[var(--surface-raised)] border border-[var(--border)] p-2 rounded-xl max-h-[300px]">
                <img src={inspectingPages[inspectSlideIndex].image} alt="Visual slide" className="max-h-[280px] object-contain" />
              </div>
            )}
            <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-4 rounded-xl max-h-[180px] overflow-y-auto text-xs font-mono text-[var(--text)]">
              {inspectingPages[inspectSlideIndex]?.text || inspectingMaterial?.contentPreview}
            </div>
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
        onUpdateSubject={onUpdateSubject}
        onDeleteSubjectWithOptions={onDeleteSubjectWithOptions}
      />
    </div>
  );
};
