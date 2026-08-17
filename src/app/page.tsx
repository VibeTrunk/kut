import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { LogoutButton } from "@/components/logout-button";
import { StarterClaimForm } from "@/components/starter-claim-form";
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

  const [{ data: profile, error: profileError }, ratingsResponse, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("profiles")
      .select("role, is_disabled, starter_claimed_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("public_live_ratings")
      .select("id, slug, display_name, archetype, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier")
      .order("live_ovr", { ascending: false })
      .order("display_name"),
    searchParams,
  ]);
  const { data, error } = ratingsResponse;

  if (profileError) {
    throw new Error("Could not verify your KUT membership.");
  }

  if (!profile || profile.is_disabled) {
    redirect("/login");
  }

  const isAdmin = profile.role === "admin" || profile.role === "superadmin";

  if (error) {
    throw new Error("Could not load the published Live Ratings.");
  }

  const ratings = (data ?? []) as LiveRating[];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">
            Terrible Football Haarlem
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            KUT Player Ratings
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            Published attendance updates these Live Ratings automatically. Only signed-in KUT members can view them.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Link className="inline-flex min-h-12 items-center rounded-xl border border-slate-600 px-4 font-bold text-slate-100 hover:border-amber-400 hover:text-amber-300" href="/club">
            My Club
          </Link>
          {isAdmin && (
            <Link className="inline-flex min-h-12 items-center rounded-xl bg-amber-400 px-4 font-bold text-slate-950" href="/admin/attendance">
              Admin attendance
            </Link>
          )}
          <LogoutButton />
        </div>

        {!profile.starter_claimed_at && <StarterClaimForm />}
        {query.starter === "1" && (
          <p className="rounded-xl bg-emerald-950 p-4 font-semibold text-emerald-200">
            Starter pack claimed: 250 KUT Coins and three Live Cards are now yours. <Link className="underline" href="/club">View My Club</Link>.
          </p>
        )}

        {ratings.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-300">
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
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
