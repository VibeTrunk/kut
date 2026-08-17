"use client";

import { useActionState } from "react";
import { cancelPublishedSession, type PublishAttendanceState } from "../actions";

const initialState: PublishAttendanceState = { error: null };

export function CancelSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, isPending] = useActionState(cancelPublishedSession, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-rose-800 bg-rose-950/30 p-5">
      <input name="sessionId" type="hidden" value={sessionId} />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-rose-100">Cancel this published session</h2>
        <p className="text-sm leading-6 text-rose-100/85">It will stay in the audit trail, but its attendance will no longer affect Live Ratings.</p>
      </div>
      <label className="block space-y-2">
        <span className="font-semibold">Why is it being cancelled?</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-rose-800 bg-slate-950 p-3"
          maxLength={500}
          minLength={3}
          name="cancellationReason"
          placeholder="For example: duplicate session created by mistake."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{state.error}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-rose-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Cancelling..." : "Cancel published session"}
      </button>
    </form>
  );
}
