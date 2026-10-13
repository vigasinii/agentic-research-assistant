'use client';

import { useState } from 'react';
import { Send, Loader2, Clock } from 'lucide-react';
import { askQuestion, ResearchResponse } from '@/lib/api';
import AnswerPanel from './AnswerPanel';
import EvalDashboard from './EvalDashboard';

const MAX_HISTORY = 5;

export default function ResearchPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await askQuestion(q);
      setResult(res);
      setHistory(prev => {
        const next = [q, ...prev.filter(h => h !== q)];
        return next.slice(0, MAX_HISTORY);
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ask a research question…"
            rows={3}
            disabled={loading}
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 resize-none transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="self-end flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Running…' : 'Ask'}
          </button>
        </div>
      </form>

      {history.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => setQuestion(h)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1 transition-colors truncate max-w-xs"
            >
              <Clock size={10} />
              <span className="truncate">{h}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
          <p className="text-sm">Agent is researching your question…</p>
        </div>
      )}

      {result && !loading && <AnswerPanel result={result} />}

      <div className="mt-8">
        <EvalDashboard />
      </div>
    </div>
  );
}
