import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  User, 
  Palette, 
  Cpu, 
  Shield, 
  Bell, 
  Info, 
  Check, 
  LogOut, 
  Trash2, 
  Download, 
  AlertTriangle,
  Loader2,
  ExternalLink,
  HardDrive
} from 'lucide-react';
import { User as FirebaseUser, updatePassword, sendEmailVerification, deleteUser, updateProfile } from 'firebase/auth';
import { RoutingMode } from '../types';
import { clearInteractionsFirestore } from '../services/firestoreService';
import { Modal } from './Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser;
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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
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
  deviceAiDetails
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'ai' | 'privacy' | 'notifications' | 'about'>('account');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    localStorage.removeItem('studybridge_drive_email');
    setIsDriveConnected(false);
    setSuccessMsg('Google Drive disconnected');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateProfile(user, { displayName });
      setSuccessMsg('Profile updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updatePassword(user, newPassword);
      setSuccessMsg('Password changed successfully!');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendEmailVerification(user);
      setSuccessMsg('Verification email sent! Check your inbox.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Preferences & Settings"
      icon={
        <div className="w-8 h-8 rounded-xl bg-[var(--info-bg)] text-[var(--info)] flex items-center justify-center shrink-0">
          <Settings className="w-4 h-4" />
        </div>
      }
      maxWidth="form"
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row h-full min-h-[460px] overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-48 bg-[var(--surface-raised)] border-r border-[var(--border)] p-3 space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'account' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <User className="w-4 h-4" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'appearance' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <Palette className="w-4 h-4" />
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'ai' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI Preferences
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'privacy' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacy & Data
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'notifications' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <Bell className="w-4 h-4" />
              Study Goals
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'about' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--muted)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]'
              }`}
            >
              <Info className="w-4 h-4" />
              About
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            
            {successMsg && (
              <div className="bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] p-3 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TAB: ACCOUNT */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Account Management</h4>
                  <p className="text-xs text-[var(--muted)]">Manage your Firebase credentials and session.</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4 bg-[var(--surface-raised)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--muted)] opacity-75 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] rounded-xl text-xs font-medium shadow"
                  >
                    Update Profile
                  </button>
                </form>

                {/* Password Change */}
                <form onSubmit={handleUpdatePassword} className="space-y-4 bg-[var(--surface-raised)] p-4 rounded-2xl border border-[var(--border)]">
                  <h5 className="text-xs font-semibold text-[var(--text)]">Change Password</h5>
                  <div className="space-y-1">
                    <input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !newPassword}
                    className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--hover)] text-[var(--text)] border border-[var(--border)] rounded-xl text-xs font-medium"
                  >
                    Change Password
                  </button>
                </form>

                {/* Email Verification & Sign Out */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {!user.emailVerified && (
                    <button
                      onClick={handleVerifyEmail}
                      disabled={loading}
                      className="px-4 py-2 bg-[var(--warning-bg)] hover:bg-[var(--hover)] text-[var(--warning)] border border-[var(--warning-border)] rounded-xl text-xs font-medium"
                    >
                      Verify Email
                    </button>
                  )}
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] border border-[var(--border)] rounded-xl text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>

                {/* Delete Account */}
                <div className="pt-4 border-t border-[var(--border)] space-y-2">
                  <h5 className="text-xs font-semibold text-[var(--danger)]">Danger Zone</h5>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-[var(--danger-bg)] hover:opacity-90 text-[var(--danger)] rounded-xl text-xs font-medium border border-[var(--danger-border)] transition-colors"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] p-4 rounded-xl space-y-3">
                      <p className="text-xs text-[var(--danger)] font-medium">
                        Are you sure? This will permanently delete your account and all associated study data.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading}
                          className="px-4 py-2 bg-[var(--danger-solid)] hover:bg-[var(--danger-solid-hover)] text-[var(--primary-text)] rounded-xl text-xs font-medium"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Appearance & Theme</h4>
                  <p className="text-xs text-[var(--muted)]">Customize visual appearance and font sizing.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'light' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'dark' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'system' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      System
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Font Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setFontSize('sm')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'sm' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => setFontSize('md')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'md' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setFontSize('lg')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'lg' ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      Large
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AI PREFERENCES */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">AI & Hybrid Routing Preferences</h4>
                  <p className="text-xs text-[var(--muted)]">Configure default routing behavior and model parameters.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Default Routing Mode</label>
                  <select
                    value={manualMode}
                    onChange={(e) => setManualMode(e.target.value as RoutingMode)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="auto">Auto (Smart Hybrid Router)</option>
                    <option value="force-on-device">Force On-Device (Nano)</option>
                    <option value="force-cloud">Force Cloud (Vertex AI)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Answer Depth</label>
                  <select
                    value={answerLength}
                    onChange={(e) => setAnswerLength(e.target.value as any)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
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
                    onChange={(e) => setStudyLanguage(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                {/* Friendly note about browser on-device AI availability */}
                <div className={`p-3.5 rounded-xl border text-xs ${
                  isDeviceAiAvailable 
                    ? 'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success)]' 
                    : 'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info)]'
                }`}>
                  <span className="font-semibold block mb-0.5">On-Device AI Status Note</span>
                  <span>{deviceAiDetails}</span>
                </div>
              </div>
            )}

            {/* TAB: PRIVACY & DATA */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Privacy & Data Management</h4>
                  <p className="text-xs text-[var(--muted)]">Export your study archive or clear history.</p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl space-y-2">
                  <h5 className="text-xs font-semibold text-[var(--text)]">How Hybrid Inference Protects Your Data</h5>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    When on-device AI is available in your browser (Chrome on desktop), short notes and simple tasks run locally on your device for privacy. In other browsers, requests route securely to cloud Vertex AI endpoints.
                  </p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-[var(--primary-accent)]" />
                      <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                        Google Drive Connection
                      </h5>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isDriveConnected
                        ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
                        : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                    }`}>
                      {isDriveConnected 
                        ? `Connected as ${localStorage.getItem('studybridge_drive_email') || user.email || 'account'}` 
                        : 'Not connected'}
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

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={onExportData}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text)] rounded-xl text-xs font-medium transition-colors border border-[var(--border)]"
                  >
                    <Download className="w-4 h-4 text-[var(--primary-accent)]" />
                    Export My Data (JSON)
                  </button>

                  <button
                    onClick={onClearHistory}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--danger-bg)] hover:opacity-90 text-[var(--danger)] rounded-xl text-xs font-medium transition-colors border border-[var(--danger-border)]"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear AI Request History
                  </button>
                </div>
              </div>
            )}

            {/* TAB: NOTIFICATIONS / STUDY GOALS */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Study Goals & Reminders</h4>
                  <p className="text-xs text-[var(--muted)]">Set daily review targets and reminder preferences.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Daily Study Goal (Requests per day)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex items-center justify-between bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl">
                  <div>
                    <h5 className="text-xs font-semibold text-[var(--text)]">Study Session Reminders</h5>
                    <p className="text-xs text-[var(--muted)]">Receive gentle daily reminders to complete your study goals.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => setReminders(e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">About StudyBridge</h4>
                  <p className="text-xs text-[var(--muted)]">Version 2.4.0 • Firebase AI Logic Hybrid Edition</p>
                </div>

                <div className="bg-[var(--surface-raised)] border border-[var(--border)] p-4 rounded-2xl space-y-3">
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
              </div>
            )}

          </div>
        </div>
    </Modal>
  );
};
