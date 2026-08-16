import { demoPlayers } from "@/game/demo-players";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">
            Terrible Football Haarlem
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            KUT Player Ratings
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            Phase 1A rating-engine preview. These are fictional test players;
            real roster data and authentication are not connected yet.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoPlayers.map((player) => (
            <article
              className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg"
              key={player.name}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{player.name}</h2>
                  <p className="mt-1 capitalize text-slate-400">
                    {player.archetype.replace("_", " ")}
                  </p>
                </div>
                <p className="text-4xl font-black text-amber-400">
                  {player.state.liveOvr}
                </p>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                {Object.entries(player.state.attributes).map(([label, value]) => (
                  <div className="rounded-lg bg-slate-800 p-2" key={label}>
                    <dt className="font-semibold uppercase text-slate-400">{label}</dt>
                    <dd className="mt-1 text-lg font-bold">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 text-sm text-slate-300">
                Activity {player.state.activityScore.toFixed(1)} · Form{" "}
                {player.state.formScore.toFixed(2)} · {player.state.rarityTier}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
