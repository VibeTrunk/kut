"use client";

import { useActionState } from "react";
import { formatDate } from "@/lib/format";
import { cancelListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };
export function CancelListingForm({
  cardId,
  listingId,
  price,
  expiresAt,
}: {
  cardId: string;
  listingId: string;
  price: number;
  // ADR-072: listings no longer all run 24 hours, so the real expiry is shown
  // rather than a fixed figure in the copy.
  expiresAt: string | null;
}) {
  const [state, action, pending] = useActionState(cancelListing, initialState);
  return (
    <form action={action} className="rounded-2xl border border-steel-line/35 bg-steel-bg/20 p-4">
      <input name="cardId" type="hidden" value={cardId} />
      <input name="listingId" type="hidden" value={listingId} />
      <p className="font-black text-steel">Listed for {price} KUT Coins</p>
      <p className="mt-1 text-sm text-steel/80">
        This card is locked while the listing is active
        {expiresAt ? `, until ${formatDate(expiresAt)}` : ""}.
      </p>
      {state.error && (
        <p className="mt-3 rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>
      )}
      <button
        className="mt-4 min-h-11 rounded-xl border border-steel px-4 font-black text-steel disabled:border-line disabled:text-ink-faint"
        disabled={pending}
        type="submit"
      >
        {pending ? "Cancelling..." : "Cancel listing"}
      </button>
    </form>
  );
}
