import React from 'react';

interface LoadingStateProps {
  label?: string;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading intelligence...', rows = 3 }) => {
  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-4">
      <div className="flex items-center space-x-3">
        <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
        <span className="text-xs font-medium text-slate-400 font-mono tracking-wide">{label}</span>
      </div>

      <div className="space-y-2.5 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-slate-800/60 animate-pulse w-full" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  );
};
