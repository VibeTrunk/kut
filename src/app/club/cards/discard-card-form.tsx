"use client";

import { useActionState, useRef } from "react";
import { discardCard, type DiscardState } from "./actions";

const initialState: DiscardState = { error: null };

type DiscardCardFormProps = {
  cardId: string;
  discardValue: number;
};

export function DiscardCardForm({ cardId, discardValue }: DiscardCardFormProps) {
  const idempotencyKey = useRef<string | null>(null);
  const [state, formAction, isPending] = useActionState(discardCard, initialState);

  function action(formData: FormData) {
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", idempotencyKey.current);
    return formAction(formData);
  }

  function confirmDiscard(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(`Discard this card permanently for ${discardValue} KUT Coins? This cannot be undone.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="rounded-2xl border border-rose-500/35 bg-rose-950/20 p-4" onSubmit={confirmDiscard}>
      <input name="cardId" type="hidden" value={cardId} />
      <p className="font-black text-rose-100">Discard this card</p>
      <p className="mt-1 text-sm leading-6 text-rose-100/80">This permanently burns this card copy. Your wallet will receive the server-calculated value.</p>
      {state.error && <p className="mt-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{state.error}</p>}
      <button
        className="mt-4 min-h-11 rounded-xl bg-rose-500 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Discarding..." : `Discard for ${discardValue} KUT Coins`}
      </button>
    </form>
  );
}
