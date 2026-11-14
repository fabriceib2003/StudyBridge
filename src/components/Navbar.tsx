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
    <header className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--text)] sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo & App Name (single line, no wrapping) */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--primary)] via-[var(--primary-hover)] to-[var(--content-flashcards)] flex items-center justify-center shadow-md text-[var(--primary-text)]">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-bold text-base tracking-tight">StudyBridge</span>
            <span className="hidden sm:inline-block bg-[var(--primary-soft-bg)] text-[var(--primary-accent)] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--primary-soft-border)]">
              AI Logic
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Centered on desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--surface-raised)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => navigate('/study')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'desk'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Study Desk
          </button>
          <button
            onClick={() => navigate('/materials')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'library'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Materials
          </button>



          <button
            onClick={() => navigate('/analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
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
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2.5 py-1 rounded-xl"
              title="Changes are waiting to sync to your account"
            >
              <Cloud className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Waiting to sync</span>
            </span>
          ) : (
            <span 
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)] px-2.5 py-1 rounded-xl"
              title="All data saved to your account"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved</span>
            </span>
          )}

          {/* Routing Mode Selector */}
          <div className="flex items-center bg-[var(--input-bg)] border border-[var(--border)] rounded-xl px-2 py-1">
            <Sliders className="w-3 h-3 text-[var(--muted)] mr-1" />
            <select
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value as RoutingMode)}
              className="bg-transparent text-xs font-medium text-[var(--text)] focus:outline-none cursor-pointer"
              title="Routing mode"
            >
              <option value="auto" className="bg-[var(--surface)] text-[var(--text)]">Auto</option>
              <option value="force-on-device" className="bg-[var(--surface)] text-[var(--text)]">On-Device</option>
              <option value="force-cloud" className="bg-[var(--surface)] text-[var(--text)]">Cloud</option>
            </select>
          </div>

          {/* Profile Avatar & Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-[var(--hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover border border-[var(--border)]" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-text)] font-bold text-xs flex items-center justify-center shadow">
                  {getInitials(displayName, email)}
                </div>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)]" />
            </button>

            {dropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl py-2 z-50 animate-fadeIn text-[var(--text)]"
                role="menu"
              >
                {/* Dropdown Header */}
                <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-0.5">
                  <p className="text-xs font-bold truncate">{displayName}</p>
                  <p className="text-[11px] text-[var(--muted)] truncate">{email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--hover)] transition-colors"
                    role="menuitem"
                  >
                    <User className="w-4 h-4 text-[var(--primary-accent)]" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--hover)] transition-colors"
                    role="menuitem"
                  >
                    <Settings className="w-4 h-4 text-[var(--accent-flashcards)]" />
                    Settings
                  </button>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-1">
                  <button
                    onClick={() => { onSignOut(); setDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs font-medium flex items-center gap-2.5 text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
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
      <div className="md:hidden flex items-center justify-around bg-[var(--surface)] border-t border-[var(--border)] py-2 px-4 shadow-lg">
        <button
          onClick={() => navigate('/study')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'desk' ? 'text-[var(--primary-accent)]' : 'text-[var(--muted)]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Desk
        </button>
        <button
          onClick={() => navigate('/materials')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            activeTab === 'library' ? 'text-[var(--primary-accent)]' : 'text-[var(--muted)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Materials
        </button>
        <button
          onClick={() => navigate('/analytics')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'dashboard' ? 'text-[var(--primary-accent)]' : 'text-[var(--muted)]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
      </div>
    </header>
  );
};
