import DocumentPanel from '@/components/DocumentPanel';
import ResearchPanel from '@/components/ResearchPanel';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col">
      <header className="border-b border-slate-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Research Assistant
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">Agentic document research powered by RAG</p>
      </header>
      <div className="flex flex-1 overflow-hidden">
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
