"use client";

import { useActionState, useRef } from "react";
import { IconCoin } from "@/components/icons";
import { buyListing, type BuyState } from "./actions";

const initialState: BuyState = { error: null };
export function BuyListingForm({ listingId, price, canAfford }: { listingId: string; price: number; canAfford: boolean }) {
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(buyListing, initialState);
  function action(data: FormData) { key.current ??= crypto.randomUUID(); data.set("idempotencyKey", key.current); return formAction(data); }
  // The market grid is two columns on a phone (KB-006), so this label has to fit a
  // ~160px button — "Buy for 1250 KUT Coins" does not. The coin glyph carries the
  // currency instead, and the full sentence stays in `aria-label` so a screen
  // reader still hears it whole.
  const label = canAfford ? `Buy for ${price} KUT Coins` : `Need ${price} KUT Coins`;
  return <form action={action}><input name="listingId" type="hidden" value={listingId} />
    {state.error && <p className="mb-2 rounded-xl bg-brick-bg p-2 text-xs text-brick">{state.error}</p>}
    <button aria-label={label} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brass px-3 text-sm font-black tabular-nums text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={pending || !canAfford} type="submit">{pending ? "Buying..." : <>{canAfford ? "Buy" : "Need"}<IconCoin aria-hidden="true" className="h-3.5 w-3.5" />{price.toLocaleString()}</>}</button>
  </form>;
}
