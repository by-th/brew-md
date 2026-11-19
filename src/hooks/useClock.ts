import { useEffect, useState } from 'react';

/** Ticks every second, and advances a slow poem index for the poetic face. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function usePoemIndex(): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => p + 1), 12000);
    return () => clearInterval(t);
  }, []);
  return i;
}
