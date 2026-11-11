import { useEffect, useState } from 'react';
import { loadState, saveState } from './lib/storage';
import type { AppState } from './lib/types';

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);
  useEffect(() => {
    saveState(state);
  }, [state]);
  return [state, setState] as const;
}

/** Current time, refreshed every 30 s so the day rolls over at local midnight. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
