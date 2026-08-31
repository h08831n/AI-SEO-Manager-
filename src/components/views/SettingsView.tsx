import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Zap,
  Sliders,
  Key,
  Bell,
  Check,
  AlertTriangle,
  Lock,
  Server,
} from 'lucide-react';
import { Website } from '../../types';

interface SettingsViewProps {
  website: Website;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ website }) => {
  const [autonomyLevel, setAutonomyLevel] = useState<'MANUAL' | 'SUPERVISED' | 'FULL_AUTONOMOUS'>('SUPERVISED');
  const [canaryRolloutPct, setCanaryRolloutPct] = useState(25);
  const [bayesianDamping, setBayesianDamping] = useState(0.85);
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/X00');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">System Configuration & Safety Gates</h2>
        <p className="text-xs text-slate-400">
          Configure autonomous agent boundaries, Bayesian auto-damping thresholds, and tenant API keys.
        </p>
      </div>

      {isSaved && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-mono flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Safety parameters and autonomy settings successfully updated!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Autonomy Level */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Autonomous Decision Mode</h3>
              <p className="text-xs text-slate-400">Controls whether AI actions execute automatically or require human sign-off.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              {
                id: 'MANUAL',
                title: 'Manual Mode',
                desc: 'All optimizations require manual human approval in the Recommendation Center.',
              },
              {
                id: 'SUPERVISED',
                title: 'Supervised Canary',
                desc: 'Low-risk fixes (schema, internal links) execute automatically on 25% canary traffic.',
              },
              {
                id: 'FULL_AUTONOMOUS',
                title: 'Full Autonomous',
                desc: 'Continuous 24/7 self-healing SEO engine with automated Stage 1-3 verifications.',
              },
            ].map((mode) => (
              <div
                key={mode.id}
                onClick={() => setAutonomyLevel(mode.id as any)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  autonomyLevel === mode.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white">{mode.title}</span>
                  {autonomyLevel === mode.id && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bayesian Learning & Canary Thresholds */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Bayesian Confidence & Damping Gate</h3>
              <p className="text-xs text-slate-400">Mathematical threshold required before the algorithm promotes a learned rule.</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Minimum Bayesian Posterior Confidence</span>
                <span className="font-mono text-emerald-400 font-bold">{(bayesianDamping * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={bayesianDamping}
                onChange={(e) => setBayesianDamping(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Initial Canary Sample Size</span>
                <span className="font-mono text-cyan-400 font-bold">{canaryRolloutPct}% of target URLs</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={canaryRolloutPct}
                onChange={(e) => setCanaryRolloutPct(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Alerting & Webhooks */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Incident & Volatility Webhooks</h3>
              <p className="text-xs text-slate-400">Receive instant alerts if Google Search Console detects indexing anomalies.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Slack / Discord Incoming Webhook URL
            </label>
            <input
              type="url"
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
          >
            Save Safety Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
