import React, { useState } from 'react';
import { Website, SEOChatMessage } from '../types';
import { askCopilot } from '../services/api';
import {
  Sparkles,
  Send,
  Bot,
  User,
  HelpCircle,
  Minimize2,
  ShieldCheck,
} from 'lucide-react';

interface SEOCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  website: Website;
}

interface ExtendedSEOChatMessage extends SEOChatMessage {
  source?: string;
  provenance?: string;
  reason?: string;
}

export const SEOCopilot: React.FC<SEOCopilotProps> = ({
  isOpen,
  onClose,
  website,
}) => {
  const [messages, setMessages] = useState<ExtendedSEOChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'AI',
      text: `Hello! I am your Technical & Strategic SEO Copilot for **${website.domain}**. You can ask me technical crawling questions, content decay root-causes, schema markup requirements, or internal linking strategies. How can I assist you today?`,
      timestamp: 'Just now',
      source: 'DETERMINISTIC_RULES',
      provenance: 'REAL_EVIDENCE',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const shortcutPrompts = [
    'What are the core technical SEO verification items?',
    'How should we handle cannibalization between competing URLs?',
    'What is the recommended approach for recovering decaying content?',
    'What schema markup is needed for technical documentation?',
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim()) return;

    const userMessage: ExtendedSEOChatMessage = {
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
        verifiedWebsiteId: website.id,
      });

      const aiReply: ExtendedSEOChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'AI',
        text: responseData.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: responseData.source,
        provenance: responseData.provenance,
        reason: responseData.reason,
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      const errorReply: ExtendedSEOChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'AI',
        text: 'I encountered an error connecting to the SEO intelligence endpoint. Please verify server connectivity and retry.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'SERVER_ERROR',
        provenance: 'DATA_UNAVAILABLE',
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
          <div className="h-7 w-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">Technical SEO Copilot</h3>
            <span className="text-[10px] text-emerald-400 font-mono">Scoped: {website.domain}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
        {messages.map((m) => {
          const isUser = m.sender === 'USER';
          return (
            <div
              key={m.id}
              className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                  isUser ? 'bg-indigo-600 text-white' : 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
                }`}
              >
                {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              </div>

              <div
                className={`max-w-[85%] p-3 rounded-xl ${
                  isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-200 border border-slate-800'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-line">{m.text}</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40 text-[9px] text-slate-500 font-mono">
                  <span>{m.timestamp}</span>
                  {m.source && (
                    <span className="text-slate-400">
                      Source: {m.source}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs italic font-mono">
            <Bot className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            <span>Analyzing SEO technical directives...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80">
        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono mb-1.5">
          <HelpCircle className="h-3 w-3 text-emerald-400" />
          <span>Quick Directives:</span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
          {shortcutPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-[10px] text-slate-300 whitespace-nowrap transition-all cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Ask technical question or strategic SEO directive..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isThinking}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-xl transition-all cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
