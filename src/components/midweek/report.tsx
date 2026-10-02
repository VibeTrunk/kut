import type { Side } from "@/game/midweek/match";
import type { MomentKind, ShootoutReport, TimelineItem } from "@/lib/midweek/report/types";
import { Chip } from "./chip";
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
 * `MidweekScoreboard` at full time: always side 0 on the left and side 1 on
 * the right, from the per-side goals, never the renderer's winner-first
 * `score`; names and digits in team colour, no chance counter (DR1-5).
 */
export function MidweekScoreboard({
  managers,
  goals,
  penalties,
  winnerSide,
  youSide,
  auto,
}: {
  managers: Managers;
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  winnerSide: Side;
  youSide: Side | null;
  auto: readonly [boolean, boolean];
}) {
  const label =
    `Final score: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
    (penalties
      ? `; ${managers[winnerSide]} won ${Math.max(...penalties)}–${Math.min(...penalties)} on penalties.`
      : ".");
  const side = (s: Side) => (
    <div className={`grid min-w-0 gap-1.5 ${s === 1 ? "justify-items-end text-right" : ""}`}>
      <p className="text-[17px] leading-[1.2] font-black [overflow-wrap:anywhere] sm:text-[22px]">
        <PlayerName side={s}>{managers[s]}</PlayerName>
      </p>
      <p className={`flex flex-wrap gap-1 ${s === 1 ? "justify-end" : ""}`}>
        {s === winnerSide ? <Chip tone="won">✓ Through</Chip> : <Chip tone="out">Out</Chip>}
        {youSide === s && <Chip tone="you">You</Chip>}
        {auto[s] && <Chip tone="auto">Auto squad</Chip>}
      </p>
    </div>
  );
  return (
    <div
      aria-label={label}
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border border-line/60 bg-panel/60 p-3.5 sm:px-6 sm:py-5"
      role="group"
    >
      {side(0)}
      <div aria-hidden="true" className="grid justify-items-center gap-1.5">
        <p className="text-[38px] leading-none font-black tracking-[0.02em] whitespace-nowrap tabular-nums sm:text-[54px]">
          <span className="text-team-blue">{goals[0]}</span>–
          <span className="text-team-red">{goals[1]}</span>
        </p>
        <p className="text-[11.5px] font-bold whitespace-nowrap text-ink-faint tabular-nums">
          {penalties ? `${penalties[0]}–${penalties[1]} on pens` : "full time"}
        </p>
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
 * chance it is in words for screen readers.
 */
export function MidweekLaneTimeline({
  timeline,
  managers,
}: {
  timeline: readonly TimelineItem[];
  managers: Managers;
}) {
  return (
    <div className="@container">
      <ol aria-label="Key moments" className="grid gap-2 @min-[600px]:gap-1.5">
        {timeline.map((item, index) => {
          const goal = item.kind === "goal";
          const left = item.side === 0;
          const whose = goal
            ? `Goal for ${managers[item.side]}`
            : `${managers[item.side]}’s chance`;
          return (
            <li
              className="@min-[600px]:grid @min-[600px]:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] @min-[600px]:items-start"
              key={index}
            >
              <div
                className={`grid gap-1 rounded-xl px-3 py-2.5 text-sm leading-normal @min-[600px]:row-start-1 @min-[600px]:m-0 ${
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
