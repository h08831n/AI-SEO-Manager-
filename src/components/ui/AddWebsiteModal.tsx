import React, { useState } from 'react';
import { X, Globe, Plus, Sparkles, Check, AlertCircle } from 'lucide-react';
import { createWebsite } from '../../services/api';

interface AddWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWebsiteCreated: (newSite: any) => void;
}

export const AddWebsiteModal: React.FC<AddWebsiteModalProps> = ({
  isOpen,
  onClose,
  onWebsiteCreated,
}) => {
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [productionUrl, setProductionUrl] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [industry, setIndustry] = useState('B2B SaaS / Enterprise');
  const [defaultLanguage, setDefaultLanguage] = useState('en-US');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().trim();
    setDomain(val);
    if (!name && val) {
      // Auto-populate friendly name
      const clean = val.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      setName(clean.split('.')[0].toUpperCase() + ' Engine');
    }
    if (!productionUrl && val) {
      setProductionUrl(val.startsWith('http') ? val : `https://${val}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain || cleanDomain.length < 3) {
      setError('Please provide a valid domain name (e.g. example.com).');
      return;
    }

    const prodUrl = productionUrl || `https://${cleanDomain}`;

    setIsSubmitting(true);
    try {
      const created = await createWebsite({
        domain: cleanDomain,
        name: name || cleanDomain,
        productionUrl: prodUrl,
        sitemapUrl: sitemapUrl || `${prodUrl}/sitemap.xml`,
        industry,
        defaultLanguage,
      });

      onWebsiteCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register website in workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Add Target Website</h3>
              <p className="text-xs text-slate-400">Register domain for 24/7 technical crawl & autonomous SEO</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 flex items-center space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Domain Name <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              value={domain}
              onChange={handleDomainChange}
              placeholder="e.g. acme-corp.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Global"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Industry / Niche
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="B2B SaaS / Enterprise">B2B SaaS / Enterprise</option>
                <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                <option value="FinTech & Banking">FinTech & Banking</option>
                <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                <option value="Media & Publishing">Media & Publishing</option>
                <option value="Agency & Client Services">Agency & Client Services</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Production URL
            </label>
            <input
              type="url"
              value={productionUrl}
              onChange={(e) => setProductionUrl(e.target.value)}
              placeholder="https://acme-corp.com"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Sitemap URL (Optional)
              </label>
              <input
                type="text"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                placeholder="https://acme-corp.com/sitemap.xml"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Default Language
              </label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
              >
                <option value="en-US">en-US (United States)</option>
                <option value="en-GB">en-GB (United Kingdom)</option>
                <option value="de-DE">de-DE (Germany)</option>
                <option value="fr-FR">fr-FR (France)</option>
                <option value="es-ES">es-ES (Spain)</option>
                <option value="ja-JP">ja-JP (Japan)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !domain}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'Registering...' : 'Add Website & Begin Crawl'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
