'use client';

import { useState } from 'react';
import DocumentPanel from '@/components/DocumentPanel';
import ResearchPanel from '@/components/ResearchPanel';
import BackendStatus, { Status } from '@/components/BackendStatus';

export default function Home() {
  const [status, setStatus] = useState<Status>('waking');
  const ready = status === 'ready';

  return (
    <div className="h-screen flex flex-col bg-[#07080f] overflow-hidden">

      {/* Header */}
      <header className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#07080f]/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 shrink-0">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 1L12 3.8V9.2L6.5 12L1 9.2V3.8L6.5 1Z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(255,255,255,0.1)" />
              <path d="M6.5 1V12" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M1 3.8L12 9.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M12 3.8L1 9.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-[13px] font-semibold text-white/95 leading-none mb-0.5">Research Assistant</h1>
            <p className="text-[10px] text-white/30 leading-none font-medium tracking-wide uppercase">LangGraph · RAG · Qdrant</p>
          </div>
        </div>
        <BackendStatus onStatusChange={setStatus} />
      </header>

      {/* Cold-start banner */}
      {!ready && (
        <div className="shrink-0 flex items-center gap-2.5 px-5 py-2 border-b border-amber-500/10 bg-gradient-to-r from-amber-950/40 to-transparent text-[11px] text-amber-300/70 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse shrink-0" />
          Backend is waking up on Render free tier — this takes up to 60 s. Features will unlock automatically.
        </div>
      )}

      {/* Body */}
      <div className={`flex flex-1 overflow-hidden transition-all duration-700 ${ready ? 'opacity-100' : 'opacity-25 pointer-events-none select-none'}`}>
        <aside className="w-[17rem] shrink-0 flex flex-col border-r border-white/[0.05] bg-[#090b12]">
          <DocumentPanel />
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto">
          <ResearchPanel />
        </main>
      </div>
    </div>
  );
}
