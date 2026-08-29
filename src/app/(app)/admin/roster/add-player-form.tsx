"use client";

import { useActionState, useState } from "react";
import { ARCHETYPES, ARCHETYPE_LABELS } from "@/game/archetypes";
import { addPlayer, type AddPlayerState } from "./actions";

export function AddPlayerForm({ existingNames }: { existingNames: string[] }) {
  const [state, formAction, isPending] = useActionState(addPlayer, null);
  const [name, setName] = useState("");

  // Reset the inputs once per successful add, during render (not in an effect)
  // as React recommends for "adjust state when a prop/result changes".
  const [handledSuccess, setHandledSuccess] = useState<AddPlayerState>(null);
  const [formKey, setFormKey] = useState(0);
  if (state?.ok && state !== handledSuccess) {
    setHandledSuccess(state);
    setName("");
    setFormKey((key) => key + 1);
  }

  const duplicate = name.trim().length > 0 && existingNames.includes(name.trim().toLowerCase());

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5" key={formKey}>
        <label className="block space-y-2">
          <span className="font-semibold">Display name</span>
          <input
            className="min-h-12 w-full rounded-xl border border-line bg-board px-4"
            maxLength={80}
            name="display_name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        {duplicate && (
          <p className="rounded-xl bg-warning-bg p-3 text-sm text-warning">
            A player called “{name.trim()}” already exists — add a distinguishing name (e.g. “Nick B”) if this is a
            different person.
          </p>
        )}
        <label className="block space-y-2">
          <span className="font-semibold">Archetype</span>
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-board px-4"
            defaultValue="all_rounder"
            name="archetype"
          >
            {ARCHETYPES.map((value) => (
              <option key={value} value={value}>
                {ARCHETYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="font-semibold">Full name</span>
          <input className="min-h-12 w-full rounded-xl border border-line bg-board px-4" maxLength={120} name="full_name" />
          <span className="block text-sm text-ink-faint">Optional. Kept for admin reference only.</span>
        </label>
        {state && !state.ok && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
        {state?.ok && (
          <p className="rounded-xl bg-moss-bg p-3 text-sm text-moss">
            Added {state.player.display_name} (slug: {state.player.slug})
          </p>
        )}
        <button
          className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Adding player…" : "Add player"}
        </button>
      </form>
    </div>
  );
}
