import React from 'react';
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;

interface RiskBadgeProps {
  risk: RiskLevel;
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk, showIcon = true }) => {
  const normalized = (risk || 'MEDIUM').toUpperCase();

  const config = {
    LOW: {
      label: 'Low Risk',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: ShieldCheck,
    },
    MEDIUM: {
      label: 'Medium Risk',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: Shield,
    },
    HIGH: {
      label: 'High Risk',
      bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      icon: AlertTriangle,
    },
    CRITICAL: {
      label: 'Critical Risk',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: ShieldAlert,
    },
  }[normalized] || {
    label: normalized,
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: Shield,
  };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium border font-mono ${config.bg}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{config.label}</span>
    </span>
  );
};
