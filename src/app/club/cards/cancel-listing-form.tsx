"use client";

import { useActionState } from "react";
import { cancelListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };
export function CancelListingForm({ cardId, listingId, price }: { cardId: string; listingId: string; price: number }) {
  const [state, action, pending] = useActionState(cancelListing, initialState);
  return <form action={action} className="rounded-2xl border border-cyan-400/35 bg-cyan-950/20 p-4">
    <input name="cardId" type="hidden" value={cardId} /><input name="listingId" type="hidden" value={listingId} />
    <p className="font-black text-cyan-100">Listed for {price} TF Coins</p>
    <p className="mt-1 text-sm text-cyan-100/80">This card is locked while its 24-hour listing is active.</p>
    {state.error && <p className="mt-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{state.error}</p>}
    <button className="mt-4 min-h-11 rounded-xl border border-cyan-300 px-4 font-black text-cyan-100 disabled:border-slate-700 disabled:text-slate-400" disabled={pending} type="submit">{pending ? "Cancelling..." : "Cancel listing"}</button>
  </form>;
}
