import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, LogOut, MapPinOff, AlertTriangle } from 'lucide-react';
import { RESTRICTION_CODE, RESTRICTED_DISTRICTS } from '../config/regionRestriction';

interface BlockedRegionScreenProps {
  district?: string | null;
  errorCode?: string;
  isPermissionDenied?: boolean;
  onCheckAgain: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const BlockedRegionScreen: React.FC<BlockedRegionScreenProps> = ({
  district,
  errorCode = RESTRICTION_CODE,
  isPermissionDenied = false,
  onCheckAgain,
  onSignOut
}) => {
  const [isChecking, setIsChecking] = useState(false);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      await onCheckAgain();
    } finally {
      setIsChecking(false);
    }
  };

  if (isPermissionDenied) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-app)] text-[var(--text)] p-6 select-none">
        <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--warning-border)] rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--warning-bg)] border border-[var(--warning-border)] flex items-center justify-center text-[var(--warning)]">
            <MapPinOff className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
            Location Permission Required
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed">
            StudyBridge requires location access to verify service availability in your area. Please enable location permissions in your browser to continue.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Retry'}
            </button>
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-app)] text-[var(--text)] p-6 select-none">
      <div className="max-w-lg w-full bg-[var(--surface)] border border-[var(--danger-border)] rounded-3xl p-8 sm:p-10 shadow-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center text-[var(--danger)] shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text)] mb-3 tracking-tight">
          Service not available in your area
        </h1>

        {district && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-sm font-semibold mb-4">
            <AlertTriangle className="w-4 h-4" />
            Detected District: <span>{district}</span>
          </div>
        )}

        <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed mb-6">
          StudyBridge is currently restricted in {RESTRICTED_DISTRICTS.join(', ')}.
        </p>

        <div className="mb-8 py-2 px-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-mono text-[var(--muted)] inline-block">
          Error code: <span className="text-[var(--danger)] font-semibold">{errorCode}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check again'}
          </button>
          <button
            onClick={onSignOut}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
