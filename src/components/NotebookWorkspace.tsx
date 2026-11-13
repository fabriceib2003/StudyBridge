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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        
        {/* Subject Switcher */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">Subject:</span>
          
          <select
            value={activeSubjectId}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsInlineCreatingSubject(true);
              } else {
                navigate(`/subject/${e.target.value}`);
              }
            }}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:border-blue-500 shadow-sm"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isPrivate ? '(Private)' : ''}
              </option>
            ))}
            <option value="__NEW__" className="text-blue-600 font-bold">+ New subject</option>
          </select>

          <button
            onClick={() => setIsInlineCreatingSubject(prev => !prev)}
            className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Subject</span>
          </button>

          <button
            onClick={() => setIsManageSubjectsOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-medium transition-colors shadow-sm"
          >
            Manage
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full justify-around">
          <button
            onClick={() => setMobileTab('sources')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'sources' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Sources ({subjectMaterials.length})
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'chat' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Workspace
          </button>
          <button
            onClick={() => setMobileTab('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mobileTab === 'studio' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Studio ({subjectResults.length})
          </button>
        </div>

        {/* Subject Privacy / Stats */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          <span>{subjectMaterials.length} sources</span>
          <span>·</span>
          <span>{subjectResults.length} generated items</span>
          {activeSubject?.isPrivate && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Lock className="w-3 h-3" /> Private (On-device)
            </span>
          )}
        </div>
      </div>

      {/* Inline Subject Creation Banner */}
      {isInlineCreatingSubject && (
        <form onSubmit={handleCreateSubjectInline} className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 shrink-0 mb-4 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1 w-full">
            <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              type="text"
              required
              value={inlineSubName}
              onChange={(e) => setInlineSubName(e.target.value)}
              placeholder="New Subject Name (e.g. Quantum Physics, Organic Chemistry)..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inlineSubIsPrivate}
                onChange={(e) => setInlineSubIsPrivate(e.target.checked)}
                className="rounded text-blue-600 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-amber-500" /> Private
              </span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow"
            >
              Create Subject
            </button>
            <button
              type="button"
              onClick={() => setIsInlineCreatingSubject(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Three Panel Notebook Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        
        {/* 1. LEFT PANEL: SOURCES (Collapsible, Resizable) */}
        <div className={`lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'sources' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                Sources ({subjectMaterials.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAddingMaterial(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Source
              </button>
            </div>
          </div>

          {/* Select All Checkbox Bar */}
          {subjectMaterials.length > 0 && (
            <div className="flex items-center justify-between py-2.5 px-2 border-b border-slate-100 dark:border-slate-800 shrink-0 text-xs text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={selectedMaterialIds.length === subjectMaterials.length && subjectMaterials.length > 0}
                  onChange={handleSelectAllSources}
                  className="rounded text-blue-600 w-4 h-4 focus:ring-blue-500"
                />
                <span>Select all ({selectedMaterialIds.length}/{subjectMaterials.length})</span>
              </label>
            </div>
          )}

          {/* Sources List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
            {subjectMaterials.length === 0 ? (
              <div className="text-center py-16 space-y-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No sources added yet</p>
                <p className="text-[11px] text-slate-400">Upload PDFs, slides, textbooks, or notes to ground your AI notebook workspace.</p>
                <button
                  onClick={() => setIsAddingMaterial(true)}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow"
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
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0 select-none">
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleToggleMaterialCheckbox(mat.id)}
                          className="mt-0.5 rounded text-blue-600 w-4 h-4 focus:ring-blue-500 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {mat.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {mat.contentPreview || 'Processed & indexed'}
                          </p>
                        </div>
                      </label>

                      {/* Card Menu Button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setActiveMaterialMenuId(isMenuOpen ? null : mat.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-6 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-30 text-xs">
                            <button
                              onClick={() => handleOpenInspect(mat)}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-500" /> View Visuals
                            </button>
                            <button
                              onClick={() => {
                                setMovingMaterial(mat);
                                setTargetMoveSubjectId(mat.subjectId);
                                setActiveMaterialMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" /> Move to subject...
                            </button>
                            <button
                              onClick={() => {
                                setActiveMaterialMenuId(null);
                                if (confirm(`Delete material "${mat.title}"?`)) {
                                  onDeleteMaterial(mat.id);
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        mat.status === 'Ready' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {mat.status}
                      </span>
                      {mat.hasImages && <span className="text-indigo-500 font-medium">📷 Has Visuals</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. CENTER PANEL: CHAT / "ASK YOUR NOTES" & QUICK ACTIONS */}
        <div className={`lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Header switch between Chat and Result viewer */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeCenterView === 'chat' ? `Notebook Workspace (${activeSubject?.name || 'Subject'})` : viewingResult?.title}
              </h3>
            </div>

            {activeCenterView === 'result' && (
              <button
                onClick={() => setActiveCenterView('chat')}
                className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                &larr; Back to Chat
              </button>
            )}
          </div>

          {/* Center Content Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {activeCenterView === 'result' && viewingResult ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white uppercase text-[10px]">
                      {viewingResult.type}
                    </span>
                    <span className="text-slate-500">
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

                <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <MarkdownViewer content={viewingResult.content} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Welcome banner / Grounded AI prompt */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg space-y-2">
                  <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    Grounded in {selectedMaterialIds.length} ticked source{selectedMaterialIds.length === 1 ? '' : 's'}
                  </div>
                  <h4 className="text-base font-bold tracking-tight">Ask your notes or generate study tools instantly</h4>
                  <p className="text-blue-100 text-xs leading-relaxed">
                    Answers and summaries are synthesized strictly from your selected source materials with full citations and math markdown.
                  </p>
                </div>

                {/* Quick-action chips */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Quick AI Actions
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => handleRunAction('summary')}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <BookOpen className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                      Summarize
                    </button>

                    <button
                      onClick={() => handleRunAction('explanation')}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                      Explain Simply
                    </button>

                    <button
                      onClick={() => handleRunAction('quiz')}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                      Quiz Arena
                    </button>

                    <button
                      onClick={() => handleRunAction('flashcards')}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1.5 transition-all group shadow-sm"
                    >
                      <Layers className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                      Flashcards
                    </button>
                  </div>
                </div>

                {/* Explain Simply Advanced Customizers */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Explain Simply Customization (Focus & Level)
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={explainFocus}
                      onChange={(e) => setExplainFocus(e.target.value)}
                      placeholder="Focus topic (e.g. Photosynthesis, Bayes theorem)..."
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />

                    <select
                      value={explainLevel}
                      onChange={(e: any) => setExplainLevel(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
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
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Route Preview: <strong>{activeSubject?.isPrivate ? 'On-Device (Private)' : 'Hybrid Cloud / On-Device'}</strong></span>
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
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatPrompt.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl text-xs font-semibold shadow-md flex items-center justify-center shrink-0 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 3. RIGHT PANEL: STUDIO (Grouped list of generated items + background jobs) */}
        <div className={`lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col shadow-sm overflow-hidden transition-all ${
          mobileTab !== 'studio' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
              Studio ({subjectResults.length})
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Background jobs survive navigation</span>
          </div>

          {/* Search & Type Filter */}
          <div className="py-2.5 space-y-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={studioSearch}
                onChange={(e) => setStudioSearch(e.target.value)}
                placeholder="Search Studio items..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {(['all', 'summary', 'explanation', 'quiz', 'flashcards'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setStudioTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize shrink-0 transition-colors ${
                    studioTypeFilter === type
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                className="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-2xl p-3.5 space-y-2 shadow-sm animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    Job: {job.type}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    job.status === 'running' ? 'bg-amber-500/10 text-amber-600 animate-pulse' :
                    job.status === 'failed' ? 'bg-rose-500/10 text-rose-600' :
                    job.status === 'interrupted' ? 'bg-purple-500/10 text-purple-600' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {job.title}
                </h4>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                  {job.progressText}
                </p>

                {job.status === 'running' && (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full animate-indeterminate w-full" />
                  </div>
                )}

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-blue-200 dark:border-blue-800/60">
                  {job.status === 'running' && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === 'failed' && (
                    <button
                      onClick={() => retryJob(job.id)}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  {job.status === 'interrupted' && (
                    <button
                      onClick={() => resumeJob(job.id)}
                      className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  )}
                  <button
                    onClick={() => removeJob(job.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Dismiss job"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Generated Studio Results */}
            {filteredStudioResults.length === 0 && subjectJobs.length === 0 ? (
              <div className="text-center py-16 space-y-2 px-2 text-slate-400">
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
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 space-y-2 relative shadow-sm hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
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
                      className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-blue-600"
                    >
                      {res.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-sans">
                      {res.content.slice(0, 120)}...
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-400">
                      <span>{new Date(res.timestamp).toLocaleDateString()}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewingResult(res);
                            setActiveCenterView('result');
                            setMobileTab('chat');
                          }}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open &rarr;
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete result "${res.title}"?`)) {
                              onDeleteResult(res.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-500 p-0.5"
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
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{extractionProgress}</p>
          </div>
        ) : newPages.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3 relative bg-slate-50 dark:bg-slate-800/40">
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.mp3,.wav,.m4a"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <FolderPlus className="w-10 h-10 text-blue-500 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Click or drop study file here</p>
              <p className="text-xs text-slate-400 mt-0.5">Supports PDF, slides, images, and audio notes</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveMaterial} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Material Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-base sm:text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Extracted Preview ({newPages.length} pages)</label>
              <textarea
                rows={6}
                value={newPages.map(p => p.text).join('\n\n')}
                onChange={(e) => setNewPages([{ pageNumber: 1, text: e.target.value }])}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-base sm:text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setNewPages([])}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px]"
              >
                Choose Different File
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow min-h-[44px]"
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
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMoveMaterial}
              className="bg-blue-600 text-white font-semibold"
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
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-base sm:text-xs text-slate-900 dark:text-white font-medium min-h-[44px]"
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
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="space-y-4">
            {inspectingPages[inspectSlideIndex]?.image && (
              <div className="flex justify-center bg-black/5 dark:bg-black/30 p-2 rounded-xl max-h-[300px]">
                <img src={inspectingPages[inspectSlideIndex].image} alt="Visual slide" className="max-h-[280px] object-contain" />
              </div>
            )}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl max-h-[180px] overflow-y-auto text-xs font-mono">
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
