import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Brain, 
  Sliders, 
  BarChart3, 
  BookOpen, 
  Layers, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown
} from 'lucide-react';
import { RoutingMode, UserStats } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { Cloud, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  user: FirebaseUser;
  manualMode: RoutingMode;
  setManualMode: (mode: RoutingMode) => void;
  onSignOut: () => void;
  hasPendingSync?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  manualMode,
  setManualMode,
  onSignOut,
  hasPendingSync = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = location.pathname === '/materials' ? 'library' : location.pathname === '/analytics' ? 'dashboard' : 'desk';

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'SB';
  };

  const avatarUrl = user.photoURL;
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const email = user.email || '';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo & App Name (single line, no wrapping) */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-base tracking-tight">StudyBridge</span>
            <span className="hidden sm:inline-block bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/20">
              AI Logic
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Centered on desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => navigate('/study')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'desk'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Study Desk
          </button>
          <button
            onClick={() => navigate('/materials')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'library'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Materials
          </button>



          <button
            onClick={() => navigate('/analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>
        </nav>


        {/* Right Compact Group */}
        <div className="flex items-center gap-2.5">
          {/* Global Pending Sync Indicator */}
          {hasPendingSync ? (
            <span 
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl"
              title="Changes are waiting to sync to your account"
            >
              <Cloud className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Waiting to sync</span>
            </span>
          ) : (
            <span 
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl"
              title="All data saved to your account"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}

          {/* Routing Mode Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
            <Sliders className="w-3 h-3 text-slate-500 dark:text-slate-400 mr-1" />
            <select
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value as RoutingMode)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              title="Routing mode"
            >
              <option value="auto" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Auto</option>
              <option value="force-on-device" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">On-Device</option>
              <option value="force-cloud" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Cloud</option>
            </select>
          </div>

          {/* Profile Avatar & Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow">
                  {getInitials(displayName, email)}
                </div>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {dropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-fadeIn text-slate-900 dark:text-slate-100"
                role="menu"
              >
                {/* Dropdown Header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-0.5">
                  <p className="text-xs font-bold truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    role="menuitem"
                  >
                    <User className="w-4 h-4 text-blue-500" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    role="menuitem"
                  >
                    <Settings className="w-4 h-4 text-purple-500" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                  <button
                    onClick={() => { onSignOut(); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-2 px-4 shadow-lg">
        <button
          onClick={() => navigate('/study')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'desk' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Desk
        </button>
        <button
          onClick={() => navigate('/materials')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            activeTab === 'library' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          Materials
        </button>
        <button
          onClick={() => navigate('/analytics')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
      </div>
    </header>
  );
};
