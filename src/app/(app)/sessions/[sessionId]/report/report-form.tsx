"use client";

import { startTransition, useActionState, useState } from "react";
import {
  SKIP,
  UNDECIDED,
  duplicateNominees,
  seedBallot,
  undecidedCategories,
  type Ballot,
} from "@/lib/session-reports/kudos-ballot";
import { saveSessionReport, type ReportState } from "./actions";

type Category = { id: string; title: string; description: string };
type Attendee = { player_id: string; display_name: string };
const initial: ReportState = { error: null };

export function ReportForm({
  sessionId,
  playerId,
  categories,
  attendees,
  goals: initialGoals,
  revision,
  rewardReceived,
  savedNominations,
  explicitSkips,
}: {
  sessionId: string;
  playerId: string;
  categories: Category[];
  attendees: Attendee[];
  goals: number | null;
  revision: number;
  rewardReceived: boolean;
  savedNominations: Record<string, string>;
  explicitSkips: string[];
}) {
  const categoryIds = categories.map((category) => category.id);
  const [goals, setGoals] = useState(initialGoals === null ? "" : String(initialGoals));
  // Every field is React-controlled on purpose. A <form action={fn}> is reset by
  // React once the action settles, and a reset restores each control to the
  // default it was *mounted* with — React never re-applies a changed
  // `defaultValue` to a <select>. Uncontrolled kudos selects therefore snapped
  // back to their opening option on every save (ADR-068 / KB-015).
  const [ballot, setBallot] = useState<Ballot>(() =>
    seedBallot(categoryIds, savedNominations, explicitSkips),
  );
  const [state, action, pending] = useActionState(saveSessionReport, initial);
  const effectiveRevision = state.revision ?? revision;
  // Dispatched from onSubmit rather than through `action={...}`, because React
  // resets a form with a function action once that action settles. A reset
  // restores every control to its mount-time default, and while React re-syncs
  // a controlled <input> past that (it keeps the element's defaultValue equal
  // to the current value) it does not do the same for a <select> — so the
  // kudos picks were wiped on every save even once controlled.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    formData.set("idempotencyKey", crypto.randomUUID());
    startTransition(() => action(formData));
  }
  const highGoals = /^\d+$/.test(goals) && Number(goals) >= 10;
  const undecided = undecidedCategories(categoryIds, ballot);
  const duplicates = new Set(duplicateNominees(categoryIds, ballot));
  const nameOf = new Map(attendees.map((a) => [a.player_id, a.display_name]));
  const blocker =
    duplicates.size > 0
      ? `Choose a different teammate in each category — ${[...duplicates]
          .map((id) => nameOf.get(id) ?? "that teammate")
          .join(" and ")} ${duplicates.size > 1 ? "are" : "is"} picked twice.`
      : undecided.length > 0
        ? `Choose a teammate or Skip in ${
            undecided.length === categoryIds.length
              ? "every kudos category"
              : `${undecided.length} more kudos ${undecided.length === 1 ? "category" : "categories"}`
          } before submitting.`
        : null;
  return (
    <form className="space-y-7" onSubmit={submit}>
      <input name="sessionId" type="hidden" value={sessionId} />
      <input name="revision" type="hidden" value={effectiveRevision} />
      <input name="categoryIds" type="hidden" value={categoryIds.join(",")} />
      {state.saved && (
        <p
          className="rounded-xl border border-moss-line bg-moss-bg p-4 font-bold text-moss"
          role="status"
        >
          {state.rewarded
            ? "Report submitted → +50 KUT Coins received."
            : "Your report is saved. Reward already received."}
        </p>
      )}
      {state.error && (
        <div
          className="rounded-xl border border-brick-line bg-brick-bg p-4 font-bold text-brick"
          role="alert"
        >
          {state.error}
        </div>
      )}
      <fieldset className="space-y-3">
        <legend className="display text-3xl">How many goals did you score?</legend>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button
              className={`min-h-11 min-w-11 rounded-xl border font-black ${goals === String(value) ? "border-brass bg-brass text-ink-on-accent" : "border-line bg-panel"}`}
              key={value}
              onClick={() => setGoals(String(value))}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
        <label className="block max-w-48 text-sm font-bold">
          6 or more
          <input
            className="mt-2 min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-base"
            max="99"
            min="0"
            name="goals"
            onChange={(e) => setGoals(e.target.value)}
            type="number"
            value={goals}
          />
        </label>
        {highGoals && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
            <input name="confirmGoals" type="checkbox" value="yes" />
            Confirm {goals} goals
          </label>
        )}
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="display text-3xl">Give kudos</legend>
        <p className="text-sm text-ink-dim">
          Choose a different teammate in each category, or explicitly Skip. Categories you leave
          unanswered are not a Skip — you can save a draft and come back to them.
        </p>
        {categories.map((category) => {
          const choice = ballot[category.id] ?? UNDECIDED;
          const duplicated = duplicates.has(choice);
          return (
            <label
              className={`block rounded-2xl border bg-panel/60 p-4 ${duplicated ? "border-brick-line" : "border-line"}`}
              key={category.id}
            >
              <span className="font-black">{category.title}</span>
              <span className="mt-1 block text-xs text-ink-faint">{category.description}</span>
              <select
                className="mt-3 min-h-12 w-full rounded-xl border border-line bg-board px-3 text-base"
                name={`category-${category.id}`}
                onChange={(e) =>
                  setBallot((current) => ({ ...current, [category.id]: e.target.value }))
                }
                value={choice}
              >
                <option value={UNDECIDED}>Choose a teammate…</option>
                {attendees
                  .filter((a) => a.player_id !== playerId)
                  .map((a) => (
                    <option key={a.player_id} value={a.player_id}>
                      {a.display_name}
                    </option>
                  ))}
                <option value={SKIP}>Skip this category</option>
              </select>
              {duplicated && (
                <span className="mt-2 block text-xs font-bold text-brick">
                  Already picked in another category.
                </span>
              )}
            </label>
          );
        })}
      </fieldset>
      <p className="text-sm text-ink-dim">
        Enter your goals and choose or skip each category. A complete first submission earns 50 KUT
        Coins; edits never pay twice.
      </p>
      {blocker && (
        <p className="text-sm font-bold text-ink-dim" role="status">
          {blocker}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="min-h-13 rounded-xl border border-line bg-panel font-black"
          disabled={pending || duplicates.size > 0}
          name="intent"
          value="draft"
        >
          Save draft
        </button>
        <button
          className="min-h-13 rounded-xl bg-brass font-black text-ink-on-accent disabled:opacity-50"
          disabled={pending || blocker !== null}
          name="intent"
          value="submit"
        >
          {pending ? "Saving…" : rewardReceived ? "Save changes" : "Submit report → earn 50 coins"}
        </button>
      </div>
    </form>
  );
}
