'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText, X } from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, Document } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: 'bg-red-900 text-red-300',
    txt: 'bg-blue-900 text-blue-300',
    md: 'bg-purple-900 text-purple-300',
  };
  const cls = colors[type.toLowerCase()] ?? 'bg-slate-700 text-slate-300';
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded uppercase ${cls}`}>
      {type}
    </span>
  );
}

export default function DocumentPanel() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDocs(await getDocuments());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
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
    setDeleteConfirm(null);
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
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Documents</h2>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-2.5 py-1.5 rounded transition-colors"
        >
          <Upload size={12} />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={onFileChange}
      />

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-4 mb-4 text-center text-xs text-slate-500 transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-900/10 text-blue-400' : 'border-slate-700 hover:border-slate-600'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        Drop PDF, TXT, or MD here
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          <X size={12} />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="text-xs text-slate-500 text-center py-8">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-8">No documents uploaded yet</div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <FileText size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <FileTypeBadge type={doc.file_type} />
                      <span className="text-xs text-slate-500">{formatBytes(doc.size_bytes)}</span>
                      <span className="text-xs text-slate-500">{doc.chunk_count} chunks</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {deleteConfirm === doc.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(doc.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
