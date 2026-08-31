import Link from "next/link";
import { type Archetype } from "@/game/archetypes";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { CardEditor } from "./card-editor";

export const metadata = { title: "My card" };

type PlayerRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
};

export default async function MyCardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("player_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error("Could not load your profile.");

  const shell = (children: React.ReactNode) => (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Account</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">My card</h1>
        </header>
        {children}
        <Link className="inline-block text-sm font-semibold text-brass underline" href="/settings">
          &larr; Back to settings
        </Link>
      </section>
    </main>
  );

  if (!profile?.player_id) {
    return shell(
      <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">
        <h2 className="display text-2xl text-ink">No player linked yet</h2>
        <p className="mx-auto mt-2 max-w-md">
          Your account isn&rsquo;t linked to a TFH player, so there&rsquo;s no card to edit yet. Ask an admin to
          link your account to your player.
        </p>
      </div>,
    );
  }

  const { data: player, error: playerError } = await supabase
    .schema("kut")
    .from("players")
    .select("id, slug, display_name, archetype, photo_path")
    .eq("id", profile.player_id)
    .maybeSingle();

  if (playerError) throw new Error("Could not load your player.");
  if (!player) {
    return shell(
      <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">
        <h2 className="display text-2xl text-ink">Player not found</h2>
        <p className="mt-2">Your linked player could not be loaded. Ask an admin to check your account.</p>
      </div>,
    );
  }

  const row = player as PlayerRow;
  const photoUrls = await resolvePhotoUrls(supabase, [row.photo_path]);
  const currentPhotoUrl = row.photo_path ? photoUrls.get(row.photo_path) ?? null : null;

  return shell(
    <CardEditor
      currentArchetype={row.archetype as Archetype}
      currentPhotoUrl={currentPhotoUrl}
      displayName={row.display_name}
      playerId={row.id}
    />,
  );
}
