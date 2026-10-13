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

      for (let attempt = 0; attempt < 20; attempt++) {
        if (cancelled) return;
        const ok = await checkHealth();
        if (ok) {
          if (!cancelled) {
            setStatus('ready');
            onStatusChange?.('ready');
            clearInterval(timer);
          }
          return;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!cancelled) {
        setStatus('error');
        onStatusChange?.('error');
        clearInterval(timer);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onStatusChange]);

  if (status === 'ready') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Backend ready
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Backend unreachable
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-400">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      Waking up backend{elapsed > 0 ? ` (${elapsed}s)` : '…'}
    </span>
  );
}
