import {
  eveningClockLabel,
  STOP_WORD,
  type ClockStop,
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
 * Replaces `MidweekRevealClock` on the evening pages; Home's card keeps that.
 */
export function MidweekClock({ stops }: { stops: readonly EveningStop[] }) {
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
    </div>
  );
}

const STATE_WORD: Record<ClockStop["state"], string> = {
  lock: "Locked",
  done: "Out",
  next: "Next",
  hidden: "Hidden",
};

const DOT: Record<ClockStop["state"], string> = {
  lock: "border-2 border-steel bg-steel-bg text-steel",
  done: "bg-brass text-ink-on-accent",
  next: "border-2 border-brass bg-board shadow-[0_0_0_4px_rgb(224_172_74/16%)]",
  hidden: "border-2 border-dashed border-line bg-board",
};

const TIME: Record<ClockStop["state"], string> = {
  lock: "text-steel",
  done: "text-brass",
  next: "text-brass",
  hidden: "text-ink-dim",
};

/** The brass line from the stop before, drawn on every stop that is out or next. */
const FILL =
  "before:absolute before:top-[29px] before:-left-1/2 before:right-1/2 before:h-0.5 before:content-[''] sm:before:top-[32px]";

/**
 * `MidweekRevealClock`: the evening as a line of stops, the lock and then one
 * per round. States differ in shape (filled ✓, ringed, dashed) and in words,
 * and a round the member won has a halo. Below 400 px the lock stop is
 * dropped. With `linkRounds`, each round jumps to its section of the bracket.
 */
export function MidweekRevealClock({
  stops,
  label,
  compact = false,
  linkRounds = false,
}: {
  stops: readonly ClockStop[];
  label: string;
  compact?: boolean;
  linkRounds?: boolean;
}) {
  const hasLock = stops[0]?.state === "lock";
  return (
    <ol
      aria-label={label}
      className="relative grid auto-cols-[minmax(0,1fr)] grid-flow-col before:absolute before:top-[29px] before:right-[10%] before:left-[10%] before:h-0.5 before:bg-[repeating-linear-gradient(90deg,var(--color-line)_0_5px,transparent_5px_9px)] before:content-[''] sm:before:top-[32px]"
    >
      {stops.map((stop, index) => {
        const filled = index > 0 && (stop.state === "done" || stop.state === "next");
        const fill = filled
          ? `${FILL} ${stop.state === "next" ? "before:bg-[linear-gradient(90deg,var(--color-brass),var(--color-brass)_40%,transparent)]" : "before:bg-brass"} ${hasLock && index === 1 ? "max-[399px]:before:hidden" : ""}`
          : "";
        const body = (
          <>
            <span
              className={`h-[13px] text-[12.5px] leading-none font-black tabular-nums sm:h-[15px] sm:text-sm ${TIME[stop.state]}`}
            >
              {stop.time}
            </span>
            <span
              aria-hidden="true"
              className={`relative z-[1] grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-black ${DOT[stop.state]} ${stop.you ? "shadow-[0_0_0_3px_var(--color-board),0_0_0_5px_rgb(224_172_74/45%)]" : ""}`}
            >
              {stop.state === "done" ? "✓" : stop.state === "lock" ? "●" : ""}
            </span>
            {!compact && (
              <span
                className={`text-[11px] leading-[1.2] font-extrabold sm:text-[12.5px] ${stop.state === "done" || stop.state === "next" ? "text-ink" : "text-ink-faint"}`}
              >
                {stop.name}
              </span>
            )}
            <span
              className={`text-[9.5px] font-extrabold tracking-[0.1em] uppercase ${stop.state === "next" ? "text-brass" : "text-ink-faint"}`}
            >
              {STATE_WORD[stop.state]}
            </span>
            {(compact || stop.you) && (
              <span className="sr-only">
                {compact ? `${stop.name}. ` : ""}
                {stop.you ? "You won this round." : ""}
              </span>
            )}
          </>
        );
        return (
          <li
            className={`relative grid min-w-0 justify-items-center gap-[5px] text-center ${stop.state === "lock" ? "max-[399px]:hidden" : ""} ${fill}`}
            key={stop.round ?? "lock"}
          >
            {linkRounds && stop.round !== null ? (
              <a
                className="grid min-h-11 justify-items-center gap-[5px] rounded-lg hover:bg-panel/60"
                href={`#round-${stop.round}`}
              >
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
