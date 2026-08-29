import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { StarterClaimForm } from "@/components/starter-claim-form";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

type LiveRating = {
  id: string;
  slug: string;
  display_name: string;
  archetype: string;
  live_ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: string;
  photo_path: string | null;
};

type HomePageProps = {
  searchParams: Promise<{ starter?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    redirect("/login");
  }

  const [{ data: profile, error: profileError }, ratingsResponse, walletResponse, clubValueResponse, rankResponse, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("profiles")
      .select("role, is_disabled, starter_claimed_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("public_live_ratings")
      .select("id, slug, display_name, archetype, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path")
      .order("live_ovr", { ascending: false })
      .order("display_name"),
    supabase.schema("kut").from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.schema("kut").from("my_club_value").select("club_value").maybeSingle(),
    supabase.schema("kut").from("club_value_leaderboard").select("rank").eq("is_current_user", true).maybeSingle(),
    searchParams,
  ]);
  const { data, error } = ratingsResponse;

  if (profileError) {
    throw new Error("Could not verify your KUT membership.");
  }

  if (!profile || profile.is_disabled) {
    redirect("/login");
  }

  if (error) {
    throw new Error("Could not load the published Live Ratings.");
  }

  const ratings = (data ?? []) as LiveRating[];
  const photoUrls = await resolvePhotoUrls(supabase, ratings.map((player) => player.photo_path));
  const balance = walletResponse.data?.balance ?? 0;
  const clubValue = clubValueResponse.data?.club_value ?? balance;
  const rank = rankResponse.data?.rank ?? null;

  return (
    <main className="min-h-screen bg-board p-6 text-ink sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">
            Terrible Football Haarlem
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            KUT Player Ratings
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-ink-dim">
            Published attendance updates these Live Ratings automatically. Only signed-in KUT members can view them.
          </p>
          <p className="text-sm">
            <Link className="font-semibold text-brass underline" href="/how-it-works">
              New here? How KUT works &rarr;
            </Link>
          </p>
        </header>

        {profile.starter_claimed_at && (
          <dl className="flex flex-wrap gap-3">
            <div className="min-w-28 rounded-2xl border border-line bg-panel/60 px-4 py-3">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">KUT Coins</dt>
              <dd className="mt-1 text-2xl font-black text-brass">{balance.toLocaleString()}</dd>
            </div>
            <div className="min-w-28 rounded-2xl border border-line bg-panel/60 px-4 py-3">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Club Value</dt>
              <dd className="mt-1 text-2xl font-black">{Number(clubValue).toLocaleString()}</dd>
            </div>
            {rank !== null && (
              <div className="min-w-28 rounded-2xl border border-steel-line/40 bg-steel-bg/30 px-4 py-3">
                <dt className="text-xs font-black uppercase tracking-[0.13em] text-steel">Rank</dt>
                <dd className="mt-1 text-2xl font-black text-steel">#{rank}</dd>
              </div>
            )}
            <Link
              className="flex min-w-28 items-center justify-center rounded-2xl border border-brass/50 bg-brass/10 px-4 py-3 text-sm font-black text-brass hover:bg-brass/20"
              href="/club/packs"
            >
              Open a pack →
            </Link>
          </dl>
        )}

        {!profile.starter_claimed_at && <StarterClaimForm />}
        {query.starter === "1" && (
          <p className="rounded-xl bg-moss-bg p-4 font-semibold text-moss">
            Starter pack claimed: 250 KUT Coins and three Live Cards are now yours.{" "}
            <Link className="underline" href="/club/collection">View My Collection</Link> or read{" "}
            <Link className="underline" href="/how-it-works">how KUT works</Link>.
          </p>
        )}

        {ratings.length === 0 ? (
          <p className="rounded-2xl border border-line bg-panel p-5 text-ink-dim">
            No Live Ratings have been published for the active season yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-5">
            {ratings.map((player) => (
              <LiveCard
                key={player.id}
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
                  rarityTier: player.rarity_tier as LiveCardPlayer["rarityTier"],
                  photoUrl: player.photo_path ? photoUrls.get(player.photo_path) ?? null : null,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
