"use client";

import { useActionState } from "react";
import { manageRoster, type RosterActionState } from "./actions";

export type RosterRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  is_active: boolean;
  has_history: boolean;
};

export function RosterTable({ players }: { players: RosterRow[] }) {
  const [state, formAction, isPending] = useActionState<RosterActionState, FormData>(manageRoster, null);

  return (
    <div className="space-y-3">
      <h2 className="display text-2xl">Current roster ({players.length})</h2>
      {state && !state.ok && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
      {state?.ok && <p className="rounded-xl bg-moss-bg p-3 text-sm text-moss">{state.message}</p>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-black uppercase tracking-[0.1em] text-ink-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-3">Display name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Archetype</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className="border-b border-line/50 last:border-0" key={player.id}>
                <td className="px-4 py-3 font-semibold">{player.display_name}</td>
                <td className="px-4 py-3 text-ink-dim">{player.slug}</td>
                <td className="px-4 py-3 text-ink-dim">{player.archetype}</td>
                <td className="px-4 py-3 text-ink-dim">{player.is_active ? "y" : "n"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="toggle" />
                      <input name="player_id" type="hidden" value={player.id} />
                      <input name="is_active" type="hidden" value={player.is_active ? "false" : "true"} />
                      <button
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isPending}
                        type="submit"
                      >
                        {player.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                    <form
                      action={formAction}
                      onSubmit={(event) => {
                        if (!window.confirm(`Permanently delete ${player.display_name}? This cannot be undone.`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input name="intent" type="hidden" value="delete" />
                      <input name="player_id" type="hidden" value={player.id} />
                      <button
                        className="rounded-lg border border-brick-line/60 px-3 py-1.5 text-xs font-bold text-brick hover:bg-brick-bg disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isPending || player.has_history}
                        title={
                          player.has_history
                            ? "Has attendance or a linked account — deactivate instead"
                            : undefined
                        }
                        type="submit"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-faint">
        Deactivating hides a player from Live Ratings and pack pools but keeps their history and any cards people own — it
        is reversible. Delete is permanent and only goes through for a player with no attendance, account, invite, or
        owned cards.
      </p>
    </div>
  );
}
