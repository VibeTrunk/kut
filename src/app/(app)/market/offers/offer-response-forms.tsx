"use client";

import { useActionState, useRef } from "react";
import { respondToOffer, withdrawOffer, type OfferState } from "../actions";

const initialState: OfferState = { error: null };

function RespondButton({ offerId, accept, label }: { offerId: string; accept: boolean; label: string }) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(respondToOffer, initialState);

  function action(data: FormData) {
    key.current ??= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    data.set("accept", String(accept));
    return formAction(data);
  }

  return (
    <form action={action} className={accept ? "flex-1" : undefined}>
      <input name="offerId" type="hidden" value={offerId} />
      {state.error && <p className="mb-2 rounded-lg bg-brick-bg p-2 text-xs text-brick">{state.error}</p>}
      <button
        className={
          accept
            ? "min-h-11 w-full rounded-lg bg-brass px-3 text-sm font-black text-ink-on-accent disabled:bg-line disabled:text-ink-faint"
            : "min-h-11 rounded-lg border border-line px-3 text-sm font-bold text-ink-dim disabled:opacity-50"
        }
        disabled={pending}
        type="submit"
      >
        {pending ? "Working..." : label}
      </button>
    </form>
  );
}

export function RespondToOfferForms({ offerId }: { offerId: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <RespondButton accept label="Accept" offerId={offerId} />
      <RespondButton accept={false} label="Decline" offerId={offerId} />
    </div>
  );
}

export function WithdrawOfferForm({ offerId }: { offerId: string }) {
  const [state, formAction, pending] = useActionState(withdrawOffer, initialState);
  return (
    <form action={formAction} className="mt-3">
      <input name="offerId" type="hidden" value={offerId} />
      {state.error && <p className="mb-2 rounded-lg bg-brick-bg p-2 text-xs text-brick">{state.error}</p>}
      <button
        className="min-h-11 rounded-lg border border-line px-3 text-sm font-bold text-ink-dim disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Withdrawing..." : "Withdraw offer"}
      </button>
    </form>
  );
}
