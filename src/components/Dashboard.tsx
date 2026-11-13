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
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
      {/* Page Title & One-line Description */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Analytics Dashboard</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monitor your hybrid inference statistics, latency, and data savings.
        </p>
      </div>

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Brain className="w-48 h-48 text-white" />
        </div>
        <div className="max-w-xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Firebase AI Logic
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            Hybrid Inference & Privacy Analytics
          </h3>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            StudyBridge intelligently routes your study queries between local on-device AI (when supported) and cloud Vertex AI endpoints.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={onNavigateDesk}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-blue-600 hover:bg-blue-50 font-medium text-xs transition-colors shadow-lg"
            >
              Start Studying Now
              <ArrowRight className="w-4 h-4" />
            </button>
            {interactions.length > 0 && (
              <button
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white text-xs font-medium transition-colors backdrop-blur-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {stats.totalRequests === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-4 shadow-sm">
          <Activity className="w-12 h-12 mx-auto text-slate-400 animate-pulse" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No AI Interactions Recorded Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Create subjects and run study requests in the Study Desk to populate your analytics dashboard.
          </p>
          <button
            onClick={onNavigateDesk}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow"
          >
            Go to Study Desk
          </button>
        </div>
      ) : (
        <>
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Total Requests</span>
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalRequests}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.onDeviceCount} on-device</span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{stats.cloudCount} cloud</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">On-Device Ratio</span>
                <Cpu className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{onDevicePercent}%</div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${onDevicePercent}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Latency</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{avgLatency} ms</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Measured via performance.now()</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wider">Data Saved</span>
                <HardDrive className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatBytes(stats.totalDataSavedBytes)}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bandwidth saved on-device</p>
            </div>
          </div>

          {/* Subject breakdown & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Subject Activity</h3>
              <div className="space-y-3">
                {subjectCounts.map((sub) => (
                  <div key={sub.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{sub.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">{sub.count} queries</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full bg-gradient-to-r ${sub.color}`} 
                        style={{ 
                          width: stats.totalRequests > 0 
                            ? `${Math.max(5, (sub.count / stats.totalRequests) * 100)}%` 
                            : '0%' 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent AI Interactions</h3>
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
                      className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {sub?.name || 'General'}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                            {item.actionType}
                          </span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${label.bgClass} ${label.colorClass} ${label.borderClass}`}>
                          {label.isDevice ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                          {label.badgeText}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        "{item.prompt}"
                      </p>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
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
