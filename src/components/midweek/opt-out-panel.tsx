"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { setMidweekOptOut, type MidweekActionState } from "@/app/(app)/club/midweek/actions";
import { ROUND_ONE_CLOCK, optOutConfirmText } from "@/lib/midweek/entry";

/**
 * `MidweekOptOutPanel` on Settings (Settings-TakingPart, Settings-OptedOut).
 * Entry is the default and this switch is the consent (ADR-091): opting out
 * takes two steps because it withdraws a saved five; opting back in is one tap.
 */
export function MidweekOptOutPanel({
  optedOut,
  hasSavedSquadThisWeek,
  locked,
  weekLabel,
}: {
  optedOut: boolean;
  hasSavedSquadThisWeek: boolean;
  locked: boolean;
  weekLabel: string | null;
}) {
  const headingId = useId();
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    setMidweekOptOut,
    null,
  );

  function send(optOut: boolean) {
    const formData = new FormData();
    formData.set("opt_out", String(optOut));
    startTransition(() => formAction(formData));
    setConfirming(false);
  }

  function toggle() {
    if (optedOut) send(false);
    else setConfirming(true);
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`grid gap-4 rounded-2xl border bg-panel/60 p-6 ${
        optedOut ? "border-dashed border-line" : "border-line/60"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div>
          <h2 className="display text-3xl" id={headingId}>
            Midweek Madness
          </h2>
          <p className="mt-1.5 text-sm text-ink-dim">
            A knockout for five of your cards, every Wednesday.
          </p>
        </div>
        <button
          aria-checked={!optedOut}
          aria-labelledby={headingId}
          className={`relative h-8 w-[52px] flex-none rounded-full disabled:opacity-60 ${
            optedOut ? "bg-line" : "bg-moss"
          }`}
          disabled={pending || confirming}
          onClick={toggle}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-6 w-6 rounded-full transition-[left] ${
              optedOut ? "left-1 bg-ink-dim" : "left-6 bg-[#0f160b]"
            }`}
          />
        </button>
      </div>

      <p
        className={`text-xs font-black tracking-[0.1em] uppercase ${optedOut ? "text-ink-faint" : "text-moss"}`}
        role="status"
      >
        {optedOut ? "You’ve opted out" : "You’re taking part"}
      </p>

      {optedOut ? (
        <p className="text-sm text-ink-dim">
          You aren&rsquo;t entered and none of your cards are shown. Switch it back on to be in
          {weekLabel ? ` for ${weekLabel}` : " for the next Wednesday"}, picked or auto.
        </p>
      ) : (
        <ul className="grid gap-2 text-sm leading-relaxed text-ink-dim">
          {[
            <>
              Members see <b className="text-ink">the five cards you enter</b>, or your auto squad,
              from {ROUND_ONE_CLOCK} on the Wednesday, with their numbers for the week.
            </>,
            <b className="text-ink" key="rest">
              The rest of your collection is never shown.
            </b>,
            <>Opting out takes you out completely: no squad, no auto squad, nothing shown.</>,
          ].map((item, index) => (
            <li
              className="relative pl-[18px] before:absolute before:top-[0.62em] before:left-0.5 before:h-1.5 before:w-1.5 before:rotate-45 before:rounded-[1px] before:bg-brass before:content-['']"
              key={index}
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {confirming && !optedOut && (
        <div
          aria-labelledby={confirmId}
          className="grid gap-3 border-t border-dashed border-line pt-4"
          role="group"
        >
          <p className="font-black" id={confirmId}>
            Opt out of Midweek Madness?
          </p>
          <p className="text-sm text-ink-dim">
            {optOutConfirmText({ locked, hasSavedSquad: hasSavedSquadThisWeek, weekLabel })}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="inline-flex min-h-11 items-center rounded-[10px] bg-brick px-3.5 text-sm font-black text-[#1d0e08]"
              onClick={() => send(true)}
              type="button"
            >
              Opt out
            </button>
            <button
              className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-panel/70 px-3.5 text-sm font-black text-ink"
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep playing
            </button>
          </div>
        </div>
      )}

      {state && (
        <p className={`text-sm font-bold ${state.ok ? "text-moss" : "text-brick"}`} role="status">
          {state.ok ? state.message : state.error}
        </p>
      )}
    </section>
  );
}
