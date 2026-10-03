"use client";

import { useState, type ReactNode } from "react";
import { saveMidweekCall } from "@/app/(app)/midweek/actions";
import {
  callError,
  callsHeading,
  settledStatus,
  type CallCard,
  type CallSide,
} from "@/lib/midweek/calls";
import { formatClock } from "@/lib/midweek/entry";
import { LiveMarker } from "./chip";

/** The foot under the block (HANDOFF "Copy", Calls). */
export const CALLS_FOOT =
  "You’re out, so you can call the winners of the matches still to come. A match opens once both matches before it have ended, and closes at its kick-off. Your picks are yours: from kick-off everyone sees how the club split, never who picked whom.";

/**
 * `MidweekPredictSplit`: how the club called a match, from its kick-off.
 * Counts only, in neutral steel and faint ink; with no picks at all, a line
 * instead of a bar.
 */
export function MidweekPredictSplit({
  split,
  sides,
}: {
  split: readonly [number, number];
  sides: readonly [CallSide, CallSide];
}) {
  const [a, b] = split;
  if (a + b === 0) return <p className="text-[13px] text-ink-faint">Nobody called this one.</p>;
  const left = Math.round((a / (a + b)) * 100);
  return (
    <div className="grid gap-1">
      <p className="text-[10.5px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
        How the club called it
      </p>
      <svg
        aria-label={`${a} picked ${sides[0].name}, ${b} picked ${sides[1].name}`}
        className="block h-2 w-full overflow-hidden rounded"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 8"
      >
        {a > 0 && (
          <rect className="fill-steel" height="8" width={Math.max(0, left - (b > 0 ? 0.6 : 0))} />
        )}
        {b > 0 && (
          <rect
            className="fill-ink-faint"
            height="8"
            width={Math.max(0, 100 - left - (a > 0 ? 0.6 : 0))}
            x={Math.min(100, left + (a > 0 ? 0.6 : 0))}
          />
        )}
      </svg>
      <p aria-hidden="true" className="flex justify-between gap-2.5 text-[13px] text-ink-dim">
        <span>
          {sides[0].name} <b className="text-ink tabular-nums">{a}</b>
        </span>
        <span>
          <b className="text-ink tabular-nums">{b}</b> {sides[1].name}
        </span>
      </p>
    </div>
  );
}

/** What the card says after the member's own tap; null shows the state the page rendered. */
type Tap =
  | { kind: "saving"; side: 0 | 1 }
  | { kind: "saved"; at: string }
  | { kind: "changed"; at: string }
  | { kind: "cleared" }
  | null;

const OK = "text-moss";

/**
 * `MidweekPredictCard` (DR3 HANDOFF §2): one later match the member is not in.
 * Two toggle buttons, not radios, so a pick can be cleared (DR3-5): a tap
 * saves at once, tapping the other name changes it, tapping your pick again
 * clears it. No submit. Neutral, because a list of matches gets no team
 * colours (DR2-1).
 */
function MidweekPredictCard({
  card,
  tournamentId,
  coins,
  paid,
}: {
  card: CallCard;
  tournamentId: string;
  coins: number;
  paid: boolean;
}) {
  const [pick, setPick] = useState(card.pick);
  const [serverPick, setServerPick] = useState(card.pick);
  const [tap, setTap] = useState<Tap>(null);
  const [error, setError] = useState<string | null>(null);
  // A newer render from the server (the page polls while a match is in play)
  // wins over a stale local pick, unless a save is on its way.
  if (card.pick !== serverPick) {
    setServerPick(card.pick);
    if (tap?.kind !== "saving") {
      setPick(card.pick);
      setTap(null);
    }
  }

  const kickoff = formatClock(card.kickoffAt);
  const legend = `${card.label} · kick-off ${kickoff}`;
  const name = (side: 0 | 1) => card.sides[side].name;

  if (card.state === "notyet") {
    return (
      <li className="grid gap-1.5 rounded-[14px] border border-dashed border-line/60 p-3">
        <p className="text-[10.5px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          {legend}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
          {[0, 1].map((side) => (
            <span
              className={`flex min-h-11 items-center rounded-xl border-[1.5px] border-dashed border-line px-2.5 py-2 text-[13px] font-bold [overflow-wrap:anywhere] text-ink-faint ${side === 1 ? "col-start-3" : ""}`}
              key={side}
            >
              {name(side as 0 | 1)}
            </span>
          ))}
          <span
            aria-hidden="true"
            className="col-start-2 row-start-1 self-center font-serif text-lg text-ink-faint"
          >
            v
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-[13px] text-ink-dim">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full border-[1.5px] border-dashed border-ink-faint"
          />
          {settledStatus(card, paid, coins)}
        </p>
      </li>
    );
  }

  const closed = card.state === "closed" || card.state === "ended";
  const saving = tap?.kind === "saving";
  const shownPick = saving ? tap.side : pick;

  async function choose(side: 0 | 1) {
    if (closed || saving) return;
    const target = pick === side ? null : side;
    const previous = pick;
    setTap({ kind: "saving", side });
    setError(null);
    let result: Awaited<ReturnType<typeof saveMidweekCall>>;
    try {
      result = await saveMidweekCall(
        tournamentId,
        card.round,
        card.pairing,
        target === null ? null : card.sides[target].userId,
      );
    } catch {
      result = { ok: false, message: null };
    }
    if (result.ok) {
      setPick(target);
      setTap(
        target === null
          ? { kind: "cleared" }
          : previous === null
            ? { kind: "saved", at: result.savedAt }
            : { kind: "changed", at: result.savedAt },
      );
    } else {
      setTap(null);
      setError(
        callError(result.message, card.kickoffAt, previous === null ? null : name(previous)),
      );
    }
  }

  let status: ReactNode;
  if (tap?.kind === "saving") status = "Saving your pick…";
  else if (tap?.kind === "cleared")
    status = `Pick cleared. Tap a name to call it. Closes at kick-off, ${kickoff}.`;
  else if ((tap?.kind === "saved" || tap?.kind === "changed") && pick !== null)
    status = (
      <>
        <span className={OK}>
          ✓ {tap.kind === "saved" ? "Saved" : `Changed to ${name(pick)},`} {formatClock(tap.at)}.
        </span>{" "}
        Change it until kick-off, {kickoff}; tap {name(pick)} again to clear it.
      </>
    );
  else if (card.state === "ended" && card.pick !== null)
    status =
      card.pick === card.winner ? (
        <>
          <Called>✓ You called it</Called> {name(card.winner)} won. +{coins} KUT Coins
          {paid ? "" : " after the final"}.
        </>
      ) : (
        <>
          <span className="mr-1.5 inline-flex rounded-full border border-line px-2 text-[11px] font-black tracking-[0.06em] text-ink-dim uppercase">
            Not this time
          </span>{" "}
          {name(card.winner ?? 0)} won.
        </>
      );
  else status = settledStatus({ ...card, pick }, paid, coins);

  return (
    <li
      className={`rounded-[14px] border border-line/60 p-3 ${closed ? "bg-panel/35" : "bg-panel/55"}`}
    >
      <div
        aria-busy={saving || undefined}
        aria-label={`${card.label}, kick-off ${kickoff}. Who wins?`}
        className="grid min-w-0 gap-2.5"
        role="group"
      >
        <div
          aria-hidden="true"
          className="flex items-center justify-between gap-2 text-[10.5px] font-extrabold tracking-[0.14em] text-ink-faint uppercase"
        >
          <span>{legend}</span>
          {card.live ? (
            <LiveMarker>Live</LiveMarker>
          ) : card.state === "ended" ? (
            <span className="tracking-[0.1em]">Full time</span>
          ) : closed ? (
            <span className="tracking-[0.1em]">Closed</span>
          ) : (
            <span className="rounded-full border border-brass-line bg-brass-bg px-2 py-px tracking-[0.04em] text-brass">
              +{coins}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
          {([0, 1] as const).map((side) => {
            const mine = shownPick === side;
            const busy = saving && tap.side === side;
            const won = card.state === "ended" && card.winner === side;
            return (
              <button
                aria-pressed={mine}
                className={`grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-default ${side === 1 ? "col-start-3" : ""} ${
                  mine
                    ? "border-brass bg-[rgb(43_31_10/50%)]"
                    : closed
                      ? "border-line/60 bg-board-deep/45"
                      : "border-line bg-board-deep/45"
                } ${saving && !busy ? "opacity-55" : ""}`}
                disabled={closed || saving}
                key={side}
                onClick={() => choose(side)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`row-span-3 grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-xs font-black ${
                    busy
                      ? "border-dashed border-brass text-brass"
                      : mine
                        ? "border-brass bg-brass text-ink-on-accent"
                        : "border-ink-faint"
                  }`}
                >
                  {mine && !busy ? "✓" : ""}
                </span>
                <span className="text-[15px] leading-[1.2] font-extrabold [overflow-wrap:anywhere] text-ink">
                  {name(side)}
                </span>
                {busy ? (
                  <span className="text-[10px] font-black tracking-[0.1em] text-brass uppercase">
                    Saving…
                  </span>
                ) : mine ? (
                  <span className="text-[10px] font-black tracking-[0.1em] text-brass uppercase">
                    Your pick
                  </span>
                ) : null}
                {won && (
                  <span className="text-[10px] font-black tracking-[0.1em] text-moss uppercase">
                    ✓ Won
                  </span>
                )}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="col-start-2 row-start-1 self-center font-serif text-lg text-ink-faint"
          >
            v
          </span>
        </div>
        {card.split && <MidweekPredictSplit sides={card.sides} split={card.split} />}
        <p aria-live="polite" className="text-[13px] leading-[1.45] text-ink-dim">
          {status}
        </p>
        {error && (
          <p className="text-[13px] text-brick" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function Called({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 inline-flex rounded-full border border-moss-line bg-moss-bg px-2 text-[11px] font-black tracking-[0.06em] text-moss uppercase">
      {children}
    </span>
  );
}

/**
 * `MidweekPredictions` (DR3 HANDOFF §2, ADR-118): on `/midweek` from the moment
 * the member is out. `Call the winners`, or `Your calls` once nothing is left
 * to call, then one card per later match.
 */
export function MidweekPredictions({
  cards,
  tournamentId,
  rounds,
  coins,
  paid = false,
  foot = true,
}: {
  cards: readonly CallCard[];
  tournamentId: string;
  rounds: number;
  coins: number;
  paid?: boolean;
  foot?: boolean;
}) {
  const { title, note } = callsHeading(cards, rounds, paid);
  return (
    <section
      aria-labelledby="calls-h"
      className="grid scroll-mt-24 content-start gap-3.5"
      id="calls"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display text-3xl" id="calls-h">
          {title}
        </h2>
        <p className="text-[13px] text-ink-faint">{note}</p>
      </div>
      <ol className="grid gap-2.5">
        {cards.map((card) => (
          <MidweekPredictCard
            card={card}
            coins={coins}
            key={`${card.round}/${card.pairing}`}
            paid={paid}
            tournamentId={tournamentId}
          />
        ))}
      </ol>
      {foot && <p className="text-[12.5px] leading-normal text-ink-faint">{CALLS_FOOT}</p>}
    </section>
  );
}
