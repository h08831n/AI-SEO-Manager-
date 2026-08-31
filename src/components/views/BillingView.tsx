import React from 'react';
import {
  CreditCard,
  Check,
  Zap,
  Globe,
  TrendingUp,
  Users,
  Download,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const BillingView: React.FC = () => {
  const invoices = [
    { id: 'INV-2026-08', date: 'Aug 01, 2026', amount: '$499.00', status: 'PAID', plan: 'Enterprise SEO Engine' },
    { id: 'INV-2026-07', date: 'Jul 01, 2026', amount: '$499.00', status: 'PAID', plan: 'Enterprise SEO Engine' },
    { id: 'INV-2026-06', date: 'Jun 01, 2026', amount: '$499.00', status: 'PAID', plan: 'Enterprise SEO Engine' },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Subscription & Quota Allocation</h2>
        <p className="text-xs text-slate-400">
          Manage your enterprise SaaS subscription tier, crawler worker allocations, and team billing.
        </p>
      </div>

      {/* Plan Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ACTIVE PLAN
            </span>
            <span className="text-sm font-bold text-white">Enterprise Autonomous Suite</span>
          </div>
          <p className="text-xs text-slate-400">Next billing cycle on September 1, 2026 • Renews automatically</p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-white">$499<span className="text-xs font-normal text-slate-400">/month</span></div>
          <span className="text-[10px] text-emerald-400 font-mono">Unlimited Autonomous Fixes</span>
        </div>
      </div>

      {/* Usage Quota Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">Monthly Crawled URLs</span>
            </div>
            <span className="font-mono text-slate-400">42,180 / 100,000</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '42%' }} />
          </div>
          <div className="text-[11px] text-slate-500">Resets in 14 days • 57,820 remaining</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-white">Tracked Keywords</span>
            </div>
            <span className="font-mono text-slate-400">48 / 250</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '19%' }} />
          </div>
          <div className="text-[11px] text-slate-500">202 available keyword tracking slots</div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">Billing History & Invoices</h3>
        </div>

        <div className="divide-y divide-slate-800/80 text-xs">
          {invoices.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
              <div className="space-y-0.5">
                <div className="font-bold text-white font-mono">{inv.id}</div>
                <div className="text-[11px] text-slate-400">{inv.plan} • {inv.date}</div>
              </div>

              <div className="flex items-center space-x-4">
                <span className="font-mono text-white font-bold">{inv.amount}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {inv.status}
                </span>
                <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
