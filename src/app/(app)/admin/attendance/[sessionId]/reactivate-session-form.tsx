"use client";

import { useActionState } from "react";
import { reactivateCancelledSession, type PublishAttendanceState } from "../actions";

const initialState: PublishAttendanceState = { error: null };

export function ReactivateSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, isPending] = useActionState(reactivateCancelledSession, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5">
      <input name="sessionId" type="hidden" value={sessionId} />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-emerald-100">Reactivate this session</h2>
        <p className="text-sm leading-6 text-emerald-100/85">Its current attendance will count again and Live Ratings will rebuild immediately.</p>
      </div>
      <label className="block space-y-2">
        <span className="font-semibold">Why should it count again?</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-emerald-800 bg-slate-950 p-3"
          maxLength={500}
          minLength={3}
          name="reactivationReason"
          placeholder="For example: the duplicate was resolved; this is the real session."
          required
        />
      </label>
      {state.error && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-100">{state.error}</p>}
      <button
        className="min-h-12 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Reactivating..." : "Reactivate session"}
      </button>
    </form>
  );
}
