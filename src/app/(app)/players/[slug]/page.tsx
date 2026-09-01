import Link from "next/link";
import { notFound } from "next/navigation";
import { archetypeLabel } from "@/game/archetypes";
import { CardLightbox } from "@/components/card-lightbox";
import { AttributeBars, RatingHistory, type RatingSnapshot } from "@/components/card-stats";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Player profile" };

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

type PlayerProfilePageProps = { params: Promise<{ slug: string }> };

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  await requireUser();
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("kut")
    .from("player_directory")
    .select("id, slug, display_name, archetype, photo_path, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error("Could not load this player.");
  if (!data) notFound();

  const player = data as DirectoryRow;
  const [photoUrls, snapshotsResponse] = await Promise.all([
    resolvePhotoUrls(supabase, [player.photo_path]),
    supabase
      .schema("kut")
      .from("player_rating_snapshots")
      .select("week_start, live_ovr")
      .eq("player_id", player.id)
      .order("week_start", { ascending: false })
      .limit(8),
  ]);
  const photoUrl = player.photo_path ? photoUrls.get(player.photo_path) ?? null : null;
  // Non-critical: a player with no published history simply has no chart.
  const snapshots = ((snapshotsResponse.data ?? []) as RatingSnapshot[]).slice().reverse();

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
    photoUrl,
  };

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/players">
          &larr; Player directory
        </Link>

        <div className="grid gap-10 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start lg:gap-16">
          <div className="group relative">
            <LiveCard size="detail" player={cardPlayer} />
            <CardLightbox player={cardPlayer} />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
                Live card &middot; <span className="capitalize">{player.rarity_tier}</span>
              </p>
              <h1 className="display text-5xl sm:text-6xl">{player.display_name}</h1>
              <p className="text-base text-ink-dim">
                {archetypeLabel(player.archetype)} &middot; {player.live_ovr} OVR &middot; rises and falls with published sessions
              </p>
            </div>

            <AttributeBars player={player} />

            {snapshots.length >= 2 && (
              <>
                <hr className="border-line/40" />
                <RatingHistory snapshots={snapshots} />
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
