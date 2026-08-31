import React from 'react';
import { Sparkles } from 'lucide-react';

interface ConfidenceBadgeProps {
  score: number; // 0 to 1 or 0 to 100
  sampleSize?: number;
  showBar?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ score, sampleSize, showBar = false }) => {
  // Normalize to 0-100
  const normalized = score <= 1.0 ? Math.round(score * 100) : Math.round(score);

  const getColor = (s: number) => {
    if (s >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (s >= 65) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    if (s >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getBarColor = (s: number) => {
    if (s >= 85) return 'bg-emerald-500';
    if (s >= 65) return 'bg-cyan-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="inline-flex items-center space-x-1.5">
      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium border font-mono ${getColor(normalized)}`}>
        <Sparkles className="w-2.5 h-2.5" />
        <span>{normalized}% Confidence</span>
      </span>

      {showBar && (
        <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full ${getBarColor(normalized)}`} style={{ width: `${normalized}%` }} />
        </div>
      )}

      {sampleSize !== undefined && (
        <span className="text-[10px] text-slate-500 font-mono">
          (n={sampleSize})
        </span>
      )}
    </div>
  );
};
