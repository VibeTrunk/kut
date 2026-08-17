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
    if (!window.confirm(`Open ${title} for ${price} KUT Coins? You will receive ${cardsPerPack} tradeable Live Cards.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="rounded-3xl border border-brass/50 bg-gradient-to-br from-brass via-[#a3711d] to-[#4a2f08] p-[1px] shadow-xl shadow-brass/30" onSubmit={confirmOpen}>
      <div className="rounded-[calc(1.5rem-1px)] bg-board/95 p-5">
        <input name="packSlug" type="hidden" value={packSlug} />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">Pack store</p>
        <h2 className="mt-2 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-dim">Three server-selected, tradeable Live Cards. Duplicates can happen.</p>
        {state.error && <p className="mt-3 rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
        <button
          className="mt-5 min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-black text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
          disabled={isPending || !canAfford}
          type="submit"
        >
          {isPending ? "Opening..." : canAfford ? `Open for ${price} KUT Coins` : `Need ${price - balance} more KUT Coins`}
        </button>
        {!canAfford && <p className="mt-2 text-center text-xs font-semibold text-ink-faint">Earn coins by attending published sessions.</p>}
      </div>
    </form>
  );
}
