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
    return <p className="rounded-xl bg-panel p-4 text-ink-dim">Every active player already has a linked account.</p>;
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <label className="block space-y-2">
          <span className="font-semibold">Player</span>
          <select className="min-h-12 w-full rounded-xl border border-line bg-board px-4" defaultValue="" name="playerId" required>
            <option disabled value="">Choose a player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>{player.display_name}</option>
            ))}
          </select>
        </label>
        {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
        <button className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={isPending} type="submit">
          {isPending ? "Creating invite…" : "Create one-time invite"}
        </button>
      </form>

      {state.inviteUrl && state.playerName && (
        <section className="space-y-3 rounded-2xl border border-moss-line bg-moss-line/10 p-5">
          <h2 className="text-xl font-bold">Invite ready for {state.playerName}</h2>
          <p className="text-sm text-moss">Copy and share this once. The token is not stored in readable form and cannot be shown again here.</p>
          <input aria-label="One-time invite link" className="min-h-12 w-full rounded-xl border border-moss/50 bg-board px-3 text-sm" readOnly value={state.inviteUrl} />
          <button className="min-h-12 w-full rounded-xl bg-moss px-4 py-3 font-bold text-ink-on-accent" onClick={copyInvite} type="button">
            {copied ? "Copied" : "Copy invite link"}
          </button>
        </section>
      )}
    </div>
  );
}
