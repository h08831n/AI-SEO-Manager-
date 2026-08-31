import React from 'react';

interface SEOScoreProps {
  score: number; // 0-100
  previousScore?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showGrade?: boolean;
}

export const SEOScore: React.FC<SEOScoreProps> = ({
  score,
  previousScore,
  size = 'md',
  label = 'SEO Health Score',
  showGrade = true,
}) => {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  const getGrade = (s: number) => {
    if (s >= 90) return { grade: 'A+', color: 'text-emerald-400', stroke: '#34d399' };
    if (s >= 80) return { grade: 'A', color: 'text-emerald-400', stroke: '#10b981' };
    if (s >= 70) return { grade: 'B', color: 'text-teal-400', stroke: '#14b8a6' };
    if (s >= 60) return { grade: 'C', color: 'text-amber-400', stroke: '#f59e0b' };
    if (s >= 50) return { grade: 'D', color: 'text-orange-400', stroke: '#f97316' };
    return { grade: 'F', color: 'text-rose-400', stroke: '#f43f5e' };
  };

  const { grade, color, stroke } = getGrade(normalizedScore);

  const radius = size === 'lg' ? 44 : size === 'md' ? 34 : 24;
  const strokeWidth = size === 'lg' ? 7 : size === 'md' ? 5 : 4;
  const svgSize = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  const delta = previousScore !== undefined ? normalizedScore - previousScore : null;

  return (
    <div className="flex items-center space-x-4">
      <div className="relative flex items-center justify-center" style={{ width: svgSize, height: svgSize }}>
        <svg className="transform -rotate-90" width={svgSize} height={svgSize}>
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-800"
            fill="transparent"
          />
          {/* Active progress */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`font-mono font-extrabold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-sm'} text-white`}>
            {normalizedScore}
          </span>
          {showGrade && size !== 'sm' && (
            <span className={`text-[10px] font-bold ${color}`}>
              {grade}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="flex items-center space-x-2 mt-0.5">
          <span className="text-sm font-medium text-slate-200">
            {normalizedScore >= 80 ? 'Optimal Architecture' : normalizedScore >= 65 ? 'Minor Optimization Needed' : 'Action Required'}
          </span>
          {delta !== null && delta !== 0 && (
            <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
