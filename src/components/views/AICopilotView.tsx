import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  User,
  Shield,
  Zap,
  ArrowRight,
  RefreshCw,
  Code,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { askCopilot } from '../../services/api';
import { Website, SEOHealthState } from '../../types';

interface AICopilotViewProps {
  website: Website;
  healthState: SEOHealthState;
  onExecuteSuggestedFix?: (fix: any) => void;
  initialPrompt?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  evidence?: any;
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  website,
  healthState,
  onExecuteSuggestedFix,
  initialPrompt,
}) => {
  const [input, setInput] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello Hossein. I am your Autonomous AI SEO Copilot for **${website.domain}**. All 17 health pillars, GSC telemetry, and Bayesian decision rules are indexed in memory. How can I assist you with your search architecture today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const presetPrompts = [
    'Why did organic impressions drop in the last 14 days?',
    'Identify keyword cannibalization risks between our top URLs',
    'Generate schema markup & CTR title recommendations for pricing page',
    'Audit Core Web Vitals (LCP & INP) bottlenecks',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askCopilot(query, {
        domain: website.domain,
        verifiedWebsiteId: website.id,
        availableDataStreams: ['GSC', 'GA4', 'DOM_CRAWLER'],
        notes: `Current health score: ${healthState.overallScore || 88}%, Active pillars: technical, onPage, ctr, schema`,
      });

      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        text: response.reply || 'Analysis completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        evidence: response,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `Diagnostic failed: ${err.message || 'Unable to connect to Copilot engine.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
      {/* Copilot Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white shadow-md shadow-indigo-950/50">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">AI SEO Copilot</h3>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected: {website.domain}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Context-Aware Neural SEO Reasoning Engine</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-slate-500">
          <span>Score: {healthState.overallScore || 88}%</span>
          <span>•</span>
          <span>17 Pillars In-Memory</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans text-xs">
        {messages.map((m) => {
          const isUser = m.sender === 'user';

          return (
            <div key={m.id} className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 space-y-2 leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[10px] font-mono ${isUser ? 'text-emerald-200 text-right' : 'text-slate-500'}`}>
                  {m.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0 font-bold font-mono text-[10px] mt-0.5">
                  HN
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center space-x-2 rounded-tl-none">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing 17 SEO pillars and GSC performance data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Preset Prompt Chips */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 flex items-center space-x-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] uppercase font-bold text-slate-500 font-mono shrink-0">Prompts:</span>
        {presetPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] whitespace-nowrap border border-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask AI Copilot about SEO health, rank drops, or schema for ${website.domain}...`}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/50 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
