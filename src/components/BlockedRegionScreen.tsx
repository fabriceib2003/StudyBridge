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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-slate-100 p-6 select-none">
        <div className="max-w-md w-full bg-slate-800/90 border border-amber-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <MapPinOff className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Location Permission Required
          </h1>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            StudyBridge requires location access to verify service availability in your area. Please enable location permissions in your browser to continue.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Retry'}
            </button>
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-slate-100 p-6 select-none">
      <div className="max-w-lg w-full bg-slate-900/95 border border-red-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
          Service not available in your area
        </h1>

        {district && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Detected District: <span>{district}</span>
          </div>
        )}

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
          StudyBridge is currently restricted in {RESTRICTED_DISTRICTS.join(', ')}.
        </p>

        <div className="mb-8 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400 inline-block">
          Error code: <span className="text-red-400 font-semibold">{errorCode}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check again'}
          </button>
          <button
            onClick={onSignOut}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
