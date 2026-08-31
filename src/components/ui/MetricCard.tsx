import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate';
  sparklineData?: number[];
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  change,
  changeLabel = 'vs last period',
  trend,
  icon: Icon,
  subtitle,
  badge,
  badgeVariant = 'indigo',
  onClick,
}) => {
  const isPositive = trend === 'up' || (change !== undefined && change > 0);
  const isNegative = trend === 'down' || (change !== undefined && change < 0);
  const isNeutral = trend === 'neutral' || change === 0;

  const badgeStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
  }[badgeVariant];

  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative p-5 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-sm ${
        onClick ? 'cursor-pointer hover:bg-slate-900' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {Icon && (
            <div className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        </div>

        {badge && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border font-mono ${badgeStyles}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-white font-mono">{value}</div>

        {change !== undefined && (
          <div
            className={`flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
              isPositive
                ? 'text-emerald-400 bg-emerald-500/10'
                : isNegative
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-slate-400 bg-slate-800'
            }`}
          >
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {isNeutral && <Minus className="w-3 h-3" />}
            <span>
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          </div>
        )}
      </div>

      {(subtitle || changeLabel) && (
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          <span>{subtitle || changeLabel}</span>
        </div>
      )}
    </div>
  );
};
