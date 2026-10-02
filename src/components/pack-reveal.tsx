"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  initialRevealState,
  packRevealReducer,
  type RevealAction,
  type RevealState,
} from "@/components/pack-reveal-state";

const RARITY_LABEL: Record<LiveCardPlayer["rarityTier"], string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

/**
 * One revealed copy. The copy's own id lives beside the card face, never in
 * it: `player.id` is the Player id the plaster cast hashes (ADR-085).
 */
export type RevealCard = {
  cardId: string;
  player: LiveCardPlayer;
  /** The summary's chip on the card face (ADR-114): "New · fills slot 14" or "×3 · discards for 63". */
  chip?: string | null;
};

type PackRevealProps = {
  cards: RevealCard[];
  title?: string;
  /** When set, each summary card links to `${cardHrefBase}${card.cardId}`. */
  cardHrefBase?: string;
  doneHref: string;
  doneLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** One line under the summary's heading: "2 new Players. Album 19 / 29." */
  summaryLine?: string;
};

export function PackReveal({
  cards,
  title,
  cardHrefBase,
  doneHref,
  doneLabel,
  secondaryHref,
  secondaryLabel,
  summaryLine,
}: PackRevealProps) {
  // Server + first client paint start mid-reveal; a reduced-motion client jumps
  // straight to the summary once mounted.
  const [state, dispatch] = useReducer(
    (s: RevealState, a: RevealAction) => packRevealReducer(s, a, cards.length),
    cards.length,
    (n) => initialRevealState(n, false),
  );

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) dispatch({ type: "skipAll" });
  }, []);

  if (state.phase === "summary") {
    return (
      <div className="pack-reveal">
        {title && (
          <p className="text-center text-sm font-black uppercase tracking-[0.25em] text-brass">
            {title}
          </p>
        )}
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight sm:text-4xl">
          Your new Live Cards
        </h1>
        {summaryLine && (
          <p className="mt-2 text-center text-sm font-bold text-ink-dim">{summaryLine}</p>
        )}
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-5">
          {cards.map((card, i) => {
            const href = cardHrefBase ? `${cardHrefBase}${card.cardId}` : null;
            const cardEl = (
              <LiveCard
                badge={card.chip ? <PackChip text={card.chip} /> : undefined}
                player={card.player}
              />
            );
            return (
              <div className="pack-reveal__summary-card" key={`${card.cardId}-${i}`}>
                {href ? (
                  <Link
                    className="block rounded-[1.25rem] outline-offset-4 outline-brass focus-visible:outline-2"
                    href={href}
                  >
                    {cardEl}
                  </Link>
                ) : (
                  cardEl
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            className="inline-flex min-h-12 items-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 font-black text-ink-on-accent hover:brightness-105"
            href={doneHref}
          >
            {doneLabel}
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              className="inline-flex min-h-12 items-center rounded-xl border border-brass px-5 font-black text-brass"
              href={secondaryHref}
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const card = cards[state.index].player;
  const total = cards.length;

  return (
    <div className="pack-reveal">
      <div className="flex items-center justify-between text-sm font-bold text-ink-faint">
        <span>
          Card {state.index + 1} of {total}
        </span>
        <button
          className="rounded-lg border border-line px-3 py-1 font-black text-ink-dim hover:text-ink"
          onClick={() => dispatch({ type: "skipAll" })}
          type="button"
        >
          Skip all
        </button>
      </div>

      <button
        aria-label="Reveal the next detail"
        className="pack-reveal__stage mt-2 w-full cursor-pointer rounded-3xl border border-brass/40 bg-[radial-gradient(circle_at_top,_#4a2f08,_#15130f_62%)]"
        onClick={() => dispatch({ type: "advance" })}
        type="button"
      >
        {state.step === 0 && (
          <div className="pack-reveal__focus text-center">
            <p className="pack-reveal__rarity inline-flex items-center gap-2 rounded-full bg-brass/15 px-4 py-2 text-lg font-black uppercase tracking-[0.2em] text-brass">
              {RARITY_LABEL[card.rarityTier]}
            </p>
            <p className="mt-3 text-sm text-ink-dim">Tap to reveal the rating</p>
          </div>
        )}

        {state.step === 1 && (
          <div className="pack-reveal__focus text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">
              {RARITY_LABEL[card.rarityTier]}
            </p>
            <p className="pack-reveal__ovr mt-2 text-7xl font-black text-ink">{card.liveOvr}</p>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-ink-faint">OVR</p>
            <p className="mt-3 text-sm text-ink-dim">Tap to reveal the player</p>
          </div>
        )}

        {state.step === 2 && (
          <div className="pack-reveal__focus w-full max-w-[240px]">
            <LiveCard player={card} />
            <p className="mt-3 text-center text-sm text-ink-dim">
              {state.index + 1 < total ? "Tap for the next card" : "Tap to see all three"}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}

/** A summary card's chip, riding the card face like the market's ownership chip (ADR-102). */
function PackChip({ text }: { text: string }) {
  return (
    <p className="max-w-full truncate rounded-full border border-ink/20 bg-board-deep/85 px-2.5 py-0.5 text-[0.7rem] font-black whitespace-nowrap text-ink tabular-nums shadow-[0_2px_6px_rgb(0_0_0/35%)] backdrop-blur-sm">
      {text}
    </p>
  );
}
