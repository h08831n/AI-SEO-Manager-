import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Anomaly Detected',
  message,
  onRetry,
}) => {
  return (
    <div className="p-6 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-200">
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-lg bg-rose-900/30 text-rose-400 border border-rose-700/50 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-300">{title}</h4>
          <p className="mt-1 text-xs text-rose-300/80 leading-relaxed font-mono">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/60 text-xs font-semibold text-rose-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Diagnostic</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
