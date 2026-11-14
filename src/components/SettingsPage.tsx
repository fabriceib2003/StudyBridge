import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  User as UserIcon, 
  Palette, 
  Cpu, 
  Shield, 
  Bell, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  Trash2, 
  Download, 
  Loader2,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { User, updatePassword, updateProfile, deleteUser } from 'firebase/auth';
import { RoutingMode, OnDeviceAIStatus } from '../types';
import { downloadOnDeviceAI } from '../services/aiService';

interface SettingsPageProps {
  user: User;
  manualMode: RoutingMode;
  setManualMode: (mode: RoutingMode) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (size: 'sm' | 'md' | 'lg') => void;
  answerLength: 'short' | 'detailed';
  setAnswerLength: (len: 'short' | 'detailed') => void;
  studyLanguage: string;
  setStudyLanguage: (lang: string) => void;
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
  reminders: boolean;
  setReminders: (rem: boolean) => void;
  onClearHistory: () => void;
  onExportData: () => void;
  onDeleteAllData: () => void;
  onSignOut: () => void;
  isDeviceAiAvailable: boolean;
  deviceAiDetails: string;
  deviceAiStatus?: OnDeviceAIStatus;
  browserName?: string;
  onRefreshDeviceAi?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  manualMode,
  setManualMode,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  answerLength,
  setAnswerLength,
  studyLanguage,
  setStudyLanguage,
  dailyGoal,
  setDailyGoal,
  reminders,
  setReminders,
  onClearHistory,
  onExportData,
  onDeleteAllData,
  onSignOut,
  isDeviceAiAvailable,
  deviceAiDetails,
  deviceAiStatus = 'unsupported',
  browserName = 'Current Browser',
  onRefreshDeviceAi
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete account confirmation text
  const [deleteInput, setDeleteInput] = useState('');

  // Unsaved changes warning
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Offline AI download state
  const [downloadingProgress, setDownloadingProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Google Drive connection state
  const [isDriveConnected, setIsDriveConnected] = useState(() => 
    localStorage.getItem('studybridge_drive_connected') === 'true' || 
    Boolean(sessionStorage.getItem('google_drive_token'))
  );

  const handleDisconnectDrive = () => {
    const token = sessionStorage.getItem('google_drive_token');
    if (token && (window as any).google?.accounts?.oauth2?.revoke) {
      try {
        (window as any).google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {
        console.warn('Revoke token warning:', e);
      }
    }
    sessionStorage.removeItem('google_drive_token');
    localStorage.removeItem('studybridge_drive_connected');
    setIsDriveConnected(false);
    showToast('Google Drive disconnected');
  };

  const handleDownloadAi = async () => {
    setIsDownloading(true);
    setDownloadingProgress(0);
    setDownloadError(null);
    try {
      const success = await downloadOnDeviceAI((percent) => {
        setDownloadingProgress(percent);
      });
      setIsDownloading(false);
      if (success) {
        showToast('Offline AI model downloaded successfully!');
        onRefreshDeviceAi?.();
      } else {
        setDownloadError('Download could not be completed in this browser. Please check browser settings.');
      }
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadError(err?.message || 'Download failed.');
    }
  };

  useEffect(() => {
    // Determine active subroute tab
    if (location.pathname === '/settings' || location.pathname === '/settings/') {
      navigate('/settings/account', { replace: true });
    }
  }, [location.pathname, navigate]);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await updateProfile(user, { displayName });
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await updatePassword(user, newPassword);
        setNewPassword('');
      }
      showToast('Account settings saved successfully!');
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') {
      setErrorMsg('Please type DELETE to confirm account deletion.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      onDeleteAllData();
      await deleteUser(user);
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  const currentTab = location.pathname.split('/').pop() || 'account';

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn text-[var(--text)]">
      
      {/* Page Title */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-[var(--muted)]">Configure your account security, AI preferences, and study goals.</p>
      </div>

      {successMsg && (
        <div className="bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Sidebar / Top Tabs */}
        <div className="w-full md:w-64 bg-[var(--surface-subtle)] border-b md:border-b-0 md:border-r border-[var(--border)] p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0">
          <button
            onClick={() => navigate('/settings/account')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'account' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Account
          </button>
          <button
            onClick={() => navigate('/settings/appearance')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'appearance' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Palette className="w-4 h-4" />
            Appearance
          </button>
          <button
            onClick={() => navigate('/settings/ai')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'ai' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            AI Preferences
          </button>
          <button
            onClick={() => navigate('/settings/privacy')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'privacy' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Shield className="w-4 h-4" />
            Privacy & Data
          </button>
          <button
            onClick={() => navigate('/migrate')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium text-[var(--warning)] hover:bg-[var(--warning-bg)] transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Restore Data (Migration)
          </button>
          <button
            onClick={() => navigate('/settings/study')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'study' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Bell className="w-4 h-4" />
            Study Goals
          </button>
          <button
            onClick={() => navigate('/settings/about')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'about' ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <Info className="w-4 h-4" />
            About
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <Routes>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold">Account Security & Credentials</h3>
                  <p className="text-xs text-[var(--muted)]">Manage your profile details and password.</p>
                </div>

                <form onSubmit={handleUpdateAccount} className="space-y-4 max-w-lg">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs text-[var(--muted)] opacity-80 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => { setDisplayName(e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">New Password (Optional)</label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-medium shadow"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] rounded-xl text-xs font-medium transition-colors border border-[var(--border)]"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </form>

                {/* Delete Account */}
                <div className="pt-6 border-t border-[var(--border)] space-y-3 max-w-lg">
                  <h4 className="text-xs font-semibold text-[var(--danger)] uppercase tracking-wider">Delete Account</h4>
                  <p className="text-xs text-[var(--muted)]">
                    Permanently delete your account and all associated study materials, analytics, and history. Type <strong className="text-[var(--danger)]">DELETE</strong> to confirm.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type DELETE"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--danger)]"
                    />
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading || deleteInput !== 'DELETE'}
                      className="px-4 py-2 bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] disabled:opacity-50 text-[var(--primary-text)] rounded-xl text-xs font-medium transition-colors"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            } />

            <Route path="appearance" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">Appearance & Theme</h3>
                  <p className="text-xs text-[var(--muted)]">Choose your color theme and reading text size across StudyBridge.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => { setTheme('light'); showToast('Theme updated to Light'); }}
                      className={`py-3 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                        theme === 'light'
                          ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow'
                          : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTheme('dark'); showToast('Theme updated to Dark'); }}
                      className={`py-3 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                        theme === 'dark'
                          ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow'
                          : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTheme('system'); showToast('Theme updated to System'); }}
                      className={`py-3 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                        theme === 'system'
                          ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow'
                          : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      System
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Font Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setFontSize('sm'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'sm' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow' : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => { setFontSize('md'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'md' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow' : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => { setFontSize('lg'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'lg' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)] shadow' : 'bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--hover-strong)]'
                      }`}
                    >
                      Large
                    </button>
                  </div>
                </div>
              </div>
            } />

            <Route path="ai" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">AI Preferences & Hybrid Routing</h3>
                  <p className="text-xs text-[var(--muted)]">Configure default routing mode and study language.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Default Routing Mode</label>
                  <select
                    value={manualMode}
                    onChange={(e) => { setManualMode(e.target.value as RoutingMode); showToast('Routing mode updated'); }}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="auto">Auto (Smart Hybrid Router)</option>
                    <option value="force-on-device" disabled={!isDeviceAiAvailable}>
                      Force On-Device (Nano){!isDeviceAiAvailable ? ' — Unavailable in this browser' : ''}
                    </option>
                    <option value="force-cloud">Force Cloud (Vertex AI)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Answer Length</label>
                  <select
                    value={answerLength}
                    onChange={(e) => { setAnswerLength(e.target.value as any); showToast('Answer length updated'); }}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="short">Concise & Direct</option>
                    <option value="detailed">Comprehensive & Detailed</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Study Language</label>
                  <input
                    type="text"
                    value={studyLanguage}
                    onChange={(e) => { setStudyLanguage(e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                {/* Offline AI Card */}
                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-5 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[var(--primary-accent)]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Offline AI
                      </h4>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      deviceAiStatus === 'available'
                        ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
                        : deviceAiStatus === 'downloadable'
                        ? 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]'
                        : deviceAiStatus === 'downloading' || isDownloading
                        ? 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]'
                        : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                    }`}>
                      {deviceAiStatus === 'available' ? 'Available' :
                       deviceAiStatus === 'downloadable' ? 'Downloadable' :
                       deviceAiStatus === 'downloading' || isDownloading ? 'Downloading' :
                       'Unsupported'}
                    </span>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text)]">Browser:</span> {browserName || 'Current Browser'}
                  </div>

                  {deviceAiStatus === 'available' && (
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      On-device AI is downloaded and ready to use in {browserName || 'this browser'}. You can run study queries locally without an internet connection.
                    </div>
                  )}

                  {deviceAiStatus === 'downloadable' && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        On-device AI is supported in {browserName || 'this browser'}, but the model needs to be downloaded before offline use.
                      </p>

                      <div className="p-3 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] rounded-xl text-xs space-y-1">
                        <span className="font-semibold block">Download size & Wi-Fi:</span>
                        <p className="text-[11px] leading-relaxed">
                          The model size is approximately 1.5–2 GB. Connect to an unmetered Wi-Fi network before downloading.
                        </p>
                      </div>

                      {isDownloading ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                            <span>Downloading offline AI...</span>
                            <span>{downloadingProgress !== null ? `${downloadingProgress}%` : 'Starting...'}</span>
                          </div>
                          <div className="w-full bg-[var(--chart-track)] h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-[var(--primary)] h-full transition-all duration-300"
                              style={{ width: `${downloadingProgress || 5}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDownloadAi}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-medium shadow transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download offline AI
                        </button>
                      )}

                      {downloadError && (
                        <p className="text-xs text-[var(--danger)]">{downloadError}</p>
                      )}
                    </div>
                  )}

                  {(deviceAiStatus === 'downloading' || (!deviceAiStatus && isDownloading)) && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                        <span>Downloading offline AI...</span>
                        <span>{downloadingProgress !== null ? `${downloadingProgress}%` : 'In progress...'}</span>
                      </div>
                      <div className="w-full bg-[var(--chart-track)] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[var(--primary)] h-full transition-all duration-300"
                          style={{ width: `${downloadingProgress || 10}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">
                        The model size is ~1.5–2 GB. Please stay connected to Wi-Fi.
                      </p>
                    </div>
                  )}

                  {deviceAiStatus === 'unsupported' && (
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)]">
                      Not available in this browser. You can still use cloud AI online and study saved material offline. For offline AI, use Chrome on a desktop computer.
                    </div>
                  )}
                </div>
              </div>
            } />

            <Route path="privacy" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">Privacy & Data Management</h3>
                  <p className="text-xs text-[var(--muted)]">Export your study archive or clear history.</p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--text)]">On-Device vs Cloud Processing</h4>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    When on-device AI is available in your browser (Chrome on desktop), short notes and simple tasks can run locally on your device for privacy. In other browsers, requests route securely to cloud Vertex AI endpoints.
                  </p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-[var(--primary-accent)]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Google Drive Connection
                      </h4>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isDriveConnected
                        ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
                        : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                    }`}>
                      {isDriveConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Manage your connected Google account used for importing files from Google Drive. Access tokens are kept in session and never stored on servers.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      disabled={!isDriveConnected}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] hover:border-[var(--danger-border)] text-[var(--text-secondary)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      Disconnect Google Drive
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onExportData}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text)] rounded-xl text-xs font-medium transition-colors border border-[var(--border)]"
                  >
                    <Download className="w-4 h-4 text-[var(--primary-accent)]" />
                    Export My Data (JSON)
                  </button>

                  <button
                    onClick={() => { onClearHistory(); showToast('History cleared successfully'); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--danger-bg)] hover:opacity-90 text-[var(--danger)] rounded-xl text-xs font-medium transition-colors border border-[var(--danger-border)]"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear AI Request History
                  </button>
                </div>
              </div>
            } />

            <Route path="study" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">Study Goals & Reminders</h3>
                  <p className="text-xs text-[var(--muted)]">Set daily review targets and reminder preferences.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Daily Study Goal (Requests per day)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={dailyGoal}
                    onChange={(e) => { setDailyGoal(Number(e.target.value)); showToast('Study goals updated'); }}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-4 py-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex items-center justify-between bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text)]">Study Session Reminders</h4>
                    <p className="text-xs text-[var(--muted)]">Receive gentle daily reminders to complete your goals.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => { setReminders(e.target.checked); showToast('Reminders updated'); }}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            } />

            <Route path="about" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">About StudyBridge</h3>
                  <p className="text-xs text-[var(--muted)]">Version 2.5.0 • Firebase AI Logic Hybrid Edition • Contact: fabriceib2003@gmail.com</p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-5 rounded-2xl space-y-3">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    StudyBridge is an AI study assistant built with React, Tailwind CSS, and Firebase AI Logic. It supports hybrid routing between local on-device AI (where supported) and cloud Vertex AI endpoints, with offline access for your saved notes and materials.
                  </p>
                  <a
                    href="https://firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--primary-accent)] font-medium hover:underline"
                  >
                    Firebase Documentation & Support
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="pt-4 border-t border-[var(--border)] flex items-center gap-6 text-xs font-medium text-[var(--primary-accent)]">
                  <Link to="/about" className="hover:underline">About Page</Link>
                  <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
                  <Link to="/terms" className="hover:underline">Terms of Service</Link>
                </div>
              </div>
            } />
            <Route path="*" element={<Navigate to="account" replace />} />
          </Routes>
        </div>

      </div>
    </div>
  );
};
