'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, FolderOpen, BarChart3, Upload, FileText, File,
  Trash2, Search, ChevronLeft, Plus, X
} from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, Document } from '@/lib/api';
import BackendStatus, { Status } from './BackendStatus';

type View = 'workspace' | 'documents' | 'evaluations';

interface Props {
  open: boolean;
  onToggle: () => void;
  currentView: View;
  onViewChange: (v: View) => void;
  onNewResearch: () => void;
  docs: Document[];
  docsLoading: boolean;
  docsError: string | null;
  onDocsRefresh: () => void;
  onStatusChange: (s: Status) => void;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pdf: { bg: 'bg-red-500/10',    text: 'text-red-400',    label: 'PDF' },
  txt: { bg: 'bg-sky-500/10',    text: 'text-sky-400',    label: 'TXT' },
  md:  { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'MD'  },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type.toLowerCase()] ?? { bg: 'bg-white/5', text: 'text-white/40', label: type.toUpperCase() };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'workspace',   label: 'Workspace',   icon: <Home size={15} /> },
  { id: 'documents',   label: 'Documents',   icon: <FolderOpen size={15} /> },
  { id: 'evaluations', label: 'Evaluations', icon: <BarChart3 size={15} /> },
];

export default function Sidebar({
  open, onToggle, currentView, onViewChange, onNewResearch,
  docs, docsLoading, docsError, onDocsRefresh, onStatusChange
}: Props) {
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // suppress unused warning
  void formatBytes;
  void getDocuments;

  const filtered = docs.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()));

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(file);
      onDocsRefresh();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(null);
    try {
      await deleteDocument(id);
      onDocsRefresh();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 270, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="shrink-0 flex flex-col border-r border-[#262638] bg-[#0E0E17] overflow-hidden relative z-10"
          style={{ minWidth: 0 }}
        >
          {/* Logo */}
          <div className="px-4 pt-5 pb-4 border-b border-[#262638]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B7CFF] to-[#6366f1] flex items-center justify-center shadow-lg shadow-[#8B7CFF]/20 shrink-0">
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1L12 3.8V9.2L6.5 12L1 9.2V3.8L6.5 1Z" stroke="white" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
                  <path d="M6.5 1V12" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M1 3.8L12 9.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M12 3.8L1 9.2" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="text-[13px] font-semibold text-[#F4F4F7] leading-none mb-0.5">Research Assistant</h1>
                <p className="text-[10px] text-[#9999AD]/50 leading-none font-medium tracking-wide">by LangGraph</p>
              </div>
            </div>

            {/* New Research button */}
            <button
              onClick={onNewResearch}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#8B7CFF] hover:bg-[#A69BFF] text-white text-[12px] font-semibold transition-colors duration-150 shadow-lg shadow-[#8B7CFF]/20"
            >
              <Plus size={13} />
              New Research
            </button>
          </div>

          {/* Nav */}
          <div className="px-3 py-3 border-b border-[#262638]">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 mb-0.5 ${
                  currentView === item.id
                    ? 'bg-[#8B7CFF]/15 text-[#A69BFF]'
                    : 'text-[#9999AD] hover:text-[#F4F4F7] hover:bg-white/5'
                }`}
              >
                <span className={currentView === item.id ? 'text-[#8B7CFF]' : ''}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Documents section */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9999AD]/40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full pl-7 pr-3 py-1.5 bg-white/[0.03] border border-[#262638] focus:border-[#8B7CFF]/40 focus:outline-none rounded-lg text-[12px] text-[#F4F4F7] placeholder-[#9999AD]/40 transition-colors"
              />
            </div>

            {/* Upload dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f); }}
              onClick={() => fileRef.current?.click()}
              className={`rounded-lg border border-dashed cursor-pointer transition-all duration-200 px-3 py-3 text-center ${
                dragOver
                  ? 'border-[#8B7CFF]/60 bg-[#8B7CFF]/5'
                  : 'border-[#262638] hover:border-[#8B7CFF]/30 hover:bg-white/[0.015]'
              }`}
            >
              <Upload size={12} className={`mx-auto mb-1 ${dragOver ? 'text-[#8B7CFF]' : 'text-[#9999AD]/30'}`} />
              <p className={`text-[11px] font-medium ${dragOver ? 'text-[#8B7CFF]' : 'text-[#9999AD]/40'}`}>
                {uploading ? 'Processing…' : 'Drop PDF, TXT, or MD'}
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />

            {/* Upload error */}
            {uploadError && (
              <div className="flex items-start gap-2 text-[11px] text-[#FF6B6B]/80 bg-[#FF6B6B]/5 border border-[#FF6B6B]/10 rounded-lg px-3 py-2">
                <X size={11} className="shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Docs error */}
            {docsError && (
              <div className="text-[11px] text-[#FF6B6B]/70 bg-[#FF6B6B]/5 border border-[#FF6B6B]/10 rounded-lg px-3 py-2">
                {docsError}
              </div>
            )}

            {/* Doc list */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-[#9999AD]/40 uppercase tracking-widest px-1 mb-1">
                {docs.length} document{docs.length !== 1 ? 's' : ''}
              </p>
              {docsLoading ? (
                [1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-white/[0.03] shimmer-bg" />)
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <File size={18} className="text-white/10" />
                  <p className="text-[11px] text-[#9999AD]/40">{search ? 'No matches' : 'No documents yet'}</p>
                </div>
              ) : (
                filtered.map(doc => (
                  <div
                    key={doc.id}
                    className="group relative flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-[#262638]/60 hover:bg-white/[0.04] hover:border-[#262638] transition-all duration-150"
                  >
                    <div className="mt-0.5 w-5 h-5 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                      <FileText size={10} className="text-[#9999AD]/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#F4F4F7]/85 truncate leading-tight mb-1">{doc.filename}</p>
                      <div className="flex items-center gap-1">
                        <TypeBadge type={doc.file_type} />
                        <span className="text-[9px] text-[#9999AD]/40">{doc.chunk_count}c</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {deleteId === doc.id ? (
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => handleDelete(doc.id)} className="text-[9px] text-[#FF6B6B] hover:text-[#FF6B6B]/80 font-medium px-1">OK</button>
                          <button onClick={() => setDeleteId(null)} className="text-[9px] text-[#9999AD]/40 hover:text-[#9999AD] font-medium px-1">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteId(doc.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#9999AD]/30 hover:text-[#FF6B6B] transition-all duration-150 rounded"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom: backend status */}
          <div className="px-4 py-3 border-t border-[#262638]">
            <BackendStatus onStatusChange={onStatusChange} />
          </div>

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#141420] border border-[#262638] flex items-center justify-center text-[#9999AD]/50 hover:text-[#F4F4F7] hover:border-[#8B7CFF]/40 transition-all duration-150 z-20"
          >
            <ChevronLeft size={12} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
