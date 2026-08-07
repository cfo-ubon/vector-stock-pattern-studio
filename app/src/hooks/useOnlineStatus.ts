import { useEffect, useState } from 'react';

/** AI-SBOS, Part 2 — the Version Center's "Offline Status" field needs a
 * real, live signal, not a fabricated constant. `navigator.onLine` plus the
 * standard `online`/`offline` window events is the real browser API for
 * this — no polling, no guessing. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
