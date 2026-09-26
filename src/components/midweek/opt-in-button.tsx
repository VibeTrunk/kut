"use client";

import { useActionState } from "react";
import { setMidweekOptOut, type MidweekActionState } from "@/app/(app)/club/midweek/actions";

/** "Take part again": opting back in is one tap, with no confirmation. */
export function MidweekOptInButton() {
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    setMidweekOptOut,
    null,
  );
  return (
    <form action={formAction} className="contents">
      <input name="opt_out" type="hidden" value="false" />
      <button
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-[15px] font-black text-ink-on-accent shadow-lg shadow-brass/25 disabled:opacity-45"
        disabled={pending}
        type="submit"
      >
        {pending ? "Joining…" : "Take part again"}
      </button>
      {state?.ok === false && (
        <p className="basis-full text-sm font-bold text-brick" role="status">
          {state.error}
        </p>
      )}
    </form>
  );
}
