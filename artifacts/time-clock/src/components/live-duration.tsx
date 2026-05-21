import { useState, useEffect } from "react";

function computeElapsedMinutes(clockIn: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000));
}

function formatElapsed(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface LiveDurationProps {
  clockIn: string;
  className?: string;
  showDot?: boolean;
}

/**
 * Renders the running elapsed time since `clockIn` and re-renders every 30 s
 * so the display stays within one minute of the true elapsed time.
 */
export function LiveDuration({ clockIn, className, showDot = false }: LiveDurationProps) {
  const [minutes, setMinutes] = useState(() => computeElapsedMinutes(clockIn));

  useEffect(() => {
    setMinutes(computeElapsedMinutes(clockIn));
    const id = setInterval(() => {
      setMinutes(computeElapsedMinutes(clockIn));
    }, 30_000);
    return () => clearInterval(id);
  }, [clockIn]);

  return (
    <span className={className}>
      {showDot && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1.5 align-middle" />
      )}
      {formatElapsed(minutes)}
    </span>
  );
}
