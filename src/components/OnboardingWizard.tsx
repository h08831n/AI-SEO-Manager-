import React, { useState } from 'react';
import {
  Globe,
  Boxes,
  Activity,
  Bot,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
  BarChart3,
  Search,
  X,
} from 'lucide-react';
import { Website } from '../types';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (website: Website) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);

  // Form State
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('SaaS & Cloud Software');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [cmsType, setCmsType] = useState<'WORDPRESS' | 'SHOPIFY' | 'HEADLESS' | 'CUSTOM'>('HEADLESS');
  const [gscConnected, setGscConnected] = useState(true);
  const [ga4Connected, setGa4Connected] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1 && !domain) {
      alert('Please enter your website domain');
      return;
    }
    if (step === 4) {
      // Trigger audit simulation step
      setStep(5);
      setIsAuditing(true);
      setAuditProgress(15);
      const interval = setInterval(() => {
        setAuditProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsAuditing(false);
            return 100;
          }
          return prev + 25;
        });
      }, 400);
      return;
    }
    setStep((prev) => Math.min(6, prev + 1));
  };

  const handleFinish = () => {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const newSite: Website = {
      id: `site-${Date.now()}`,
      domain: cleanDomain || 'mywebsite.com',
      name: name || cleanDomain || 'My Website',
      industry: industry || 'Technology',
      productionUrl: `https://${cleanDomain || 'mywebsite.com'}`,
      sitemapUrl: sitemapUrl || `https://${cleanDomain || 'mywebsite.com'}/sitemap.xml`,
      defaultLanguage: 'en-US',
      competitors: ['competitor-a.com', 'competitor-b.com'],
      gscConnected,
      ga4Connected,
      wpConnected: cmsType === 'WORDPRESS',
      sheetsConnected: false,
      lastCrawlTimestamp: new Date().toISOString(),
      capacityConfig: {
        articlesPerWeek: 3,
        writersCount: 2,
        editorsCount: 1,
        weeklyHours: 30,
      },
    };
    onComplete(newSite);
  };

  const stepsList = [
    { num: 1, label: 'Website' },
    { num: 2, label: 'CMS Hook' },
    { num: 3, label: 'Search Console' },
    { num: 4, label: 'Analytics' },
    { num: 5, label: 'Initial Audit' },
    { num: 6, label: 'Launch Swarm' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Virtual SEO Department Setup Wizard
              </h2>
              <p className="text-xs text-slate-400">
                Deploy your autonomous 6-agent SEO team in 2 minutes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 bg-slate-950/30 border-b border-slate-800/80 flex items-center justify-between">
          {stepsList.map((s, idx) => (
            <div key={s.num} className="flex items-center space-x-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                  step === s.num
                    ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/40'
                    : step > s.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  step === s.num ? 'text-white font-semibold' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
              {idx < stepsList.length - 1 && (
                <div className="hidden sm:block w-4 h-[1px] bg-slate-800 ml-2" />
              )}
            </div>
          ))}
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Step 1: Website Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Enter Your Target Website</h3>
                <p className="text-xs text-slate-400">
                  Provide your primary production domain for continuous crawl audits and ranking tracking.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Website Domain *
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value);
                      if (!name) setName(e.target.value.replace(/^https?:\/\//, '').split('.')[0]);
                    }}
                    placeholder="e.g. techscale.io"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Brand / Workspace Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. TechScale Cloud"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Industry / Vertical
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SaaS & Cloud Software">SaaS & Cloud Software</option>
                      <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                      <option value="FinTech & Banking">FinTech & Banking</option>
                      <option value="Healthcare & Bio">Healthcare & Bio</option>
                      <option value="Agency & Services">Agency & Services</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    XML Sitemap URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={sitemapUrl}
                    onChange={(e) => setSitemapUrl(e.target.value)}
                    placeholder="e.g. https://techscale.io/sitemap.xml"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: CMS Integration */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Select Your Content Architecture</h3>
                <p className="text-xs text-slate-400">
                  Allows your AI team to safely stage meta tag, schema, and content improvements.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { id: 'HEADLESS', name: 'Headless / Next.js', desc: 'Git Webhook & API Mutation' },
                  { id: 'WORDPRESS', name: 'WordPress REST', desc: 'Yoast / RankMath Integration' },
                  { id: 'SHOPIFY', name: 'Shopify Liquid', desc: 'Product & Collection Schema' },
                  { id: 'CUSTOM', name: 'Custom Edge Proxy', desc: 'Cloudflare Worker / Lambda@Edge' },
                ].map((cms) => (
                  <div
                    key={cms.id}
                    onClick={() => setCmsType(cms.id as any)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      cmsType === cms.id
                        ? 'bg-slate-950 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{cms.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{cms.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Google Search Console */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Connect Google Search Console</h3>
                <p className="text-xs text-slate-400">
                  Enables real SERP impressions, query click-through-rates, and indexing status telemetry.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Search Console OAuth 2.0</div>
                    <div className="text-[11px] text-slate-400">Live query impression & ranking feed</div>
                  </div>
                </div>
                <button
                  onClick={() => setGscConnected(!gscConnected)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    gscConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {gscConnected ? 'Connected ✓' : 'Connect GSC'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Google Analytics 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Connect Google Analytics 4</h3>
                <p className="text-xs text-slate-400">
                  Powers Bayesian causal impact attribution and organic revenue conversion lift tracking.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">GA4 Data Stream</div>
                    <div className="text-[11px] text-slate-400">Attribution & organic engagement metrics</div>
                  </div>
                </div>
                <button
                  onClick={() => setGa4Connected(!ga4Connected)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ga4Connected
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {ga4Connected ? 'Connected ✓' : 'Connect GA4'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Initial Crawl & Audit */}
          {step === 5 && (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">
                  {auditProgress < 100 ? 'Running Initial 17-Pillar Audit...' : 'Audit Complete!'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {auditProgress < 100
                    ? 'Autonomous crawler is analyzing HTML structure, schema, canonicals, and indexability...'
                    : '17 Health Pillars evaluated. Initial recommendations generated.'}
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-2 pt-2">
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${auditProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span>Crawling URLs</span>
                  <span className="text-emerald-400 font-bold">{auditProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Launch SEO Swarm */}
          {step === 6 && (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Your Virtual SEO Department is Ready!
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  6 specialized agents (Technical, Content, Growth, Competitor, Auditor, Automation Manager) have been initialized for <strong className="text-emerald-400">{domain || 'your website'}</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left pt-2 max-w-md mx-auto">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="text-slate-500 font-mono text-[10px]">HEALTH SCORE</div>
                  <div className="font-bold text-emerald-400 text-sm mt-0.5">88 / 100 (17 Pillars)</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="text-slate-500 font-mono text-[10px]">FIRST ACTIONS READY</div>
                  <div className="font-bold text-indigo-400 text-sm mt-0.5">4 High-Confidence Fixes</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          {step > 1 && step < 6 ? (
            <button
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={isAuditing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 && (
            <button
              onClick={handleNext}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <span>{step === 4 ? 'Run Initial Audit' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 5 && auditProgress === 100 && (
            <button
              onClick={() => setStep(6)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <span>Review Strategy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 6 && (
            <button
              onClick={handleFinish}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch Command Center</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
