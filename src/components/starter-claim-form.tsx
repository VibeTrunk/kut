"use client";

import { useActionState } from "react";
import { claimStarterPack, type StarterClaimState } from "@/app/(app)/starter-actions";

const initialState: StarterClaimState = { error: null };

export function StarterClaimForm() {
  const [state, formAction, isPending] = useActionState(claimStarterPack, initialState);

  return (
    <form action={formAction} className="rounded-2xl border border-brass bg-brass/10 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brass">Welcome to KUT</p>
      <h2 className="mt-2 text-2xl font-black">Claim your starter pack</h2>
      <p className="mt-2 leading-6 text-ink-dim">Receive 250 KUT Coins and three distinct, untradeable Live Cards.</p>
      {state.error && <p className="mt-3 rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      <button
        className="mt-4 min-h-12 rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Claiming..." : "Claim starter pack"}
      </button>
    </form>
  );
}
