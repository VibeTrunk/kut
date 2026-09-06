"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  correctPublishedAttendanceSession,
  publishAttendanceSession,
  type PublishAttendanceState,
} from "./actions";
import { sessionUsesMemberReports } from "@/game/session-reporting";

type Player = { id: string; display_name: string };
type CorrectionSession = {
  id: string;
  sessionDate: string;
  sessionType: string;
  status: "published" | "cancelled";
  ratingRulesVersion: number;
  bibsWashedBy: string | null;
  attendance: Array<{ player_id: string; goals: number }>;
};

const initialState: PublishAttendanceState = { error: null };

export function AttendanceForm({
  correctionSession,
  players,
  v2StartsWeek,
}: {
  correctionSession?: CorrectionSession;
  players: Player[];
  v2StartsWeek?: string | null;
}) {
  const isCorrection = Boolean(correctionSession);
  const isCancelledSession = correctionSession?.status === "cancelled";
  const [selected, setSelected] = useState<string[]>(() => correctionSession?.attendance.map((entry) => entry.player_id) ?? []);
  const [goals, setGoals] = useState<Record<string, number>>(
    () => Object.fromEntries(correctionSession?.attendance.map((entry) => [entry.player_id, entry.goals]) ?? []),
  );
  const dateInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"attendance" | "review">("attendance");
  const [sessionDate, setSessionDate] = useState(() => correctionSession?.sessionDate ?? new Date().toISOString().slice(0, 10));
  const [sessionType, setSessionType] = useState(() => correctionSession?.sessionType ?? "friday");
  const [bibsWashedBy, setBibsWashedBy] = useState<string>(() => correctionSession?.bibsWashedBy ?? "");
  const [state, formAction, isPending] = useActionState(
    isCorrection ? correctPublishedAttendanceSession : publishAttendanceSession,
    initialState,
  );

  const selectedPlayers = useMemo(
    () => players.filter((player) => selected.includes(player.id)),
    [players, selected],
  );
  const attendance = useMemo(
    () => selectedPlayers.map((player) => ({ player_id: player.id, goals: goals[player.id] ?? 0 })),
    [goals, selectedPlayers],
  );

  // A bibs bringer who was removed from attendance falls back to "Nobody"
  // without touching state (the raw pick is kept in case they are re-added).
  const effectiveBibsWashedBy = bibsWashedBy && selected.includes(bibsWashedBy) ? bibsWashedBy : "";
  const usesMemberReports = correctionSession
    ? correctionSession.ratingRulesVersion === 2
    : sessionUsesMemberReports(sessionDate, v2StartsWeek);
  const formattedCutover = v2StartsWeek
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(new Date(`${v2StartsWeek}T12:00:00`))
    : null;

  function togglePlayer(playerId: string) {
    setSelected((current) =>
      current.includes(playerId)
        ? current.filter((selectedPlayerId) => selectedPlayerId !== playerId)
        : [...current, playerId],
    );
  }

  if (players.length === 0) {
    return <p className="rounded-xl bg-panel p-4 text-ink-dim">There are no active players to record yet.</p>;
  }

  return (
    <form action={formAction} className="space-y-6">
      <input name="attendance" type="hidden" value={JSON.stringify(attendance)} />
      <input name="sessionDate" type="hidden" value={sessionDate} />
      <input name="sessionType" type="hidden" value={sessionType} />
      <input name="bibsWashedBy" type="hidden" value={effectiveBibsWashedBy} />
      {correctionSession && <input name="sessionId" type="hidden" value={correctionSession.id} />}

      <div className="flex gap-2 text-sm font-semibold">
        {[
          ["attendance", "1. Attendance"],
          ["review", isCorrection ? "2. Correct" : "2. Publish"],
        ].map(([value, label]) => (
          <span
            className={`rounded-full px-3 py-1 ${step === value ? "bg-brass text-ink-on-accent" : "bg-panel-2 text-ink-dim"}`}
            key={value}
          >
            {label}
          </span>
        ))}
      </div>

      {step === "attendance" && (
        <fieldset className="space-y-3">
          <legend className="text-xl font-bold">Session details</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Date</span>
              <span className="relative block">
                <input
                  className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4 pr-14 [color-scheme:dark]"
                  onChange={(event) => setSessionDate(event.target.value)}
                  ref={dateInput}
                  required
                  type="date"
                  value={sessionDate}
                />
                <button
                  aria-label="Open date picker"
                  className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-lg text-xl text-brass hover:bg-brass/10"
                  onClick={() => { try { dateInput.current?.showPicker(); } catch { dateInput.current?.focus(); } }}
                  type="button"
                >
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>
                </button>
              </span>
            </label>
            <label className="space-y-2">
              <span className="font-semibold">Session</span>
              <select
                className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4"
                onChange={(event) => setSessionType(event.target.value)}
                value={sessionType}
              >
                <option value="monday">Monday</option>
                <option value="friday">Friday</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          {!isCorrection && formattedCutover && (
            <p className={`rounded-xl border p-3 text-sm ${usesMemberReports ? "border-moss-line bg-moss-bg text-moss" : "border-brass-line bg-brass-bg/30 text-brass"}`}>
              {usesMemberReports
                ? "This date uses member reports. Publishing opens goals & kudos for linked attendees for 24 hours."
                : `This is a legacy date. Member reports begin with the week of ${formattedCutover}; enter goals during review instead.`}
            </p>
          )}
          <legend className="pt-4 text-xl font-bold">Who played?</legend>
          <p className="text-ink-dim">Tap each attendee. Large targets are intentional for pitch-side use.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {players.map((player) => {
              const isSelected = selected.includes(player.id);
              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold ${isSelected ? "border-brass bg-brass text-ink-on-accent" : "border-line bg-panel text-ink"}`}
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  type="button"
                >
                  {player.display_name}
                </button>
              );
            })}
          </div>
          <button
            className="min-h-12 w-full rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-faint"
            disabled={selected.length === 0 || !sessionDate}
            onClick={() => setStep("review")}
            type="button"
          >
            {selected.length} selected — review
          </button>
        </fieldset>
      )}

      {step === "review" && (
        <section className="space-y-4 rounded-2xl border border-brass bg-brass/10 p-5">
          <h2 className="display text-2xl">{isCorrection ? "Ready to save correction" : "Ready to publish"}</h2>
          <p>
            {selected.length} attendees selected. {isCancelledSession
              ? "Saving this correction preserves the revised record until it is reactivated."
              : `${isCorrection ? "Saving this correction" : "Publishing"} will recalculate every Live Card from the season history.`}
          </p>
          <label className="block space-y-2">
            <span className="font-semibold">Who brought the bibs?</span>
            <select
              className="min-h-12 w-full rounded-xl border border-line bg-panel px-4"
              onChange={(event) => setBibsWashedBy(event.target.value)}
              value={effectiveBibsWashedBy}
            >
              <option value="">Nobody</option>
              {selectedPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.display_name}
                </option>
              ))}
            </select>
            <span className="block text-sm text-brass">
              Whoever brings the bibs gets a one-off bonus in KUT Coins. Changing this on a
              correction pays the new bringer; the previous one keeps their bonus.
            </span>
          </label>
          {!usesMemberReports && (
            <fieldset className="space-y-3 rounded-xl border border-line bg-board/50 p-4">
              <legend className="px-1 font-black">Goals for this legacy session</legend>
              <p className="text-sm text-ink-dim">Sessions before the reporting cutover keep the original admin-entered goal totals.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedPlayers.map((player) => (
                  <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-line/50 bg-panel px-3" key={player.id}>
                    <span className="min-w-0 truncate text-sm font-bold">{player.display_name}</span>
                    <input
                      aria-label={`${player.display_name} goals`}
                      className="h-10 w-20 rounded-lg border border-line bg-board px-3 text-right font-black tabular-nums"
                      max="99"
                      min="0"
                      onChange={(event) => setGoals((current) => ({ ...current, [player.id]: Math.max(0, Math.min(99, Number(event.target.value) || 0)) }))}
                      type="number"
                      value={goals[player.id] ?? 0}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {isCorrection ? (
            <label className="block space-y-2">
              <span className="font-semibold">Why is this being corrected?</span>
              <textarea
                className="min-h-24 w-full rounded-xl border border-line bg-panel p-3"
                maxLength={500}
                minLength={3}
                name="correctionReason"
                placeholder="For example: Alex was selected by mistake."
                required
              />
              <span className="block text-sm text-brass">
                The previous attendance and this reason are retained in the admin audit log.
                {isCancelledSession && " This session will remain excluded from ratings until reactivated."}
              </span>
            </label>
          ) : (
            <p className="text-sm text-brass">{usesMemberReports ? "Check the date, session type and attendees carefully. Publishing opens member reports for 24 hours." : "Check the legacy goal totals carefully. This date does not open member reports."}</p>
          )}
          {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
          <div className="flex gap-3">
            <button className="min-h-12 flex-1 rounded-xl bg-panel-2 px-4 py-3 font-bold" disabled={isPending} onClick={() => setStep("attendance")} type="button">
              Back to attendance
            </button>
            <button className="min-h-12 flex-1 rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent disabled:bg-line disabled:text-ink-faint" disabled={isPending} type="submit">
              {isPending ? (isCorrection ? "Saving..." : "Publishing...") : (isCorrection ? "Save correction" : "Publish session")}
            </button>
          </div>
        </section>
      )}
    </form>
  );
}
