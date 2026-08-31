import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AddPlayerForm } from "./add-player-form";
import { RosterTable, type RosterRow } from "./roster-table";

export default async function RosterPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [playersRes, attendanceRes, profilesRes] = await Promise.all([
    supabase.schema("kut").from("players").select("id, slug, display_name, archetype, is_active").order("display_name"),
    supabase.schema("kut").from("attendance").select("player_id"),
    supabase.schema("kut").from("profiles").select("player_id").not("player_id", "is", null),
  ]);

  if (playersRes.error || attendanceRes.error || profilesRes.error) {
    throw new Error("Could not load the roster.");
  }

  const withHistory = new Set<string>([
    ...(attendanceRes.data ?? []).map((row) => row.player_id),
    ...(profilesRes.data ?? []).flatMap((row) => (row.player_id ? [row.player_id] : [])),
  ]);
  const players: RosterRow[] = (playersRes.data ?? []).map((player) => ({
    ...player,
    has_history: withHistory.has(player.id),
  }));

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Add a player</h1>
          <p className="text-ink-dim">
            Register a new TFH member. They get a Live Card straight away and appear in Live Ratings at 30 OVR (common)
            until their first published attendance.
          </p>
        </header>

        <AddPlayerForm existingNames={players.map((player) => player.display_name.toLowerCase())} />

        <section className="border-t border-panel-2 pt-8">
          <RosterTable players={players} />
        </section>
      </section>
    </main>
  );
}
