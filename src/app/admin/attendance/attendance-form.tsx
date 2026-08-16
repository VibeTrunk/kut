"use client";

import { useMemo, useState } from "react";

const PLAYERS = ["Alex Example", "Bea Test", "Charlie Fixture", "Dana Demo", "Elliot Sample"];

export function AttendanceForm() {
  const [selected, setSelected] = useState<string[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"attendance" | "goals" | "review">("attendance");

  const selectedPlayers = useMemo(
    () => PLAYERS.filter((player) => selected.includes(player)),
    [selected],
  );

  function togglePlayer(player: string) {
    setSelected((current) =>
      current.includes(player)
        ? current.filter((selectedPlayer) => selectedPlayer !== player)
        : [...current, player],
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setStep("review");
      }}
    >
      <div className="flex gap-2 text-sm font-semibold">
        {[
          ["attendance", "1. Attendance"],
          ["goals", "2. Goals"],
          ["review", "3. Publish"],
        ].map(([value, label]) => (
          <span
            className={`rounded-full px-3 py-1 ${step === value ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}
            key={value}
          >
            {label}
          </span>
        ))}
      </div>

      {step === "attendance" && (
        <fieldset className="space-y-3">
          <legend className="text-xl font-bold">Who played?</legend>
          <p className="text-slate-300">Tap each attendee. Large targets are intentional for pitch-side use.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAYERS.map((player) => {
              const isSelected = selected.includes(player);
              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold ${isSelected ? "border-amber-400 bg-amber-400 text-slate-950" : "border-slate-700 bg-slate-900 text-slate-50"}`}
                  key={player}
                  onClick={() => togglePlayer(player)}
                  type="button"
                >
                  {player}
                </button>
              );
            })}
          </div>
          <button
            className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={selected.length === 0}
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
          <p className="text-slate-300">Goals are optional and default to zero.</p>
          {selectedPlayers.map((player) => (
            <label className="flex items-center justify-between rounded-xl bg-slate-900 p-4" key={player}>
              <span className="font-semibold">{player}</span>
              <input
                className="w-20 rounded-lg border border-slate-600 bg-slate-800 p-2 text-center"
                min="0"
                onChange={(event) =>
                  setGoals((current) => ({ ...current, [player]: Number(event.target.value) }))
                }
                type="number"
                value={goals[player] ?? 0}
              />
            </label>
          ))}
          <div className="flex gap-3">
            <button className="min-h-12 flex-1 rounded-xl bg-slate-800 px-4 py-3 font-bold" onClick={() => setStep("attendance")} type="button">
              Back
            </button>
            <button className="min-h-12 flex-1 rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950" type="submit">
              Review publication
            </button>
          </div>
        </fieldset>
      )}

      {step === "review" && (
        <section className="space-y-4 rounded-2xl border border-amber-400 bg-amber-400/10 p-5">
          <h2 className="text-xl font-bold">Ready to publish</h2>
          <p>{selected.length} attendees selected. Publishing will recalculate every Live Card from the season history.</p>
          <p className="text-sm text-amber-200">
            Preview only: real publication is enabled after the local admin login is wired in the next auth slice.
          </p>
          <button className="min-h-12 w-full rounded-xl bg-slate-800 px-4 py-3 font-bold" onClick={() => setStep("goals")} type="button">
            Back to goals
          </button>
        </section>
      )}
    </form>
  );
}
