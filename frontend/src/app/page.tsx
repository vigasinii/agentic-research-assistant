'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeft, PanelRight } from 'lucide-react';
import { getDocuments, Document, ResearchResponse, EvalSummary, askQuestion } from '@/lib/api';
import { Status } from '@/components/BackendStatus';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import ResearchComposer from '@/components/ResearchComposer';
import AnswerPanel from '@/components/AnswerPanel';
import EvaluationsView from '@/components/EvaluationsView';

type View = 'workspace' | 'documents' | 'evaluations';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState<Status>('waking');
  const [currentView, setCurrentView] = useState<View>('workspace');

  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');

  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      setDocs(await getDocuments());
    } catch (e: unknown) {
      setDocsError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function handleSubmit(question: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setLastQuestion(question);
    try {
      const res = await askQuestion(question);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  }

  function handleNewResearch() {
    setResult(null);
    setError(null);
    setCurrentView('workspace');
  }

  function handleRetry() {
    if (lastQuestion) handleSubmit(lastQuestion);
  }

  const ready = backendStatus === 'ready';

  return (
    <div className="h-screen flex flex-col bg-[#09090F] overflow-hidden">
      {/* Cold-start banner */}
      <AnimatePresence>
        {!ready && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 flex items-center gap-2.5 px-5 py-2 border-b border-[#F2B86B]/10 bg-gradient-to-r from-[#F2B86B]/5 to-transparent text-[11px] text-[#F2B86B]/70 font-medium overflow-hidden"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2B86B]/80 animate-pulse shrink-0" />
            Backend is waking up on Render free tier. This takes up to 60 seconds. Features will unlock automatically.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className={`flex flex-1 overflow-hidden transition-all duration-700 ${ready ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>

        {/* Sidebar toggle (when closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-lg bg-[#141420] border border-[#262638] flex items-center justify-center text-[#9999AD]/60 hover:text-[#F4F4F7] hover:border-[#8B7CFF]/40 transition-all"
          >
            <PanelLeft size={14} />
          </button>
        )}

        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          currentView={currentView}
          onViewChange={setCurrentView}
          onNewResearch={handleNewResearch}
          docs={docs}
          docsLoading={docsLoading}
          docsError={docsError}
          onDocsRefresh={loadDocs}
          onStatusChange={setBackendStatus}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#09090F] relative">
          <div className="h-full">
            {currentView === 'workspace' && (
              <div className="flex flex-col items-center justify-start min-h-full px-4 py-12">
                {result ? (
                  <AnswerPanel result={result} onNewResearch={handleNewResearch} />
                ) : (
                  <ResearchComposer
                    onSubmit={handleSubmit}
                    loading={loading}
                    error={error}
                    onRetry={handleRetry}
                  />
                )}
              </div>
            )}

            {currentView === 'documents' && (
              <div className="flex flex-col items-center justify-start min-h-full px-4 py-12">
                <div className="w-full max-w-2xl">
                  <h2 className="text-2xl font-bold text-[#F4F4F7] mb-1">Document Library</h2>
                  <p className="text-[14px] text-[#9999AD] mb-6">Manage your knowledge base. Documents are chunked and indexed for semantic search.</p>
                  <div className="bg-[#141420] border border-[#262638] rounded-2xl p-4 space-y-2">
                    {docsLoading ? (
                      [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/[0.03] shimmer-bg" />)
                    ) : docs.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-[14px] text-[#9999AD]/60">No documents yet. Upload from the sidebar to get started.</p>
                      </div>
                    ) : (
                      docs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-[#262638]/60">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#F4F4F7]/85 truncate">{doc.filename}</p>
                            <p className="text-[11px] text-[#9999AD]/60">{doc.chunk_count} chunks  {doc.file_type.toUpperCase()}</p>
                          </div>
                          <p className="text-[11px] text-[#9999AD]/40 font-mono shrink-0">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'evaluations' && (
              <EvaluationsView onEvalResult={setEvalSummary} />
            )}
          </div>
        </main>

        <RightPanel
          open={rightPanelOpen}
          onToggle={() => setRightPanelOpen(false)}
          docs={docs}
          result={result}
          evalSummary={evalSummary}
          onSwitchToEvals={() => setCurrentView('evaluations')}
        />

        {/* Right panel toggle (when closed) */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-lg bg-[#141420] border border-[#262638] flex items-center justify-center text-[#9999AD]/60 hover:text-[#F4F4F7] hover:border-[#8B7CFF]/40 transition-all"
          >
            <PanelRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
