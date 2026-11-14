import React from 'react';
import { 
  Brain, 
  Sliders, 
  Settings, 
  BarChart3, 
  BookOpen, 
  Layers
} from 'lucide-react';
import { RoutingMode, UserStats } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  manualMode: RoutingMode;
  setManualMode: (mode: RoutingMode) => void;
  stats: UserStats;
  isOnline: boolean;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  manualMode,
  setManualMode,
  onOpenSettings
}) => {
  return (
    <header className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--text)] sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Logo & App Name (single line, no wrapping) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-sm text-[var(--primary-text)]">
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
            onClick={() => setActiveTab('desk')}
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
            onClick={() => setActiveTab('library')}
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
            onClick={() => setActiveTab('dashboard')}
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
        <div className="flex items-center gap-2">
          {/* Routing Mode Selector */}
          <div className="flex items-center bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl px-2 py-1">
            <Sliders className="w-3 h-3 text-[var(--muted)] mr-1" />
            <select
              value={manualMode}
              onChange={(e) => setManualMode(e.target.value as RoutingMode)}
              className="bg-transparent text-xs font-medium text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              title="Routing mode"
            >
              <option value="auto" className="bg-[var(--surface)] text-[var(--text)]">Auto</option>
              <option value="force-on-device" className="bg-[var(--surface)] text-[var(--text)]">On-Device</option>
              <option value="force-cloud" className="bg-[var(--surface)] text-[var(--text)]">Cloud</option>
            </select>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors"
            title="Settings & Preferences"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden flex items-center justify-around bg-[var(--surface)] border-t border-[var(--border)] py-2 px-4 shadow-lg">
        <button
          onClick={() => setActiveTab('desk')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'desk' ? 'text-[var(--primary-accent)]' : 'text-[var(--muted)]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Desk
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'library' ? 'text-[var(--primary-accent)]' : 'text-[var(--muted)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Materials
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
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
