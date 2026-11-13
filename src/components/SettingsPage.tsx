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
  RefreshCw
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
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* Page Title */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your account security, AI preferences, and study goals.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Sidebar / Top Tabs */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950/50 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0">
          <button
            onClick={() => navigate('/settings/account')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'account' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Account
          </button>
          <button
            onClick={() => navigate('/settings/appearance')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'appearance' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            Appearance
          </button>
          <button
            onClick={() => navigate('/settings/ai')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'ai' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            AI Preferences
          </button>
          <button
            onClick={() => navigate('/settings/privacy')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'privacy' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Privacy & Data
          </button>
          <button
            onClick={() => navigate('/migrate')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Restore Data (Migration)
          </button>
          <button
            onClick={() => navigate('/settings/study')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'study' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            Study Goals
          </button>
          <button
            onClick={() => navigate('/settings/about')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-colors shrink-0 ${
              currentTab === 'about' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Manage your profile details and password.</p>
                </div>

                <form onSubmit={handleUpdateAccount} className="space-y-4 max-w-lg">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs opacity-75 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => { setDisplayName(e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">New Password (Optional)</label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </form>

                {/* Delete Account */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 max-w-lg">
                  <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Delete Account</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Permanently delete your account and all associated study materials, analytics, and history. Type <strong className="text-rose-500">DELETE</strong> to confirm.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type DELETE"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      onClick={handleDeleteAccount}
                      disabled={loading || deleteInput !== 'DELETE'}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            } />

            <Route path="appearance" element={
              <div className="space-y-6 max-w-lg">

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Font Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setFontSize('sm'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'sm' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => { setFontSize('md'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'md' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => { setFontSize('lg'); showToast('Font size updated'); }}
                      className={`py-3 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'lg' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Configure default routing mode and study language.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Default Routing Mode</label>
                  <select
                    value={manualMode}
                    onChange={(e) => { setManualMode(e.target.value as RoutingMode); showToast('Routing mode updated'); }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="auto">Auto (Smart Hybrid Router)</option>
                    <option value="force-on-device" disabled={!isDeviceAiAvailable}>
                      Force On-Device (Nano){!isDeviceAiAvailable ? ' — Unavailable in this browser' : ''}
                    </option>
                    <option value="force-cloud">Force Cloud (Vertex AI)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Answer Length</label>
                  <select
                    value={answerLength}
                    onChange={(e) => { setAnswerLength(e.target.value as any); showToast('Answer length updated'); }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="short">Concise & Direct</option>
                    <option value="detailed">Comprehensive & Detailed</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Study Language</label>
                  <input
                    type="text"
                    value={studyLanguage}
                    onChange={(e) => { setStudyLanguage(e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Offline AI Card */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Offline AI
                      </h4>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      deviceAiStatus === 'available'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : deviceAiStatus === 'downloadable'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        : deviceAiStatus === 'downloading' || isDownloading
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                    }`}>
                      {deviceAiStatus === 'available' ? 'Available' :
                       deviceAiStatus === 'downloadable' ? 'Downloadable' :
                       deviceAiStatus === 'downloading' || isDownloading ? 'Downloading' :
                       'Unsupported'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Browser:</span> {browserName || 'Current Browser'}
                  </div>

                  {deviceAiStatus === 'available' && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      On-device AI is downloaded and ready to use in {browserName || 'this browser'}. You can run study queries locally without an internet connection.
                    </div>
                  )}

                  {deviceAiStatus === 'downloadable' && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        On-device AI is supported in {browserName || 'this browser'}, but the model needs to be downloaded before offline use.
                      </p>

                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs space-y-1">
                        <span className="font-semibold block">Download size & Wi-Fi:</span>
                        <p className="text-[11px] leading-relaxed">
                          The model size is approximately 1.5–2 GB. Connect to an unmetered Wi-Fi network before downloading.
                        </p>
                      </div>

                      {isDownloading ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Downloading offline AI...</span>
                            <span>{downloadingProgress !== null ? `${downloadingProgress}%` : 'Starting...'}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full transition-all duration-300"
                              style={{ width: `${downloadingProgress || 5}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDownloadAi}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download offline AI
                        </button>
                      )}

                      {downloadError && (
                        <p className="text-xs text-rose-500">{downloadError}</p>
                      )}
                    </div>
                  )}

                  {(deviceAiStatus === 'downloading' || (!deviceAiStatus && isDownloading)) && (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Downloading offline AI...</span>
                        <span>{downloadingProgress !== null ? `${downloadingProgress}%` : 'In progress...'}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full transition-all duration-300"
                          style={{ width: `${downloadingProgress || 10}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        The model size is ~1.5–2 GB. Please stay connected to Wi-Fi.
                      </p>
                    </div>
                  )}

                  {deviceAiStatus === 'unsupported' && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Export your study archive or clear history.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">On-Device vs Cloud Processing</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    When on-device AI is available in your browser (Chrome on desktop), short notes and simple tasks can run locally on your device for privacy. In other browsers, requests route securely to cloud Vertex AI endpoints.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Google Drive Connection
                      </h4>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isDriveConnected
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                    }`}>
                      {isDriveConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Manage your connected Google account used for importing files from Google Drive. Access tokens are kept in session and never stored on servers.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      disabled={!isDriveConnected}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 dark:hover:border-rose-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      Disconnect Google Drive
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onExportData}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    Export My Data (JSON)
                  </button>

                  <button
                    onClick={() => { onClearHistory(); showToast('History cleared successfully'); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium transition-colors border border-rose-500/20"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set daily review targets and reminder preferences.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Daily Study Goal (Requests per day)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={dailyGoal}
                    onChange={(e) => { setDailyGoal(Number(e.target.value)); showToast('Study goals updated'); }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Study Session Reminders</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive gentle daily reminders to complete your goals.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => { setReminders(e.target.checked); showToast('Reminders updated'); }}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            } />

            <Route path="about" element={
              <div className="space-y-6 max-w-lg">
                <div>
                  <h3 className="text-base font-bold">About StudyBridge</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Version 2.5.0 • Firebase AI Logic Hybrid Edition • Contact: fabriceib2003@gmail.com</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    StudyBridge is an AI study assistant built with React, Tailwind CSS, and Firebase AI Logic. It supports hybrid routing between local on-device AI (where supported) and cloud Vertex AI endpoints, with offline access for your saved notes and materials.
                  </p>
                  <a
                    href="https://firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    Firebase Documentation & Support
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-6 text-xs font-medium text-blue-600 dark:text-blue-400">
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
