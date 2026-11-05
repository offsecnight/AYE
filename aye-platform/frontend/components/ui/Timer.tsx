"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  createdAt: string; // ISO string
  className?: string;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Live-ticking "Unresolved for X" timer — shown in red on Experience cards */
export function UnresolvedTimer({ createdAt, className }: TimerProps) {
  const [duration, setDuration] = useState(() =>
    formatDuration(Date.now() - new Date(createdAt).getTime())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(formatDuration(Date.now() - new Date(createdAt).getTime()));
    }, 60_000); // update every minute
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <span
      className={`font-mono text-xs font-bold text-danger uppercase tracking-wider animate-blink ${className ?? ""}`}
    >
      ● UNRESOLVED FOR {duration}
    </span>
  );
}

/** Countdown timer for OTP (120 seconds) */
export function OtpCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (seconds <= 0) { onExpire?.(); return; }
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(t); onExpire?.(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [seconds, onExpire]);

  const pct = (seconds / 120) * 100;
  const color = seconds > 60 ? "#D4F542" : seconds > 30 ? "#F59E0B" : "#E11D48";

  return (
    <div className="flex flex-col gap-2">
      <div
        className="font-mono text-4xl font-bold text-center tabular-nums"
        style={{ color }}
      >
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </div>
      {/* progress bar */}
      <div className="h-2 border-2 border-ink w-full bg-paper overflow-hidden">
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
