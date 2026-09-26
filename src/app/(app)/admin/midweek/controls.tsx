"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { VOID_NOTE_MAX, rehearsalRounds } from "@/lib/midweek/admin";
import { formatClock, formatSavedAt } from "@/lib/midweek/entry";
import { roundName } from "@/lib/midweek/evening";
import {
  runMidweekRehearsal,
  setMidweekEnabled,
  voidMidweekWeek,
  type AdminActionState,
  type RehearsalState,
} from "./actions";

const PANEL = "rounded-2xl border border-line/60 bg-panel/60 p-5 sm:p-6";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line bg-panel/70 px-3.5 text-sm font-black text-ink hover:border-brass disabled:opacity-45";

function Feedback({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm font-bold text-moss" role="status">
      {state.message}
    </p>
  ) : (
    <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick" role="alert">
      {state.error}
    </p>
  );
}

/** The launch and pause switch (`admin_set_midweek_enabled`). */
export function MidweekSwitch({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(setMidweekEnabled, null);
  return (
    <section aria-labelledby="midweek-switch-h" className={`${PANEL} grid gap-3`}>
      <form action={action} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <h2 className="text-lg font-black" id="midweek-switch-h">
          {enabled ? "Running" : "Paused"}
        </h2>
        <input name="enabled" type="hidden" value={enabled ? "false" : "true"} />
        <button
          aria-checked={enabled}
          aria-labelledby="midweek-switch-h"
          className={`relative h-8 w-[52px] flex-none rounded-full disabled:opacity-60 ${enabled ? "bg-moss" : "bg-line"}`}
          disabled={pending}
          role="switch"
          type="submit"
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-6 w-6 rounded-full transition-[left] ${enabled ? "left-6 bg-[#0f160b]" : "left-1 bg-ink-dim"}`}
          />
        </button>
      </form>
      <p className="text-[13px] leading-relaxed text-ink-dim">
        While running, a new tournament opens as soon as the last one ends. Pausing stops new ones;
        a tournament that is already open still plays unless you void it.
      </p>
      <Feedback state={state} />
    </section>
  );
}

/** The rehearsal (`admin_midweek_rehearsal`): the engine on today's squads, a throwaway seed, nothing written. */
export function MidweekRehearsalPanel() {
  const [state, action, pending] = useActionState<RehearsalState>(runMidweekRehearsal, null);
  const rehearsal = state?.ok ? state.rehearsal : null;
  return (
    <section aria-labelledby="rehearsal-h" className={`${PANEL} grid gap-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-black" id="rehearsal-h">
          Rehearsal
        </h2>
        <form action={action}>
          <button className={SECONDARY} disabled={pending} type="submit">
            {pending ? "Running…" : rehearsal ? "Run again" : "Run a rehearsal"}
          </button>
        </form>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-dim">
        Runs the engine on the squads saved right now plus auto squads, with a throwaway seed.
        Writes nothing and pays nothing.
        {rehearsal && <> Last run {formatSavedAt(rehearsal.ran_at)}.</>}
      </p>
      {state && !state.ok && (
        <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick" role="alert">
          {state.error}
        </p>
      )}
      {rehearsal && (
        <div aria-live="polite" className="grid gap-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/60 bg-line/45 sm:grid-cols-4 [&>div]:bg-panel [&>div]:px-3.5 [&>div]:py-3">
            {[
              ["Field", rehearsal.field, " entrants"],
              ["Picked", rehearsal.picked, ""],
              ["Auto", rehearsal.auto, ""],
              [
                "Bracket",
                rehearsal.size ?? "—",
                rehearsal.rounds ? ` slots, ${rehearsal.rounds} rounds` : "",
              ],
            ].map(([label, value, note]) => (
              <div key={label}>
                <dt className="text-[10.4px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                  {label}
                </dt>
                <dd className="mt-0.5 text-[22px] font-black tabular-nums">
                  {value}
                  <small className="text-xs font-bold text-ink-faint">{note}</small>
                </dd>
              </div>
            ))}
          </dl>
          {rehearsal.rounds && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10.4px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
                    <th className="py-1.5 pr-2" scope="col">
                      Round
                    </th>
                    <th className="py-1.5 pr-2" scope="col">
                      Matches
                    </th>
                    <th className="py-1.5 pr-2" scope="col">
                      Byes
                    </th>
                    <th className="py-1.5 pr-2" scope="col">
                      Pays
                    </th>
                    <th className="py-1.5 pr-2" scope="col">
                      Out at
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rehearsalRounds(rehearsal).map((row) => (
                    <tr
                      className="border-b border-line/30 text-ink-dim tabular-nums"
                      key={row.round}
                    >
                      <td className="py-[7px] pr-2">
                        <b className="text-ink">
                          {roundName(row.round, rehearsal.rounds as number)}
                        </b>
                      </td>
                      <td className="py-[7px] pr-2">{row.matches}</td>
                      <td className="py-[7px] pr-2">{row.byes}</td>
                      <td className="py-[7px] pr-2">{row.pays}</td>
                      <td className="py-[7px] pr-2">{formatClock(row.revealAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[13px] text-ink-dim">
            <b className="text-ink">Auto squads:</b>{" "}
            {rehearsal.auto_managers.length > 0
              ? `${rehearsal.auto_managers.join(", ")}.`
              : "none."}
          </p>
          {rehearsal.champion && (
            <p className="text-[13px] text-ink-dim">
              <b className="text-ink">Rehearsal champion:</b> {rehearsal.champion.name}.{" "}
              <span className="text-ink-faint">Throwaway seed, so not tonight&rsquo;s result.</span>
            </p>
          )}
          <pre className="overflow-x-auto rounded-xl border border-line bg-board-deep px-3.5 py-3 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-dim">
            {rehearsal.warnings.length === 0 ? (
              <>
                <span className="text-moss">ok</span>
                {"   no warnings"}
              </>
            ) : (
              rehearsal.warnings.map((warning, index) => (
                <span className="block" key={index}>
                  <span className={warning.level === "warning" ? "text-warning" : "text-steel"}>
                    {warning.level === "warning" ? "warn" : "info"}
                  </span>
                  {"  "}
                  {warning.message}
                </span>
              ))
            )}
          </pre>
        </div>
      )}
    </section>
  );
}

/** Void a week before payout (`admin_void_midweek`): a reason members read, and a tick. */
export function MidweekVoidForm({
  tournamentId,
  lockAt,
  weekLabel,
}: {
  tournamentId: string;
  lockAt: string;
  weekLabel: string;
}) {
  const [state, action, pending] = useActionState(voidMidweekWeek, null);
  const [note, setNote] = useState("");
  if (state?.ok) {
    return (
      <div className="grid gap-3">
        <Feedback state={state} />
        <Link className="text-sm font-bold text-brass hover:underline" href="/admin/midweek">
          &larr; Back to Midweek
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <input name="tournament_id" type="hidden" value={tournamentId} />
      <input name="lock_at" type="hidden" value={lockAt} />
      <div className="grid gap-1.5">
        <label className="text-[13px] font-extrabold" htmlFor="void-note">
          Reason, shown to every member
        </label>
        <textarea
          aria-describedby="void-note-hint"
          className="min-h-24 w-full resize-y rounded-xl border border-line bg-board-deep p-3 text-[15px] text-ink"
          id="void-note"
          maxLength={VOID_NOTE_MAX}
          minLength={3}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          required
          value={note}
        />
        <p className="text-xs text-ink-faint" id="void-note-hint">
          Up to {VOID_NOTE_MAX} characters. {note.trim().length} used.
        </p>
      </div>
      <label className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5 text-sm text-ink-dim">
        <input
          className="mt-0.5 h-[22px] w-[22px] accent-brick"
          name="confirm"
          required
          type="checkbox"
        />
        <span>I understand nobody is paid for {weekLabel} and the results disappear.</span>
      </label>
      <Feedback state={state} />
      <div className="flex flex-wrap gap-2.5">
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brick px-5 text-[15px] font-black text-[#1d0e08] disabled:opacity-45"
          disabled={pending}
          type="submit"
        >
          {pending ? "Voiding…" : `Void ${weekLabel}`}
        </button>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-panel/70 px-5 text-[15px] font-black text-ink hover:border-brass"
          href="/admin/midweek"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
