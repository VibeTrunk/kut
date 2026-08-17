"use client";

import { useActionState } from "react";
import { claimStarterPack, type StarterClaimState } from "@/app/(app)/starter-actions";

const initialState: StarterClaimState = { error: null };

export function StarterClaimForm() {
  const [state, formAction, isPending] = useActionState(claimStarterPack, initialState);

  return (
    <form action={formAction} className="rounded-2xl border border-amber-400 bg-amber-400/10 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Welcome to KUT</p>
      <h2 className="mt-2 text-2xl font-black">Claim your starter pack</h2>
      <p className="mt-2 leading-6 text-slate-200">Receive 250 KUT Coins and three distinct, untradeable Live Cards.</p>
      {state.error && <p className="mt-3 rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{state.error}</p>}
      <button
        className="mt-4 min-h-12 rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Claiming..." : "Claim starter pack"}
      </button>
    </form>
  );
}
