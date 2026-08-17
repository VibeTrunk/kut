"use client";

import { useActionState, useRef } from "react";
import { buyListing, type BuyState } from "./actions";

const initialState: BuyState = { error: null };
export function BuyListingForm({ listingId, price, canAfford }: { listingId: string; price: number; canAfford: boolean }) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(buyListing, initialState);
  function action(data: FormData) { key.current ??= crypto.randomUUID(); data.set("idempotencyKey", key.current); return formAction(data); }
  return <form action={action} className="mt-3"><input name="listingId" type="hidden" value={listingId} />
    {state.error && <p className="mb-2 rounded-xl bg-brick-bg p-2 text-xs text-brick">{state.error}</p>}
    <button className="min-h-11 w-full rounded-xl bg-brass px-3 font-black text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={pending || !canAfford} type="submit">{pending ? "Buying..." : canAfford ? `Buy for ${price} KUT Coins` : `Need ${price} KUT Coins`}</button>
  </form>;
}
