"use client";

import { useActionState } from "react";
import { claimInvite, type ClaimInviteState } from "./actions";

const initialState: ClaimInviteState = { error: null };

export function ClaimInviteForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(claimInvite, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input name="token" type="hidden" value={token} />
      <label className="block space-y-2">
        <span className="font-semibold">Email</span>
        <input autoComplete="email" className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-4" name="email" required type="email" />
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Choose a password</span>
        <input autoComplete="new-password" className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 px-4" minLength={12} name="password" required type="password" />
      </label>
      <p className="text-sm text-slate-400">Use at least 12 characters. Your invite can only be claimed once.</p>
      {state.error && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{state.error}</p>}
      <button className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400" disabled={isPending} type="submit">
        {isPending ? "Creating account…" : "Create KUT account"}
      </button>
    </form>
  );
}
