import React, { useState } from 'react';
import { generateBrief } from '../services/api';
import { ContentBriefResponse } from '../shared/contracts';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  Copy,
  Layers,
  HelpCircle,
  Link2,
  Image as ImageIcon,
  Tag,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const ContentStudio: React.FC = () => {
  const [targetKeyword, setTargetKeyword] = useState('distributed tracing in microservices');
  const [topic, setTopic] = useState('OpenTelemetry distributed tracing architectural patterns for high-throughput cloud services');
  const [targetAudience, setTargetAudience] = useState('Senior Backend Engineers & DevOps Architects');
  const [searchIntent, setSearchIntent] = useState('Informational / Architectural Guide');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<ContentBriefResponse | null>(null);

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

  const [activeSubTab, setActiveSubTab] = useState<'BRIEF' | 'EDITOR' | 'EEAT_ANALYZER'>('BRIEF');
  const [copied, setCopied] = useState(false);

  const handleGenerateBrief = async () => {
    setIsGenerating(true);
    try {
      const data = await generateBrief({
        targetKeyword,
        topic,
        targetAudience,
        searchIntent,
      });
      setGeneratedBrief(data);
      setActiveSubTab('BRIEF');
    } catch (err) {
      console.error('Brief generation error:', err);
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
            <span>AI CONTENT STUDIO & E-E-A-T BRIEF ARCHITECT</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AI Content Studio & Structured Brief Generator
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Generate 12-dimensional SEO content briefs, enforce E-E-A-T and Information Gain requirements, and author technical articles with markdown formatting.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
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
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'BRIEF'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SEO Content Brief Generator
        </button>
        <button
          onClick={() => setActiveSubTab('EDITOR')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'EDITOR'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Markdown Production Editor
        </button>
        <button
          onClick={() => setActiveSubTab('EEAT_ANALYZER')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'EEAT_ANALYZER'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          E-E-A-T Framework [Demo Fixture]
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
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow transition-all cursor-pointer"
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
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Synthesized Content Brief</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Slug: /{generatedBrief.recommendedSlug || 'slug'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{generatedBrief.seoTitle}</h3>
                  <p className="text-slate-300 text-xs mt-1">{generatedBrief.metaDescription}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-mono text-slate-400">
                    <span>H1: <strong className="text-white">{generatedBrief.h1}</strong></span>
                    <span>Target: <strong className="text-emerald-400">~{generatedBrief.targetWordCount || 2400} words</strong></span>
                    <span>Intent: <strong className="text-indigo-400">{generatedBrief.searchIntent}</strong></span>
                  </div>
                </div>

                {/* Heading Outline */}
                {generatedBrief.outline && generatedBrief.outline.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Structural Heading Outline</span>
                    <div className="space-y-1.5 mt-2">
                      {generatedBrief.outline.map((h, i) => (
                        <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-emerald-400 font-bold">{h.section}</span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-1">{h.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entities & Information Gain */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-lg border border-indigo-950/60 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-indigo-400 font-bold text-[10px] uppercase">
                      <Tag className="h-3 w-3" />
                      <span>Semantic Entities</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {generatedBrief.semanticEntities?.map((entity, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-indigo-950/80 text-indigo-200 rounded border border-indigo-800/40">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-emerald-950/60 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[10px] uppercase">
                      <Sparkles className="h-3 w-3" />
                      <span>Information Gain Angles</span>
                    </div>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                      {generatedBrief.informationGainAngles?.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Internal Links & FAQs */}
                {generatedBrief.internalLinkSuggestions && generatedBrief.internalLinkSuggestions.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[10px] uppercase">
                      <Link2 className="h-3 w-3" />
                      <span>Internal Link Opportunities</span>
                    </div>
                    <div className="space-y-1.5">
                      {generatedBrief.internalLinkSuggestions.map((link, i) => (
                        <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <span className="text-white font-mono font-bold">{link}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FAQs */}
                {generatedBrief.faq && generatedBrief.faq.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center space-x-1.5 text-slate-300 font-bold text-[10px] uppercase">
                      <HelpCircle className="h-3 w-3" />
                      <span>FAQ Schema Content</span>
                    </div>
                    <div className="space-y-1.5">
                      {generatedBrief.faq.map((f, i) => (
                        <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <strong className="text-slate-200 block">Q: {f.question}</strong>
                          <p className="text-slate-400 mt-0.5">Angle: {f.answerAngle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              <p className="text-xs text-slate-400">Technical code blocks and proprietary data placeholders.</p>
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
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">E-E-A-T & Information Gain Diagnostic</h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DEMO_FIXTURE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automated real-time E-E-A-T scoring requires verified live author graph and citation crawlers. Below is the structural evaluation rubric.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-slate-400">-- / 100</span>
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Real-Time Evaluation Pending</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">1. Experience</span>
              <p className="text-slate-400">First-hand screenshots, original data measurements, and tangible implementation evidence.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">2. Expertise</span>
              <p className="text-slate-400">Verified author credentials, subject matter domain depth, and accurate technical terminology.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">3. Authoritativeness</span>
              <p className="text-slate-400">Industry citations, peer backlinks, and recognized topical authority in seed entities.</p>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="font-bold text-emerald-400 uppercase text-[10px] font-mono">4. Trustworthiness</span>
              <p className="text-slate-400">Accurate sources, transparent editorial ownership, working SSL, and clean business disclosures.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
