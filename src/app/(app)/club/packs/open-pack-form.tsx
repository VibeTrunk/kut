"use client";

import { useActionState, useRef, useState } from "react";
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
  const [confirming, setConfirming] = useState(false);
  const quotedPrice = state.priceChanged && state.currentPrice ? state.currentPrice : price;

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  const affordable = canAfford && balance >= quotedPrice;

  return (
    <form action={action} className="relative overflow-hidden rounded-3xl border border-brass/30 bg-[radial-gradient(120%_100%_at_12%_0%,#4a2f08_0%,#1c1509_46%,#100d08_100%)] p-8 shadow-xl shadow-black/40">
      <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(224,172,74,0.2),transparent_70%)]" />
      <div className="relative">
        <input name="packSlug" type="hidden" value={packSlug} />
        <input name="expectedPrice" type="hidden" value={quotedPrice} />
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-brass">Pack store</p>
        <h2 className="display mt-3 text-4xl">{title}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
          {cardsPerPack} server-selected Live Cards. Card selection is weighted by rarity, so the ladder still has a top. Duplicates can happen.
        </p>
        {state.error && <p className="mt-4 rounded-xl border border-brick-line/40 bg-brick-bg p-3 text-sm font-bold text-brick">{state.error}</p>}
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button className="min-h-13 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-7 text-[0.95rem] font-black text-ink-on-accent shadow-lg shadow-brass/25 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-none disabled:bg-line disabled:text-ink-faint disabled:shadow-none" disabled={isPending || !affordable} onClick={() => setConfirming(true)} type="button">
            {isPending ? "Opening…" : affordable ? `Open for ${quotedPrice} KUT Coins` : `Need ${quotedPrice - balance} more KUT Coins`}
          </button>
          <p className="text-xs font-bold text-ink-faint">
            {affordable ? `${cardsPerPack} cards · leaves you ${(balance - quotedPrice).toLocaleString()}` : "Earn coins by attending published sessions."}
          </p>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-board-deep/80 backdrop-blur-sm sm:place-items-center sm:p-6" role="presentation">
          <section aria-labelledby={`confirm-${packSlug}`} aria-modal="true" className="w-full rounded-t-3xl border border-line bg-panel p-6 shadow-2xl sm:max-w-md sm:rounded-3xl" role="dialog">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-brass">{state.priceChanged ? "Price updated" : "Confirm pack"}</p>
            <h3 className="display mt-2 text-3xl" id={`confirm-${packSlug}`}>{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">
              Spend <strong className="text-ink">{quotedPrice} KUT Coins</strong> for {cardsPerPack} server-selected Live Cards? Duplicates can happen.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="min-h-12 rounded-xl border border-line bg-panel-soft px-4 font-extrabold" onClick={() => setConfirming(false)} type="button">Not now</button>
              <button className="min-h-12 rounded-xl bg-brass px-4 font-black text-ink-on-accent disabled:opacity-60" disabled={isPending || balance < quotedPrice} onClick={() => { if (state.priceChanged) idempotencyKey.current = null; }} type="submit">
                {isPending ? "Opening…" : `Pay ${quotedPrice}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
