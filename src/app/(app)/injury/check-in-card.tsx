"use client";

import { useActionState } from "react";
import { checkInInjury, type CheckInState } from "./actions";

/** Home's rehab check-in call to action (ADR-082), styled like the report CTA. */
export function InjuryCheckInCard({
  weekStart,
  weekLabel,
  stipend,
}: {
  weekStart: string;
  weekLabel: string;
  stipend: number;
}) {
  const [state, action, pending] = useActionState<CheckInState, FormData>(checkInInjury, null);

  if (state?.ok) {
    return (
      <p className="rounded-2xl border border-moss-line bg-moss-bg p-5 text-sm font-bold text-moss">
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="flex min-h-20 flex-wrap items-center justify-between gap-4 rounded-2xl border border-brass/50 bg-brass-bg/25 p-5"
    >
      <input name="week_start" type="hidden" value={weekStart} />
      <span className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wider text-brass">
          Rehab check-in → +{stipend} KUT Coins
        </span>
        <span className="display mt-1 block text-2xl">Keep your card protected</span>
        <span className="mt-1 block text-sm text-ink-dim">
          For the football week of {weekLabel}. Your card rating won&rsquo;t drop for a week you
          check in.
        </span>
        {state && !state.ok && (
          <span className="mt-2 block rounded-xl bg-brick-bg p-3 text-sm text-brick">
            {state.error}
          </span>
        )}
      </span>
      <button
        className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 font-black text-ink-on-accent hover:brightness-105 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Checking in…" : "Check in"}
      </button>
    </form>
  );
}
