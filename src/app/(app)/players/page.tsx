import Link from "next/link";
import { IconSearch } from "@/components/icons";
import { ARCHETYPES, ARCHETYPE_LABELS, isArchetype } from "@/game/archetypes";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import { LEADERBOARD_TABS } from "@/lib/nav/routes";
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
const fieldClass = "min-h-11 rounded-xl border border-line bg-board-deep/60 px-3.5 text-sm font-semibold text-ink placeholder:text-ink-faint focus:border-brass/60 focus:outline-none";

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
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">KUT roster</p>
          <h1 className="display text-5xl sm:text-6xl">Player directory</h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-dim">
            Every collectible TFH player and their current Live Card. Tap a card for the full profile.
          </p>
          <p className="text-xs font-bold text-ink-faint">{players.length} {players.length === 1 ? "player" : "players"}</p>
          <div className="pt-2">
            <SectionTabs label="Leaderboard" tabs={LEADERBOARD_TABS} />
          </div>
        </header>

        <form className="grid gap-3 rounded-2xl border border-line/60 bg-board-deep/40 p-3.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_10rem_auto]">
          <label className={`${fieldClass} flex items-center gap-2`}>
            <IconSearch aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              aria-label="Search player"
              className="w-full bg-transparent focus:outline-none"
              defaultValue={query.q}
              name="q"
              placeholder="Search player"
            />
          </label>
          <select aria-label="Tier" className={`${fieldClass} capitalize`} defaultValue={query.rarity} name="rarity">
            <option value="">Any tier</option>
            {RARITIES.map((rarity) => (
              <option className="capitalize" key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
          <select aria-label="Archetype" className={fieldClass} defaultValue={query.archetype} name="archetype">
            <option value="">Any archetype</option>
            {ARCHETYPES.map((archetype) => (
              <option key={archetype} value={archetype}>
                {ARCHETYPE_LABELS[archetype]}
              </option>
            ))}
          </select>
          <select aria-label="Sort" className={fieldClass} defaultValue={query.sort} name="sort">
            <option value="ovr">Highest OVR</option>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
          <button className="min-h-11 rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-sm font-black text-ink-on-accent hover:brightness-105" type="submit">
            Filter
          </button>
        </form>

        {players.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-dim">
            No players match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {players.map((player) => {
              const cardPlayer: LiveCardPlayer = {
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
              };
              return (
                <Link
                  aria-label={`Open ${player.display_name}'s profile`}
                  className="block rounded-[0.9rem] outline-offset-4 outline-brass focus-visible:outline-2"
                  href={`/players/${player.slug}`}
                  key={player.id}
                >
                  <LiveCard player={cardPlayer} />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
