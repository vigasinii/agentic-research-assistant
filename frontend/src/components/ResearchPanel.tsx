'use client';

import { useState } from 'react';
import { ArrowUp, Clock, Sparkles } from 'lucide-react';
import { askQuestion, ResearchResponse } from '@/lib/api';
import AnswerPanel from './AnswerPanel';
import EvalDashboard from './EvalDashboard';

const MAX_HISTORY = 5;

function ThinkingAnimation() {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-600/20 flex items-center justify-center">
          <Sparkles size={12} className="text-indigo-400" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="thinking-dot w-1.5 h-1.5 rounded-full bg-indigo-400"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
        <p className="text-[12px] text-white/30 font-medium">Agent is researching…</p>
      </div>
    </div>
  );
}

export default function ResearchPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await askQuestion(q);
      setResult(res);
      setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* Search area */}
      <div className="mb-6">
        <div className={`relative rounded-xl border transition-all duration-300 ${
          focused
            ? 'border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_0_32px_rgba(99,102,241,0.08)] bg-white/[0.03]'
            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
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
            rows={3}
            disabled={loading}
            className="w-full bg-transparent px-4 pt-4 pb-12 text-[14px] text-white/90 placeholder-white/20 resize-none focus:outline-none leading-relaxed disabled:opacity-60"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {question.trim() && (
              <span className="text-[10px] text-white/20 font-medium">Enter ↵</span>
            )}
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !question.trim()}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                question.trim() && !loading
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 text-white'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {loading
                ? <div className="w-3.5 h-3.5 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                : <ArrowUp size={14} />
              }
            </button>
          </div>
        </div>

        {/* History pills */}
        {history.length > 0 && !loading && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => setQuestion(h)}
                className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/70 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] rounded-full px-2.5 py-1 transition-all duration-150 max-w-[200px] truncate"
              >
                <Clock size={9} className="shrink-0" />
                <span className="truncate">{h}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* States */}
      {error && (
        <div className="mb-6 text-[12px] text-red-300/80 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 leading-relaxed">
          {error}
        </div>
      )}

      {loading && <ThinkingAnimation />}

      {result && !loading && (
        <div className="animate-fade-up">
          <AnswerPanel result={result} />
        </div>
      )}

      {/* Eval dashboard */}
      <div className="mt-10">
        <EvalDashboard />
      </div>
    </div>
  );
}
