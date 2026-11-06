import { useEffect, useState } from "react";

/**
 * Live countdown to an ISO timestamp. Ticks every second while the target is
 * in the future; returns 0 once it has passed. Used by cooldown chips.
 */
export function useCountdown(targetIso?: string | null) {
  const [seconds, setSeconds] = useState(() => remaining(targetIso));

  useEffect(() => {
    setSeconds(remaining(targetIso));
    if (!targetIso) return;
    const t = setInterval(() => setSeconds(remaining(targetIso)), 1000);
    return () => clearInterval(t);
  }, [targetIso]);

  return { seconds };
}

function remaining(iso?: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return 0;
  return Math.max(0, Math.round(ms / 1000));
}
