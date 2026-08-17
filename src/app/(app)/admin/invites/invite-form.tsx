"use client";

import { useActionState, useState } from "react";
import { createInvite, type CreateInviteState } from "./actions";

type Player = { id: string; display_name: string };

const initialState: CreateInviteState = {
  error: null,
  inviteUrl: null,
  playerName: null,
};

export function InviteForm({ players }: { players: Player[] }) {
  const [state, formAction, isPending] = useActionState(createInvite, initialState);
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
  }

  if (players.length === 0) {
    return <p className="rounded-xl bg-slate-900 p-4 text-slate-300">Every active player already has a linked account.</p>;
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <label className="block space-y-2">
          <span className="font-semibold">Player</span>
          <select className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-4" defaultValue="" name="playerId" required>
            <option disabled value="">Choose a player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>{player.display_name}</option>
            ))}
          </select>
        </label>
        {state.error && <p className="rounded-xl bg-rose-950 p-3 text-sm text-rose-200">{state.error}</p>}
        <button className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400" disabled={isPending} type="submit">
          {isPending ? "Creating invite…" : "Create one-time invite"}
        </button>
      </form>

      {state.inviteUrl && state.playerName && (
        <section className="space-y-3 rounded-2xl border border-emerald-400 bg-emerald-400/10 p-5">
          <h2 className="text-xl font-bold">Invite ready for {state.playerName}</h2>
          <p className="text-sm text-emerald-100">Copy and share this once. The token is not stored in readable form and cannot be shown again here.</p>
          <input aria-label="One-time invite link" className="min-h-12 w-full rounded-xl border border-emerald-300/50 bg-slate-950 px-3 text-sm" readOnly value={state.inviteUrl} />
          <button className="min-h-12 w-full rounded-xl bg-emerald-300 px-4 py-3 font-bold text-emerald-950" onClick={copyInvite} type="button">
            {copied ? "Copied" : "Copy invite link"}
          </button>
        </section>
      )}
    </div>
  );
}
