import React from 'react';
import { CheckCircle2, Clock, XCircle, RotateCcw, AlertTriangle, Play, ShieldAlert } from 'lucide-react';

export type StatusType =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'FAILED'
  | 'REVERTED'
  | 'REJECTED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'STUCK'
  | 'CIRCUIT_BREAKER_TRIPPED'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = true }) => {
  const norm = (status || 'PENDING').toUpperCase();

  const config: Record<string, { label: string; bg: string; icon: any }> = {
    VERIFIED: {
      label: 'Verified (Stage 1-3)',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: CheckCircle2,
    },
    EXECUTED: {
      label: 'Executed',
      bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      icon: CheckCircle2,
    },
    APPROVED: {
      label: 'Approved',
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: CheckCircle2,
    },
    RUNNING: {
      label: 'Executing...',
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse',
      icon: Play,
    },
    QUEUED: {
      label: 'Queued',
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: Clock,
    },
    PENDING: {
      label: 'Pending Review',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: Clock,
    },
    REVERTED: {
      label: 'Rolled Back',
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: RotateCcw,
    },
    REJECTED: {
      label: 'Rejected',
      bg: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: XCircle,
    },
    FAILED: {
      label: 'Failed',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: XCircle,
    },
    STUCK: {
      label: 'Watchdog Flagged',
      bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      icon: AlertTriangle,
    },
    CIRCUIT_BREAKER_TRIPPED: {
      label: 'Circuit Breaker',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: ShieldAlert,
    },
  };

  const current = config[norm] || {
    label: norm,
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: Clock,
  };

  const Icon = current.icon;

  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border font-mono ${current.bg}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{current.label}</span>
    </span>
  );
};
