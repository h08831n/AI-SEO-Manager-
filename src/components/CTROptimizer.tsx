import React, { useState } from 'react';
import { optimizeCtr } from '../services/api';
import {
  Search,
  Sparkles,
  Smartphone,
  Monitor,
  Copy,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const CTROptimizer: React.FC = () => {
  const [targetKeyword, setTargetKeyword] = useState('b2b enterprise workflow automation');
  const [currentTitle, setCurrentTitle] = useState('Automate Workflows Faster with TechScale Enterprise Software');
  const [currentMeta, setCurrentMeta] = useState('TechScale workflow engine helps software teams automate build steps and compliance checks with ease.');
  const [currentPosition, setCurrentPosition] = useState(6.2);
  const [currentCtr, setCurrentCtr] = useState(4.32);
  const [impressions, setImpressions] = useState(34200);

  const [previewMode, setPreviewMode] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [selectedMetaIndex, setSelectedMetaIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // Expected vs Actual CTR Curve benchmark
  const ctrCurveData = [
    { position: 1, expectedCtr: 28.5, actualCtr: 26.2 },
    { position: 2, expectedCtr: 15.7, actualCtr: 14.8 },
    { position: 3, expectedCtr: 11.0, actualCtr: 10.1 },
    { position: 4, expectedCtr: 8.0, actualCtr: 7.2 },
    { position: 5, expectedCtr: 6.2, actualCtr: 5.9 },
    { position: 6, expectedCtr: 5.1, actualCtr: 3.4 }, // underperforming
    { position: 7, expectedCtr: 4.1, actualCtr: 3.8 },
    { position: 8, expectedCtr: 3.3, actualCtr: 2.1 }, // underperforming
    { position: 9, expectedCtr: 2.8, actualCtr: 2.5 },
    { position: 10, expectedCtr: 2.4, actualCtr: 1.8 },
  ];

  const handleGenerateAiRewrites = async () => {
    setIsGenerating(true);
    try {
      const data = await optimizeCtr(
        currentTitle,
        currentMeta,
        targetKeyword,
        currentPosition,
        currentCtr,
        impressions
      );
      setAiSuggestions(data);
      setSelectedTitleIndex(0);
      setSelectedMetaIndex(0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const activeDisplayTitle = aiSuggestions?.recommendedTitles?.[selectedTitleIndex]?.title || currentTitle;
  const activeDisplayMeta = aiSuggestions?.recommendedMetaDescriptions?.[selectedMetaIndex]?.description || currentMeta;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(`<title>${activeDisplayTitle}</title>\n<meta name="description" content="${activeDisplayMeta}">`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Search className="h-4 w-4" />
            <span>CLICK-THROUGH RATE & SERP SNIPPET STUDIO</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            CTR Curve Optimizer & SERP Snippet Simulator
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Compare actual SERP click rates against category curves, diagnose title/meta intent mismatch, and generate high-converting title and description variations with Gemini AI.
          </p>
        </div>
      </div>

      {/* CTR Curve Analysis Chart */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">SERP Expected vs Actual CTR Curve</h2>
            <p className="text-xs text-slate-400">Position 6 and Position 8 display severe negative CTR anomalies (-33% below expected baseline)</p>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ctrCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="position" stroke="#94a3b8" fontSize={11} label={{ value: 'SERP Position', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
              <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="expectedCtr" name="Expected Benchmark CTR %" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="actualCtr" name="Actual Site CTR %" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Snippet Optimizer Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters & AI Generator (Left) */}
        <div className="lg:col-span-6 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white tracking-tight">Snippet Optimization Input</h3>
            <button
              onClick={handleGenerateAiRewrites}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Generating...' : 'AI Generate Rewrites'}</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Target Keyword</label>
              <input
                type="text"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Position</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentPosition}
                  onChange={(e) => setCurrentPosition(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono mb-1">Actual CTR %</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentCtr}
                  onChange={(e) => setCurrentCtr(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono mb-1">Impressions</label>
                <input
                  type="number"
                  value={impressions}
                  onChange={(e) => setImpressions(parseInt(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Current Title ({currentTitle.length} chars)</label>
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Current Meta Description ({currentMeta.length} chars)</label>
              <textarea
                rows={2}
                value={currentMeta}
                onChange={(e) => setCurrentMeta(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* AI Suggestions Selectors */}
          {aiSuggestions && (
            <div className="space-y-4 pt-3 border-t border-slate-800">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Select Optimized Title ({aiSuggestions.recommendedTitles?.length || 0})
                </span>
                <div className="space-y-2 mt-2">
                  {aiSuggestions.recommendedTitles?.map((t: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTitleIndex(idx)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                        selectedTitleIndex === idx
                          ? 'bg-slate-850 border-emerald-500/50 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{t.title}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">+{t.predictedCtrLift} CTR</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{t.angle} • {t.title.length} chars</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Select Optimized Meta Description
                </span>
                <div className="space-y-2 mt-2">
                  {aiSuggestions.recommendedMetaDescriptions?.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedMetaIndex(idx)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                        selectedMetaIndex === idx
                          ? 'bg-slate-850 border-emerald-500/50 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-slate-200">{m.description}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{m.description.length} chars • Hook: {m.hook}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live SERP Preview Simulator (Right) */}
        <div className="lg:col-span-6 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white tracking-tight">Google SERP Live Simulator</h3>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setPreviewMode('DESKTOP')}
                className={`p-1.5 rounded text-xs ${previewMode === 'DESKTOP' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewMode('MOBILE')}
                className={`p-1.5 rounded text-xs ${previewMode === 'MOBILE' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Realistic SERP Rendering Card */}
          <div className={`p-4 rounded-xl border ${previewMode === 'MOBILE' ? 'max-w-sm mx-auto bg-white text-slate-900' : 'bg-white text-slate-900'}`}>
            <div className="flex items-center space-x-2 text-[12px] text-slate-700 mb-1">
              <div className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                T
              </div>
              <span className="truncate">techscale.io &rsaquo; platform &rsaquo; workflow-engine</span>
            </div>
            <h4 className="text-[#1a0dab] hover:underline text-lg font-medium leading-snug cursor-pointer">
              {activeDisplayTitle}
            </h4>
            <p className="text-[#4d5156] text-xs mt-1 leading-relaxed">
              {activeDisplayMeta}
            </p>
          </div>

          {/* Character & Pixel Width Limits Checker */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px]">Title Tag Length</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="font-mono text-base font-bold text-white">{activeDisplayTitle.length} chars</span>
                <span className={`text-[10px] font-semibold ${activeDisplayTitle.length <= 60 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeDisplayTitle.length <= 60 ? 'Optimal (≤60)' : 'May Truncate (>60)'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px]">Meta Description Length</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="font-mono text-base font-bold text-white">{activeDisplayMeta.length} chars</span>
                <span className={`text-[10px] font-semibold ${activeDisplayMeta.length <= 160 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeDisplayMeta.length <= 160 ? 'Optimal (≤160)' : 'May Truncate (>160)'}
                </span>
              </div>
            </div>
          </div>

          {/* Copy Snippet Code CTA */}
          <button
            onClick={handleCopySnippet}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-700 transition-all"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'HTML Snippet Copied to Clipboard!' : 'Copy HTML <title> & <meta> Tags'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
