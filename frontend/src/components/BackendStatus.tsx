'use client';

import { useEffect, useState } from 'react';
import { checkHealth } from '@/lib/api';

export type Status = 'waking' | 'ready' | 'error';

interface Props {
  onStatusChange?: (s: Status) => void;
}

export default function BackendStatus({ onStatusChange }: Props) {
  const [status, setStatus] = useState<Status>('waking');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      const start = Date.now();
      timer = setInterval(() => {
        if (!cancelled) setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        const ok = await checkHealth();
        if (ok) {
          if (!cancelled) { setStatus('ready'); onStatusChange?.('ready'); clearInterval(timer); }
          return;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!cancelled) { setStatus('error'); onStatusChange?.('error'); clearInterval(timer); }
    }

    poll();
    return () => { cancelled = true; clearInterval(timer); };
  }, [onStatusChange]);

  const cfg = {
    waking: {
      dot: 'bg-amber-400 animate-pulse',
      pill: 'bg-amber-500/8 border-amber-500/15 text-amber-300/80',
      label: elapsed > 0 ? `Waking up (${elapsed}s)` : 'Waking up',
    },
    ready: {
      dot: 'bg-emerald-400',
      pill: 'bg-emerald-500/8 border-emerald-500/15 text-emerald-300/90',
      label: 'Backend ready',
    },
    error: {
      dot: 'bg-red-400',
      pill: 'bg-red-500/8 border-red-500/15 text-red-300/80',
      label: 'Unreachable',
    },
  }[status];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium tracking-wide transition-all duration-500 ${cfg.pill}`}>
      {cfg.label}
    </div>
  );
}
