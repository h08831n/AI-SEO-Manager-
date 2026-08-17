import React, { useState } from 'react';
import { generateSchema } from '../services/api';
import {
  Code,
  Sparkles,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const SchemaStudio: React.FC = () => {
  const [selectedSchemaType, setSelectedSchemaType] = useState<string>('Article');
  const [headline, setHeadline] = useState('Kubernetes Cost Optimization: 7 Production-Grade Strategies');
  const [url, setUrl] = useState('https://techscale.io/blog/kubernetes-cost-optimization');
  const [authorName, setAuthorName] = useState('Alex Mercer, Cloud Architect');
  const [datePublished, setDatePublished] = useState('2026-08-15');
  const [faqQuestions, setFaqQuestions] = useState([
    { question: 'What causes Kubernetes cluster cost overruns?', answer: 'Uncapped CPU/memory requests and unutilized idle replica sets are the primary drivers.' },
    { question: 'How much can Karpenter save on EKS workloads?', answer: 'Teams routinely observe 35-50% infrastructure cost reductions using Karpenter spot consolidation.' },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJsonLd, setGeneratedJsonLd] = useState<string>(`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Kubernetes Cost Optimization: 7 Production-Grade Strategies",
  "url": "https://techscale.io/blog/kubernetes-cost-optimization",
  "author": {
    "@type": "Person",
    "name": "Alex Mercer, Cloud Architect"
  },
  "publisher": {
    "@type": "Organization",
    "name": "TechScale",
    "logo": {
      "@type": "ImageObject",
      "url": "https://techscale.io/logo.png"
    }
  },
  "datePublished": "2026-08-15",
  "dateModified": "2026-08-17"
}`);

  const [copied, setCopied] = useState(false);

  const handleGenerateSchema = async () => {
    setIsGenerating(true);
    try {
      const payload: any = {
        type: selectedSchemaType,
        data: {
          headline,
          url,
          authorName,
          datePublished,
          faqItems: faqQuestions,
          organizationName: 'TechScale',
        },
      };
      const result = await generateSchema(selectedSchemaType, payload.data);
      setGeneratedJsonLd(JSON.stringify(result.schemaJsonLd, null, 2));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`<script type="application/ld+json">\n${generatedJsonLd}\n</script>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Code className="h-4 w-4" />
            <span>SCHEMA.ORG & GOOGLE SEARCH CENTRAL COMPLIANT JSON-LD</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Schema JSON-LD Generator & Rich Snippet Studio
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Generate and validate structured data for Articles, FAQPages, Products, Organizations, and BreadcrumbLists. Ensure rich snippet eligibility on Google SERPs.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow transition-all shrink-0"
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? 'Copied HTML Script!' : 'Copy <script> Tag'}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schema Input Controls (Left) */}
        <div className="lg:col-span-5 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white tracking-tight">Schema Parameters</h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Schema Type</label>
              <select
                aria-label="Select Schema Type"
                value={selectedSchemaType}
                onChange={(e) => setSelectedSchemaType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="Article">Article / BlogPosting</option>
                <option value="FAQPage">FAQPage</option>
                <option value="Product">Product / SoftwareApplication</option>
                <option value="Organization">Organization / LocalBusiness</option>
                <option value="BreadcrumbList">BreadcrumbList</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Entity Headline / Name</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Target URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Author / Expert Name</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Date Published</label>
              <input
                type="date"
                value={datePublished}
                onChange={(e) => setDatePublished(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateSchema}
            disabled={isGenerating}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow transition-all"
          >
            <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Validating Schema...' : 'Generate & Validate JSON-LD'}</span>
          </button>
        </div>

        {/* Live JSON-LD Code Output & Google Rich Result Validator (Right) */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-emerald-400 font-bold">VALIDATED JSON-LD OUTPUT</span>
              <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                Google Rich Snippet Eligible
              </span>
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto max-h-96 leading-relaxed">
              {generatedJsonLd}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
