import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Trash2, 
  BookOpen, 
  FolderPlus, 
  Folder,
  ArrowLeft,
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
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Material, Subject, Page } from '../types';
import { extractText, transcribeAudio } from '../services/materialExtractor';
import { getMaterialPagesLocal } from '../services/mediaStorage';
import { saveMaterialWithChunks, updatePreferences } from '../services/firestoreService';
import { auth } from '../services/firebaseService';
import { ManageSubjectsModal } from './ManageSubjectsModal';
import { Modal } from './Modal';
import { useActiveSubject } from '../contexts/SubjectContext';
import { useTheme } from '../contexts/ThemeContext';
import { getSubjectColorTheme, DEFAULT_SUBJECT_COLOR } from '../utils/subjectColors';

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

let memoryDriveToken: { token: string; expiry: number; email: string } | null = null;

async function getDriveAccessToken(userEmail?: string): Promise<string> {
  const now = Date.now();
  if (memoryDriveToken && memoryDriveToken.token && now < memoryDriveToken.expiry - 60000) {
    if (!userEmail || memoryDriveToken.email === userEmail) {
      return memoryDriveToken.token;
    }
  }

  await loadGis();
  return new Promise<string>((resolve, reject) => {
    const attemptRequest = (promptVal: string) => {
      const opts: any = {
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        prompt: promptVal,
        callback: (resp: any) => {
          if (resp.error) {
            if (promptVal === '' && (resp.error === 'interaction_required' || resp.error === 'login_required' || resp.error === 'account_selection_required' || resp.error === 'popup_closed_by_user')) {
              attemptRequest('select_account');
              return;
            }
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (resp.access_token) {
            const expiresIn = resp.expires_in ? Number(resp.expires_in) * 1000 : 3600000;
            memoryDriveToken = {
              token: resp.access_token,
              expiry: Date.now() + expiresIn,
              email: userEmail || ''
            };
            if (userEmail && auth.currentUser) {
              updatePreferences(auth.currentUser.uid, {
                driveConnected: { connected: true, email: userEmail }
              }).catch(() => {});
              localStorage.setItem('studybridge_drive_connected', 'true');
              localStorage.setItem('studybridge_drive_email', userEmail);
            }
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token returned from Google.'));
          }
        }
      };
      if (userEmail) {
        opts.login_hint = userEmail;
      }
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient(opts);
      tokenClient.requestAccessToken({ prompt: promptVal });
    };

    attemptRequest(memoryDriveToken ? '' : '');
  });
}

interface DriveFileProgress {
  id: string;
  name: string;
  status: 'downloading' | 'extracting' | 'saving' | 'saved' | 'error';
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

const getFolderMaterialsPerPage = (width: number): number => {
  if (width >= 1024) return 9;
  if (width >= 768) return 6;
  if (width >= 640) return 4;
  return 3;
};

const getPaginationItems = (currentPage: number, totalPages: number): (number | 'ellipsis')[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
};

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
  const { subjectId: routeSubjectId } = useParams<{ subjectId?: string }>();
  const { activeSubjectId, setActiveSubjectId } = useActiveSubject();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPage, setFolderPage] = useState<number>(1);
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
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
  const [inlineSubSwitchToIt, setInlineSubSwitchToIt] = useState(false);
  const [isSubmittingInlineSub, setIsSubmittingInlineSub] = useState(false);

  // New Material form state (Upload tab)
  const [newPages, setNewPages] = useState<Page[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(
    (routeSubjectId && routeSubjectId !== 'unfiled' ? routeSubjectId : '') || activeSubjectId || subjects[0]?.id || ''
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

  // Responsive viewport listener for inside-folder pagination
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      const token = await auth.currentUser?.getIdToken(true) || await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Please sign in to your account before importing YouTube videos.");
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
      const userEmail = auth.currentUser?.email || undefined;
      const token = await getDriveAccessToken(userEmail);
      logDrive("OAuth token obtained successfully");

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
        .enableFeature((window as any).google.picker.Feature.SUPPORT_TEAM_DRIVES)
        .setSize(1051, 650)
        .setTitle("Choose files for StudyBridge")
        .setLocale("en");

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
      progressMsg: 'Downloading',
      fileObj: d
    }));
    setDriveFiles(initialFiles);

    for (const docItem of docs) {
      await processSingleDriveDoc(docItem, token);
    }
  };

  const processSingleDriveDoc = async (docItem: any, token: string) => {
    try {
      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'downloading', progressMsg: 'Downloading' } : f));
      
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

      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'extracting', progressMsg: 'Extracting' } : f));

      const pages = await extractText(file, (msg) => {
        setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, progressMsg: msg } : f));
      });

      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'saving', progressMsg: 'Saving' } : f));

      const targetSubjectId = newSubjectId || subjects[0]?.id || 'sub-default';
      const cleanTitle = docItem.name.replace(/\.[^/.]+$/, "");

      onAddMaterial({
        subjectId: targetSubjectId,
        title: cleanTitle,
        pageCount: pages.length,
        hasImages: pages.some(p => !!p.image),
        type: 'drive'
      }, pages);

      setDriveFiles(prev => prev.map(f => f.id === docItem.id ? { ...f, status: 'saved', progressMsg: 'Saved' } : f));
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
    if (!inlineSubName.trim() || isSubmittingInlineSub) return;
    setIsSubmittingInlineSub(true);
    try {
      const created = await onAddSubject({
        name: inlineSubName.trim(),
        color: DEFAULT_SUBJECT_COLOR,
        icon: 'BookOpen',
        isPrivate: inlineSubIsPrivate
      });
      if (inlineSubSwitchToIt && created?.id) {
        setActiveSubjectId(created.id, true);
        setNewSubjectId(created.id);
      }
      setInlineSubName('');
      setInlineSubIsPrivate(false);
      setInlineSubSwitchToIt(false);
      setIsInlineCreatingSubject(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingInlineSub(false);
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
    if (mat.subjectId && subjects.some(s => s.id === mat.subjectId)) {
      setActiveSubjectId(mat.subjectId, true);
    }
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

  const subjectIdSet = new Set(subjects.map(s => s.id));
  const unfiledMaterials = materials.filter(m => !m.subjectId || !subjectIdSet.has(m.subjectId));

  const isFolderOpen = Boolean(routeSubjectId);
  const isUnfiledFolder = routeSubjectId === 'unfiled';
  const openSubject = !isUnfiledFolder && routeSubjectId ? subjects.find(s => s.id === routeSubjectId) : undefined;
  const openFolderName = isUnfiledFolder ? 'Unfiled' : openSubject?.name || 'Folder';
  const openFolderTheme = isUnfiledFolder
    ? getSubjectColorTheme('slate', isDark)
    : getSubjectColorTheme(openSubject, isDark);

  const folderMaterials = !isFolderOpen
    ? []
    : isUnfiledFolder
    ? unfiledMaterials
    : openSubject
    ? materials.filter(m => m.subjectId === openSubject.id)
    : [];

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const folderFilteredMaterials = trimmedSearch
    ? folderMaterials.filter(m => m.title.toLowerCase().includes(trimmedSearch))
    : folderMaterials;

  const folderPerPage = getFolderMaterialsPerPage(windowWidth);
  const totalFolderPages = Math.max(1, Math.ceil(folderFilteredMaterials.length / folderPerPage));

  // Reset folder pagination to page 1 when the open folder or search text changes
  useEffect(() => {
    setFolderPage(1);
  }, [routeSubjectId, searchQuery]);

  // Preserve page containing first visible material on resize & move to previous page if last item deleted
  const prevFolderPerPageRef = useRef<number>(folderPerPage);
  useEffect(() => {
    const prevPerPage = prevFolderPerPageRef.current;
    if (prevPerPage !== folderPerPage) {
      prevFolderPerPageRef.current = folderPerPage;
      setFolderPage(prev => {
        const firstVisibleIndex = (prev - 1) * prevPerPage;
        const preservedPage = Math.floor(firstVisibleIndex / folderPerPage) + 1;
        return Math.max(1, Math.min(preservedPage, totalFolderPages));
      });
    } else if (folderPage > totalFolderPages) {
      setFolderPage(totalFolderPages);
    }
  }, [folderPerPage, totalFolderPages, folderPage]);

  const openImportModal = () => {
    setIsAddingMaterial(true);
    resetImportForms();
    setNewSubjectId(openSubject?.id || activeSubjectId || subjects[0]?.id || '');
  };

  const visualPagesCount = newPages.filter(p => !!p.image).length;

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn text-[var(--text)] overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Study Materials</h2>
          <p className="text-sm text-[var(--muted)]">
            Import PDFs, slides, diagrams, and recordings. Materials sync with your account with offline persistence.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setIsManageSubjectsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] font-medium text-xs transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[var(--muted)] shrink-0" />
            Manage Subjects
          </button>
          <button
            type="button"
            onClick={openImportModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-medium text-xs sm:text-sm transition-colors shadow-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Import Material
          </button>
        </div>
      </div>

      {/* Search Bar & "+" Import Button */}
      <div className="bg-[var(--surface)] p-3.5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFolderOpen ? `Search materials in ${openFolderName}...` : 'Search materials across all subjects...'}
              className="w-full pl-9 pr-8 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openImportModal}
            className="p-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl text-[var(--primary-text)] transition-colors shadow-sm shrink-0 cursor-pointer flex items-center justify-center"
            title={openSubject ? `Import material into ${openSubject.name}` : 'Import Material'}
            aria-label="Import Material"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Subject Creation Banner if toggled */}
      {isInlineCreatingSubject && (
        <form onSubmit={handleCreateInlineSubject} className="bg-[var(--primary-soft-bg)] border border-[var(--primary-soft-border)] p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <FolderPlus className="w-4 h-4 text-[var(--primary-accent)] shrink-0" />
            <input
              type="text"
              required
              value={inlineSubName}
              onChange={(e) => setInlineSubName(e.target.value)}
              placeholder="New Subject Name (e.g. Physics, History)..."
              className="flex-1 bg-[var(--surface)] border border-[var(--input-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
            <label 
              className="flex items-center gap-1.5 text-xs select-none cursor-pointer text-[var(--text-secondary)]"
              title="Switch active subject to this new subject"
            >
              <input
                type="checkbox"
                checked={inlineSubSwitchToIt}
                onChange={(e) => setInlineSubSwitchToIt(e.target.checked)}
                className="rounded accent-[var(--primary)] w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[11px]">Switch to it</span>
            </label>

            <label 
              className={`flex items-center gap-1.5 text-xs select-none ${!isDeviceAiAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer text-[var(--text-secondary)]'}`}
              title={!isDeviceAiAvailable ? "Private subjects require on-device AI, which is not available in this browser. For offline/private AI, use Chrome on a desktop computer." : "Keep this subject private (runs only on-device)"}
            >
              <input
                type="checkbox"
                disabled={!isDeviceAiAvailable}
                checked={inlineSubIsPrivate}
                onChange={(e) => setInlineSubIsPrivate(e.target.checked)}
                className="rounded accent-[var(--primary)] w-3.5 h-3.5 disabled:cursor-not-allowed"
              />
              <span className="flex items-center gap-1 text-[11px]">
                <Lock className="w-3 h-3 text-[var(--warning)]" /> Private {!isDeviceAiAvailable && '(Unavailable)'}
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmittingInlineSub || !inlineSubName.trim()}
              className="px-3.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--primary-text)] rounded-xl text-xs font-medium shadow"
            >
              {isSubmittingInlineSub ? 'Creating...' : 'Create'}
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
            <div className="flex border-b border-[var(--border)]">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeImportTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex-1 py-2.5 px-2 text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[var(--primary)] text-[var(--primary-accent)]'
                        : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
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
                  <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center space-y-3 hover:border-[var(--primary)] transition-colors cursor-pointer relative bg-[var(--surface-subtle)]">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx,.mp3,.wav,.m4a"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] flex items-center justify-center mx-auto">
                      {extractionProgress ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {extractionProgress ? 'Processing Document...' : 'Click or drag a file to upload'}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {extractionProgress || 'PDFs, lecture slides, textbooks, diagrams, or recordings'}
                      </p>
                    </div>
                    {!extractionProgress && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--primary-accent)] bg-[var(--primary-soft-bg)] px-3 py-1 rounded-full border border-[var(--primary-soft-border)]">
                        Text & visual diagrams are extracted client-side
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                          Material Title
                        </label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. Chapter 4 Cellular Respiration..."
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                          Assign to Subject
                        </label>
                        <select
                          value={newSubjectId}
                          onChange={(e) => setNewSubjectId(e.target.value)}
                          className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.isPrivate ? '(Private)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Visuals vs Extracted Text tabs */}
                      <div className="flex items-center gap-2 border-b border-[var(--border)] pt-1">
                        {visualPagesCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewTab('visuals')}
                            className={`py-1.5 px-3 text-xs font-semibold border-b-2 ${
                              previewTab === 'visuals' ? 'border-[var(--primary)] text-[var(--primary-accent)]' : 'border-transparent text-[var(--muted)]'
                            }`}
                          >
                            Visual Diagrams ({visualPagesCount})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewTab('text')}
                          className={`py-1.5 px-3 text-xs font-semibold border-b-2 ${
                            previewTab === 'text' || visualPagesCount === 0 ? 'border-[var(--primary)] text-[var(--primary-accent)]' : 'border-transparent text-[var(--muted)]'
                          }`}
                        >
                          Text Notes ({newPages.length} Pages)
                        </button>
                      </div>

                      {previewTab === 'visuals' && visualPagesCount > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                            <span>Slide {activeSlideIndex + 1} of {newPages.length}</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={activeSlideIndex === 0}
                                onClick={() => setActiveSlideIndex(p => Math.max(0, p - 1))}
                                className="p-1 rounded bg-[var(--surface-raised)] border border-[var(--border)] disabled:opacity-40"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={activeSlideIndex === newPages.length - 1}
                                onClick={() => setActiveSlideIndex(p => Math.min(newPages.length - 1, p + 1))}
                                className="p-1 rounded bg-[var(--surface-raised)] border border-[var(--border)] disabled:opacity-40"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {newPages[activeSlideIndex]?.image && (
                            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface-raised)] p-2 flex items-center justify-center max-h-[220px]">
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
                        <div className="bg-[var(--surface-raised)] p-3 rounded-xl border border-[var(--border)] max-h-[160px] overflow-y-auto text-xs font-mono text-[var(--text)] whitespace-pre-wrap">
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
                        className="px-3 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        Upload different file
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow transition-colors"
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
                  <div className="p-5 border border-[var(--warning-border)] bg-[var(--warning-bg)] rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-[var(--warning)] font-semibold text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>Google Drive isn't set up yet.</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      The Google Drive integration requires Google API credentials. Configure environment variables.
                    </p>
                  </div>
                ) : (() => {
                  const allFilesFinished = driveFiles.length > 0 && driveFiles.every(f => f.status === 'saved' || f.status === 'error');
                  const anyFailed = driveFiles.some(f => f.status === 'error');
                  const allSuccessCount = driveFiles.filter(f => f.status === 'saved').length;
                  const targetSubject = subjects.find(s => s.id === newSubjectId) || subjects[0];

                  if (allFilesFinished && !anyFailed && driveFiles.length > 0) {
                    return (
                      <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-4 animate-fadeIn">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--success-bg)] text-[var(--success)] flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[var(--text)]">
                            {allSuccessCount} file{allSuccessCount === 1 ? '' : 's'} added to {targetSubject?.name || 'Subject'}
                          </h4>
                          <p className="text-xs text-[var(--muted)] mt-1">
                            All selected files have been successfully processed and saved to your library.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingMaterial(false);
                              resetImportForms();
                              showToast(`${allSuccessCount} files imported`);
                            }}
                            className="px-4 py-2.5 bg-[var(--surface)] hover:bg-[var(--hover)] text-[var(--text-secondary)] border border-[var(--border)] rounded-xl text-xs font-medium cursor-pointer"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingMaterial(false);
                              resetImportForms();
                              showToast(`${allSuccessCount} files imported`);
                              navigate(`/materials/${newSubjectId || targetSubject?.id || ''}`);
                            }}
                            className="px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-semibold shadow cursor-pointer"
                          >
                            Open in Materials
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDriveFiles([]);
                              handleOpenGoogleDrive();
                            }}
                            className="px-4 py-2.5 bg-[var(--surface-raised)] hover:bg-[var(--hover)] text-[var(--primary-accent)] border border-[var(--primary-soft-border)] rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Import more
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {!isOnline && (
                        <div className="p-3 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] rounded-xl text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Google Drive needs an internet connection.</span>
                        </div>
                      )}

                      <div className="bg-[var(--surface-raised)] p-4 rounded-2xl border border-[var(--border)] space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-[var(--text)]">
                            Choose from Google Drive
                          </h4>
                          <p className="text-xs text-[var(--muted)] leading-relaxed">
                            StudyBridge requests read access only to the files you select. Tokens and files are never stored on our servers.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-[var(--muted)] font-medium mr-1">Supported formats:</span>
                          {['PDF', 'Docs', 'Slides', 'PPTX', 'Images', 'Text'].map((fmt) => (
                            <span
                              key={fmt}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                            >
                              {fmt}
                            </span>
                          ))}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                            Assign to Subject
                          </label>
                          <select
                            value={newSubjectId}
                            onChange={(e) => setNewSubjectId(e.target.value)}
                            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                          >
                            {subjects.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.isPrivate ? '(Private)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleOpenGoogleDrive}
                          disabled={!isOnline || isDrivePicking}
                          className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:pointer-events-none text-[var(--primary-text)] text-xs font-semibold flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                        >
                          {isDrivePicking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <HardDrive className="w-4 h-4" />
                          )}
                          <span>Choose from Google Drive</span>
                        </button>
                      </div>

                      {/* Owner Diagnostics Panel (collapsed by default) */}
                      {isOwner && (
                        <div className="border border-[var(--border)] rounded-xl p-3 bg-[var(--code-block-bg)] text-[var(--code-block-text)] text-[11px] font-mono space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer select-none" 
                            onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                          >
                            <span className="font-bold flex items-center gap-1.5 text-[var(--primary-accent)]">
                              <span>⚙️ Drive diagnostics (Owner Only)</span>
                            </span>
                            <span className="text-[var(--muted)] text-xs">{isDiagnosticsOpen ? 'Hide' : 'Show'}</span>
                          </div>

                          {isDiagnosticsOpen && (
                            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-[var(--text-secondary)]">
                                <div>Iframe: {window.self !== window.top ? 'Yes' : 'No'}</div>
                                <div>Origin: {window.location.origin}</div>
                                <div>API Key: {googleApiKey ? `${googleApiKey.slice(0, 6)}...` : 'Missing'}</div>
                                <div>Client ID: {googleClientId ? `${googleClientId.slice(0, 6)}...` : 'Missing'}</div>
                                <div>gapi loaded: {Boolean((window as any).gapi) ? 'Yes' : 'No'}</div>
                                <div>picker loaded: {Boolean((window as any).gapi?.picker) ? 'Yes' : 'No'}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {driveError && (
                        <div className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] rounded-xl text-xs flex items-center justify-between">
                          <span>{driveError}</span>
                          <button
                            type="button"
                            onClick={handleOpenGoogleDrive}
                            className="font-semibold underline ml-2 shrink-0 cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {driveFiles.length > 0 && (
                        <div className="space-y-2.5 pt-1 border-t border-[var(--border)]">
                          <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                            Selected Files ({driveFiles.length})
                          </span>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {driveFiles.map(file => {
                              const percent = file.status === 'saved' ? 100 : file.status === 'saving' ? 90 : file.status === 'extracting' ? 65 : file.status === 'downloading' ? 30 : 100;
                              return (
                                <div
                                  key={file.id}
                                  className="p-3 bg-[var(--surface-raised)] rounded-xl text-xs border border-[var(--border)] space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <FileText className="w-3.5 h-3.5 text-[var(--primary-accent)] shrink-0" />
                                      <span className="truncate font-medium text-[var(--text)]">
                                        {file.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {file.status === 'downloading' || file.status === 'extracting' || file.status === 'saving' ? (
                                        <span className="flex items-center gap-1 text-[11px] text-[var(--primary-accent)] font-medium capitalize">
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          {file.status} ({file.progressMsg || 'Processing...'})
                                        </span>
                                      ) : file.status === 'saved' ? (
                                        <span className="flex items-center gap-1 text-[11px] text-[var(--success)] font-semibold">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Saved
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
                                          <span className="font-medium">Failed</span>
                                          <button
                                            type="button"
                                            onClick={() => processSingleDriveDoc(file.fileObj, memoryDriveToken?.token || sessionStorage.getItem('google_drive_token') || '')}
                                            className="underline font-semibold cursor-pointer"
                                          >
                                            Retry
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-full bg-[var(--chart-track)] h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${file.status === 'error' ? 'bg-[var(--danger)]' : file.status === 'saved' ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  {file.errorMsg && (
                                    <p className="text-[10px] text-[var(--danger)]">{file.errorMsg}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* YOUTUBE LINK TAB */}
            {activeImportTab === 'YouTube' && (
              <div className="space-y-4">
                {/* Offline notice: ONLY shown on YouTube tab when offline */}
                {!isOnline && (
                  <div className="p-3 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>You're offline. This link will be processed when you reconnect.</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block">
                    YouTube Video URL
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                    className={`w-full bg-[var(--input-bg)] border rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none ${
                      youtubeUrl && !youtubeVideoId
                        ? 'border-[var(--danger)] focus:border-[var(--danger)]'
                        : 'border-[var(--input-border)] focus:border-[var(--primary)]'
                    }`}
                  />
                  {youtubeUrl && !youtubeVideoId && (
                    <p className="text-[11px] text-[var(--danger)] pt-0.5">
                      Please enter a valid YouTube video link (watch, youtu.be, or shorts).
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--muted)] pt-0.5">
                    Works with videos that have captions.
                  </p>
                </div>

                {/* Video Preview Card */}
                {youtubeVideoId && (
                  <div className="border border-[var(--border)] bg-[var(--surface-raised)] rounded-2xl p-3 flex gap-3 items-center">
                    {isLoadingYtPreview ? (
                      <div className="w-24 h-16 rounded-xl bg-[var(--chart-track)] animate-pulse flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)]" />
                      </div>
                    ) : (
                      <img
                        src={youtubePreview?.thumbnailUrl || `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`}
                        alt="YouTube thumbnail"
                        className="w-24 h-16 rounded-xl object-cover shrink-0 border border-[var(--border)] bg-[var(--surface-subtle)]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-[var(--text)] line-clamp-2">
                        {youtubePreview?.title || (isLoadingYtPreview ? 'Loading video details...' : 'YouTube Video')}
                      </p>
                      {youtubePreview?.channelName && (
                        <p className="text-[11px] text-[var(--muted)] truncate">
                          {youtubePreview.channelName}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Assign to Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
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
                    <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                      Caption Language
                    </label>
                    <select
                      value={selectedYtLang}
                      onChange={(e) => setSelectedYtLang(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
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
                  <div className="space-y-2 p-3 bg-[var(--info-bg)] border border-[var(--info-border)] rounded-xl">
                    <div className="flex items-center justify-between text-xs text-[var(--info)] font-semibold">
                      <span>
                        {ytImportStep === 'checking' && 'Checking captions...'}
                        {ytImportStep === 'fetching' && 'Fetching transcript...'}
                        {ytImportStep === 'saving' && 'Saving...'}
                      </span>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="w-full bg-[var(--chart-track)] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[var(--primary)] h-full transition-all duration-300"
                        style={{
                          width: ytImportStep === 'checking' ? '33%' : ytImportStep === 'fetching' ? '66%' : '95%'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error message with plain language and Retry */}
                {ytImportError && (
                  <div className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="leading-relaxed">{ytImportError}</span>
                      <button
                        type="button"
                        onClick={handleImportYoutube}
                        className="font-semibold underline ml-2 shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                    <div className="pt-2 border-t border-[var(--danger-border)] flex items-center justify-between">
                      <span className="text-[11px] text-[var(--text-secondary)]">Have the transcript or video notes?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveImportTab('Paste');
                          if (youtubePreview?.title && youtubePreview.title !== "Couldn't load video details") {
                            setPasteTitle(youtubePreview.title);
                          }
                          setYtImportError(null);
                        }}
                        className="text-[11px] font-semibold text-[var(--primary-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Paste transcript instead &rarr;
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleImportYoutube}
                  disabled={!youtubeVideoId || (ytImportStep !== 'idle' && ytImportStep !== 'done')}
                  className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:pointer-events-none text-[var(--primary-text)] text-xs font-semibold flex items-center justify-center gap-2 shadow transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{isOnline ? 'Import video' : 'Save link for later'}</span>
                </button>
              </div>
            )}

            {/* PASTE TEXT TAB */}
            {activeImportTab === 'Paste' && (
              <form onSubmit={handleSavePaste} className="space-y-4">
                {youtubeVideoId && (
                  <div className="p-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                        <span>💡 Quick YouTube Transcript Guide</span>
                      </span>
                      <a
                        href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-[var(--primary-accent)] hover:underline inline-flex items-center gap-1"
                      >
                        Open video <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[var(--muted)] leading-relaxed">
                      <li>On the YouTube page, click <strong>...more</strong> below the description &rarr; <strong>Show transcript</strong>.</li>
                      <li>In the transcript box, highlight and copy the text (or click the 3 dots &rarr; <em>Toggle timestamps</em> to remove timestamps).</li>
                      <li>Paste into the <strong>Study Content</strong> box below and click <strong>Save Material</strong>.</li>
                    </ol>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Note Title
                  </label>
                  <input
                    type="text"
                    required
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                    placeholder="e.g. Pasted Study Note, Anatomy Lecture Summary..."
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Assign to Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
                    Study Content
                  </label>
                  <textarea
                    rows={7}
                    required
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    placeholder="Paste your study notes, textbook chapters, or transcript text here..."
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] font-mono leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!pasteContent.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:pointer-events-none text-[var(--primary-text)] text-xs font-semibold shadow transition-colors cursor-pointer"
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
                className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
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
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
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
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            <p className="text-xs text-[var(--muted)]">Loading visual slides from local storage...</p>
          </div>
        ) : inspectingMaterial ? (
          <div className="space-y-4">
            {inspectingPages.length > 0 && inspectingPages[inspectSlideIndex]?.image && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    Slide / Page {inspectSlideIndex + 1} of {inspectingPages.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={inspectSlideIndex === 0}
                      onClick={() => setInspectSlideIndex(prev => Math.max(0, prev - 1))}
                      className="p-2 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={inspectSlideIndex === inspectingPages.length - 1}
                      onClick={() => setInspectSlideIndex(prev => Math.min(inspectingPages.length - 1, prev + 1))}
                      className="p-2 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-subtle)] p-2 flex items-center justify-center max-h-[300px]">
                  <img
                    src={inspectingPages[inspectSlideIndex].image}
                    alt={`Slide ${inspectSlideIndex + 1}`}
                    className="max-h-[280px] w-auto object-contain rounded"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block">
                Extracted Text Context
              </span>
              <div className="bg-[var(--surface-raised)] p-4 rounded-xl border border-[var(--border)] max-h-[180px] overflow-y-auto text-xs font-mono text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
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
          <div className="w-8 h-8 rounded-xl bg-[var(--info-bg)] text-[var(--info)] flex items-center justify-center shrink-0">
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
              className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmMove}
              disabled={!targetMoveSubjectId || targetMoveSubjectId === movingMaterial?.subjectId}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-[var(--primary-text)] font-semibold shadow transition-colors cursor-pointer"
            >
              Move Material
            </button>
          </>
        }
      >
        {movingMaterial && (
          <div className="space-y-3 pt-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)] block">
              Destination Subject
            </label>
            <select
              value={targetMoveSubjectId}
              onChange={(e) => setTargetMoveSubjectId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-3 text-base sm:text-sm text-[var(--text)] font-medium focus:outline-none focus:border-[var(--primary)] min-h-[44px]"
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

      {/* Folders Grid, Cross-Subject Search Results, or Folder Detail View */}
      {(() => {
        const renderMaterialCard = (mat: Material) => {
          const sub = subjects.find(s => s.id === mat.subjectId);
          const subTheme = sub ? getSubjectColorTheme(sub, isDark) : getSubjectColorTheme('slate', isDark);
          const isMenuOpen = activeMenuId === mat.id;

          return (
            <div 
              key={mat.id} 
              style={subTheme.borderLeftStyle}
              className={`bg-[var(--surface)] border border-[var(--border)] ${subTheme.borderLeftClass} rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 hover:border-[var(--border-strong)] transition-all flex flex-col justify-between relative min-w-0`}
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    style={subTheme.badgeStyle}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 border max-w-full min-w-0"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={subTheme.dotStyle} />
                    <span className="truncate">{sub?.name || 'Unfiled'}</span>
                  </span>
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Sync status per item: "Saved to your account" vs "Waiting to sync" */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      mat.hasPendingWrites
                        ? 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]'
                        : 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
                    }`}>
                      <Cloud className="w-2.5 h-2.5 shrink-0" />
                      {mat.hasPendingWrites ? 'Waiting to sync' : 'Saved to your account'}
                    </span>

                    {mat.hasImages && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] border border-[var(--primary-soft-border)] whitespace-nowrap">
                        <ImageIcon className="w-3 h-3 shrink-0" />
                        Visuals
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[var(--text)] line-clamp-1 break-words" title={mat.title}>
                  {mat.title}
                </h3>

                <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed break-words">
                  {mat.contentPreview || 'Notes and visual diagrams processed and ready for analysis.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenInspect(mat)}
                    className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--primary-accent)] font-medium text-[11px] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    View Visuals
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStudyMaterial(mat)}
                    className="inline-flex items-center gap-1 text-[var(--primary-accent)] hover:underline font-semibold text-[11px] whitespace-nowrap cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    Study
                  </button>
                </div>

                {/* Card Actions Menu */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(isMenuOpen ? null : mat.id)}
                    aria-label="Material actions"
                    className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--hover)] cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 bottom-7 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 z-30 animate-fadeIn text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setMovingMaterial(mat);
                          setTargetMoveSubjectId(mat.subjectId);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--hover)] text-[var(--text-secondary)] whitespace-nowrap cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--primary-accent)] shrink-0" />
                        Move to subject...
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          if (confirm(`Delete material "${mat.title}"?`)) {
                            onDeleteMaterial(mat.id);
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--danger-bg)] text-[var(--danger)] whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        Delete material
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        };

        // 1. OPEN FOLDER VIEW (/materials/:subjectId)
        if (isFolderOpen) {
          const folderNotFound = !isUnfiledFolder && !openSubject;
          const currentFolderPage = Math.min(folderPage, totalFolderPages);
          const paginatedFolderMaterials = folderFilteredMaterials.slice(
            (currentFolderPage - 1) * folderPerPage,
            currentFolderPage * folderPerPage
          );
          const paginationItems = getPaginationItems(currentFolderPage, totalFolderPages);

          return (
            <div className="space-y-4">
              {/* Breadcrumb + Back button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate('/materials')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] text-xs font-medium transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    Back
                  </button>

                  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate('/materials')}
                      className="text-[var(--muted)] hover:text-[var(--text)] font-medium hover:underline whitespace-nowrap cursor-pointer"
                    >
                      Materials
                    </button>
                    <span className="text-[var(--muted)] select-none">/</span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-[var(--text)] min-w-0 truncate">
                      <Folder className="w-4 h-4 shrink-0" style={openFolderTheme.iconStyle} />
                      <span className="truncate">{openFolderName}</span>
                    </span>
                  </nav>

                  {openSubject?.isPrivate && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      <Lock className="w-2.5 h-2.5 shrink-0" /> Private
                    </span>
                  )}
                </div>

                <span className="text-xs text-[var(--muted)] font-medium whitespace-nowrap">
                  {folderMaterials.length} {folderMaterials.length === 1 ? 'material' : 'materials'}
                </span>
              </div>

              {folderNotFound ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-10 text-center space-y-3">
                  <h3 className="text-sm font-bold text-[var(--text)]">Folder not found</h3>
                  <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                    This subject folder may have been deleted or moved.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/materials')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    Back to Materials
                  </button>
                </div>
              ) : folderMaterials.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-10 sm:p-12 text-center space-y-3">
                  <div
                    className="w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto"
                    style={openFolderTheme.iconBoxStyle}
                  >
                    <Folder className="w-6 h-6" style={openFolderTheme.iconStyle} />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text)]">No materials in {openFolderName} yet</h3>
                  <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                    Import your first document, slides, YouTube transcript, or study notes into this folder.
                  </p>
                  <button
                    type="button"
                    onClick={openImportModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    Import material
                  </button>
                </div>
              ) : folderFilteredMaterials.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-10 text-center space-y-3">
                  <h3 className="text-sm font-bold text-[var(--text)]">No matching materials</h3>
                  <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                    No materials in {openFolderName} match "{searchQuery.trim()}".
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--hover)] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedFolderMaterials.map(renderMaterialCard)}
                  </div>

                  {/* Pagination inside folder */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
                    <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">
                      Showing {(currentFolderPage - 1) * folderPerPage + 1}–{Math.min(currentFolderPage * folderPerPage, folderFilteredMaterials.length)} of {folderFilteredMaterials.length}
                    </span>

                    {totalFolderPages > 1 && (
                      <div className="flex items-center gap-1 flex-wrap ml-auto">
                        <button
                          type="button"
                          onClick={() => setFolderPage(p => Math.max(1, p - 1))}
                          disabled={currentFolderPage <= 1}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--hover)] transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Previous
                        </button>
                        {paginationItems.map((item, idx) =>
                          item === 'ellipsis' ? (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-1.5 text-xs text-[var(--muted)] select-none"
                              aria-hidden="true"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setFolderPage(item)}
                              aria-current={currentFolderPage === item ? 'page' : undefined}
                              className={`min-w-[28px] h-7 px-2 text-xs rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                currentFolderPage === item
                                  ? 'bg-[var(--primary)] text-[var(--primary-text)]'
                                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--hover)] shadow-xs'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => setFolderPage(p => Math.min(totalFolderPages, p + 1))}
                          disabled={currentFolderPage >= totalFolderPages}
                          className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--hover)] transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 2. ROOT /materials WITH ACTIVE SEARCH -> GROUPED RESULTS ACROSS ALL SUBJECTS
        if (trimmedSearch) {
          const matchingMaterials = materials.filter(m => m.title.toLowerCase().includes(trimmedSearch));
          const groups: Array<{ id: string; name: string; theme: ReturnType<typeof getSubjectColorTheme>; isPrivate?: boolean; items: Material[] }> = [];

          subjects.forEach((sub) => {
            const items = matchingMaterials.filter(m => m.subjectId === sub.id);
            if (items.length > 0) {
              groups.push({
                id: sub.id,
                name: sub.name,
                theme: getSubjectColorTheme(sub, isDark),
                isPrivate: sub.isPrivate,
                items
              });
            }
          });

          const matchingUnfiled = matchingMaterials.filter(m => !m.subjectId || !subjectIdSet.has(m.subjectId));
          if (matchingUnfiled.length > 0) {
            groups.push({
              id: 'unfiled',
              name: 'Unfiled',
              theme: getSubjectColorTheme('slate', isDark),
              isPrivate: false,
              items: matchingUnfiled
            });
          }

          if (groups.length === 0) {
            return (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-raised)] text-[var(--muted)] flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">No materials found</h3>
                <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                  No materials across your folders match "{searchQuery.trim()}".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--hover)] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[var(--border-subtle)] pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        navigate(`/materials/${group.id}`);
                      }}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text)] hover:text-[var(--primary-accent)] transition-colors min-w-0 cursor-pointer"
                    >
                      <Folder className="w-4 h-4 shrink-0" style={group.theme.iconStyle} />
                      <span className="truncate">{group.name}</span>
                      {group.isPrivate && (
                        <Lock className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                      )}
                    </button>
                    <span className="text-[11px] font-medium text-[var(--muted)] whitespace-nowrap">
                      {group.items.length} {group.items.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map(renderMaterialCard)}
                  </div>
                </section>
              ))}
            </div>
          );
        }

        // 3. ROOT /materials FOLDER GRID
        const folderCards: Array<{
          id: string;
          name: string;
          theme: ReturnType<typeof getSubjectColorTheme>;
          count: number;
          isPrivate: boolean;
          lastUpdated: number | null;
        }> = subjects.map((sub) => {
          const subMats = materials.filter(m => m.subjectId === sub.id);
          const latestMatTs = subMats.reduce<number | null>((max, m) => {
            const ts = m.updatedAt || m.createdAt || 0;
            return ts > (max || 0) ? ts : max;
          }, null);
          return {
            id: sub.id,
            name: sub.name,
            theme: getSubjectColorTheme(sub, isDark),
            count: subMats.length,
            isPrivate: Boolean(sub.isPrivate),
            lastUpdated: latestMatTs || sub.createdAt || null
          };
        });

        if (unfiledMaterials.length > 0) {
          const latestUnfiledTs = unfiledMaterials.reduce<number | null>((max, m) => {
            const ts = m.updatedAt || m.createdAt || 0;
            return ts > (max || 0) ? ts : max;
          }, null);
          folderCards.push({
            id: 'unfiled',
            name: 'Unfiled',
            theme: getSubjectColorTheme('slate', isDark),
            count: unfiledMaterials.length,
            isPrivate: false,
            lastUpdated: latestUnfiledTs
          });
        }

        if (folderCards.length === 0) {
          return (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-10 sm:p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] flex items-center justify-center mx-auto">
                <FolderPlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text)]">No subject folders yet</h3>
              <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                Create your first subject folder to organize PDFs, lecture slides, notes, and video transcripts.
              </p>
              <button
                type="button"
                onClick={() => setIsInlineCreatingSubject(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-text)] text-xs font-semibold hover:bg-[var(--primary-hover)] transition-colors shadow whitespace-nowrap cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                Create subject
              </button>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {folderCards.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => navigate(`/materials/${folder.id}`)}
                style={folder.theme.borderLeftStyle}
                className={`bg-[var(--surface)] border border-[var(--border)] ${folder.theme.borderLeftClass} rounded-2xl p-4 sm:p-5 text-left shadow-sm hover:border-[var(--border-strong)] hover:shadow-md transition-all flex flex-col justify-between gap-4 min-w-0 w-full cursor-pointer group`}
              >
                <div className="space-y-3 w-full min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                      style={folder.theme.iconBoxStyle}
                    >
                      <Folder className="w-5 h-5" style={folder.theme.iconStyle} />
                    </div>
                    {folder.isPrivate && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        <Lock className="w-2.5 h-2.5 shrink-0" /> Private
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text)] line-clamp-2 break-words group-hover:text-[var(--primary-accent)] transition-colors">
                      {folder.name}
                    </h3>
                    <p className="text-xs font-medium text-[var(--muted)]">
                      {folder.count} {folder.count === 1 ? 'material' : 'materials'}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px] text-[var(--muted)] w-full">
                  <span className="truncate">
                    {folder.lastUpdated
                      ? `Updated ${new Date(folder.lastUpdated).toLocaleDateString()}`
                      : 'Empty folder'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        );
      })()}

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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[var(--toast-bg)] text-[var(--toast-text)] border border-[var(--toast-border)] px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
