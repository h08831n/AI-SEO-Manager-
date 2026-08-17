import React, { useState } from 'react';
import { Website, SEOChatMessage } from '../types';
import { askCopilot } from '../services/api';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  HelpCircle,
  CheckCircle2,
  Minimize2,
} from 'lucide-react';

interface SEOCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  website: Website;
}

export const SEOCopilot: React.FC<SEOCopilotProps> = ({
  isOpen,
  onClose,
  website,
}) => {
  const [messages, setMessages] = useState<SEOChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'AI',
      text: `Hello! I am your Autonomous Senior SEO Consultant for **${website.domain}**. I have full context of all 248 crawled URLs, Search Console performance trends, decaying pages, and ICE-ranked task directives. How can I assist your organic growth today?`,
      timestamp: 'Just now',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const shortcutPrompts = [
    'What are today’s top 3 SEO priorities?',
    'How do we fix the cannibalization on "saas metric tracking"?',
    'Which decaying page has the highest revenue recovery potential?',
    'What schema markup is missing on our pricing page?',
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim()) return;

    const userMessage: SEOChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'USER',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputQuery('');
    setIsThinking(true);

    try {
      const responseData = await askCopilot(textToSend, {
        domain: website.domain,
        healthScore: 84,
        totalUrls: 248,
        criticalIssuesCount: 3,
        trafficGrowth: '+8.4%',
        primaryKeywordsCount: 19,
      });

      const aiReply: SEOChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'AI',
        text: responseData.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      const errorReply: SEOChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'AI',
        text: 'I apologize, but I encountered a temporary connection issue while querying the SEO intelligence engine. Please try your question again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">Autonomous Senior SEO Copilot</h3>
            <span className="text-[10px] text-emerald-400 font-mono">Grounded in {website.domain}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-xs"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900/90 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-2 ${msg.sender === 'USER' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                msg.sender === 'AI' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
              }`}
            >
              {msg.sender === 'AI' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                msg.sender === 'USER'
                  ? 'bg-emerald-600 text-white rounded-tr-none'
                  : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-line">{msg.text}</p>
              <span className="text-[9px] text-slate-400 block mt-1 text-right font-mono">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center space-x-2 text-xs text-indigo-400 font-mono p-2">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            <span>Analyzing crawl database and synthesizing answer...</span>
          </div>
        )}
      </div>

      {/* Shortcut Prompts Bar */}
      <div className="px-3 py-2 bg-slate-950/70 border-t border-slate-800 overflow-x-auto scrollbar-none flex gap-1.5 min-w-max">
        {shortcutPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 rounded-full transition-all whitespace-nowrap"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask anything about your SEO rankings, errors, or roadmap..."
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isThinking}
          className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg transition-all"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
