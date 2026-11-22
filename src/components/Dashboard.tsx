import React from 'react';
import { 
  BarChart3, 
  Cpu, 
  Cloud, 
  Zap, 
  HardDrive, 
  Activity, 
  Clock, 
  Sparkles,
  ArrowRight,
  Brain,
  Trash2
} from 'lucide-react';
import { AIInteraction, UserStats, Subject } from '../types';
import { getRouteLabel } from '../services/aiService';
import { useTheme } from '../contexts/ThemeContext';
import { getSubjectColorTheme } from '../utils/subjectColors';

interface DashboardProps {
  stats: UserStats;
  interactions: AIInteraction[];
  subjects: Subject[];
  onNavigateDesk: () => void;
  onClearHistory: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  interactions,
  subjects,
  onNavigateDesk,
  onClearHistory
}) => {
  const { isDark } = useTheme();
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const avgLatency = stats.totalRequests > 0 
    ? Math.round(stats.totalLatencyMs / stats.totalRequests) 
    : 0;

  const onDevicePercent = stats.totalRequests > 0
    ? Math.round((stats.onDeviceCount / stats.totalRequests) * 100)
    : 0;

  const subjectCounts = subjects.map(sub => {
    const count = interactions.filter(i => i.subjectId === sub.id).length;
    return { ...sub, count };
  });

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn text-[var(--text)]">
      {/* Page Title & One-line Description */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Analytics Dashboard</h2>
        <p className="text-sm text-[var(--muted)]">
          Monitor your hybrid inference statistics, latency, and data savings.
        </p>
      </div>

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[var(--primary)] via-[var(--primary-hover)] to-[var(--content-flashcards)] rounded-2xl p-6 sm:p-8 text-[var(--primary-text)] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Brain className="w-48 h-48 text-[var(--primary-text)]" />
        </div>
        <div className="max-w-xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-[var(--primary-text)]/20 text-[var(--primary-text)] text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Firebase AI Logic
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            Hybrid Inference & Privacy Analytics
          </h3>
          <p className="text-[var(--primary-text)]/90 text-xs sm:text-sm leading-relaxed">
            StudyBridge intelligently routes your study queries between local on-device AI (when supported) and cloud Vertex AI endpoints.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={onNavigateDesk}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface)] text-[var(--primary-accent)] hover:bg-[var(--hover)] font-medium text-xs transition-colors shadow-lg"
            >
              Start Studying Now
              <ArrowRight className="w-4 h-4" />
            </button>
            {interactions.length > 0 && (
              <button
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--overlay)] hover:opacity-90 text-[var(--primary-text)] text-xs font-medium transition-colors backdrop-blur-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {stats.totalRequests === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-16 text-center space-y-4 shadow-sm">
          <Activity className="w-12 h-12 mx-auto text-[var(--muted)] animate-pulse" />
          <h3 className="text-base font-bold text-[var(--text)]">No AI Interactions Recorded Yet</h3>
          <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
            Create subjects and run study requests in the Study Desk to populate your analytics dashboard.
          </p>
          <button
            onClick={onNavigateDesk}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] text-xs font-medium shadow"
          >
            Go to Study Desk
          </button>
        </div>
      ) : (
        <>
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-xs font-medium uppercase tracking-wider">Total Requests</span>
                <Activity className="w-4 h-4 text-[var(--primary-accent)]" />
              </div>
              <div className="text-3xl font-bold text-[var(--text)]">{stats.totalRequests}</div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="text-[var(--success)] font-semibold">{stats.onDeviceCount} on-device</span>
                <span>•</span>
                <span className="text-[var(--accent-flashcards)] font-semibold">{stats.cloudCount} cloud</span>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-xs font-medium uppercase tracking-wider">On-Device Ratio</span>
                <Cpu className="w-4 h-4 text-[var(--success)]" />
              </div>
              <div className="text-3xl font-bold text-[var(--text)]">{onDevicePercent}%</div>
              <div className="w-full bg-[var(--chart-track)] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[var(--content-summary)] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${onDevicePercent}%` }}
                />
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Latency</span>
                <Clock className="w-4 h-4 text-[var(--warning)]" />
              </div>
              <div className="text-3xl font-bold text-[var(--text)]">{avgLatency} ms</div>
              <p className="text-xs text-[var(--muted)]">Measured via performance.now()</p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-xs font-medium uppercase tracking-wider">Data Saved</span>
                <HardDrive className="w-4 h-4 text-[var(--success)]" />
              </div>
              <div className="text-3xl font-bold text-[var(--text)]">{formatBytes(stats.totalDataSavedBytes)}</div>
              <p className="text-xs text-[var(--muted)]">Bandwidth saved on-device</p>
            </div>
          </div>

          {/* Subject breakdown & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="text-sm font-semibold text-[var(--text)]">Subject Activity</h3>
              <div className="space-y-3">
                {subjectCounts.map((sub) => {
                  const subTheme = getSubjectColorTheme(sub, isDark);
                  return (
                    <div key={sub.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--text-secondary)]">{sub.name}</span>
                        <span className="text-[var(--muted)]">{sub.count} queries</span>
                      </div>
                      <div className="w-full bg-[var(--chart-track)] h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            backgroundColor: subTheme.dotColor,
                            width: stats.totalRequests > 0 
                              ? `${Math.max(5, (sub.count / stats.totalRequests) * 100)}%` 
                              : '0%' 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Recent AI Interactions</h3>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {interactions.slice().reverse().map((item) => {
                  const sub = subjects.find(s => s.id === item.subjectId);
                  const label = getRouteLabel(item.route, {
                    latencyMs: item.latencyMs,
                    ttftMs: item.ttftMs,
                    routingReason: item.routingReason
                  });
                  return (
                    <div 
                      key={item.id} 
                      className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {sub?.name || 'General'}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">
                            {item.actionType}
                          </span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${label.bgClass} ${label.colorClass} ${label.borderClass}`}>
                          {label.isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                          {label.badgeText}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] line-clamp-1 font-mono bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                        "{item.prompt}"
                      </p>

                      <div className="text-[11px] text-[var(--muted)] flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[var(--warning)] shrink-0" />
                        <span className="truncate">{item.routingReason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
