"use client";

import { useActionState } from "react";
import { saveClubName, type SettingsActionState } from "./actions";

function Feedback({ state }: { state: SettingsActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-xl bg-moss-bg p-3 text-sm font-bold text-moss">{state.message}</p>
  ) : (
    <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>
  );
}

export function ClubNameForm({ currentName, defaultName }: { currentName: string | null; defaultName: string }) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(saveClubName, null);

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-2">
        <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Club name</span>
        <input
          className="min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-ink"
          defaultValue={currentName ?? ""}
          maxLength={80}
          name="club_name"
          placeholder={defaultName}
          type="text"
        />
      </label>
      <p className="text-sm text-ink-faint">
        Shown on the Club Value leaderboard. Leave blank to use{" "}
        <span className="font-bold text-ink-dim">{defaultName}</span>.
      </p>
      <Feedback state={state} />
      <button
        className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 font-black text-ink-on-accent hover:brightness-105 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save club name"}
      </button>
    </form>
  );
}
