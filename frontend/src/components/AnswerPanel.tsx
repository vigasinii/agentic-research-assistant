'use client';

import { useState } from 'react';
import { AlertTriangle, FileText, ChevronDown, ChevronUp, Copy, Check, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { ResearchResponse } from '@/lib/api';

interface Props {
  result: ResearchResponse;
  onNewResearch: () => void;
}

function renderInline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-[#F4F4F7]">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function MarkdownAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  const els: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (i + 1 < lines.length && /^\s*\|?[\s\-|]+\|?\s*$/.test(lines[i + 1]) && line.trim().startsWith('|')) {
      const headers = line.split('|').filter((_, x, a) => x > 0 && x < a.length - 1).map(h => h.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').filter((_, x, a) => x > 0 && x < a.length - 1).map(c => c.trim()));
        i++;
      }
      els.push(
        <div key={`t${i}`} className="overflow-x-auto my-4 rounded-lg border border-[#262638]">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.03]">
              <tr>{headers.map((h, hi) => <th key={hi} className="px-3 py-2 text-left text-[#9999AD] font-semibold border-b border-[#262638]">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-white/[0.015]'}>
                  {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-[#F4F4F7]/75 border-b border-[#262638]/50 last-of-type:border-0">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('# '))       els.push(<h1 key={i} className="text-[17px] font-bold text-[#F4F4F7] mt-4 mb-2 leading-snug">{renderInline(line.slice(2))}</h1>);
    else if (line.startsWith('## ')) els.push(<h2 key={i} className="text-[15px] font-semibold text-[#F4F4F7]/90 mt-4 mb-1.5 leading-snug">{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith('### '))els.push(<h3 key={i} className="text-[13px] font-semibold text-[#F4F4F7]/80 mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      const content = line.replace(/^\d+\.\s/, '');
      els.push(
        <div key={i} className="flex gap-2.5 my-1.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#8B7CFF]/15 border border-[#8B7CFF]/20 flex items-center justify-center text-[10px] font-bold text-[#8B7CFF] mt-0.5">{num}</span>
          <p className="text-[14px] text-[#F4F4F7]/80 leading-relaxed flex-1">{renderInline(content)}</p>
        </div>
      );
    }
    else if (line.trim() === '') els.push(<div key={i} className="h-1" />);
    else els.push(<p key={i} className="text-[14px] text-[#F4F4F7]/80 leading-relaxed my-1">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{els}</div>;
}

export default function AnswerPanel({ result, onNewResearch }: Props) {
  const [citOpen, setCitOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3 w-full max-w-2xl mx-auto"
    >
      {/* Question block */}
      <div className="border-l-2 border-[#8B7CFF]/50 pl-3 py-1">
        <p className="text-[12px] text-[#9999AD] mb-0.5 uppercase tracking-wider font-semibold">Question</p>
        <p className="text-[14px] text-[#F4F4F7]/80 leading-relaxed">{result.question}</p>
      </div>

      {/* Abstention warning */}
      {result.abstained && result.abstention_reason && (
        <div className="flex gap-3 bg-[#F2B86B]/5 border border-[#F2B86B]/15 rounded-xl p-4">
          <AlertTriangle size={15} className="text-[#F2B86B] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-[#F2B86B] mb-1 uppercase tracking-wide">Abstained</p>
            <p className="text-[13px] text-[#F2B86B]/80 leading-relaxed">{result.abstention_reason}</p>
          </div>
        </div>
      )}

      {/* Answer card */}
      {!result.abstained && (
        <div className="rounded-xl border border-[#262638] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#262638] bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#8B7CFF] to-[#6366f1]" />
              <span className="text-[10px] font-semibold text-[#9999AD]/50 uppercase tracking-widest">Answer</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[11px] text-[#9999AD]/60 hover:text-[#F4F4F7] transition-colors"
              >
                {copied ? <Check size={11} className="text-[#42D6A4]" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="px-4 py-4">
            <MarkdownAnswer text={result.answer} />
          </div>

          {/* Verification warning */}
          {result.citations.length === 0 && !result.abstained && (
            <div className="px-4 pb-3 flex items-center gap-2 text-[11px] text-[#F2B86B]/70">
              <AlertTriangle size={11} />
              Answer has no citations. Verify independently.
            </div>
          )}
        </div>
      )}

      {/* Citations */}
      {result.citations.length > 0 && (
        <div className="rounded-xl border border-[#262638] overflow-hidden">
          <button
            onClick={() => setCitOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.035] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-[#9999AD]/40" />
              <span className="text-[11px] font-medium text-[#9999AD]/60">
                {result.citations.length} citation{result.citations.length !== 1 ? 's' : ''}
              </span>
            </div>
            {citOpen ? <ChevronUp size={12} className="text-[#9999AD]/30" /> : <ChevronDown size={12} className="text-[#9999AD]/30" />}
          </button>

          {citOpen && (
            <div className="divide-y divide-[#262638]/60">
              {result.citations.map((c, i) => (
                <div key={c.chunk_id ?? i} className="px-4 py-3 bg-white/[0.01] hover:bg-white/[0.025] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-[#8B7CFF]/90">{c.source_filename}</span>
                    {c.page_number != null && (
                      <span className="text-[10px] text-[#9999AD]/40 bg-white/5 px-1.5 py-0.5 rounded">p. {c.page_number}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#9999AD]/60 leading-relaxed line-clamp-3 font-mono">{c.excerpt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Research button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onNewResearch}
          className="flex items-center gap-2 text-[12px] text-[#9999AD]/60 hover:text-[#F4F4F7] bg-white/[0.03] hover:bg-white/[0.06] border border-[#262638] hover:border-[#262638]/80 rounded-lg px-3 py-2 transition-all duration-150"
        >
          <RotateCcw size={11} />
          New Research
        </button>
      </div>
    </motion.div>
  );
}
