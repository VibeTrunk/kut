"use client";

import { useActionState, useMemo, useState } from "react";
import {
  correctPublishedAttendanceSession,
  publishAttendanceSession,
  type PublishAttendanceState,
} from "./actions";

type Player = { id: string; display_name: string };
type CorrectionSession = {
  id: string;
  sessionDate: string;
  sessionType: string;
  status: "published" | "cancelled";
  bibsWashedBy: string | null;
  attendance: Array<{ player_id: string; goals: number }>;
};

const initialState: PublishAttendanceState = { error: null };

export function AttendanceForm({
  correctionSession,
  players,
}: {
  correctionSession?: CorrectionSession;
  players: Player[];
}) {
  const isCorrection = Boolean(correctionSession);
  const isCancelledSession = correctionSession?.status === "cancelled";
  const [selected, setSelected] = useState<string[]>(() => correctionSession?.attendance.map((entry) => entry.player_id) ?? []);
  const [goals, setGoals] = useState<Record<string, number>>(() =>
    Object.fromEntries(correctionSession?.attendance.map((entry) => [entry.player_id, entry.goals]) ?? []),
  );
  const [step, setStep] = useState<"attendance" | "goals" | "review">("attendance");
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
          ["goals", "2. Goals"],
          ["review", isCorrection ? "3. Correct" : "3. Publish"],
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
              <input
                className="min-h-12 w-full rounded-xl border border-line bg-board-deep/60 px-4"
                onChange={(event) => setSessionDate(event.target.value)}
                required
                type="date"
                value={sessionDate}
              />
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
            onClick={() => setStep("goals")}
            type="button"
          >
            {selected.length} selected — enter goals
          </button>
        </fieldset>
      )}

      {step === "goals" && (
        <fieldset className="space-y-3">
          <legend className="text-xl font-bold">Goals</legend>
          <p className="text-ink-dim">Goals are optional and default to zero.</p>
          {selectedPlayers.map((player) => (
            <label className="flex items-center justify-between rounded-xl bg-panel p-4" key={player.id}>
              <span className="font-semibold">{player.display_name}</span>
              <input
                className="w-20 rounded-lg border border-line bg-board-deep/60 p-2 text-center"
                min="0"
                onChange={(event) => setGoals((current) => ({ ...current, [player.id]: Number(event.target.value) }))}
                type="number"
                value={goals[player.id] ?? 0}
              />
            </label>
          ))}
          <div className="flex gap-3">
            <button className="min-h-12 flex-1 rounded-xl bg-panel-2 px-4 py-3 font-bold" onClick={() => setStep("attendance")} type="button">
              Back
            </button>
            <button className="min-h-12 flex-1 rounded-xl bg-brass px-4 py-3 font-bold text-ink-on-accent" onClick={() => setStep("review")} type="button">
              {isCorrection ? "Review correction" : "Review publication"}
            </button>
          </div>
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
            <p className="text-sm text-brass">Check the date, session type, attendees, and goals carefully. Published sessions affect ratings immediately.</p>
          )}
          {state.error && <p className="rounded-xl bg-brick-bg p-3 text-sm text-brick">{state.error}</p>}
          <div className="flex gap-3">
            <button className="min-h-12 flex-1 rounded-xl bg-panel-2 px-4 py-3 font-bold" disabled={isPending} onClick={() => setStep("goals")} type="button">
              Back to goals
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
