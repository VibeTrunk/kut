import { archetypeLabel } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { getRarityTier } from "@/game/rating-engine";
import { factorText, handicapText } from "@/lib/midweek/evening";
import type {
  MomentKind,
  ShootoutReport,
  TimelineItem,
  WhyCard,
  WhySide,
} from "@/lib/midweek/report/types";
import { Chip } from "./chip";

/**
 * The match report's parts (BUILD_SPEC §44.10, HANDOFF "Report"): the
 * scoreboard, the timeline, the shoot-out and the "why" panel. Presentational:
 * the page renders the report on the server and hands these its pieces.
 */

export type Managers = readonly [string, string];

const pct = (ppm: number) => `${Math.round(ppm / 10_000)}%`;

/**
 * `MidweekScoreboard`: always side 0 on the left and side 1 on the right, from
 * the per-side goals, never the renderer's winner-first `score`.
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
  winnerSide: 0 | 1;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
}) {
  const label =
    `Final score: ${managers[0]} ${goals[0]}, ${managers[1]} ${goals[1]}` +
    (penalties
      ? `; ${managers[winnerSide]} won ${Math.max(...penalties)}–${Math.min(...penalties)} on penalties.`
      : ".");
  const side = (s: 0 | 1) => (
    <div className={`grid min-w-0 gap-1 ${s === 1 ? "justify-items-end text-right" : ""}`}>
      <p
        className={`text-lg leading-[1.15] [overflow-wrap:anywhere] sm:text-2xl ${s === winnerSide ? "font-black" : "font-bold text-ink-dim"}`}
      >
        {managers[s]}
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
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-y border-line/55 py-3.5"
      role="group"
    >
      {side(0)}
      <div aria-hidden="true" className="grid justify-items-center gap-0.5">
        <b className="text-[40px] leading-none font-black tracking-[-0.03em] whitespace-nowrap tabular-nums sm:text-[56px]">
          {goals[0]}–{goals[1]}
        </b>
        <small className="text-[11.5px] font-extrabold whitespace-nowrap text-ink-dim tabular-nums">
          {penalties ? `${penalties[0]}–${penalties[1]} on pens` : "full time"}
        </small>
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

/** `MidweekTimeline`: the key moments, each with its minute, a kind in words and the running score. */
export function MidweekTimeline({
  timeline,
  managers,
}: {
  timeline: readonly TimelineItem[];
  managers: Managers;
}) {
  return (
    <ol aria-label="Key moments" className="grid">
      {timeline.map((item, index) => {
        const goal = item.kind === "goal";
        const [a, b] = item.score;
        return (
          <li
            className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line/35 py-3.5"
            key={index}
          >
            <span
              className={`pt-px text-[15px] font-black tabular-nums ${goal ? "text-brass" : "text-ink-faint"}`}
            >
              {item.minute}&prime;
            </span>
            <div className="grid min-w-0 gap-1.5">
              <p className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold text-ink-faint">
                <span
                  className={`inline-flex items-center rounded-md border px-[7px] py-px text-[10.5px] font-black tracking-[0.1em] uppercase ${KIND_CHIP[item.kind]}`}
                >
                  {KIND_WORD[item.kind]}
                </span>
                <span>
                  {goal ? `for ${managers[item.side]}` : `${managers[item.side]}’s chance`}
                </span>
              </p>
              <p
                className={`text-[14.5px] leading-[1.55] text-pretty ${goal ? "text-ink" : "text-ink-dim"}`}
              >
                {item.text}
              </p>
            </div>
            <span
              className={`pt-px font-extrabold whitespace-nowrap tabular-nums ${goal ? "text-[17px] text-ink-dim" : "text-[15px] text-ink-faint"}`}
            >
              <span className="sr-only">
                Score after this: {managers[0]} {a}, {managers[1]} {b}.{" "}
              </span>
              <span aria-hidden="true">
                {goal && item.side === 0 ? <b className="font-black text-ink">{a}</b> : a}–
                {goal && item.side === 1 ? <b className="font-black text-ink">{b}</b> : b}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const KICK = "grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-black";
const SCORED = "bg-brass text-ink-on-accent";
const MISSED = "border-2 border-brick text-brick";
const SUDDEN = "shadow-[0_0_0_2px_var(--color-board),0_0_0_3px_var(--color-steel-line)]";

/**
 * `MidweekShootout`: a tally per side (✓ scored, ✕ missed, sudden-death kicks
 * ringed), a table of every kick for screen readers, then the renderer's lines
 * (the misses and the decider), the decider emphasised.
 */
export function MidweekShootout({
  shootout,
  managers,
}: {
  shootout: ShootoutReport;
  managers: Managers;
}) {
  const perSide = ([0, 1] as const).map((s) => shootout.kicks.filter((kick) => kick.side === s));
  const sudden = shootout.kicks.some((kick) => kick.round > MIDWEEK.penalties.kicks);
  const count = shootout.kicks.length;
  const summary = sudden
    ? `${count} kicks · sudden death`
    : perSide.every((kicks) => kicks.length === MIDWEEK.penalties.kicks)
      ? "five each"
      : `${count} kicks`;
  return (
    <section aria-labelledby="shootout-h" className="grid gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="display text-3xl" id="shootout-h">
          Penalties
        </h2>
        <p className="text-[13px] text-ink-faint">{summary}</p>
      </div>
      <div aria-hidden="true" className="grid gap-1.5">
        {([0, 1] as const).map((s) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3" key={s}>
            <span className="truncate text-sm font-extrabold">{managers[s]}</span>
            <span className="flex items-center gap-2.5">
              <span className="flex flex-wrap justify-end gap-1">
                {perSide[s].map((kick, index) => (
                  <span
                    className={`${KICK} ${kick.outcome === "goal" ? SCORED : MISSED} ${kick.round > MIDWEEK.penalties.kicks ? SUDDEN : ""}`}
                    key={index}
                  >
                    {kick.outcome === "goal" ? "✓" : "✕"}
                  </span>
                ))}
              </span>
              <span className="min-w-[2ch] text-right text-lg font-black tabular-nums">
                {shootout.score[s]}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-dim">
        <span className="inline-flex items-center gap-1.5">
          <span className={`${KICK} ${SCORED}`}>✓</span>scored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`${KICK} ${MISSED}`}>✕</span>missed
        </span>
        {sudden && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`${KICK} ${SCORED} ${SUDDEN}`} />
            sudden death
          </span>
        )}
      </p>
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
      <ol className="grid gap-2">
        {shootout.lines.map((line, index) => {
          const last = index === shootout.lines.length - 1;
          return (
            <li
              className={`border-l-2 pl-3.5 text-[14.5px] leading-[1.55] ${last ? "border-brass font-bold text-ink" : "border-line/70 text-ink-dim"}`}
              key={index}
            >
              {line}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Factor({ label, ppm }: { label: string; ppm: number }) {
  const factor = factorText(ppm);
  return (
    <div className="grid min-w-0 gap-px rounded-md bg-board-deep/55 px-1 pt-[5px] pb-1 text-center">
      <dt className="text-[9px] font-extrabold tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd
        className={`text-[12.5px] font-extrabold tabular-nums min-[360px]:text-[13px] ${factor.trend === "up" ? "text-moss" : factor.trend === "down" ? "text-brick" : "text-ink-dim"}`}
      >
        {factor.trend !== "flat" && (
          <span aria-hidden="true" className="mr-0.5 align-[2px] text-[7px]">
            {factor.trend === "up" ? "▲" : "▼"}
          </span>
        )}
        {factor.text}
      </dd>
    </div>
  );
}

function WhyCardRow({ card, manager }: { card: WhyCard; manager: string }) {
  // A Player both sides fielded is named "Olaf G. (Joris)" in the text; under
  // Joris's own side the manager is redundant (HANDOFF question 12).
  const suffix = ` (${manager})`;
  const name = card.name.endsWith(suffix) ? card.name.slice(0, -suffix.length) : card.name;
  const tags = [
    card.inGoal && <Chip key="goal">In goal</Chip>,
    card.trialist && <Chip key="trialist">Trialist</Chip>,
    card.injured && (
      <Chip key="injured" tone="plaster">
        Injured
      </Chip>
    ),
    card.handicapPpm !== 1_000_000 && (
      <Chip key="handicap" tone="auto">
        handicap ×{handicapText(card.handicapPpm)}
      </Chip>
    ),
    card.pickLabel && card.pickLabel !== "auto squad" && (
      <Chip key="pick" tone={card.pickLabel === "a rare pick" ? "auto" : "neutral"}>
        {card.pickLabel}
      </Chip>
    ),
    card.goals > 0 && (
      <Chip key="goals" tone="won">
        {card.goals} {card.goals === 1 ? "goal" : "goals"}
      </Chip>
    ),
    card.assists > 0 && (
      <Chip key="assists">
        {card.assists} {card.assists === 1 ? "assist" : "assists"}
      </Chip>
    ),
  ].filter(Boolean);
  return (
    <li className="grid gap-[7px] border-b border-line/30 py-2.5">
      <div className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5">
        {card.trialist ? (
          <span
            aria-hidden="true"
            className="h-6 w-5 rounded-[0.3rem] border-[1.5px] border-dashed border-line"
          />
        ) : (
          <span
            aria-hidden="true"
            className="tier-chip h-6 w-5 [&>span]:h-[0.55rem] [&>span]:w-[0.55rem]"
            data-rarity={getRarityTier(card.ovr)}
          >
            <span />
          </span>
        )}
        <p className="text-[14.5px] leading-tight font-black [overflow-wrap:anywhere]">
          {name}
          <small className="mt-px block text-[11.5px] font-semibold text-ink-faint">
            {archetypeLabel(card.archetype)} &middot; OVR {card.ovr}
          </small>
        </p>
        <p className="text-right text-lg leading-none font-black tabular-nums">
          {(card.powerPpm / 1_000_000).toFixed(2)}
          <small className="mt-[3px] block text-[9.5px] font-extrabold tracking-[0.1em] text-ink-faint uppercase">
            Power
          </small>
        </p>
      </div>
      <dl className="grid grid-cols-5 gap-[3px] pl-8">
        <Factor label="OVR" ppm={card.ovrFactorPpm} />
        <Factor label="Form" ppm={card.formRollPpm} />
        <Factor label="Pick" ppm={card.pickFactorPpm} />
        <Factor label="Fitness" ppm={card.fitnessPpm} />
        <Factor label="Day" ppm={card.dayRollPpm} />
      </dl>
      {tags.length > 0 && <p className="flex flex-wrap gap-1 pl-8">{tags}</p>}
    </li>
  );
}

/**
 * `MidweekWhyPanel`: the odds before kick-off (both percentages printed and the
 * managers named beneath; one side hatched as well as coloured), then every
 * card's week in numbers. The bar is SVG, since widths from data can't be
 * inline styles under the CSP.
 */
export function MidweekWhyPanel({ why }: { why: readonly [WhySide, WhySide] }) {
  const left = why[0].winChancePpm / 10_000;
  return (
    <section aria-labelledby="why-h" className="grid gap-5">
      <h2 className="display text-3xl" id="why-h">
        Why
      </h2>
      <div className="grid gap-2">
        <p className="text-[10.4px] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
          Chances before kick-off
        </p>
        <div
          aria-label={`Before kick-off: ${why[0].manager} ${pct(why[0].winChancePpm)}, ${why[1].manager} ${pct(why[1].winChancePpm)}`}
          className="relative h-7 overflow-hidden rounded-lg border border-line"
          role="img"
        >
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
            <defs>
              <pattern
                height="12"
                id="odds-hatch"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
                width="12"
              >
                <rect className="fill-brass-bg" height="12" width="12" />
                <rect className="fill-brass/10" height="12" width="6" />
              </pattern>
            </defs>
            <rect className="fill-steel-bg" height="100%" width={`${left}%`} />
            <rect fill="url(#odds-hatch)" height="100%" width={`${100 - left}%`} x={`${left}%`} />
          </svg>
          <p
            aria-hidden="true"
            className="relative flex h-full items-center justify-between px-2 text-xs font-black tabular-nums"
          >
            <span className="text-steel">{pct(why[0].winChancePpm)}</span>
            <span className="text-brass">{pct(why[1].winChancePpm)}</span>
          </p>
        </div>
        <p
          aria-hidden="true"
          className="flex justify-between gap-3 text-xs font-extrabold text-ink-dim"
        >
          <span>{why[0].manager}</span>
          <span className="text-right">{why[1].manager}</span>
        </p>
      </div>
      {why.map((side) => (
        <section aria-label={`${side.manager}’s five`} className="grid gap-2" key={side.manager}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 border-b border-line/60 pb-1.5">
            <h3 className="flex flex-wrap items-center gap-1.5 text-[17px] font-black">
              {side.manager}
              {side.auto && <Chip tone="auto">Auto squad</Chip>}
              {side.keeperless && <Chip tone="warn">No keeper</Chip>}
            </h3>
            <p className="text-xs font-extrabold text-ink-faint tabular-nums">
              {pct(side.winChancePpm)} before kick-off
            </p>
          </div>
          <ul>
            {side.cards.map((card, slot) => (
              <WhyCardRow card={card} key={slot} manager={side.manager} />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs leading-relaxed text-ink-faint">
        Power is the card&rsquo;s week:{" "}
        <code className="font-mono text-[11.5px] text-ink-dim">
          OVR &times; Form &times; Pick &times; Fitness
        </code>
        , times any handicap, fixed at the lock. Each match multiplies it by a fresh Day roll. A
        green arrow is above 1.00, a red one below.
      </p>
    </section>
  );
}
