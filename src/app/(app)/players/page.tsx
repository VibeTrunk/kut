import Link from "next/link";
import { ARCHETYPES, ARCHETYPE_LABELS, isArchetype } from "@/game/archetypes";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Player directory" };

type DirectoryRow = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  photo_path: string | null;
  live_ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
};

const RARITIES = ["common", "bronze", "silver", "gold", "holo", "elite"] as const;

type PlayerDirectoryPageProps = {
  searchParams: Promise<{ q?: string; rarity?: string; archetype?: string; sort?: string }>;
};

export default async function PlayerDirectoryPage({ searchParams }: PlayerDirectoryPageProps) {
  await requireUser();
  const supabase = await createClient();
  const query = await searchParams;

  let request = supabase
    .schema("kut")
    .from("player_directory")
    .select("id, slug, display_name, archetype, photo_path, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier");

  const term = query.q?.trim().slice(0, 80);
  if (term) request = request.ilike("display_name", `%${term}%`);
  if (RARITIES.includes(query.rarity as (typeof RARITIES)[number])) request = request.eq("rarity_tier", query.rarity);
  if (query.archetype && isArchetype(query.archetype)) request = request.eq("archetype", query.archetype);
  if (query.sort === "name") request = request.order("display_name");
  else if (query.sort === "newest") request = request.order("created_at", { ascending: false });
  else request = request.order("live_ovr", { ascending: false }).order("display_name");

  const { data, error } = await request;
  if (error) throw new Error("Could not load the player directory.");

  const players = (data ?? []) as DirectoryRow[];
  const photoUrls = await resolvePhotoUrls(supabase, players.map((player) => player.photo_path));

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-7">
        <header>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-brass">KUT roster</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Player directory</h1>
          <p className="mt-3 text-ink-dim">
            Every collectible TFH player and their current Live Card. Tap a card for the full profile.
          </p>
        </header>

        <form className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-5">
          <input
            className="min-h-11 rounded-xl bg-board px-3 sm:col-span-2"
            defaultValue={query.q}
            name="q"
            placeholder="Search player"
          />
          <select className="min-h-11 rounded-xl bg-board px-3" defaultValue={query.rarity} name="rarity">
            <option value="">Any tier</option>
            {RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
          <select className="min-h-11 rounded-xl bg-board px-3" defaultValue={query.archetype} name="archetype">
            <option value="">Any archetype</option>
            {ARCHETYPES.map((archetype) => (
              <option key={archetype} value={archetype}>
                {ARCHETYPE_LABELS[archetype]}
              </option>
            ))}
          </select>
          <select className="min-h-11 rounded-xl bg-board px-3" defaultValue={query.sort} name="sort">
            <option value="ovr">Highest OVR</option>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
          <button className="min-h-11 rounded-xl border border-brass px-4 font-black text-brass sm:col-span-5" type="submit">
            Filter
          </button>
        </form>

        {players.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
            No players match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
            {players.map((player) => (
              <Link
                aria-label={`Open ${player.display_name}'s profile`}
                className="rounded-[1.25rem] outline-offset-4 outline-brass focus-visible:outline-2"
                href={`/players/${player.slug}`}
                key={player.id}
              >
                <LiveCard
                  player={{
                    id: player.id,
                    displayName: player.display_name,
                    archetype: player.archetype,
                    liveOvr: player.live_ovr,
                    pac: player.pac,
                    sho: player.sho,
                    pas: player.pas,
                    dri: player.dri,
                    def: player.def,
                    phy: player.phy,
                    rarityTier: player.rarity_tier,
                    photoUrl: player.photo_path ? photoUrls.get(player.photo_path) ?? null : null,
                  }}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
