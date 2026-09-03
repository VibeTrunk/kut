"use client";

import { useActionState, useRef, useState } from "react";
import { ECONOMY } from "@/game/economy";
import { proposeOffer, type OfferState } from "./actions";

export type OfferableCard = { card_id: string; display_name: string; ovr: number; rarity_tier: string };

const initialState: OfferState = { error: null };

/**
 * The coin-and-card offer builder.
 *
 * This used to expand inline inside a market grid tile, behind a "Make an offer"
 * button. Since the grid went to two columns on a phone (KB-006 / ADR-051) a tile
 * is ~160px wide — far too narrow for a coin input and a scrollable card list — so
 * offers moved to the listing detail page, where this is the whole point of the
 * screen. It therefore renders open: there is no collapsed state left to manage.
 */
export function ProposeOfferForm({
  listingId,
  askingPrice,
  offerableCards,
}: {
  listingId: string;
  askingPrice: number;
  offerableCards: OfferableCard[];
}) {
  const [coins, setCoins] = useState<number>(askingPrice);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const key = useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(proposeOffer, initialState);

  function action(data: FormData) {
    key.current ??= crypto.randomUUID();
    data.set("idempotencyKey", key.current);
    return formAction(data);
  }

  function toggle(cardId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else if (next.size < ECONOMY.tradeOfferMaxCards) next.add(cardId);
      return next;
    });
  }

  const nothingOffered = coins <= 0 && picked.size === 0;

  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-board/60 p-3 text-left">
      <input name="listingId" type="hidden" value={listingId} />
      {[...picked].map((cardId) => (
        <input key={cardId} name="cardId" type="hidden" value={cardId} />
      ))}

      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.12em] text-ink-faint" htmlFor={`offer-coins-${listingId}`}>
          KUT Coins
        </label>
        <input
          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-panel px-3 font-bold tabular-nums"
          id={`offer-coins-${listingId}`}
          min={0}
          name="offeredCoins"
          onChange={(event) => setCoins(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
          step={1}
          type="number"
          value={coins}
        />
      </div>

      {offerableCards.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            Add cards ({picked.size}/{ECONOMY.tradeOfferMaxCards})
          </legend>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {offerableCards.map((card) => {
              const checked = picked.has(card.card_id);
              return (
                <label
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                    checked ? "border-brass bg-brass/10" : "border-line"
                  }`}
                  key={card.card_id}
                >
                  <input
                    checked={checked}
                    className="accent-brass"
                    disabled={!checked && picked.size >= ECONOMY.tradeOfferMaxCards}
                    onChange={() => toggle(card.card_id)}
                    type="checkbox"
                  />
                  <span className="font-semibold">{card.display_name}</span>
                  <span className="ml-auto text-xs text-ink-faint capitalize">
                    {card.ovr} · {card.rarity_tier}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {state.error && <p className="rounded-lg bg-brick-bg p-2 text-xs text-brick">{state.error}</p>}

      <button
        className="min-h-11 w-full rounded-lg bg-brass px-3 text-sm font-black text-ink-on-accent disabled:bg-line disabled:text-ink-faint"
        disabled={pending || nothingOffered}
        type="submit"
      >
        {pending ? "Sending..." : "Send offer"}
      </button>
      <p className="text-[0.7rem] text-ink-faint">
        Coins and cards are held in escrow until the seller responds or the offer expires after{" "}
        {ECONOMY.tradeOfferExpiryHours}h.
      </p>
    </form>
  );
}
