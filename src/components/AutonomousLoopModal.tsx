import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle2,
  Clock,
  Zap,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface AutonomousLoopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoopComplete: () => void;
}

const LOOP_STEPS = [
  '01. Check website availability and HTTP status',
  '02. Crawl high-priority URLs',
  '03. Detect newly broken pages (4xx, 5xx)',
  '04. Detect redirect chains and loops',
  '05. Verify canonical tags',
  '06. Check robots.txt and meta robots',
  '07. Verify XML sitemaps',
  '08. Check structured data and Schema validity',
  '09. Fetch Google Search Console data',
  '10. Compare clicks, impressions, CTR, position vs yesterday, last week, last month',
  '11. Detect sudden ranking drops',
  '12. Detect sudden traffic drops',
  '13. Detect keyword ranking improvements',
  '14. Detect new ranking keywords',
  '15. Detect lost ranking keywords',
  '16. Identify keyword cannibalization',
  '17. Identify pages with declining traffic (content decay)',
  '18. Find high-impression, low-CTR keywords (striking distance / CTR opportunity)',
  '19. Find keywords ranking in positions 4-10',
  '20. Find keywords ranking in positions 11-20 (page 2 opportunities)',
  '21. Analyze internal link distribution',
  '22. Find orphan pages (pages with 0 internal links)',
  '23. Recommend internal links between related pages',
  '24. Audit on-page elements (missing title, duplicate title, title length, missing meta, duplicate meta, H1 missing/multiple, thin content, image alt text)',
  '25. Check page speed and performance indicators',
  '26. Check mobile usability indicators',
  '27. Check E-E-A-T signals (author info, publish date, citations)',
  '28. Analyze competitor rank changes',
  '29. Identify new competitor content',
  '30. Identify content gaps vs competitors',
  '31. Evaluate topic cluster coverage',
  '32. Check indexation status of new pages',
  '33. Check for indexing errors in Search Console',
  '34. Evaluate SERP feature presence',
  '35. Generate prioritized SEO task list with ICE scores',
  '36. Execute pre-authorized automated fixes',
  '37. Draft content briefs for highest-priority content opportunities',
  '38. Generate title/meta rewrite suggestions for low-CTR pages',
  '39. Generate Schema JSON-LD for pages missing structured data',
  '40. Update SEO health score (17 pillars)',
  '41. Log all findings and actions to the audit trail',
  '42. Generate the daily SEO report (What happened, What is wrong, What changed, What to do first, What AI fixed safely, What needs human approval)',
];

export const AutonomousLoopModal: React.FC<AutonomousLoopModalProps> = ({
  isOpen,
  onClose,
  onLoopComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isOpen && isRunning && currentStepIndex < LOOP_STEPS.length) {
      timer = setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 70); // Smooth progression across 42 steps
    } else if (isRunning && currentStepIndex >= LOOP_STEPS.length) {
      setIsRunning(false);
      setIsFinished(true);
      onLoopComplete();
    }
    return () => clearTimeout(timer);
  }, [isOpen, isRunning, currentStepIndex, onLoopComplete]);

  const handleStartLoop = () => {
    setCurrentStepIndex(0);
    setIsRunning(true);
    setIsFinished(false);
  };

  if (!isOpen) return null;

  const progressPct = Math.min(100, Math.round((currentStepIndex / LOOP_STEPS.length) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  42-Step Autonomous Daily SEO Loop
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  WORKFLOW PREVIEW
                </span>
              </div>
              <p className="text-xs text-slate-400">Step-by-step preview of the 24/7 background audit and ICE prioritization cycle</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Execution Progress:</span>
            <span className="text-emerald-400 font-bold">{progressPct}% ({currentStepIndex}/{LOOP_STEPS.length} Steps)</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step Execution Terminal Log */}
        <div className="flex-1 min-h-[300px] overflow-y-auto bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-1.5 scrollbar-none">
          {LOOP_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex && isRunning;
            return (
              <div
                key={idx}
                className={`flex items-center space-x-2 py-0.5 ${
                  isDone
                    ? 'text-emerald-400 font-medium'
                    : isCurrent
                    ? 'text-white font-bold animate-pulse'
                    : 'text-slate-600'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : isCurrent ? (
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-700 shrink-0" />
                )}
                <span className="truncate">{step}</span>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-mono">
            {isFinished ? '✓ 42/42 Steps Executed Successfully' : isRunning ? 'Running SEO Loop...' : 'Ready to Run'}
          </span>

          <div className="flex items-center space-x-2">
            {!isRunning && !isFinished && (
              <button
                onClick={handleStartLoop}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Autonomous Loop</span>
              </button>
            )}

            {isFinished && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow"
              >
                <span>View Updated Command Center</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
