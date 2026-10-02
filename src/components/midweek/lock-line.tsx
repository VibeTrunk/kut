import { formatClock, formatDayDate } from "@/lib/midweek/entry";
import { MidweekCountdown } from "./countdown";

/**
 * `MidweekLockLine` (KB-029, HANDOFF "Midweek: the picker"): one line, when
 * squads lock and how long is left, the countdown right after the time it
 * counts to. The fairness seal moved to the bracket and the champion view.
 */
export function MidweekLockLine({ lockAt, now }: { lockAt: string; now: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[15px]">
      <span>
        Squads lock{" "}
        <b className="font-black">
          {formatDayDate(lockAt)}, {formatClock(lockAt)}
        </b>
      </span>
      <MidweekCountdown
        className="font-extrabold text-brass tabular-nums"
        now={now}
        target={lockAt}
      />
    </p>
  );
}
