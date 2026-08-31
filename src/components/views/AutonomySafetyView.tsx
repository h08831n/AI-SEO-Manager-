import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  Zap,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  Flame,
  Layers,
  Save,
  HelpCircle,
} from 'lucide-react';
import { SafetyConfig, AutonomyMode, Website } from '../../types';

interface AutonomySafetyViewProps {
  website: Website;
  initialConfig?: SafetyConfig;
  onSaveConfig?: (config: SafetyConfig) => void;
}

export const AutonomySafetyView: React.FC<AutonomySafetyViewProps> = ({
  website,
  initialConfig,
  onSaveConfig,
}) => {
  const [config, setConfig] = useState<SafetyConfig>(
    initialConfig || {
      autonomyLevel: 'SUPERVISED',
      rollbackEnabled: true,
      verificationEnabled: true,
      canaryRolloutPct: 25,
      bayesianDamping: 0.85,
      circuitBreakerActive: true,
      maxActionsPerDay: 8,
      autoRollbackOnDrop: true,
      slackWebhook: '',
    }
  );

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onSaveConfig?.(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              AUTONOMY & SAFETY GATES
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Guardrails for {website.domain}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Autonomous SEO Execution & Circuit Breakers
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Configure how aggressively your virtual SEO team acts autonomously, set rate limits, enable zero-downtime rollback snapshots, and establish circuit breakers.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaved ? 'Guardrails Saved!' : 'Save Safeguards'}</span>
        </button>
      </div>

      {/* Autonomy Mode Selector */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            1. Swarm Autonomy Level
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Determine the balance between automated execution speed and human-in-the-loop review.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Manual */}
          <div
            onClick={() => setConfig({ ...config, autonomyLevel: 'MANUAL' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.autonomyLevel === 'MANUAL'
                ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">Manual Review</span>
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The AI team analyzes and drafts all recommendations, but requires manual human approval for every single code/content change.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
              0% Autonomous execution
            </div>
          </div>

          {/* Supervised (Recommended) */}
          <div
            onClick={() => setConfig({ ...config, autonomyLevel: 'SUPERVISED' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.autonomyLevel === 'SUPERVISED'
                ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white">Supervised Autonomy</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    RECOMMENDED
                  </span>
                </div>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically executes Low-Risk, High-Confidence fixes (e.g. self-canonicals, schema markup, title hooks), while queuing high-impact structural changes for review.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400 font-mono">
              Low-risk auto-pilot active
            </div>
          </div>

          {/* Autonomous */}
          <div
            onClick={() => setConfig({ ...config, autonomyLevel: 'AUTONOMOUS' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.autonomyLevel === 'AUTONOMOUS'
                ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">Full Autonomous Swarm</span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Autonomous 24/7 self-healing SEO department. Continuously audits, decides, executes via CMS/Git webhooks, verifies across 3 stages, and self-reverts if anomalies occur.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-slate-800/80 text-[11px] text-indigo-400 font-mono">
              100% Autonomous continuous loop
            </div>
          </div>
        </div>
      </div>

      {/* Safety Gates & Circuit Breakers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification & Rollback Safeguards */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              2. Verification & Rollback Safeguards
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Toggle 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="space-y-0.5 pr-4">
                <div className="font-semibold text-slate-200">Zero-Downtime Rollback Snapshots</div>
                <div className="text-slate-400 text-[11px]">Takes immutable pre-mutation state capture before applying any change.</div>
              </div>
              <input
                type="checkbox"
                checked={config.rollbackEnabled}
                onChange={(e) => setConfig({ ...config, rollbackEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Toggle 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="space-y-0.5 pr-4">
                <div className="font-semibold text-slate-200">6-Stage Automated Verification</div>
                <div className="text-slate-400 text-[11px]">Enforces Stage 1 DOM check, Stage 2 GSC SERP check, Stage 3 Traffic DiD test.</div>
              </div>
              <input
                type="checkbox"
                checked={config.verificationEnabled}
                onChange={(e) => setConfig({ ...config, verificationEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Toggle 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="space-y-0.5 pr-4">
                <div className="font-semibold text-slate-200">Automatic Rollback on Metric Degradation</div>
                <div className="text-slate-400 text-[11px]">Auto-reverts any mutation if organic CTR or impressions drop by &gt;5% in 72 hours.</div>
              </div>
              <input
                type="checkbox"
                checked={config.autoRollbackOnDrop}
                onChange={(e) => setConfig({ ...config, autoRollbackOnDrop: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Toggle 4 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="space-y-0.5 pr-4">
                <div className="font-semibold text-slate-200">Google Algorithm Turbulence Circuit Breaker</div>
                <div className="text-slate-400 text-[11px]">Automatically halts non-essential modifications during detected Google Core Algorithm volatility.</div>
              </div>
              <input
                type="checkbox"
                checked={config.circuitBreakerActive}
                onChange={(e) => setConfig({ ...config, circuitBreakerActive: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Rate Limiting & Bayesian Thresholds */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              3. Rate Limiting & Bayesian Calibrations
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Slider 1: Max Actions Per Day */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Daily Execution Rate Limit</span>
                <span className="font-mono text-emerald-400 font-bold">{config.maxActionsPerDay} actions / day</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={config.maxActionsPerDay}
                onChange={(e) => setConfig({ ...config, maxActionsPerDay: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                Caps the maximum number of automated SEO mutations deployed per 24 hours.
              </p>
            </div>

            {/* Slider 2: Canary Rollout Percentage */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Canary Rollout Allocation</span>
                <span className="font-mono text-cyan-400 font-bold">{config.canaryRolloutPct}% of pages</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={config.canaryRolloutPct}
                onChange={(e) => setConfig({ ...config, canaryRolloutPct: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-[11px] text-slate-400">
                Gradually applies mutations to a subset of cluster URLs before rolling out to 100% of pages.
              </p>
            </div>

            {/* Slider 3: Bayesian Damping Factor */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Minimum Bayesian Confidence Threshold</span>
                <span className="font-mono text-indigo-400 font-bold">{Math.round(config.bayesianDamping * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.60"
                max="0.99"
                step="0.01"
                value={config.bayesianDamping}
                onChange={(e) => setConfig({ ...config, bayesianDamping: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Decisions with Bayesian posterior confidence below this threshold are routed to human review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
