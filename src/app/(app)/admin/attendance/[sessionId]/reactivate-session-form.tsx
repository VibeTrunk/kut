"use client";

import { useActionState } from "react";
import { reactivateCancelledSession, type PublishAttendanceState } from "../actions";

const initialState: PublishAttendanceState = { error: null };

export function ReactivateSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, isPending] = useActionState(reactivateCancelledSession, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-moss-line bg-moss-bg/30 p-5">
      <input name="sessionId" type="hidden" value={sessionId} />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-moss">Reactivate this session</h2>
        <p className="text-sm leading-6 text-moss/85">Its current attendance will count again and Live Ratings will rebuild immediately.</p>
      </div>
      <label className="block space-y-2">
        <span className="font-semibold">Why should it count again?</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-moss-line bg-board-deep/60 p-3"
          maxLength={500}
          minLength={3}
          name="reactivationReason"
          placeholder="For example: the duplicate was resolved; this is the real session."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-moss px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Reactivating..." : "Reactivate session"}
      </button>
    </form>
  );
}
