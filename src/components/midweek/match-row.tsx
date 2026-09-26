import Link from "next/link";
import { formatClock } from "@/lib/midweek/entry";
import {
  matchSentence,
  sideScore,
  type BracketPair,
  type BracketSlot,
} from "@/lib/midweek/evening";
import { Chip } from "./chip";

const SIDE = "grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-1.5";
const SECOND = "border-t border-line/45";

function Who({ slot, you, auto = slot.auto }: { slot: BracketSlot; you: boolean; auto?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{slot.name}</span>
      {you && <Chip tone="you">You</Chip>}
      {auto && <Chip tone="auto">Auto</Chip>}
    </span>
  );
}

/**
 * `MidweekMatchRow`: one pairing. A played match shows both sides with the
 * winner ticked and bold, penalties as "1 (5)", and a link to its report; a bye
 * is one dashed row; a pairing not revealed yet names who meet (or where they
 * come from) and when it comes out. Each is a group with one full sentence as
 * its label, so a screen reader hears the result, not the layout.
 */
export function MidweekMatchRow({
  pair,
  you,
  weekStart,
  revealAt,
  dense = false,
}: {
  pair: BracketPair;
  you: string | null;
  weekStart: string;
  revealAt: string;
  dense?: boolean;
}) {
  const sideSize = dense
    ? "min-h-[30px] px-2 py-[3px] pl-1.5 text-[13px]"
    : "min-h-[34px] py-1 pr-2.5 pl-2 text-sm";
  const isYou = pair.sides.some((side) => side.userId !== null && side.userId === you);

  if (pair.kind === "bye") {
    const [slot] = pair.sides;
    return (
      <div
        aria-label={matchSentence(pair.match)}
        className={`grid overflow-hidden rounded-xl border border-dashed bg-panel/35 ${isYou ? "border-brass-line" : "border-line/70"}`}
        role="group"
      >
        <div
          className={`${SIDE} ${sideSize} ${dense ? "" : "min-h-9"} font-black ${isYou ? "bg-brass/[9%] shadow-[inset_3px_0_0_var(--color-brass)]" : ""}`}
        >
          <span aria-hidden="true" className="text-center text-[11px] font-black text-moss">
            ✓
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-ink">{slot.name}</span>
            {isYou && <Chip tone="you">You</Chip>}
            <Chip>Bye</Chip>
          </span>
          <span />
        </div>
      </div>
    );
  }

  if (pair.kind === "hidden") {
    const time = formatClock(revealAt);
    return (
      <div
        aria-label={`${pair.sides[0].name} v ${pair.sides[1].name}, result revealed at ${time}`}
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-xl border border-dashed bg-board-deep/35 ${isYou && pair.known ? "border-brass-line" : "border-line/80"}`}
        role="group"
      >
        <div className="grid min-w-0">
          {pair.sides.map((slot, index) => (
            <div
              className={`${SIDE} ${sideSize} ${index > 0 ? SECOND : ""} font-semibold text-ink-dim ${slot.userId !== null && slot.userId === you ? "bg-brass/[9%] shadow-[inset_3px_0_0_var(--color-brass)]" : ""}`}
              key={index}
            >
              <span />
              <Who auto={false} slot={slot} you={slot.userId !== null && slot.userId === you} />
              <span />
            </div>
          ))}
        </div>
        <div className="grid place-items-center content-center border-l border-dashed border-line/80 px-3 text-center text-[11px] leading-tight font-extrabold text-ink-faint tabular-nums">
          <span>Reveals</span>
          <b className="text-[13px] text-ink-dim">{time}</b>
        </div>
      </div>
    );
  }

  const { match } = pair;
  return (
    <div
      aria-label={matchSentence(match)}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch overflow-hidden rounded-xl border bg-panel/85 ${isYou ? "border-brass-line" : "border-line/70"}`}
      role="group"
    >
      <div className="grid min-w-0">
        {pair.sides.map((slot, index) => {
          const side = index as 0 | 1;
          const won = match.winner_side === side;
          const score = sideScore(match, side);
          const mine = slot.userId === you;
          return (
            <div
              className={`${SIDE} ${sideSize} ${index > 0 ? SECOND : ""} ${won ? "font-black text-ink" : "font-semibold text-ink-faint"} ${mine ? "bg-brass/[9%] shadow-[inset_3px_0_0_var(--color-brass)]" : ""}`}
              key={index}
            >
              <span aria-hidden="true" className="text-center text-[11px] font-black text-moss">
                {won ? "✓" : ""}
              </span>
              <Who slot={slot} you={mine} />
              <span
                className={`min-w-[1.5ch] text-right tabular-nums ${won ? "font-black" : "font-bold"}`}
              >
                {score.goals}
                {score.penalties !== null && (
                  <small className="ml-[3px] text-[11px] font-extrabold text-ink-faint">
                    ({score.penalties})
                  </small>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <Link
        aria-label={`Match report: ${matchSentence(match)}`}
        className={`grid place-items-center border-l border-line/45 font-black text-brass hover:bg-brass/10 ${dense ? "w-[34px] text-[15px]" : "w-11 text-lg"}`}
        href={`/club/midweek/${weekStart}/match/${match.match_id}`}
      >
        <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
