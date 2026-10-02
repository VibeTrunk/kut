import Link from "next/link";
import type { PastWeek } from "@/lib/midweek/evening";

/**
 * `MidweekWeekList` (HANDOFF "Bracket", Weeks-Past): one row per finished
 * week, newest first, each opening that week's bracket.
 */
export function MidweekWeekList({ weeks }: { weeks: readonly PastWeek[] }) {
  return (
    <ul aria-label="Past weeks" className="grid gap-2">
      {weeks.map((week) => (
        <li key={week.weekStart}>
          <Link
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border border-line/60 bg-panel/50 px-3.5 py-3 hover:border-brass"
            href={`/midweek/${week.weekStart}`}
          >
            <b className="text-[15px]">{week.date}</b>
            <span
              aria-hidden="true"
              className="col-start-2 row-span-2 row-start-1 text-lg font-black text-brass"
            >
              ›
            </span>
            <span className="text-[13px] text-ink-dim">{week.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
