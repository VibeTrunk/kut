import Link from "next/link";
import { formatClock } from "@/lib/midweek/entry";
import { pairSentence, sideScore, type BracketPair, type BracketSlot } from "@/lib/midweek/evening";
import { Chip, LiveMarker } from "./chip";

/** A call on a bracket row (DR3 HANDOFF §2): the bracket shows calls, it never takes them. */
export type RowCall = { kind: "picked"; name: string } | { kind: "open" };

function CallChip({ call, dense }: { call: RowCall; dense: boolean }) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${dense ? "pb-1 pl-2" : "pb-2.5 pl-3"}`}
    >
      <span
        className={`inline-flex items-center rounded-full border px-2 py-px text-[10.5px] font-black tracking-[0.06em] whitespace-nowrap uppercase ${
          call.kind === "picked"
            ? "border-brass-line bg-brass-bg text-brass"
            : "border-dashed border-line text-ink-dim"
        }`}
      >
        {call.kind === "picked" ? `✓ Your call: ${call.name}` : "Open to call"}
      </span>
      {call.kind === "open" && (
        <Link
          className="text-xs font-bold whitespace-nowrap text-brass hover:underline"
          href="/midweek#calls"
        >
          Call it &rarr;
        </Link>
      )}
    </p>
  );
}

function Side({
  slot,
  you,
  won,
  lost,
  bye,
  score,
}: {
  slot: BracketSlot;
  you: boolean;
  won: boolean;
  lost: boolean;
  bye: boolean;
  score: { goals: number; penalties: number | null } | null;
}) {
  const tone = slot.placeholder
    ? "text-ink-faint"
    : won
      ? "font-extrabold text-ink"
      : lost
        ? "text-ink-faint"
        : "text-ink";
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span className={`min-w-[5ch] truncate ${tone}`}>{slot.name}</span>
      {won && <span className="font-black text-moss">✓</span>}
      {you && <Chip tone="you">You</Chip>}
      {slot.auto && <Chip tone="auto">Auto</Chip>}
      {bye && <Chip>Bye</Chip>}
      {score && (
        <span className={`ml-auto pl-2 tabular-nums ${won ? "font-black" : "font-bold"}`}>
          {score.goals}
          {score.penalties !== null && (
            <small className="ml-[3px] text-[11px] font-bold text-ink-faint">
              ({score.penalties})
            </small>
          )}
        </span>
      )}
    </p>
  );
}

/**
 * `MidweekMatchRow` (HANDOFF "Bracket"), neutral, never in team colours
 * (DR2-1). Four states: `Kick-off 20:15` before a pairing starts, naming who
 * meet or where they come from (`Winner of Mila v Eline`); in play, as `Live`
 * with a link to watch it for the member's own match and the final, and as
 * `In play · result at full time` for every other match, with no score
 * (ADR-115); `Full time` with both scores, the winner ticked and a link to the
 * report; a bye as one dashed row that counts as a win. Each row is a group
 * with one full sentence as its name; `dense` is the desktop tree's box. For a
 * member who is out, a later match carries their call, read-only (ADR-118).
 */
export function MidweekMatchRow({
  pair,
  you,
  weekStart,
  dense = false,
  call = null,
}: {
  pair: BracketPair;
  you: string | null;
  weekStart: string;
  dense?: boolean;
  call?: RowCall | null;
}) {
  const mine = (slot: BracketSlot) => !slot.placeholder && you !== null && slot.userId === you;
  const isYou = pair.sides.some(mine);
  const sentence = pairSentence(pair);
  const frame =
    pair.kind === "bye"
      ? `border-dashed bg-transparent ${isYou ? "border-brass" : "border-line/70"}`
      : `bg-panel/55 ${isYou ? "border-brass shadow-[0_0_0_1px_rgb(224_172_74/25%)]" : "border-line/60"}`;
  const sides = pair.sides.map((slot, index) => {
    const played = pair.kind === "played";
    const won = played && pair.match.winner_side === index;
    return (
      <Side
        bye={pair.kind === "bye"}
        key={index}
        lost={played && !won}
        score={played ? sideScore(pair.match, index as 0 | 1) : null}
        slot={slot}
        won={won}
        you={mine(slot)}
      />
    );
  });

  let state;
  if (pair.kind === "played") {
    state = (
      <Link
        aria-label={`Match report: ${sentence}`}
        className={`grid content-center gap-0.5 border-l border-line/40 font-bold text-ink-faint hover:bg-brass/10 ${dense ? "w-8 justify-items-center" : "min-w-11 justify-items-end px-3 text-xs"}`}
        href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
      >
        {!dense && <span>Full time</span>}
        <b aria-hidden="true" className="text-lg leading-none font-black text-brass">
          ›
        </b>
      </Link>
    );
  } else if (pair.kind === "inplay" && (isYou || pair.final)) {
    state = (
      <Link
        aria-label={`Watch it: ${sentence}`}
        className={`flex items-center gap-2 border-l border-line/40 hover:bg-brass/10 ${dense ? "px-1.5" : "px-3"}`}
        href={`/midweek/${weekStart}/match/${pair.match.match_id}`}
      >
        <LiveMarker />
        {!dense && (
          <b aria-hidden="true" className="text-lg leading-none font-black text-brass">
            ›
          </b>
        )}
      </Link>
    );
  } else if (pair.kind === "inplay") {
    state = (
      <span
        className={`grid content-center justify-items-end gap-1 text-[11px] font-bold text-ink-faint ${dense ? "pr-1.5" : "pr-3"}`}
      >
        <span className="rounded-full border border-dashed border-steel-line px-2 py-px text-[10px] font-black tracking-[0.1em] whitespace-nowrap text-steel uppercase">
          In play
        </span>
        {!dense && (
          <span className="whitespace-nowrap max-[359px]:hidden">result at full time</span>
        )}
      </span>
    );
  } else if (pair.kind === "upcoming") {
    const time = formatClock(pair.kickoffAt);
    state = dense ? (
      <b className="self-center pr-2 text-[12.5px] font-black text-ink tabular-nums">{time}</b>
    ) : (
      <span className="grid content-center justify-items-end gap-0.5 pr-3 text-xs font-bold text-ink-faint">
        <span>Kick-off</span>
        <b className="text-[15px] font-black text-ink tabular-nums">{time}</b>
      </span>
    );
  } else {
    state = dense ? (
      <span />
    ) : (
      <span className="self-center pr-3 text-xs font-bold whitespace-nowrap text-ink-faint max-[359px]:hidden">
        counts as a win
      </span>
    );
  }

  return (
    <div
      aria-label={sentence}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-2 overflow-hidden rounded-xl border ${frame}`}
      role="group"
    >
      <div className="grid min-w-0 content-center">
        <div
          aria-hidden="true"
          className={`grid min-w-0 content-center gap-1 ${dense ? "py-1 pl-2 text-[12.5px] leading-[1.45]" : "py-2.5 pl-3 text-sm"}`}
        >
          {sides}
        </div>
        {call && <CallChip call={call} dense={dense} />}
      </div>
      {state}
    </div>
  );
}
