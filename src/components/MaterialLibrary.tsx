import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Trash2, 
  BookOpen, 
  FolderPlus, 
  Settings, 
  Cloud, 
  FileText, 
  Loader2, 
  Image as ImageIcon, 
  Eye, 
  CheckCircle2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical,
  ArrowRightLeft,
  Lock,
  Upload,
  HardDrive,
  Video,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Material, Subject, Page } from '../types';
import { extractText, transcribeAudio } from '../services/materialExtractor';
import { getMaterialPagesLocal } from '../services/mediaStorage';
import { saveMaterialWithChunks } from '../services/firestoreService';
import { auth } from '../services/firebaseService';
import { ManageSubjectsModal } from './ManageSubjectsModal';
import { Modal } from './Modal';

const OWNER_EMAILS = ['fabriceib2003@gmail.com'];
const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleProjectNumber = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER || '';
const isDriveConfigured = Boolean(googleApiKey && googleClientId);

function getFriendlyDriveError(err: any, isOwnerUser: boolean): string {
  const msg = err?.message || String(err);
  if (msg.includes('popup') || msg.includes('closed') || msg.includes('popup_blocked') || msg.includes('timed out')) {
    return 'Google Drive couldn\'t open. Check your connection, allow pop-ups and third-party cookies for this site, or open the app in a new tab.';
  }
  if (msg.includes('access_denied') || msg.includes('permission')) {
    return 'Google Drive access was denied. Please allow permissions to select files.';
  }
  if (msg.includes('cookie') || msg.includes('idpiframe') || msg.includes('storage') || msg.includes('Third-party')) {
    return 'Google Drive couldn\'t open. Check your connection, allow pop-ups and third-party cookies for this site, or open the app in a new tab.';
  }
  if (isOwnerUser) {
    return `Google Drive setup error: ${msg}. Check API Key, Client ID, and Project Number.`;
  }
  return 'Google Drive couldn\'t open. Check your connection, allow pop-ups and third-party cookies for this site, or open the app in a new tab.';
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function loadGapi(): Promise<void> {
  if ((window as any).gapi && (window as any).gapi.picker) return;
  return new Promise<void>((resolve, reject) => {
    if ((window as any).gapi) {
      (window as any).gapi.load('picker', { 
        callback: () => {
          (window as any).gapi.load('auth', { callback: resolve });
        }, 
        onerror: reject 
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = () => {
      (window as any).gapi.load('picker', { 
        callback: () => {
          (window as any).gapi.load('auth', { callback: resolve });
        }, 
        onerror: reject 
      });
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.body.appendChild(script);
  });
}

async function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return;
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(script);
  });
}

async function getDriveAccessToken(clientId: string): Promise<string> {
  const cached = sessionStorage.getItem('google_drive_token');
  if (cached) return cached;

  await loadGis();
  return new Promise<string>((resolve, reject) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (resp.access_token) {
          sessionStorage.setItem('google_drive_token', resp.access_token);
          localStorage.setItem('studybridge_drive_connected', 'true');
          resolve(resp.access_token);
        } else {
          reject(new Error('No access token returned from Google.'));
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

interface DriveFileProgress {
  id: string;
  name: string;
  status: 'downloading' | 'extracting' | 'saved' | 'error';
  progressMsg?: string;
  errorMsg?: string;
  fileObj?: any;
}

interface MaterialLibraryProps {
  materials: Material[];
  subjects: Subject[];
  onAddMaterial: (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'status'>, pages: Page[]) => void;
  onDeleteMaterial: (id: string) => void;
  onSelectMaterial: (material: Material) => void;
  onAddSubject: (subject: Omit<Subject, 'id'>) => Promise<any>;
  onUpdateSubject?: (id: string, updates: Partial<Subject>) => Promise<any>;
  onDeleteSubjectWithOptions?: (id: string, action: 'delete-materials' | 'move', targetSubjectId?: string) => Promise<any>;
  onMoveMaterial?: (materialId: string, newSubjectId: string) => Promise<any>;
  isDeviceAiAvailable?: boolean;
}

export const MaterialLibrary: React.FC<MaterialLibraryProps> = ({
  materials,
  subjects,
  onAddMaterial,
  onDeleteMaterial,
  onSelectMaterial,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubjectWithOptions,
  onMoveMaterial,
  isDeviceAiAvailable = false
}) => {
  const navigate = useNavigate();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<'Upload' | 'Drive' | 'YouTube' | 'Paste'>('Upload');
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Manage Subjects modal state
  const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);

  // New Subject inline creation inside switcher or dialog
  const [isInlineCreatingSubject, setIsInlineCreatingSubject] = useState(false);
  const [inlineSubName, setInlineSubName] = useState('');
  const [inlineSubIsPrivate, setInlineSubIsPrivate] = useState(false);

  // New Material form state (Upload tab)
  const [newPages, setNewPages] = useState<Page[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(
    selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || '')
  );
  const [previewTab, setPreviewTab] = useState<'visuals' | 'text'>('visuals');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // YouTube tab state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubePreview, setYoutubePreview] = useState<{ title: string; channelName: string; thumbnailUrl: string } | null>(null);
  const [isLoadingYtPreview, setIsLoadingYtPreview] = useState(false);
  const [ytImportStep, setYtImportStep] = useState<'idle' | 'checking' | 'fetching' | 'saving' | 'done'>('idle');
  const [ytImportError, setYtImportError] = useState<string | null>(null);
  const [availableYtLangs, setAvailableYtLangs] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedYtLang, setSelectedYtLang] = useState<string>('');

  // Paste tab state
  const [pasteTitle, setPasteTitle] = useState('Pasted Study Note');
  const [pasteContent, setPasteContent] = useState('');

  // Google Drive tab state
  const [driveFiles, setDriveFiles] = useState<DriveFileProgress[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [isDrivePicking, setIsDrivePicking] = useState(false);
  const [driveLogs, setDriveLogs] = useState<string[]>([]);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [lastTokenError, setLastTokenError] = useState<string | null>(null);
  const [pickerCreatedState, setPickerCreatedState] = useState<boolean>(false);
  const [callbackActionsReceived, setCallbackActionsReceived] = useState<string[]>([]);

  const logDrive = (msg: string) => {
    const line = `[Drive] ${new Date().toISOString().split('T')[1].slice(0, 8)} - ${msg}`;
    console.log(line);
    setDriveLogs(prev => [...prev.slice(-30), line]);
  };

  // Move Material Modal State
  const [movingMaterial, setMovingMaterial] = useState<Material | null>(null);
  const [targetMoveSubjectId, setTargetMoveSubjectId] = useState<string>('');

  // Card dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Inspect Modal State
  const [inspectingMaterial, setInspectingMaterial] = useState<Material | null>(null);
  const [inspectingPages, setInspectingPages] = useState<Page[]>([]);
  const [isLoadingInspect, setIsLoadingInspect] = useState(false);
  const [inspectSlideIndex, setInspectSlideIndex] = useState(0);

  const currentUserEmail = auth.currentUser?.email?.toLowerCase();
  const isOwner = Boolean(currentUserEmail && OWNER_EMAILS.includes(currentUserEmail));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const resetImportForms = () => {
    setNewPages([]);
    setNewTitle('');
    setYoutubeUrl('');
    setYoutubeVideoId(null);
    setYoutubePreview(null);
    setYtImportError(null);
    setYtImportStep('idle');
    setPasteTitle('Pasted Study Note');
    setPasteContent('');
    setDriveFiles([]);
    setDriveError(null);
  };

  // Sync online/offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-process queued YouTube videos on reconnect
  useEffect(() => {
    if (!isOnline) return;

    const processQueuedVideos = async () => {
      const queued = materials.filter(m => 
        m.type === 'youtube' && 
        (m.status === 'Queued (waiting for connection)' || m.pageCount === 0) &&
        m.sourceUrl
      );
      if (queued.length === 0) return;

      const token = await auth.currentUser?.getIdToken();
      if (!token || !auth.currentUser) return;

      for (const mat of queued) {
        try {
          const videoId = extractYouTubeVideoId(mat.sourceUrl!);
          if (!videoId) continue;

          const res = await fetch('/api/youtube/transcript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ videoId })
          });

          if (res.ok) {
            const data = await res.json();
            const pages: Page[] = [{
              pageNumber: 1,
              text: data.transcript,
              hasVisualDiagrams: false
            }];
            await saveMaterialWithChunks(
              auth.currentUser.uid,
              {
                subjectId: mat.subjectId,
                title: data.title || mat.title,
                pageCount: 1,
                hasImages: false,
                type: 'youtube',
                sourceUrl: mat.sourceUrl,
                status: 'Ready'
              } as any,
              data.transcript,
              pages
            );
            onDeleteMaterial(mat.id);
            showToast(`Processed queued video: ${data.title || mat.title}`);
          }
        } catch (err) {
          console.warn("Could not process queued video:", err);
        }
      }
    };

    processQueuedVideos();
  }, [isOnline, materials]);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a title for this material.");
      return;
    }
    const targetSubjectId = newSubjectId || subjects[0]?.id || 'sub-default';

    onAddMaterial({
      subjectId: targetSubjectId,
      title: newTitle.trim(),
      pageCount: newPages.length,
      hasImages: newPages.some(p => !!p.image)
    }, newPages);

    setIsAddingMaterial(false);
    resetImportForms();
  };

  const handleYoutubeUrlChange = (val: string) => {
    setYoutubeUrl(val);
    setYtImportError(null);
    const vid = extractYouTubeVideoId(val);
    setYoutubeVideoId(vid);
    if (vid) {
      loadYoutubePreview(vid);
    } else {
      setYoutubePreview(null);
    }
  };

  const loadYoutubePreview = async (vid: string) => {
    setIsLoadingYtPreview(true);
    try {
      const res = await fetch(`/api/youtube/preview?videoId=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setYoutubePreview(data);
      } else {
        setYoutubePreview({
          title: "Couldn't load video details",
          channelName: '',
          thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
        });
      }
    } catch {
      setYoutubePreview({
        title: "Couldn't load video details",
        channelName: '',
        thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
      });
    } finally {
      setIsLoadingYtPreview(false);
    }
  };

  const handleImportYoutube = async () => {
    if (!youtubeVideoId) return;

    if (!navigator.onLine) {
      const title = youtubePreview?.title && youtubePreview.title !== "Couldn't load video details" 
        ? youtubePreview.title 
        : 'Queued YouTube Video';
      onAddMaterial({
        subjectId: newSubjectId || subjects[0]?.id || 'sub-default',
        title,
        pageCount: 0,
        hasImages: false,
        type: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        status: 'Queued (waiting for connection)'
      } as any, []);
      showToast("Link saved. Will be imported when you reconnect.");
      setIsAddingMaterial(false);
      resetImportForms();
      return;
    }

    setYtImportError(null);
    setYtImportStep('checking');

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Please sign in to import YouTube transcripts.");
      }

      setYtImportStep('fetching');
      const res = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId: youtubeVideoId,
          lang: selectedYtLang || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch transcript from video.");
      }

      if (data.availableLanguages && data.availableLanguages.length > 1 && !selectedYtLang) {
        setAvailableYtLangs(data.availableLanguages);
        setSelectedYtLang(data.selectedLanguage || data.availableLanguages[0].code);
      }

      setYtImportStep('saving');
      const pages: Page[] = [{
        pageNumber: 1,
        text: data.transcript,
        hasVisualDiagrams: false
      }];

      const finalTitle = data.title || (youtubePreview?.title && youtubePreview.title !== "Couldn't load video details" ? youtubePreview.title : 'YouTube Video');

      onAddMaterial({
        subjectId: newSubjectId || subjects[0]?.id || 'sub-default',
        title: finalTitle,
        pageCount: 1,
        hasImages: false,
        type: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`
      }, pages);

      setYtImportStep('done');
      showToast("Video added");
      setIsAddingMaterial(false);
      resetImportForms();
    } catch (err: any) {
      setYtImportStep('idle');
      setYtImportError(err.message || "Failed to import YouTube video.");
    }
  };

  const handleOpenGoogleDrive = async () => {
    if (!navigator.onLine) return;
    setDriveError(null);
    setIsDrivePicking(true);
    logDrive("Opening Google Drive integration...");

    try {
      const isIframe = window.self !== window.top;
      logDrive(`Iframe check: ${isIframe}, Origin: ${window.location.origin}`);

      logDrive("Loading Google API script (gapi)...");
      const loadTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Google Drive loading timed out (8s).')), 8000));
      await Promise.race([loadGapi(), loadTimeout]);
      logDrive(`gapi loaded: true, picker module: ${Boolean((window as any).gapi?.picker)}`);

      logDrive("Loading GIS script & requesting access token...");
      await loadGis();

      const token = await new Promise<string>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (resp: any) => {
            if (resp.error) {
              setLastTokenError(resp.error);
              logDrive(`Token request error: ${resp.error_description || resp.error}`);
              reject(new Error(resp.error_description || resp.error));
              return;
            }
            if (resp.access_token) {
              sessionStorage.setItem('google_drive_token', resp.access_token);
              localStorage.setItem('studybridge_drive_connected', 'true');
              logDrive("OAuth token obtained successfully");
              resolve(resp.access_token);
            } else {
              reject(new Error('No access token returned from Google.'));
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: '' });
      });

      logDrive("Building Google Picker instance...");
      const origin = window.location.protocol + '//' + window.location.host;
      const view = new (window as any).google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp,text/plain,application/vnd.google-apps.document,application/vnd.google-apps.presentation');

      const builder = new (window as any).google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(googleApiKey)
        .setOrigin(origin)
        .enableFeature((window as any).google.picker.Feature.MULTISELECT_ENABLED)
        .enableFeature((window as any).google.picker.Feature.SUPPORT_TEAM_DRIVES);

      if (googleProjectNumber) {
        builder.setAppId(googleProjectNumber);
      }

      const picker = builder
        .setCallback((pickerData: any) => {
          const action = pickerData[(window as any).google.picker.Response.ACTION];
          logDrive(`Picker callback action received: ${action}`);
          setCallbackActionsReceived(prev => [...prev, action]);

          if (action === (window as any).google.picker.Action.PICKED) {
            const documents = pickerData[(window as any).google.picker.Response.DOCUMENTS];
            if (documents && documents.length > 0) {
              processDriveDocuments(documents, token);
            }
          }
        })
        .build();

      setPickerCreatedState(true);
      logDrive("Picker created successfully and set visible");
      picker.setVisible(true);
    } catch (err: any) {
      const friendly = getFriendlyDriveError(err, isOwner);
      setDriveError(friendly);
      logDrive(`Drive error: ${err.message || err}`);
    } finally {
      setIsDrivePicking(false);
    }
  };

  const processDriveDocuments = async (docs: any[], token: string) => {
    const initialFiles: DriveFileProgress[] = docs.map(d => ({
      id: d.id,
      name: d.name,
      status: 'downloading',
      progressMsg: 'Downloading from Google Drive...',
      fileObj: d
    }));
    setDriveFiles(initialFiles);

    for (const docItem of docs) {
      await processSingleDriveDoc(docItem, token);
    }
  };

  const processSingleDriveDoc = async (docItem: any, token: string) => {
    try {
      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'downloading', progressMsg: 'Downloading from Google Drive...' } : f));
      
      let downloadUrl = `https://www.googleapis.com/drive/v3/files/${docItem.id}?alt=media`;
      let fileName = docItem.name;

      if (docItem.mimeType === 'application/vnd.google-apps.document') {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${docItem.id}/export?mimeType=text/plain`;
        fileName = `${docItem.name}.txt`;
      } else if (docItem.mimeType === 'application/vnd.google-apps.presentation') {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${docItem.id}/export?mimeType=application/pdf`;
        fileName = `${docItem.name}.pdf`;
      }

      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Google Drive download error (${res.status}): Please check permissions.`);
      }

      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'extracting', progressMsg: 'Extracting text and notes...' } : f));

      const pages = await extractText(file, (msg) => {
        setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, progressMsg: msg } : f));
      });

      const targetSubjectId = newSubjectId || subjects[0]?.id || 'sub-default';
      const cleanTitle = docItem.name.replace(/\.[^/.]+$/, "");

      onAddMaterial({
        subjectId: targetSubjectId,
        title: cleanTitle,
        pageCount: pages.length,
        hasImages: pages.some(p => !!p.image),
        type: 'drive'
      }, pages);

      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'saved', progressMsg: 'Saved to library' } : f));
      showToast(`Imported ${cleanTitle}`);
    } catch (err: any) {
      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'error', errorMsg: err.message || 'Failed to process file.' } : f));
    }
  };

  const handleSavePaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    const targetSubjectId = newSubjectId || subjects[0]?.id || 'sub-default';
    const pages: Page[] = [{
      pageNumber: 1,
      text: pasteContent.trim(),
      hasVisualDiagrams: false
    }];

    onAddMaterial({
      subjectId: targetSubjectId,
      title: pasteTitle.trim() || 'Pasted Study Note',
      pageCount: 1,
      hasImages: false,
      type: 'pasted'
    }, pages);

    showToast("Material saved");
    setIsAddingMaterial(false);
    resetImportForms();
  };

  const availableTabs: Array<{ id: 'Upload' | 'Drive' | 'YouTube' | 'Paste'; label: string; icon: any }> = [
    { id: 'Upload', label: 'Upload file', icon: Upload },
    ...(isOwner ? [{ id: 'Drive' as const, label: 'Google Drive', icon: HardDrive }] : []),
    { id: 'YouTube', label: 'YouTube link', icon: Video },
    { id: 'Paste', label: 'Paste text', icon: FileText }
  ];

  const handleCreateInlineSubject = async (e: React.FormEvent) => {
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
        setNewSubjectId(created.id);
        setSelectedSubjectId(created.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenInspect = async (mat: Material) => {
    setInspectingMaterial(mat);
    setIsLoadingInspect(true);
    setInspectSlideIndex(0);
    setActiveMenuId(null);
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

  const handleStudyMaterial = (mat: Material) => {
    onSelectMaterial(mat);
    navigate('/study');
  };

  const handleConfirmMove = async () => {
    if (!movingMaterial || !targetMoveSubjectId) return;
    try {
      if (onMoveMaterial) {
        await onMoveMaterial(movingMaterial.id, targetMoveSubjectId);
      }
      setMovingMaterial(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSubject = selectedSubjectId === 'all' || m.subjectId === selectedSubjectId;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.contentPreview?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesSubject && matchesSearch;
  });

  const visualPagesCount = newPages.filter(p => !!p.image).length;

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Study Materials</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Import PDFs, slides, diagrams, and recordings. Materials sync with your account with offline persistence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsManageSubjectsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-xs transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Manage Subjects
          </button>
          <button
            onClick={() => {
              setIsAddingMaterial(true);
              setNewPages([]);
              setNewTitle('');
              setNewSubjectId(selectedSubjectId !== 'all' ? selectedSubjectId : (subjects[0]?.id || ''));
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm transition-colors shadow-lg shadow-blue-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Import Material
          </button>
        </div>
      </div>

      {/* Subject Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search materials or diagram notes..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Subject Switcher with "+ New subject" always visible inside it */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsInlineCreatingSubject(true);
              } else {
                setSelectedSubjectId(e.target.value);
              }
            }}
            className="flex-1 sm:flex-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isPrivate ? '(Private)' : ''}
              </option>
            ))}
            <option value="__NEW__" className="text-blue-600 font-semibold">+ New subject</option>
          </select>

          <button
            type="button"
            onClick={() => setIsInlineCreatingSubject(true)}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors"
            title="Create new subject inline"
          >
            <Plus className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      </div>

      {/* Inline Subject Creation Banner if toggled */}
      {isInlineCreatingSubject && (
        <form onSubmit={handleCreateInlineSubject} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              type="text"
              required
              value={inlineSubName}
              onChange={(e) => setInlineSubName(e.target.value)}
              placeholder="New Subject Name (e.g. Physics, History)..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label 
              className={`flex items-center gap-1.5 text-xs select-none ${!isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer text-slate-700 dark:text-slate-300'}`}
              title={!isDeviceAiAvailable ? "Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer." : "Keep this subject private (runs only on-device)"}
            >
              <input
                type="checkbox"
                disabled={!isDeviceAiAvailable}
                checked={inlineSubIsPrivate}
                onChange={(e) => setInlineSubIsPrivate(e.target.checked)}
                className="rounded text-blue-600 w-3.5 h-3.5 disabled:cursor-not-allowed"
              />
              <span className="flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-amber-500" /> Private {!isDeviceAiAvailable && '(Unavailable)'}
              </span>
            </label>

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow"
            >
              Create
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

      {/* Import Material Modal */}
      {isAddingMaterial && (
        <Modal
          isOpen={isAddingMaterial}
          onClose={() => {
            setIsAddingMaterial(false);
            resetImportForms();
          }}
          title="Import Study Material"
          subtitle="Import from your device, Google Drive, YouTube or pasted text."
          maxWidth="form"
        >
          <div className="space-y-4">
            {/* Tabs: ONLY Name & Icon, NO sub-labels */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeImportTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex-1 py-2.5 px-2 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                    onClick={() => setActiveImportTab(tab.id)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* UPLOAD FILE TAB */}
            {activeImportTab === 'Upload' && (
              <div className="space-y-4">
                {newPages.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3 hover:border-blue-500 transition-colors cursor-pointer relative bg-slate-50/50 dark:bg-slate-800/30">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.mp3,.wav,.m4a"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      {extractionProgress ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {extractionProgress ? 'Processing Document...' : 'Click or drag a file to upload'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {extractionProgress || 'PDFs, lecture slides, textbooks, diagrams, or recordings'}
                      </p>
                    </div>
                    {!extractionProgress && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/40">
                        Text & visual diagrams are extracted client-side
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Material Title
                        </label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. Chapter 4 Cellular Respiration..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Assign to Subject
                        </label>
                        <select
                          value={newSubjectId}
                          onChange={(e) => setNewSubjectId(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.isPrivate ? '(Private)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Visuals vs Extracted Text tabs */}
                      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pt-1">
                        {visualPagesCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewTab('visuals')}
                            className={`py-1.5 px-3 text-xs font-semibold border-b-2 ${
                              previewTab === 'visuals' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500'
                            }`}
                          >
                            Visual Diagrams ({visualPagesCount})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewTab('text')}
                          className={`py-1.5 px-3 text-xs font-semibold border-b-2 ${
                            previewTab === 'text' || visualPagesCount === 0 ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500'
                          }`}
                        >
                          Text Notes ({newPages.length} Pages)
                        </button>
                      </div>

                      {previewTab === 'visuals' && visualPagesCount > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Slide {activeSlideIndex + 1} of {newPages.length}</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={activeSlideIndex === 0}
                                onClick={() => setActiveSlideIndex(p => Math.max(0, p - 1))}
                                className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={activeSlideIndex === newPages.length - 1}
                                onClick={() => setActiveSlideIndex(p => Math.min(newPages.length - 1, p + 1))}
                                className="p-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {newPages[activeSlideIndex]?.image && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-black/5 dark:bg-black/30 p-2 flex items-center justify-center max-h-[220px]">
                              <img
                                src={newPages[activeSlideIndex].image}
                                alt={`Slide ${activeSlideIndex + 1}`}
                                className="max-h-[200px] w-auto object-contain rounded"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {(previewTab === 'text' || visualPagesCount === 0) && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 max-h-[160px] overflow-y-auto text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {newPages[activeSlideIndex]?.text || newPages.map(p => p.text).join('\n\n')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewPages([]);
                          setNewTitle('');
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        Upload different file
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
                      >
                        Save to Study Library
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* GOOGLE DRIVE TAB */}
            {activeImportTab === 'Drive' && (
              <div className="space-y-4">
                {!isDriveConfigured ? (
                  <div className="p-5 border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>Google Drive isn't set up yet.</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      The Google Drive integration requires Google API credentials. Configure the following environment variables in your environment:
                    </p>
                    <div className="space-y-1.5 text-xs font-mono bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span>VITE_GOOGLE_API_KEY</span>
                        <span className={googleApiKey ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>
                          {googleApiKey ? 'Configured' : 'Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>VITE_GOOGLE_CLIENT_ID</span>
                        <span className={googleClientId ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>
                          {googleClientId ? 'Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Offline notice: ONLY shown on Drive tab when offline */}
                    {!isOnline && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Google Drive needs an internet connection.</span>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Import from Google Drive
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        StudyBridge will request read access to only the files you pick. Your Google Drive files and tokens are never stored on our servers.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supported formats: PDF, Google Docs, Google Slides, PPTX, Images, and Text.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Assign to Subject
                      </label>
                      <select
                        value={newSubjectId}
                        onChange={(e) => setNewSubjectId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.isPrivate ? '(Private)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Iframe Notice */}
                    {window.self !== window.top && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center justify-between gap-2">
                        <span>Google Drive may not work inside the preview. Open the app in its own tab.</span>
                        <button
                          type="button"
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold shrink-0 cursor-pointer"
                        >
                          Open in new tab
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleOpenGoogleDrive}
                      disabled={!isOnline || isDrivePicking}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                    >
                      {isDrivePicking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <HardDrive className="w-4 h-4" />
                      )}
                      <span>Choose from Google Drive</span>
                    </button>

                    {/* Owner Diagnostics Panel */}
                    {isOwner && (
                      <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-slate-900 text-slate-100 text-[11px] font-mono space-y-2">
                        <div 
                          className="flex items-center justify-between cursor-pointer select-none" 
                          onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                        >
                          <span className="font-bold flex items-center gap-1.5 text-blue-400">
                            <span>⚙️ Drive diagnostics (Owner Only)</span>
                          </span>
                          <span className="text-slate-400 text-xs">{isDiagnosticsOpen ? 'Hide' : 'Show'}</span>
                        </div>

                        {isDiagnosticsOpen && (
                          <div className="space-y-2 pt-2 border-t border-slate-800">
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                              <div>Iframe: {window.self !== window.top ? 'Yes' : 'No'}</div>
                              <div>Origin: {window.location.origin}</div>
                              <div>API Key: {googleApiKey ? `${googleApiKey.slice(0, 6)}...` : 'Missing'}</div>
                              <div>Client ID: {googleClientId ? `${googleClientId.slice(0, 6)}...` : 'Missing'}</div>
                              <div>Project #: {googleProjectNumber ? `${googleProjectNumber.slice(0, 6)}...` : 'Missing'}</div>
                              <div>gapi loaded: {Boolean((window as any).gapi) ? 'Yes' : 'No'}</div>
                              <div>picker loaded: {Boolean((window as any).gapi?.picker) ? 'Yes' : 'No'}</div>
                              <div>GIS loaded: {Boolean((window as any).google?.accounts?.oauth2) ? 'Yes' : 'No'}</div>
                              <div>Token obtained: {Boolean(sessionStorage.getItem('google_drive_token')) ? 'Yes' : 'No'}</div>
                              <div>Picker created: {pickerCreatedState ? 'Yes' : 'No'}</div>
                            </div>

                            {lastTokenError && (
                              <div className="text-rose-400 text-[10px]">Last Token Error: {lastTokenError}</div>
                            )}

                            <div>
                              <div className="flex items-center justify-between text-slate-400 mb-1">
                                <span>Recent Logs:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(driveLogs.join('\n'));
                                    showToast("Diagnostics copied to clipboard");
                                  }}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="bg-black/40 p-2 rounded max-h-32 overflow-y-auto text-[10px] space-y-0.5 text-slate-300">
                                {driveLogs.slice(-20).map((l, i) => (
                                  <div key={i}>{l}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {driveError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center justify-between">
                        <span>{driveError}</span>
                        <button
                          type="button"
                          onClick={handleOpenGoogleDrive}
                          className="font-semibold underline ml-2 shrink-0"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {driveFiles.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Selected Files ({driveFiles.length})
                        </span>
                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                          {driveFiles.map(file => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {file.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {file.status === 'downloading' || file.status === 'extracting' ? (
                                  <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {file.progressMsg || 'Processing...'}
                                  </span>
                                ) : file.status === 'saved' ? (
                                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Saved
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[11px] text-rose-600">
                                    <span>{file.errorMsg || 'Failed'}</span>
                                    <button
                                      type="button"
                                      onClick={() => processSingleDriveDoc(file.fileObj, sessionStorage.getItem('google_drive_token') || '')}
                                      className="underline font-semibold"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* YOUTUBE LINK TAB */}
            {activeImportTab === 'YouTube' && (
              <div className="space-y-4">
                {/* Offline notice: ONLY shown on YouTube tab when offline */}
                {!isOnline && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>You're offline. This link will be processed when you reconnect.</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    YouTube Video URL
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none ${
                      youtubeUrl && !youtubeVideoId
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
                    }`}
                  />
                  {youtubeUrl && !youtubeVideoId && (
                    <p className="text-[11px] text-rose-500 pt-0.5">
                      Please enter a valid YouTube video link (watch, youtu.be, or shorts).
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    Works with videos that have captions.
                  </p>
                </div>

                {/* Video Preview Card */}
                {youtubeVideoId && (
                  <div className="border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 flex gap-3 items-center">
                    {isLoadingYtPreview ? (
                      <div className="w-24 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <img
                        src={youtubePreview?.thumbnailUrl || `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`}
                        alt="YouTube thumbnail"
                        className="w-24 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 bg-black/10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                        {youtubePreview?.title || (isLoadingYtPreview ? 'Loading video details...' : 'YouTube Video')}
                      </p>
                      {youtubePreview?.channelName && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {youtubePreview.channelName}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Assign to Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {availableYtLangs.length > 1 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Caption Language
                    </label>
                    <select
                      value={selectedYtLang}
                      onChange={(e) => setSelectedYtLang(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      {availableYtLangs.map(l => (
                        <option key={l.code} value={l.code}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Progress bar during multi-step extraction */}
                {ytImportStep !== 'idle' && ytImportStep !== 'done' && (
                  <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl">
                    <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-semibold">
                      <span>
                        {ytImportStep === 'checking' && 'Checking captions...'}
                        {ytImportStep === 'fetching' && 'Fetching transcript...'}
                        {ytImportStep === 'saving' && 'Saving...'}
                      </span>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{
                          width: ytImportStep === 'checking' ? '33%' : ytImportStep === 'fetching' ? '66%' : '95%'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message with plain language and Retry */}
                {ytImportError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl text-xs flex items-center justify-between">
                    <span>{ytImportError}</span>
                    <button
                      type="button"
                      onClick={handleImportYoutube}
                      className="font-semibold underline ml-2 shrink-0 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleImportYoutube}
                  disabled={!youtubeVideoId || (ytImportStep !== 'idle' && ytImportStep !== 'done')}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{isOnline ? 'Import video' : 'Save link for later'}</span>
                </button>
              </div>
            )}

            {/* PASTE TEXT TAB */}
            {activeImportTab === 'Paste' && (
              <form onSubmit={handleSavePaste} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Note Title
                  </label>
                  <input
                    type="text"
                    required
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="e.g. Pasted Study Note, Anatomy Lecture Summary..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Assign to Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Study Content
                  </label>
                  <textarea
                    rows={7}
                    required
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder="Paste your study notes, textbook chapters, or transcript text here..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!pasteContent.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold shadow transition-colors cursor-pointer"
                >
                  Save Material
                </button>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* Inspect Visuals & Notes Modal */}
      <Modal
        isOpen={Boolean(inspectingMaterial)}
        onClose={() => setInspectingMaterial(null)}
        title={inspectingMaterial?.title || 'Material Details'}
        subtitle="Visual slides, diagrams, and extracted study text"
        maxWidth="wide"
        footer={
          inspectingMaterial ? (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between w-full gap-2.5">
              <button
                type="button"
                onClick={() => setInspectingMaterial(null)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const mat = inspectingMaterial;
                  setInspectingMaterial(null);
                  handleStudyMaterial(mat);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Load into Study Desk</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {isLoadingInspect ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs text-slate-500">Loading visual slides from local storage...</p>
          </div>
        ) : inspectingMaterial ? (
          <div className="space-y-4">
            {inspectingPages.length > 0 && inspectingPages[inspectSlideIndex]?.image && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Slide / Page {inspectSlideIndex + 1} of {inspectingPages.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={inspectSlideIndex === 0}
                      onClick={() => setInspectSlideIndex(prev => Math.max(0, prev - 1))}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={inspectSlideIndex === inspectingPages.length - 1}
                      onClick={() => setInspectSlideIndex(prev => Math.min(inspectingPages.length - 1, prev + 1))}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 p-2 flex items-center justify-center max-h-[300px]">
                  <img
                    src={inspectingPages[inspectSlideIndex].image}
                    alt={`Slide ${inspectSlideIndex + 1}`}
                    className="max-h-[280px] w-auto object-contain rounded"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Extracted Text Context
              </span>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 max-h-[180px] overflow-y-auto text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {inspectingPages[inspectSlideIndex]?.text || inspectingMaterial.contentPreview || 'No text extracted.'}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Move Material Modal */}
      <Modal
        isOpen={Boolean(movingMaterial)}
        onClose={() => setMovingMaterial(null)}
        title="Move to Another Subject"
        subtitle={movingMaterial ? `Select the subject to move "${movingMaterial.title}" to:` : undefined}
        icon={
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
        }
        maxWidth="confirmation"
        isConfirmation={true}
        footer={
          <>
            <button
              type="button"
              onClick={() => setMovingMaterial(null)}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMove}
              disabled={!targetMoveSubjectId || targetMoveSubjectId === movingMaterial?.subjectId}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold shadow transition-colors cursor-pointer"
            >
              Move Material
            </button>
          </>
        }
      >
        {movingMaterial && (
          <div className="space-y-3 pt-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Destination Subject
            </label>
            <select
              value={targetMoveSubjectId}
              onChange={(e) => setTargetMoveSubjectId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base sm:text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500 min-h-[44px]"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === movingMaterial.subjectId ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </Modal>

      {/* Materials Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMaterials.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No materials found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery ? "Try refining your search terms or subject filter." : "Import your first document, textbook chapter, or slide deck to begin studying."}
            </p>
            <button
              onClick={() => setIsAddingMaterial(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload First Document
            </button>
          </div>
        ) : (
          filteredMaterials.map(mat => {
            const sub = subjects.find(s => s.id === mat.subjectId);
            const isMenuOpen = activeMenuId === mat.id;

            return (
              <div 
                key={mat.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {sub?.name || 'General Subject'}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {/* Sync status per item: "Saved to your account" vs "Waiting to sync" */}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        mat.hasPendingWrites
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      }`}>
                        <Cloud className="w-2.5 h-2.5" />
                        {mat.hasPendingWrites ? 'Waiting to sync' : 'Saved to your account'}
                      </span>

                      {mat.hasImages && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                          <ImageIcon className="w-3 h-3" />
                          Visuals
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {mat.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {mat.contentPreview || 'Notes and visual diagrams processed and ready for analysis.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenInspect(mat)}
                      className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-[11px] transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Visuals
                    </button>
                    <button
                      onClick={() => handleStudyMaterial(mat)}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold text-[11px]"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Study
                    </button>
                  </div>

                  {/* Card Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(isMenuOpen ? null : mat.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 bottom-7 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-30 animate-fadeIn text-xs">
                        <button
                          onClick={() => {
                            setMovingMaterial(mat);
                            setTargetMoveSubjectId(mat.subjectId);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                          Move to subject...
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            if (confirm(`Delete material "${mat.title}"?`)) {
                              onDeleteMaterial(mat.id);
                            }
                          }}
                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete material
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
