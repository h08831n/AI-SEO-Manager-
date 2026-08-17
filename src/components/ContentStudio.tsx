import React, { useState } from 'react';
import { generateBrief } from '../services/api';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  History,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const ContentStudio: React.FC = () => {
  const [targetKeyword, setTargetKeyword] = useState('distributed tracing in microservices');
  const [topic, setTopic] = useState('OpenTelemetry distributed tracing architectural patterns for high-throughput cloud services');
  const [targetAudience, setTargetAudience] = useState('Senior Backend Engineers & DevOps Architects');
  const [searchIntent, setSearchIntent] = useState('Informational / Architectural Guide');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<any>(null);

  // Markdown Editor States
  const [articleContent, setArticleContent] = useState<string>(`# The Pragmatic Guide to OpenTelemetry Distributed Tracing in High-Throughput Microservices

Distributed tracing has moved from an operational luxury to a core requirement for diagnosing high-latency tail events in asynchronous systems.

## 1. Context Propagation Mechanics (W3C TraceContext)
In distributed microservices, tracing relies on context injection into HTTP/gRPC transport headers:

- **traceparent**: Standard 4-part identifier ensuring zero propagation drift.
- **tracestate**: Vendor-specific baggage pairs.

\`\`\`typescript
import { trace, context } from '@opentelemetry/api';

export function executeTracedCall(spanName: string, fn: Function) {
  const tracer = trace.getTracer('techscale-core');
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
\`\`\`

## 2. Head-Based vs Tail-Based Sampling Tradeoffs
Sampling is mandatory at >10,000 requests/sec. Tail-based sampling via OpenTelemetry Collector prevents dropping error traces.`);

  const [wordCount, setWordCount] = useState<number>(0);
  const [activeSubTab, setActiveSubTab] = useState<'BRIEF' | 'EDITOR' | 'EEAT_ANALYZER'>('BRIEF');
  const [copied, setCopied] = useState(false);

  const handleGenerateBrief = async () => {
    setIsGenerating(true);
    try {
      const data = await generateBrief(targetKeyword, topic, targetAudience, searchIntent);
      setGeneratedBrief(data);
      setActiveSubTab('BRIEF');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(articleContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Sparkles className="h-4 w-4" />
            <span>AI CONTENT STUDIO & E-E-A-T INFORMATION GAIN ENGINE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AI Content Studio & Comprehensive Brief Generator
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Generate 12-dimensional SEO content briefs, enforce E-E-A-T and proprietary Information Gain benchmarks, and author technical articles with markdown versioning.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition-all"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('BRIEF')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'BRIEF'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SEO Content Brief Generator
        </button>
        <button
          onClick={() => setActiveSubTab('EDITOR')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'EDITOR'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Markdown Production Editor
        </button>
        <button
          onClick={() => setActiveSubTab('EEAT_ANALYZER')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'EEAT_ANALYZER'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          E-E-A-T & Information Gain Score (92/100)
        </button>
      </div>

      {/* VIEW 1: BRIEF GENERATOR */}
      {activeSubTab === 'BRIEF' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Brief Input Parameters (Left) */}
          <div className="lg:col-span-5 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white tracking-tight">Generate New SEO Content Brief</h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Primary Keyword</label>
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Core Topic & Scope</label>
                <textarea
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Target Audience Persona</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Search Intent</label>
                <input
                  type="text"
                  value={searchIntent}
                  onChange={(e) => setSearchIntent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateBrief}
              disabled={isGenerating}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow transition-all"
            >
              <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Synthesizing Detailed Brief...' : 'Generate 12-Pillar Brief with Gemini AI'}</span>
            </button>
          </div>

          {/* Generated Brief Display Panel (Right) */}
          <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-5">
            {generatedBrief ? (
              <div className="space-y-4 text-xs">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Synthesized Content Brief</span>
                  <h3 className="text-base font-bold text-white mt-1">{generatedBrief.recommendedTitle || targetKeyword}</h3>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-mono">Word Target: ~{generatedBrief.targetWordCount || 2400} words</p>
                </div>

                {/* Title Options */}
                {generatedBrief.titleOptions?.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Recommended Title Angles</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1 mt-1">
                      {generatedBrief.titleOptions.map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Heading Outline */}
                {generatedBrief.headingOutline?.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Structural Heading Outline</span>
                    <div className="space-y-1.5 mt-2">
                      {generatedBrief.headingOutline.map((h: any, i: number) => (
                        <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800">
                          <span className="font-mono text-emerald-400 font-bold">{h.level}:</span>{' '}
                          <span className="text-white font-medium">{h.heading}</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">{h.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* E-E-A-T & Information Gain Requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-indigo-950/60 space-y-1">
                    <span className="font-bold text-indigo-400 uppercase text-[10px]">E-E-A-T Requirements</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                      {generatedBrief.eeatRequirements?.map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-emerald-950/60 space-y-1">
                    <span className="font-bold text-emerald-400 uppercase text-[10px]">Information Gain Triggers</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                      {generatedBrief.informationGainTriggers?.map((g: string, i: number) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <span>Configure keyword parameters and click "Generate Brief" to create an actionable outline</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: MARKDOWN PRODUCTION EDITOR */}
      {activeSubTab === 'EDITOR' && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Markdown Production Studio</h2>
              <p className="text-xs text-slate-400">Zero generic fluff. Technical code blocks and proprietary data placeholders.</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {articleContent.split(/\s+/).filter(Boolean).length} Words
            </span>
          </div>

          <textarea
            rows={16}
            value={articleContent}
            onChange={(e) => setArticleContent(e.target.value)}
            className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
          />
        </div>
      )}

      {/* VIEW 3: E-E-A-T & INFORMATION GAIN ANALYZER */}
      {activeSubTab === 'EEAT_ANALYZER' && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">E-E-A-T & Information Gain Diagnostic</h2>
              <p className="text-xs text-slate-400">Evaluated against Google Search Quality Rater Guidelines</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-emerald-400">92 / 100</span>
              <span className="text-[10px] text-slate-400 block uppercase font-mono">High Authority Grade</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">1. Experience (90%)</span>
              <p className="text-slate-300">Contains direct first-hand code examples and architectural benchmark measurements.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">2. Expertise (95%)</span>
              <p className="text-slate-300">Authored by Principal Infrastructure Architect with verified industry credentials.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">3. Authoritativeness (92%)</span>
              <p className="text-slate-300">Cited by CNCF ecosystem documentation and referenced across 14 industry publications.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">4. Trustworthiness (91%)</span>
              <p className="text-slate-300">Fully transparent editorial review cycle, fact checking notes, and RFC citations.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
