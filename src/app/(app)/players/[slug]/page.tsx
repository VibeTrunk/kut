import Link from "next/link";
import { notFound } from "next/navigation";
import { archetypeLabel } from "@/game/archetypes";
import { AttributeBars } from "@/components/card-stats";
import {
  RatingHistory,
  buildGoalsByWeek,
  type AttendanceGoalRow,
  type RatingSnapshot,
} from "@/components/rating-history";
import { RatingBreakdownStory } from "@/components/rating-breakdown";
import type { FormContribution, RatingBreakdown } from "@/lib/rating-story";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
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
    .select(
      "id, slug, display_name, archetype, photo_path, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error("Could not load this player.");
  if (!data) notFound();

  const player = data as DirectoryRow;
  const [photoUrls, seasonResponse, attendanceResponse, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(supabase, [player.photo_path]),
    supabase.schema("kut").from("seasons").select("id").eq("is_active", true).maybeSingle(),
    supabase
      .schema("kut")
      .from("attendance")
      .select("goals, match_sessions!inner(session_date, status, rating_rules_version)")
      .eq("player_id", player.id)
      .eq("match_sessions.status", "published"),
    fetchInjuredPlayerIds(supabase),
  ]);
  const snapshotsResponse = seasonResponse.data
    ? await supabase
        .schema("kut")
        .from("player_rating_snapshots")
        .select("week_start, live_ovr, rarity_tier")
        .eq("player_id", player.id)
        .eq("season_id", seasonResponse.data.id)
        .order("week_start")
    : { data: null, error: null };
  // ADR-074: the same "why this rating" story the card page shows, here beneath
  // the history chart. Non-critical like the chart queries — a failure drops the
  // section rather than breaking the profile.
  const [breakdownResponse, contributionsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("player_rating_breakdown")
      .select("live_ovr, form_score, activity_score, form_bonus, attendance_base, is_ovr_capped")
      .eq("player_id", player.id)
      .maybeSingle(),
    supabase
      .schema("kut")
      // "*" rather than a column list: ADR-083 appended source and
      // protected_weeks, and the page ships before the hosted schema does.
      .from("player_form_contributions")
      .select("*")
      .eq("player_id", player.id)
      .order("session_date", { ascending: false }),
  ]);
  const ratingBreakdown = breakdownResponse.error
    ? null
    : ((breakdownResponse.data as RatingBreakdown | null) ?? null);
  const formContributions = contributionsResponse.error
    ? []
    : ((contributionsResponse.data ?? []) as FormContribution[]);
  // Both chart queries are deliberately non-critical.
  const snapshots = snapshotsResponse.error
    ? []
    : ((snapshotsResponse.data ?? []) as RatingSnapshot[]);
  // Goals come from two sources, exactly as the rating engine reads them:
  // admin-entered attendance before the rating-v2 cutover, member-reported
  // results from it on (KB-021). `formContributions` is already loaded above for
  // the story section and holds every published v2 session of the active season,
  // so the second source costs no extra query.
  const attendanceGoals = attendanceResponse.error
    ? []
    : (
        (attendanceResponse.data ?? []) as unknown as {
          goals: number | null;
          match_sessions: { session_date: string; rating_rules_version: number } | null;
        }[]
      )
        .filter((row) => row.match_sessions !== null)
        .map((row): AttendanceGoalRow => ({
          goals: row.goals,
          session_date: row.match_sessions!.session_date,
          rating_rules_version: row.match_sessions!.rating_rules_version,
        }));
  const goalsByWeek = buildGoalsByWeek(attendanceGoals, formContributions);

  const cardPlayer = toLiveCardPlayer(player, injuredPlayerIds, photoUrls);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/players">
          &larr; Players
        </Link>

        <div className="grid gap-10 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start lg:gap-16">
          <div>
            <LiveCard size="detail" player={cardPlayer} />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
                Live card &middot; <span className="capitalize">{player.rarity_tier}</span>
              </p>
              <h1 className="display text-3xl sm:text-6xl">{player.display_name}</h1>
              <p className="text-base text-ink-dim">
                {archetypeLabel(player.archetype)} &middot; {player.live_ovr} OVR &middot; rises and
                falls with published sessions
              </p>
            </div>

            <AttributeBars player={player} />

            <hr className="border-line/40" />
            <RatingHistory
              goalsByWeek={goalsByWeek}
              playerName={player.display_name}
              snapshots={snapshots}
            />

            {ratingBreakdown && (
              <RatingBreakdownStory
                breakdown={ratingBreakdown}
                contributions={formContributions}
                playerName={player.display_name}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
