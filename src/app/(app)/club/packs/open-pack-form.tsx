"use client";

import { useActionState, useRef } from "react";
import { openPack, type OpenPackState } from "./actions";

const initialState: OpenPackState = { error: null };

type OpenPackFormProps = {
  packSlug: string;
  title: string;
  price: number;
  cardsPerPack: number;
  balance: number;
  canAfford: boolean;
};

export function OpenPackForm({ packSlug, title, price, cardsPerPack, balance, canAfford }: OpenPackFormProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(openPack, initialState);

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  function confirmOpen(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Open ${title} for ${price} KUT Coins? You will receive ${cardsPerPack} Live Cards.`)) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={action}
      className="relative overflow-hidden rounded-3xl border border-brass/30 bg-[radial-gradient(120%_100%_at_12%_0%,#4a2f08_0%,#1c1509_46%,#100d08_100%)] p-8 shadow-xl shadow-black/40"
      onSubmit={confirmOpen}
    >
      {/* A single light source rather than a gradient border: the pack should
          feel lit from inside, the way an Elite card is. */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(224,172,74,0.2),transparent_70%)]" />
      <div className="relative">
        <input name="packSlug" type="hidden" value={packSlug} />
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-brass">Pack store</p>
        <h2 className="display mt-3 text-4xl">{title}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
          {cardsPerPack} server-selected Live Cards. Card selection is weighted by rarity, so the ladder still has a top. Duplicates can happen.
        </p>
        {state.error && <p className="mt-4 rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-sm font-bold text-brick">{state.error}</p>}
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            className="min-h-13 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-7 text-[0.95rem] font-black text-ink-on-accent shadow-lg shadow-brass/25 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-line disabled:text-ink-faint disabled:shadow-none"
            disabled={isPending || !canAfford}
            type="submit"
          >
            {isPending ? "Opening..." : canAfford ? `Open for ${price} KUT Coins` : `Need ${price - balance} more KUT Coins`}
          </button>
          <p className="text-xs font-bold text-ink-faint">
            {canAfford
              ? `${cardsPerPack} cards · leaves you ${(balance - price).toLocaleString()}`
              : "Earn coins by attending published sessions."}
          </p>
        </div>
      </div>
    </form>
  );
}
