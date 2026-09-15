"use client";

import { useActionState, useState } from "react";
import { ECONOMY } from "@/game/economy";
import { createListing, type ListingState } from "./market-actions";

const initialState: ListingState = { error: null };

// ADR-072: the seller picks how long the listing runs. The options mirror the
// allow-list enforced by kut.create_listing; the server action re-validates, so
// this control is convenience, not security.
const DURATIONS = ECONOMY.listingDurationChoiceHours;

export function CreateListingForm({
  cardId,
  minimumPrice,
  maximumPrice,
}: {
  cardId: string;
  minimumPrice: number;
  maximumPrice: number;
}) {
  const [state, action, pending] = useActionState(createListing, initialState);
  const [durationHours, setDurationHours] = useState<number>(ECONOMY.listingDurationHours);
  return (
    <form action={action} className="rounded-2xl border border-steel-line/35 bg-steel-bg/20 p-4">
      <input name="cardId" type="hidden" value={cardId} />
      <p className="font-black text-steel">List on the market</p>
      <p className="mt-1 text-sm text-steel/80">
        Choose a buy-now price from {minimumPrice} to {maximumPrice} KUT Coins, and how long the
        listing should run. It locks this card until it sells, expires, or you cancel it.
      </p>
      <label className="mt-4 block text-sm font-bold" htmlFor="listing-price">
        Price
      </label>
      <input
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-board-deep/60 px-3 font-bold"
        defaultValue={minimumPrice}
        id="listing-price"
        max={maximumPrice}
        min={minimumPrice}
        name="price"
        required
        step="1"
        type="number"
      />
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">How long?</legend>
        <div className="mt-1 flex gap-2">
          {DURATIONS.map((hours) => (
            <label
              className={`min-h-11 flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center font-bold outline-offset-2 outline-brass has-[:focus-visible]:outline-2 ${
                durationHours === hours
                  ? "border-steel bg-steel text-ink-on-accent"
                  : "border-line bg-board-deep/60"
              }`}
              key={hours}
            >
              <input
                checked={durationHours === hours}
                className="sr-only"
                name="durationHours"
                onChange={() => setDurationHours(hours)}
                type="radio"
                value={hours}
              />
              {hours} hours
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && (
        <p className="mt-3 rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>
      )}
      <button
        className="mt-4 min-h-11 rounded-xl bg-steel px-4 font-black text-ink-on-accent disabled:bg-line disabled:text-ink-faint"
        disabled={pending}
        type="submit"
      >
        {pending ? "Listing..." : `Create ${durationHours}-hour listing`}
      </button>
    </form>
  );
}
