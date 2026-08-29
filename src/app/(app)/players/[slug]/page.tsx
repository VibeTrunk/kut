import Link from "next/link";
import { notFound } from "next/navigation";
import { archetypeLabel } from "@/game/archetypes";
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

const ATTRS: [label: string, key: keyof Pick<DirectoryRow, "pac" | "sho" | "pas" | "dri" | "def" | "phy">][] = [
  ["PAC", "pac"],
  ["SHO", "sho"],
  ["PAS", "pas"],
  ["DRI", "dri"],
  ["DEF", "def"],
  ["PHY", "phy"],
];

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
  const photoUrls = await resolvePhotoUrls(supabase, [player.photo_path]);
  const photoUrl = player.photo_path ? photoUrls.get(player.photo_path) ?? null : null;

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-6">
        <Link className="text-sm font-semibold text-brass underline" href="/players">
          &larr; Player directory
        </Link>

        <div className="grid gap-8 rounded-3xl border border-line/80 bg-panel/70 p-6 sm:p-8 md:grid-cols-[minmax(280px,360px)_1fr] md:items-center">
          <LiveCard
            size="detail"
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
              photoUrl,
            }}
          />

          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Live card</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">{player.display_name}</h1>
              <p className="mt-2 text-lg text-ink-dim">
                {archetypeLabel(player.archetype)} &middot; <span className="capitalize">{player.rarity_tier}</span> &middot;{" "}
                {player.live_ovr} OVR
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              {ATTRS.map(([label, key]) => (
                <div key={key} className="rounded-2xl bg-board/60 p-4 text-center">
                  <dt className="font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
                  <dd className="mt-1 text-2xl font-black">{player[key]}</dd>
                </div>
              ))}
            </dl>

            <p className="text-sm text-ink-faint">
              This rating is live &mdash; it changes with published football sessions.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
