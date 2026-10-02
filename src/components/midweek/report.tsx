import type { Side } from "@/game/midweek/match";
import type { LiveScore } from "@/lib/midweek/live";
import type {
  MomentKind,
  ShootoutKick,
  ShootoutReport,
  TimelineItem,
} from "@/lib/midweek/report/types";
import { Chip, LiveMarker } from "./chip";
import { PlayerName, ReportText, TEAM_TEXT } from "./player-name";

/**
 * The match report's parts (BUILD_SPEC §44.10, design/ux-review/HANDOFF.md
 * "Matches"): the scoreboard, the lane timeline and the shoot-out; the "why"
 * is `MidweekWhyList`. Presentational: the page renders the report on the
 * server and hands these its pieces. Team colours only here, where one match
 * is open (DR2-1): side 0 blue on the left, side 1 red on the right.
 */

export type Managers = readonly [string, string];

/**
 * `MidweekScoreboard`: always side 0 on the left and side 1 on the right, from
 * the per-side goals, never the renderer's winner-first `score`; names and
 * digits in team colour, no chance counter (DR1-5). At full time Through and
 * Out chips; live (ADR-115) the score so far and `Live · 64′` or `Live · pens
 * 3–3`, with no chips until it ends.
 */
export function MidweekScoreboard({
  managers,
  goals,
  penalties,
  winnerSide,
  youSide,
  auto,
  compact = false,
  live = null,
}: {
  managers: Managers;
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  /** Ignored while `live`. */
  winnerSide: Side | null;
  youSide: Side | null;
  auto: readonly [boolean, boolean];
  /** Home's card (Home-Now-Live): smaller type, no panel, no auto-squad chip. */
  compact?: boolean;
  live?: LiveScore | null;
}) {
  const label = live
    ? `Live, ${live.penalties ? "penalties" : `${ordinal(live.minute)} minute`}: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
      (live.penalties ? `, penalties ${live.penalties[0]}–${live.penalties[1]}.` : ".")
    : `Final score: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
      (penalties && winnerSide !== null
        ? `; ${managers[winnerSide]} won ${Math.max(...penalties)}–${Math.min(...penalties)} on penalties.`
        : ".");
  const side = (s: Side) => (
    <div className={`grid min-w-0 gap-1.5 ${s === 1 ? "justify-items-end text-right" : ""}`}>
      <p
        className={`leading-[1.2] font-black [overflow-wrap:anywhere] ${compact ? "text-[15px] sm:text-[17px]" : "text-[17px] sm:text-[22px]"}`}
      >
        <PlayerName side={s}>{managers[s]}</PlayerName>
      </p>
      <p className={`flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
        {!live &&
          (s === winnerSide ? <Chip tone="won">✓ Through</Chip> : <Chip tone="out">Out</Chip>)}
        {youSide === s && <Chip tone="you">You</Chip>}
        {/* Home's card leaves the auto squad to the match page: two long names
            and their chips would not fit a 320 px card. */}
        {auto[s] && !compact && <Chip tone="auto">Auto squad</Chip>}
      </p>
    </div>
  );
  return (
    <div
      aria-label={label}
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 border border-line/60 ${
        compact
          ? "rounded-xl bg-board/50 px-3 py-2.5 sm:px-4"
          : "rounded-2xl bg-panel/60 p-3.5 sm:px-6 sm:py-5"
      }`}
      role="group"
    >
      {side(0)}
      <div aria-hidden="true" className="grid justify-items-center gap-1.5">
        <p
          className={`leading-none font-black tracking-[0.02em] whitespace-nowrap tabular-nums ${compact ? "text-[28px] sm:text-[32px]" : "text-[38px] sm:text-[54px]"}`}
        >
          <span className="text-team-blue">{goals[0]}</span>–
          <span className="text-team-red">{goals[1]}</span>
        </p>
        {live && compact ? (
          // The card's kicker already carries the Live marker.
          <p className="text-[11.5px] font-bold whitespace-nowrap text-live tabular-nums">
            {live.penalties ? `pens ${live.penalties[0]}–${live.penalties[1]}` : `${live.minute}′`}
          </p>
        ) : live ? (
          <LiveMarker>
            Live &middot;{" "}
            {live.penalties ? `pens ${live.penalties[0]}–${live.penalties[1]}` : `${live.minute}′`}
          </LiveMarker>
        ) : (
          <p className="text-[11.5px] font-bold whitespace-nowrap text-ink-faint tabular-nums">
            {penalties ? `${penalties[0]}–${penalties[1]} on pens` : "full time"}
          </p>
        )}
      </div>
      {side(1)}
    </div>
  );
}

const KIND_WORD: Record<MomentKind, string> = {
  goal: "Goal",
  save: "Save",
  block: "Block",
  woodwork: "Woodwork",
  wide: "Wide",
};

const KIND_CHIP: Record<MomentKind, string> = {
  goal: "border-brass bg-brass text-ink-on-accent",
  save: "border-steel-line text-steel",
  block: "border-steel-line text-steel",
  woodwork: "border-warning-line text-warning",
  wide: "border-line text-ink-dim",
};

/** "39th", "1st", "22nd": the minute as screen readers hear it. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The score after a moment, the scoring side's digit emphasised. */
function Score({ item }: { item: TimelineItem }) {
  const [a, b] = item.score;
  const goal = item.kind === "goal";
  return (
    <>
      {goal && item.side === 0 ? <b className="font-black text-ink">{a}</b> : a}–
      {goal && item.side === 1 ? <b className="font-black text-ink">{b}</b> : b}
    </>
  );
}

/**
 * `MidweekLaneTimeline` (HANDOFF "Matches"): the key moments in order, each
 * leaning to its side. In a column under 600 px: one lane, a side-0 chance
 * with a blue rail on the left and room on the right, a side-1 chance
 * mirrored. From 600 px of its own width (a container query, not the page):
 * two lanes either side of a minute-and-score spine. Each item says whose
 * chance it is in words for screen readers. On a live page (ADR-115) the
 * newest moment has a brass outline and slides in, unless the member asked for
 * reduced motion.
 */
export function MidweekLaneTimeline({
  timeline,
  managers,
  live = false,
}: {
  timeline: readonly TimelineItem[];
  managers: Managers;
  live?: boolean;
}) {
  if (live && timeline.length === 0) {
    return <p className="text-sm text-ink-faint">No chance yet.</p>;
  }
  return (
    <div className="@container">
      <ol aria-label="Key moments" className="grid gap-2 @min-[600px]:gap-1.5">
        {timeline.map((item, index) => {
          const goal = item.kind === "goal";
          const left = item.side === 0;
          const newest = live && index === timeline.length - 1;
          const whose = goal
            ? `Goal for ${managers[item.side]}`
            : `${managers[item.side]}’s chance`;
          return (
            <li
              className="@min-[600px]:grid @min-[600px]:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] @min-[600px]:items-start"
              key={index}
            >
              <div
                className={`grid gap-1 rounded-xl px-3 py-2.5 text-sm leading-normal @min-[600px]:row-start-1 @min-[600px]:m-0 ${newest ? "mw-chance-in outline-1 outline-brass" : ""} ${
                  left
                    ? "mr-8 border-l-[3px] border-team-blue bg-team-blue-bg/55 @min-[600px]:col-start-1"
                    : "ml-8 border-r-[3px] border-team-red bg-team-red-bg/55 @min-[600px]:col-start-3"
                }`}
              >
                <p
                  aria-hidden="true"
                  className={`flex items-center gap-2 text-xs font-extrabold ${left ? "" : "flex-row-reverse"}`}
                >
                  <span className="text-ink-faint tabular-nums @min-[600px]:hidden">
                    {item.minute}&prime;
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-[7px] py-px text-[9.5px] font-black tracking-[0.1em] uppercase ${KIND_CHIP[item.kind]}`}
                  >
                    {KIND_WORD[item.kind]}
                  </span>
                  <PlayerName side={item.side}>{managers[item.side]}</PlayerName>
                  <span
                    className={`text-ink-dim tabular-nums @min-[600px]:hidden ${left ? "ml-auto" : "mr-auto"}`}
                  >
                    <Score item={item} />
                  </span>
                </p>
                <p className="sr-only">
                  {ordinal(item.minute)} minute. {whose}.
                </p>
                <p className={`text-pretty ${goal ? "text-ink" : "text-ink-dim"}`}>
                  <ReportText parts={item.parts} />
                </p>
                <p className="sr-only">
                  Score: {managers[0]} {item.score[0]}, {managers[1]} {item.score[1]}.
                </p>
              </div>
              <p
                aria-hidden="true"
                className="hidden justify-items-center gap-0.5 pt-2.5 text-xs font-extrabold text-ink-faint tabular-nums @min-[600px]:col-start-2 @min-[600px]:row-start-1 @min-[600px]:grid"
              >
                <span>{item.minute}&prime;</span>
                <span className="text-[13px] text-ink">
                  <Score item={item} />
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const KICK = "grid h-5 w-5 place-items-center rounded-full text-[11px] font-black";
const SCORED = ["bg-team-blue text-ink-on-team-blue", "bg-team-red text-ink-on-team-red"] as const;
const MISSED = "border-[1.5px] border-ink-faint text-ink-faint";

/**
 * `MidweekShootout` at full time (HANDOFF "Shoot-out", static rows): per side
 * the manager, then the running total (DR2-5), then the kicks, scored filled
 * in team colour (✓), missed ringed (✕); a table of every kick for screen
 * readers; then the renderer's lines (the misses and the decider), the decider
 * emphasised.
 */
export function MidweekShootout({
  shootout,
  managers,
}: {
  shootout: ShootoutReport;
  managers: Managers;
}) {
  return (
    <section aria-labelledby="shootout-h" className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="display text-3xl" id="shootout-h">
          Penalties
        </h2>
        <p className="text-[13px] text-ink-faint">{shootout.kicks.length} kicks</p>
      </div>
      <div aria-hidden="true" className="grid gap-2">
        {([0, 1] as const).map((s) => (
          <div
            className="grid grid-cols-[minmax(0,6.5rem)_1.75rem_minmax(0,1fr)] items-center gap-2.5"
            key={s}
          >
            <span className="truncate text-sm">
              <PlayerName side={s}>{managers[s]}</PlayerName>
            </span>
            <span className={`text-center text-xl font-black tabular-nums ${TEAM_TEXT[s]}`}>
              {shootout.score[s]}
            </span>
            <span className="flex flex-wrap gap-1">
              {shootout.kicks
                .filter((kick) => kick.side === s)
                .map((kick, index) => (
                  <span
                    className={`${KICK} ${kick.outcome === "goal" ? SCORED[s] : MISSED}`}
                    key={index}
                  >
                    {kick.outcome === "goal" ? "✓" : "✕"}
                  </span>
                ))}
            </span>
          </div>
        ))}
      </div>
      {/* A table ignores `sr-only`'s 1 px width and would widen a phone's
          layout viewport, so a block clips it instead. */}
      <div className="sr-only">
        <table>
          <caption>Every kick in order</caption>
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Side</th>
              <th scope="col">Kicker</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {shootout.kicks.map((kick, index) => (
              <tr key={index}>
                <td>{kick.round}</td>
                <td>{managers[kick.side]}</td>
                <td>{kick.kicker}</td>
                <td>{kick.outcome === "goal" ? "scored" : "missed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="mt-1.5 grid gap-2">
        {shootout.lineParts.map((parts, index) => {
          const last = index === shootout.lineParts.length - 1;
          return (
            <li
              className={`border-l-2 pl-3.5 text-[14.5px] leading-[1.55] text-pretty ${last ? "border-brass font-bold text-ink" : "border-line/70 text-ink-dim"}`}
              key={index}
            >
              <ReportText parts={parts} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * `MidweekShootoutLive` (HANDOFF "Shoot-out, live"): per side the manager, the
 * running total (DR2-5), then the kicks so far, filled in team colour (✓) or
 * ringed (✕), with dashed rings for the first five still to come. Grows in
 * place; a long sudden death wraps. The last kick is read out politely.
 */
export function MidweekShootoutLive({
  kicks,
  penalties,
  managers,
}: {
  kicks: readonly ShootoutKick[];
  penalties: readonly [number, number];
  managers: Managers;
}) {
  const last = kicks.at(-1) ?? null;
  return (
    <section aria-labelledby="shootout-h" className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="display text-3xl" id="shootout-h">
          Penalties
        </h2>
        <p className="text-[13px] text-ink-faint">
          {kicks.length} {kicks.length === 1 ? "kick" : "kicks"} so far &middot; one every 5 seconds
        </p>
      </div>
      <div className="grid gap-2">
        {([0, 1] as const).map((s) => {
          const taken = kicks.filter((kick) => kick.side === s);
          return (
            <div
              aria-label={`${managers[s]}: ${penalties[s]} scored from ${taken.length}`}
              className="grid grid-cols-[minmax(0,6.5rem)_1.75rem_minmax(0,1fr)] items-center gap-2.5"
              key={s}
              role="group"
            >
              <span aria-hidden="true" className="truncate text-sm">
                <PlayerName side={s}>{managers[s]}</PlayerName>
              </span>
              <span
                aria-hidden="true"
                className={`text-center text-xl font-black tabular-nums ${TEAM_TEXT[s]}`}
              >
                {penalties[s]}
              </span>
              <span aria-hidden="true" className="flex flex-wrap gap-1">
                {taken.map((kick, index) => (
                  <span
                    className={`${KICK} ${kick.outcome === "goal" ? SCORED[s] : MISSED}`}
                    key={index}
                  >
                    {kick.outcome === "goal" ? "✓" : "✕"}
                  </span>
                ))}
                {Array.from({ length: Math.max(0, 5 - taken.length) }, (_, index) => (
                  <span
                    className={`${KICK} border-[1.5px] border-dashed border-line`}
                    key={`to-come-${index}`}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <p aria-live="polite" className="text-sm text-ink">
        {last && (
          <>
            Last kick: <PlayerName side={last.side}>{last.kicker}</PlayerName>{" "}
            {last.outcome === "goal" ? "scores" : "misses"}.
          </>
        )}
      </p>
    </section>
  );
}
