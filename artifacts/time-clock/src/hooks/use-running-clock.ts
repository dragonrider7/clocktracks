import { useState, useEffect } from "react";

function formatElapsed(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function computeMinutes(clockInISO: string, extraMinutes: number): number {
  const sessionMs = Date.now() - new Date(clockInISO).getTime();
  return Math.max(0, Math.floor(sessionMs / 60000)) + extraMinutes;
}

/**
 * Returns a live-updating formatted duration string.
 *
 * @param clockInISO  ISO timestamp of the active clock-in (null if not clocked in)
 * @param extraMinutes  Already-completed minutes to add to the running session total
 */
export function useRunningClock(clockInISO: string | null, extraMinutes = 0): string {
  const [minutes, setMinutes] = useState(() =>
    clockInISO ? computeMinutes(clockInISO, extraMinutes) : extraMinutes,
  );

  useEffect(() => {
    if (clockInISO) {
      setMinutes(computeMinutes(clockInISO, extraMinutes));
    } else {
      setMinutes(extraMinutes);
    }
    if (!clockInISO) return;
    const id = setInterval(() => setMinutes(computeMinutes(clockInISO, extraMinutes)), 60000);
    return () => clearInterval(id);
  }, [clockInISO, extraMinutes]);

  return formatElapsed(minutes);
}
