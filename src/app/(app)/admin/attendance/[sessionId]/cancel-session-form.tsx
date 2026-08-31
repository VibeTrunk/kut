"use client";

import { useActionState } from "react";
import { cancelPublishedSession, type PublishAttendanceState } from "../actions";

const initialState: PublishAttendanceState = { error: null };

export function CancelSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, isPending] = useActionState(cancelPublishedSession, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-brick-line bg-brick-bg/30 p-5">
      <input name="sessionId" type="hidden" value={sessionId} />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-brick">Cancel this published session</h2>
        <p className="text-sm leading-6 text-brick/85">It will stay in the audit trail, but its attendance will no longer affect Live Ratings.</p>
      </div>
      <label className="block space-y-2">
        <span className="font-semibold">Why is it being cancelled?</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-brick-line bg-board-deep/60 p-3"
          maxLength={500}
          minLength={3}
          name="cancellationReason"
          placeholder="For example: duplicate session created by mistake."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-brick px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Cancelling..." : "Cancel published session"}
      </button>
    </form>
  );
}
