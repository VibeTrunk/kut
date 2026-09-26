import { formatClock, formatDayDate } from "@/lib/midweek/entry";
import { MidweekCountdown } from "./countdown";
import { MidweekSeed } from "./seed";

/**
 * `MidweekLockBar`: when squads lock, in club time, a ticking countdown, and
 * the fairness seal beneath. Only the countdown is a client component.
 */
export function MidweekLockBar({
  lockAt,
  now,
  seedHash,
}: {
  lockAt: string;
  now: string;
  seedHash: string;
}) {
  return (
    <section
      aria-label="Lock"
      className="grid gap-3.5 rounded-2xl border border-line/60 bg-gradient-to-b from-panel-2/70 to-panel/70 px-[18px] py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-[18px]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[0.65rem] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
            Squads lock
          </p>
          <p className="text-xl font-black tracking-[-0.01em] sm:text-2xl">
            {formatDayDate(lockAt)}, {formatClock(lockAt)}
          </p>
        </div>
        <MidweekCountdown
          className="text-sm font-extrabold text-brass tabular-nums"
          now={now}
          target={lockAt}
        />
      </div>
      <MidweekSeed seedHash={seedHash} />
    </section>
  );
}
