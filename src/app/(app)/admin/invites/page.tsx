import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export default async function InvitesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [playersResponse, profilesResponse] = await Promise.all([
    supabase.schema("kut").from("players").select("id, display_name").eq("is_active", true).order("display_name"),
    supabase.schema("kut").from("profiles").select("player_id").not("player_id", "is", null),
  ]);

  if (playersResponse.error || profilesResponse.error) {
    throw new Error("Could not load invitation details.");
  }

  const linkedPlayerIds = new Set(
    (profilesResponse.data ?? []).flatMap((profile) => profile.player_id ? [profile.player_id] : []),
  );
  const availablePlayers = (playersResponse.data ?? []).filter((player) => !linkedPlayerIds.has(player.id));

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-black tracking-tight">Invite a player</h1>
          <p className="text-slate-300">Each link can create one KUT account tied to one real player. It expires after 14 days.</p>
        </header>
        <InviteForm players={availablePlayers} />
      </section>
    </main>
  );
}
