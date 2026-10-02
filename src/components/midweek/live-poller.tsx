"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 20_000;
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Keeps a live page current (HANDOFF "Polling", ADR-115): while a match is in
 * play it asks the server for the page again every 20 seconds, and otherwise
 * once, at the next kick-off (`nextAt`), so a round never starts unseen. No
 * Realtime: the server renders what is due, and only that reaches the page.
 * A hidden tab skips its polls and catches up when it is shown again. Shows
 * `Updated 20:18:20` quietly, from the server's render time.
 */
export function MidweekLivePoller({
  at,
  poll,
  nextAt = null,
  foot = false,
}: {
  /** When the server rendered the page. */
  at: string;
  poll: boolean;
  nextAt?: string | null;
  /** The match page's foot line, which says how often it checks. */
  foot?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timers: number[] = [];
    if (poll) timers.push(window.setInterval(refresh, POLL_MS));
    if (nextAt) {
      const wait = Date.parse(nextAt) - Date.now() + 1_000;
      if (wait > 0 && wait < 2 ** 31 - 1) timers.push(window.setTimeout(refresh, wait));
    }
    const onShow = () => {
      if (poll && document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [router, poll, nextAt, at]);

  if (!poll && !foot) return null;
  return (
    <p className="text-[11px] font-bold text-ink-faint tabular-nums">
      Updated {clockFormat.format(new Date(at))}
      {foot && poll && " · checks for new chances every 20 seconds"}
    </p>
  );
}
