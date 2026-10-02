import type { ReactNode } from "react";
import {
  eveningClockLabel,
  STOP_WORD,
  type EveningStop,
  type StopState,
} from "@/lib/midweek/evening";

const STOP_DOT: Record<StopState, string> = {
  locked: "border-[1.5px] border-steel bg-steel-bg",
  played: "border-[1.5px] border-brass bg-brass",
  live: "border-[2.5px] border-live bg-team-red-bg shadow-[0_0_0_4px_rgb(255_128_145/18%)]",
  next: "border-2 border-brass bg-board-deep",
  later: "border-[1.5px] border-dashed border-ink-faint bg-board-deep",
};

/**
 * `MidweekClock` (HANDOFF "Midweek: the evening"): sticky at the top of an
 * evening page, under the app header, edge to edge. The lock and every round
 * with its time; each state differs in shape (steel ring, filled ✓, live ring
 * with a halo, brass ring, dashed) and in words. Rounds the member is in carry a
 * brass dot after the name. The list is one sentence for screen readers.
 * It replaced `MidweekRevealClock`, retired with Home's old card (ADR-114).
 */
export function MidweekClock({
  stops,
  updated = null,
}: {
  stops: readonly EveningStop[];
  /** `Updated 20:18:20` under the clock while the evening polls (ADR-115). */
  updated?: ReactNode;
}) {
  return (
    <div className="sticky top-14 z-20 -mx-5 -mt-5 mb-5 border-b border-line/50 bg-board-deep/92 px-5 pt-2.5 pb-2 backdrop-blur-sm sm:top-16 sm:-mx-10 sm:-mt-10 sm:mb-10 sm:px-10 sm:pt-3 sm:pb-2.5">
      <ol
        aria-label={eveningClockLabel(stops)}
        className="relative mx-auto grid max-w-6xl auto-cols-[minmax(0,1fr)] grid-flow-col before:absolute before:top-[22px] before:right-[6%] before:left-[6%] before:border-t-[1.5px] before:border-dashed before:border-line before:content-['']"
        data-testid="midweek-clock"
      >
        {stops.map((stop) => (
          <li
            aria-hidden="true"
            className="relative grid min-w-0 justify-items-center gap-0.5 text-center"
            data-state={stop.state}
            key={stop.round ?? "lock"}
          >
            <span
              className={`text-[11px] font-extrabold tabular-nums ${stop.state === "live" ? "text-live" : "text-ink-faint"}`}
            >
              {stop.time}
            </span>
            <span
              className={`z-[1] grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black text-ink-on-accent ${STOP_DOT[stop.state]}`}
            >
              {stop.state === "played" ? "✓" : ""}
            </span>
            <span
              className={`text-[10.5px] font-extrabold whitespace-nowrap max-[359px]:text-[9.5px] ${stop.you ? "text-ink after:text-brass after:content-['_•']" : "text-ink-dim"}`}
            >
              {stop.name}
            </span>
            <span
              className={`text-[8.5px] font-black tracking-[0.1em] uppercase max-[359px]:text-[7.5px] max-[359px]:tracking-[0.04em] ${
                stop.state === "live"
                  ? "text-live"
                  : stop.state === "next"
                    ? "text-brass"
                    : "text-ink-faint"
              }`}
            >
              {STOP_WORD[stop.state]}
            </span>
          </li>
        ))}
      </ol>
      {updated && <div className="mx-auto mt-1 flex max-w-6xl justify-end">{updated}</div>}
    </div>
  );
}
