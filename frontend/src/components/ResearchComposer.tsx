'use client';

import { useState } from 'react';
import { ArrowUp, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const SUGGESTIONS = [
  'What were the major milestones in space exploration?',
  'How did the Cold War shape early space programs?',
  'What were the key technologies behind Apollo?',
  'Compare robotic vs human exploration missions.',
];

interface Props {
  onSubmit: (question: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function ThinkingAnimation() {
  return (
    <div className="flex flex-col items-center gap-6 py-24">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-[#8B7CFF]/20 animate-pulse-ring" />
        <div className="absolute inset-2 rounded-full border border-[#8B7CFF]/15 animate-pulse-ring" style={{ animationDelay: '0.3s' }} />
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B7CFF]/20 to-[#6366f1]/20 flex items-center justify-center">
          <Sparkles size={13} className="text-[#8B7CFF]" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="thinking-dot w-1.5 h-1.5 rounded-full bg-[#8B7CFF]"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
        <p className="text-[13px] text-[#9999AD] font-medium">Agent is researching…</p>
      </div>
    </div>
  );
}

export default function ResearchComposer({ onSubmit, loading, error, onRetry }: Props) {
  const [question, setQuestion] = useState('');
  const [focused, setFocused] = useState(false);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    onSubmit(q);
  }

  if (loading) return <ThinkingAnimation />;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Empty state headline */}
      {!error && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-bold text-[#F4F4F7] mb-2 gradient-text">
            Your research, intelligently connected.
          </h2>
          <p className="text-[14px] text-[#9999AD] max-w-md mx-auto leading-relaxed">
            Ask complex questions, explore your sources, and discover answers grounded in evidence.
          </p>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 flex items-start gap-3 bg-[#FF6B6B]/8 border border-[#FF6B6B]/20 rounded-xl px-4 py-3.5"
        >
          <AlertTriangle size={15} className="text-[#FF6B6B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] text-[#FF6B6B]/90 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[11px] text-[#9999AD] hover:text-[#F4F4F7] transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </motion.div>
      )}

      {/* Composer */}
      <div className={`relative rounded-xl border transition-all duration-300 ${
        focused
          ? 'border-[#8B7CFF]/50 shadow-[0_0_0_1px_rgba(139,124,255,0.2),0_0_32px_rgba(139,124,255,0.08)] bg-[#141420]'
          : 'border-[#262638] bg-[#0E0E17] hover:border-[#262638]/80'
      }`}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
          placeholder="Ask a research question…"
          rows={4}
          disabled={loading}
          className="w-full bg-transparent px-4 pt-4 pb-12 text-[14px] text-[#F4F4F7] placeholder-[#9999AD]/40 resize-none focus:outline-none leading-relaxed"
        />
        <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
          <span className="text-[10px] text-[#9999AD]/40">
            Press Enter to submit · Shift+Enter for new line
          </span>
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
              question.trim() && !loading
                ? 'bg-[#8B7CFF] hover:bg-[#A69BFF] shadow-lg shadow-[#8B7CFF]/30 text-white'
                : 'bg-white/5 text-[#9999AD]/30 cursor-not-allowed'
            }`}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="mt-5">
        <p className="text-[10px] font-semibold text-[#9999AD]/40 uppercase tracking-widest mb-2 px-1">Example questions</p>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setQuestion(s)}
              className="text-left text-[12px] text-[#9999AD]/70 hover:text-[#F4F4F7] bg-[#141420] hover:bg-[#141420]/80 border border-[#262638] hover:border-[#8B7CFF]/30 rounded-lg px-3 py-2.5 transition-all duration-150 leading-relaxed"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
