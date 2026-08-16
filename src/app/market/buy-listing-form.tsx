"use client";

import { useActionState, useRef } from "react";
import { buyListing, type BuyState } from "./actions";

const initialState: BuyState = { error: null };
export function BuyListingForm({ listingId, price, canAfford }: { listingId: string; price: number; canAfford: boolean }) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(buyListing, initialState);
  function action(data: FormData) { key.current ??= crypto.randomUUID(); data.set("idempotencyKey", key.current); return formAction(data); }
  return <form action={action} className="mt-3"><input name="listingId" type="hidden" value={listingId} />
    {state.error && <p className="mb-2 rounded-xl bg-rose-950 p-2 text-xs text-rose-100">{state.error}</p>}
    <button className="min-h-11 w-full rounded-xl bg-amber-400 px-3 font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-400" disabled={pending || !canAfford} type="submit">{pending ? "Buying..." : canAfford ? `Buy for ${price} TF Coins` : `Need ${price} TF Coins`}</button>
  </form>;
}
