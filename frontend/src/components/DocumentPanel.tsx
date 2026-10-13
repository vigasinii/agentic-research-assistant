'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText, File, X, Plus } from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, Document } from '@/lib/api';

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

export default function DocumentPanel() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(retries = 3) {
    setLoading(true);
    setError(null);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        setDocs(await getDocuments());
        setLoading(false);
        return;
      } catch (e: unknown) {
        if (attempt < retries) {
          setError('Service is starting up, retrying…');
          await new Promise(r => setTimeout(r, 3000));
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load documents');
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(null);
    try {
      await deleteDocument(id);
      setDocs(d => d.filter(doc => doc.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Documents</span>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 disabled:opacity-50 transition-colors"
          >
            <Plus size={12} />
            {uploading ? 'Uploading…' : 'Add'}
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative rounded-lg border border-dashed cursor-pointer transition-all duration-200 px-3 py-3 text-center ${
            dragOver
              ? 'border-indigo-500/60 bg-indigo-500/5 shadow-[inset_0_0_20px_rgba(99,102,241,0.06)]'
              : 'border-white/10 hover:border-white/20 hover:bg-white/[0.015]'
          }`}
        >
          <Upload size={13} className={`mx-auto mb-1.5 ${dragOver ? 'text-indigo-400' : 'text-white/20'}`} />
          <p className={`text-[11px] font-medium ${dragOver ? 'text-indigo-300' : 'text-white/25'}`}>
            {uploading ? 'Processing…' : 'Drop PDF, TXT, or MD'}
          </p>
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={onFileChange} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 flex items-start gap-2 text-[11px] text-red-300/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
          <X size={11} className="shrink-0 mt-0.5 text-red-400/60" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[1, 2].map(i => (
              <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <File size={20} className="text-white/10" />
            <p className="text-[11px] text-white/20">No documents yet</p>
          </div>
        ) : (
          docs.map(doc => (
            <div
              key={doc.id}
              className="group relative flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-150"
            >
              <div className="mt-0.5 w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                <FileText size={11} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white/85 truncate leading-tight mb-1">{doc.filename}</p>
                <div className="flex items-center gap-1.5">
                  <TypeBadge type={doc.file_type} />
                  <span className="text-[10px] text-white/25">{formatBytes(doc.size_bytes)}</span>
                  <span className="text-[10px] text-white/25">{doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="shrink-0">
                {deleteId === doc.id ? (
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleDelete(doc.id)} className="text-[9px] text-red-400 hover:text-red-300 font-medium px-1">Confirm</button>
                    <button onClick={() => setDeleteId(null)} className="text-[9px] text-white/30 hover:text-white/60 font-medium px-1">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition-all duration-150 rounded"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
