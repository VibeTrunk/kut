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
    <form action={action} className="rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-700 p-[1px] shadow-xl shadow-amber-950/30" onSubmit={confirmOpen}>
      <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/95 p-5">
        <input name="packSlug" type="hidden" value={packSlug} />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Pack store</p>
        <h2 className="mt-2 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Three server-selected, tradeable Live Cards. Duplicates can happen.</p>
        {state.error && <p className="mt-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{state.error}</p>}
        <button
          className="mt-5 min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={isPending || !canAfford}
          type="submit"
        >
          {isPending ? "Opening..." : canAfford ? `Open for ${price} KUT Coins` : `Need ${price - balance} more KUT Coins`}
        </button>
        {!canAfford && <p className="mt-2 text-center text-xs font-semibold text-slate-400">Earn coins by attending published sessions.</p>}
      </div>
    </form>
  );
}
