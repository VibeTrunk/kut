"use client";

import { useEffect, useState } from "react";
import { countdownText } from "@/lib/midweek/entry";

/**
 * "in 1 day, 4 h", ticking. The first render uses the server's `now`, so the
 * server and the hydrating client print the same text; the clock takes over
 * after that, every 20 seconds.
 */
export function MidweekCountdown({
  target,
  now,
  className,
}: {
  target: string;
  now: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(() => Date.parse(now));
  useEffect(() => {
    const timer = window.setInterval(() => setCurrent(Date.now()), 20_000);
    const first = window.setTimeout(() => setCurrent(Date.now()), 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, []);
  return (
    <span className={className} role="timer">
      {countdownText(new Date(target), new Date(current))}
    </span>
  );
}
