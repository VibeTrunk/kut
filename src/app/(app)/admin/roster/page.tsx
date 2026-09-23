import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { AddPlayerForm } from "./add-player-form";
import { RosterTable, type RosterRow } from "./roster-table";

// The injury RPCs judge "no later than today" in Europe/Amsterdam; the date
// picker's default and max follow the same clock.
function amsterdamToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

export default async function RosterPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [playersRes, attendanceRes, profilesRes, injuredRes] = await Promise.all([
    supabase
      .schema("kut")
      .from("players")
      .select("id, slug, display_name, archetype, is_active")
      .order("display_name"),
    supabase.schema("kut").from("attendance").select("player_id"),
    supabase
      .schema("kut")
      .from("profiles")
      .select("player_id, is_disabled")
      .not("player_id", "is", null),
    // ADR-082. Non-critical: a failed read shows no injury controls rather
    // than failing the roster (e.g. before the migration reaches hosted).
    supabase.schema("kut").from("injured_players").select("player_id, started_on, protected_weeks"),
  ]);

  if (playersRes.error || attendanceRes.error || profilesRes.error) {
    throw new Error("Could not load the roster.");
  }

  const withHistory = new Set<string>([
    ...(attendanceRes.data ?? []).map((row) => row.player_id),
    ...(profilesRes.data ?? []).flatMap((row) => (row.player_id ? [row.player_id] : [])),
  ]);
  const withAccount = new Set<string>(
    (profilesRes.data ?? []).flatMap((row) =>
      row.player_id && !row.is_disabled ? [row.player_id] : [],
    ),
  );
  if (injuredRes.error) console.error("roster injured players read failed", injuredRes.error);
  const injuries = injuredRes.error
    ? null
    : new Map(
        (injuredRes.data ?? []).map((row) => [
          row.player_id as string,
          { started_on: row.started_on as string, protected_weeks: row.protected_weeks as number },
        ]),
      );
  const players: RosterRow[] = (playersRes.data ?? []).map((player) => ({
    ...player,
    has_history: withHistory.has(player.id),
    has_account: withAccount.has(player.id),
    injury: injuries ? (injuries.get(player.id) ?? null) : undefined,
  }));

  return (
    <main className="board-ground min-h-screen p-6 text-ink sm:p-10">
      {/* The form stays narrow; the roster table gets more room, since the
          injury column (ADR-082) pushed it past max-w-2xl. */}
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="mx-auto max-w-2xl space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Add a player</h1>
          <p className="text-ink-dim">
            Register a new TFH member. They get a Live Card straight away and appear in Live Ratings
            at 30 OVR (common) until their first published attendance.
          </p>
        </header>

        <div className="mx-auto max-w-2xl">
          <AddPlayerForm
            existingNames={players.map((player) => player.display_name.toLowerCase())}
          />
        </div>

        <section className="border-t border-panel-2 pt-8">
          <RosterTable players={players} today={amsterdamToday()} />
        </section>
      </section>
    </main>
  );
}
