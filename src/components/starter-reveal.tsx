"use client";

import { useState, useTransition } from "react";
import { markStarterOpened } from "@/app/welcome/actions";
import { type LiveCardPlayer } from "@/components/live-card";
import { PackReveal } from "@/components/pack-reveal";

export function StarterReveal({ cards }: { cards: LiveCardPlayer[] }) {
  const [phase, setPhase] = useState<"sealed" | "revealing">("sealed");
  const [revealCards, setRevealCards] = useState<LiveCardPlayer[]>(cards);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await markStarterOpened();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRevealCards(result.players.length > 0 ? result.players : cards);
      setPhase("revealing");
    });
  }

  if (phase === "revealing") {
    return <PackReveal cards={revealCards} doneHref="/" doneLabel="Enter KUT" title="Your starter pack" />;
  }

  return (
    <div className="pack-reveal space-y-5 text-center">
      <div className="pack-reveal__stage rounded-3xl border border-brass/40 bg-[radial-gradient(circle_at_top,_#4a2f08,_#15130f_62%)]">
        <div className="pack-reveal__seal">
          <p className="text-6xl">&#127890;</p>
          <p className="mt-3 text-sm font-black uppercase tracking-[0.25em] text-brass">Sealed starter pack</p>
        </div>
      </div>
      <p className="mx-auto max-w-md leading-7 text-ink-dim">
        250 KUT Coins and three Live Cards are already yours &mdash; open the pack to meet them.
      </p>
      {error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{error}</p>}
      <button
        className="min-h-12 rounded-xl bg-brass px-6 py-3 font-black text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        disabled={pending}
        onClick={open}
        type="button"
      >
        {pending ? "Opening…" : "Open your starter pack"}
      </button>
    </div>
  );
}
