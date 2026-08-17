"use client";

import { useActionState } from "react";
import { createListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };
export function CreateListingForm({ cardId, minimumPrice, maximumPrice }: { cardId: string; minimumPrice: number; maximumPrice: number }) {
  const [state, action, pending] = useActionState(createListing, initialState);
  return <form action={action} className="rounded-2xl border border-steel-line/35 bg-steel-bg/20 p-4">
    <input name="cardId" type="hidden" value={cardId} />
    <p className="font-black text-steel">List on the market</p>
    <p className="mt-1 text-sm text-steel/80">Choose a buy-now price from {minimumPrice} to {maximumPrice} KUT Coins. The listing lasts 24 hours and locks this card.</p>
    <label className="mt-4 block text-sm font-bold" htmlFor="listing-price">Price</label>
    <input className="mt-1 min-h-11 w-full rounded-xl border border-line bg-board px-3 font-bold" defaultValue={minimumPrice} id="listing-price" max={maximumPrice} min={minimumPrice} name="price" required step="1" type="number" />
    {state.error && <p className="mt-3 rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
    <button className="mt-4 min-h-11 rounded-xl bg-steel px-4 font-black text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={pending} type="submit">{pending ? "Listing..." : "Create 24-hour listing"}</button>
  </form>;
}
