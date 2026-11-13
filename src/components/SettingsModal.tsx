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
  ExternalLink
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
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Settings className="w-4 h-4" />
        </div>
      }
      maxWidth="form"
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row h-full min-h-[460px] overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-3 space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'account' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-4 h-4" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'appearance' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Palette className="w-4 h-4" />
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'ai' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI Preferences
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'privacy' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacy & Data
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              Study Goals
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                activeTab === 'about' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Info className="w-4 h-4" />
              About
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* TAB: ACCOUNT */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold">Account Management</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Manage your Firebase credentials and session.</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email || ''}
                      className="w-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs opacity-75 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow"
                  >
                    Update Profile
                  </button>
                </form>

                {/* Password Change */}
                <form onSubmit={handleUpdatePassword} className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Change Password</h5>
                  <div className="space-y-1">
                    <input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !newPassword}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl text-xs font-medium"
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
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium"
                    >
                      Verify Email
                    </button>
                  )}
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>

                {/* Delete Account */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <h5 className="text-xs font-semibold text-rose-600 dark:text-rose-400">Danger Zone</h5>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium border border-rose-500/20 transition-colors"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl space-y-3">
                      <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                        Are you sure? This will permanently delete your account and all associated study data.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium"
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
                  <h4 className="text-sm font-bold">Appearance & Theme</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Customize visual appearance and font sizing.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'light' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'dark' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        theme === 'system' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      System
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Font Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setFontSize('sm')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'sm' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => setFontSize('md')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'md' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setFontSize('lg')}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        fontSize === 'lg' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
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
                  <h4 className="text-sm font-bold">AI & Hybrid Routing Preferences</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Configure default routing behavior and model parameters.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Default Routing Mode</label>
                  <select
                    value={manualMode}
                    onChange={(e) => setManualMode(e.target.value as RoutingMode)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="auto">Auto (Smart Hybrid Router)</option>
                    <option value="force-on-device">Force On-Device (Nano)</option>
                    <option value="force-cloud">Force Cloud (Vertex AI)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Answer Depth</label>
                  <select
                    value={answerLength}
                    onChange={(e) => setAnswerLength(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
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
                    onChange={(e) => setStudyLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Friendly note about browser on-device AI availability */}
                <div className={`p-3.5 rounded-xl border text-xs ${
                  isDeviceAiAvailable 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
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
                  <h4 className="text-sm font-bold">Privacy & Data Management</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Export your study archive or clear history.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2">
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">How Hybrid Inference Protects Your Data</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    When on-device AI is available in your browser (Chrome on desktop), short notes and simple tasks run locally on your device for privacy. In other browsers, requests route securely to cloud Vertex AI endpoints.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={onExportData}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    Export My Data (JSON)
                  </button>

                  <button
                    onClick={onClearHistory}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium transition-colors border border-rose-500/20"
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
                  <h4 className="text-sm font-bold">Study Goals & Reminders</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set daily review targets and reminder preferences.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Daily Study Goal (Requests per day)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Study Session Reminders</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive gentle daily reminders to complete your study goals.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reminders}
                    onChange={(e) => setReminders(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold">About StudyBridge</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Version 2.4.0 • Firebase AI Logic Hybrid Edition</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
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
              </div>
            )}

          </div>
        </div>
    </Modal>
  );
};
