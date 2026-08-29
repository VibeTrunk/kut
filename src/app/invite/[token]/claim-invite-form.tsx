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
        <span className="font-semibold">Choose a username</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="min-h-12 w-full rounded-xl border border-line bg-board px-4"
          maxLength={30}
          minLength={3}
          name="username"
          pattern="[A-Za-z0-9_]{3,30}"
          required
          spellCheck={false}
          type="text"
        />
      </label>
      <label className="block space-y-2">
        <span className="font-semibold">Choose a password</span>
        <input autoComplete="new-password" className="min-h-12 w-full rounded-xl border border-line bg-board px-4" minLength={12} name="password" required type="password" />
      </label>
      <p className="text-sm text-ink-faint">
        Username: 3–30 letters, numbers, or underscores — you&rsquo;ll sign in with it. Password: at least 12
        characters. Your invite can only be claimed once.
      </p>
      {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      <button className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={isPending} type="submit">
        {isPending ? "Creating account…" : "Create KUT account"}
      </button>
    </form>
  );
}
