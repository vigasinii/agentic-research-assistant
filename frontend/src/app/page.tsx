'use client';

import { useState } from 'react';
import DocumentPanel from '@/components/DocumentPanel';
import ResearchPanel from '@/components/ResearchPanel';
import BackendStatus, { Status } from '@/components/BackendStatus';

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<Status>('waking');
  const ready = backendStatus === 'ready';

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Research Assistant</h1>
          <p className="text-sm text-slate-400 mt-0.5">Agentic document research powered by RAG</p>
        </div>
        <BackendStatus onStatusChange={setBackendStatus} />
      </header>

      {!ready && (
        <div className="mx-6 mt-4 flex items-center gap-3 text-sm text-amber-300 bg-amber-900/20 border border-amber-800/50 rounded-lg px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          The backend is starting up on Render's free tier — this takes up to 60 seconds.
          Upload and search will be available once it's ready.
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <aside className="w-80 min-w-[280px] border-r border-slate-700 overflow-y-auto">
          <DocumentPanel />
        </aside>
        <section className="flex-1 overflow-y-auto">
          <ResearchPanel />
        </section>
      </div>
    </main>
  );
}
