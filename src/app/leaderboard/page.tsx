import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type LeaderboardClub = {
  rank: number;
  display_name: string;
  club_name: string;
  club_value: number;
  card_count: number;
  unique_player_count: number;
  is_current_user: boolean;
};

export default async function LeaderboardPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("club_value_leaderboard")
    .select("rank, display_name, club_name, club_value, card_count, unique_player_count, is_current_user")
    .order("rank")
    .order("display_name");

  if (error) throw new Error("Could not load the club leaderboard.");
  const clubs = (data ?? []) as LeaderboardClub[];

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <div className="flex justify-end"><LogoutButton /></div>
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
          <Link className="text-amber-400 hover:text-amber-300" href="/club">← My Club</Link>
          <Link className="text-slate-400 hover:text-slate-200" href="/market">Transfer market</Link>
        </nav>

        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">KUT standings</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Club Value Leaderboard</h1>
          <p className="mt-3 max-w-2xl text-slate-300">Club Value is KUT Coins plus the current reference value of every unburned card. References use recent completed sales when there is enough history, otherwise a safe discard-value fallback.</p>
        </header>

        {clubs.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-300">No active clubs are ready for the standings yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/70">
            <div className="hidden grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_8rem_5rem_5rem] gap-3 border-b border-slate-700 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 sm:grid">
              <span>Rank</span><span>Member</span><span>Club</span><span className="text-right">Value</span><span className="text-right">Cards</span><span className="text-right">Players</span>
            </div>
            <ol>
              {clubs.map((club) => (
                <li className={`grid gap-x-3 gap-y-1 border-b border-slate-800 px-5 py-4 last:border-0 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_8rem_5rem_5rem] sm:items-center ${club.is_current_user ? "bg-amber-400/10" : ""}`} key={`${club.rank}-${club.display_name}`}>
                  <span className="row-span-2 text-2xl font-black text-amber-300 sm:row-span-1">#{club.rank}</span>
                  <span className="font-black">{club.display_name}{club.is_current_user && <span className="ml-2 text-xs uppercase tracking-[0.12em] text-amber-300">You</span>}</span>
                  <span className="text-sm text-slate-400">{club.club_name}</span>
                  <span className="font-black text-amber-300 sm:text-right">{Number(club.club_value).toLocaleString()} TF</span>
                  <span className="text-sm text-slate-300 sm:text-right">{club.card_count} cards</span>
                  <span className="text-sm text-slate-300 sm:text-right">{club.unique_player_count} players</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
