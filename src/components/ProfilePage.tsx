import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Save, 
  Activity, 
  Cpu, 
  Cloud, 
  HardDrive, 
  BookOpen, 
  Layers, 
  Award,
  Flame,
  Loader2
} from 'lucide-react';
import { User, updateProfile, sendEmailVerification } from 'firebase/auth';
import { Subject, Material, AIInteraction, UserStats } from '../types';

interface ProfilePageProps {
  user: User;
  subjects: Subject[];
  materials: Material[];
  interactions: AIInteraction[];
  stats: UserStats;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  subjects,
  materials,
  interactions,
  stats
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.photoURL);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'SB';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateProfile(user, { 
        displayName,
        photoURL: photoPreview 
      });
      setSuccessMsg('Profile updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendVerification = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendEmailVerification(user);
      setSuccessMsg('Verification email sent!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quizzesTaken = interactions.filter(i => i.actionType === 'quiz').length;
  const onDevicePercent = stats.totalRequests > 0 ? Math.round((stats.onDeviceCount / stats.totalRequests) * 100) : 0;
  
  // Estimate study streak from unique days of interaction
  const uniqueDays = new Set(interactions.map(i => new Date(i.timestamp).toDateString())).size;

  const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Recently';

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* Page Title */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your personal information and view study statistics.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-3.5 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <div className="relative group">
          {photoPreview ? (
            <img src={photoPreview} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-600 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              {getInitials(user.displayName, user.email)}
            </div>
          )}
          <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full shadow cursor-pointer transition-transform hover:scale-105">
            <Camera className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h3 className="text-xl font-bold">{user.displayName || 'StudyBridge Scholar'}</h3>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              user.emailVerified 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            }`}>
              {user.emailVerified ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {user.emailVerified ? 'Verified Account' : 'Email Unverified'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            {user.email}
          </p>

          <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Member since {creationTime}
          </p>

          {!user.emailVerified && (
            <div className="pt-1">
              <button
                onClick={handleSendVerification}
                disabled={loading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Send verification email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <h4 className="text-sm font-bold">Edit Profile Details</h4>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium shadow"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </div>

      {/* Real Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Subjects & Notes</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold">{subjects.length} / {materials.length}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active subjects & study notes</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">AI Requests</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold">{stats.totalRequests}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{quizzesTaken} quizzes generated</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">On-Device Ratio</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold">{onDevicePercent}%</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(stats.totalDataSavedBytes)} data saved</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Study Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold">{uniqueDays} Days</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active engagement days</p>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <h4 className="text-sm font-bold">Recent Study Activity</h4>
        {interactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <Activity className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs">No AI interactions recorded yet. Start studying at the Study Desk!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {interactions.slice().reverse().map(item => {
              const sub = subjects.find(s => s.id === item.subjectId);
              const isDevice = item.route === 'on-device';
              return (
                <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1 truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {sub?.name || 'General'}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{item.actionType}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">"{item.prompt}"</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0 ${
                    isDevice ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'
                  }`}>
                    {isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                    {isDevice ? 'On-device' : 'Cloud'} ({item.latencyMs}ms)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
