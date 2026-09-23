import Link from "next/link";
import { notFound } from "next/navigation";
import { AttributeBars } from "@/components/card-stats";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { RatingBreakdownStory } from "@/components/rating-breakdown";
import { requireUser } from "@/lib/auth/user";
import type { FormContribution, RatingBreakdown } from "@/lib/rating-story";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { DiscardCardForm } from "../discard-card-form";
import { CreateListingForm } from "../create-listing-form";
import { CancelListingForm } from "../cancel-listing-form";

type CardPageProps = {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ listed?: string; listingCancelled?: string }>;
};

type CollectionCard = {
  card_id: string;
  edition_id: string;
  edition_title: string;
  edition_type: string;
  is_live: boolean;
  source: string;
  display_name: string;
  player_id: string;
  player_slug: string;
  archetype: string;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  discard_value: number;
  active_listing_id: string | null;
  active_listing_price: number | null;
  active_listing_expires_at: string | null;
  held_by_offer_id: string | null;
  photo_path: string | null;
};

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function CardDetailPage({ params, searchParams }: CardPageProps) {
  await requireUser();
  const { cardId } = await params;
  // A malformed id (a stray path segment) fails the `uuid` cast below with a
  // query error instead of the intended "not found" (KB-007).
  if (!isUuid(cardId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select(
      "card_id, edition_id, edition_title, edition_type, is_live, source, player_id, player_slug, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, discard_value, active_listing_id, active_listing_price, active_listing_expires_at, held_by_offer_id, photo_path",
    )
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load this card.");
  }

  if (!data) {
    notFound();
  }

  const card = data as CollectionCard;
  const [photoUrls, injuredPlayerIds] = await Promise.all([
    resolvePhotoUrls(supabase, [card.photo_path]),
    fetchInjuredPlayerIds(supabase),
  ]);
  // ADR-074: the rating story applies only to a Live card. A Special edition is
  // a frozen snapshot, so explaining a current OVR would misdescribe it. Both
  // reads are non-critical — a failure renders the page without the story
  // rather than 500ing, matching how the rating graph treats its own queries.
  const [query, boundsResponse, valueResponse, breakdownResponse, contributionsResponse] =
    await Promise.all([
      searchParams,
      !card.active_listing_id
        ? supabase.schema("kut").rpc("get_listing_bounds", { p_card_id: card.card_id })
        : Promise.resolve({ data: null, error: null }),
      supabase
        .schema("kut")
        .from("my_club_value_copies")
        .select("weight_percent,club_value_contribution,club_value_change_if_discarded")
        .eq("card_id", card.card_id)
        .maybeSingle(),
      card.is_live
        ? supabase
            .schema("kut")
            .from("player_rating_breakdown")
            .select(
              "live_ovr, form_score, activity_score, form_bonus, attendance_base, is_ovr_capped",
            )
            .eq("player_id", card.player_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      card.is_live
        ? supabase
            .schema("kut")
            // "*" rather than a column list: ADR-083 appended source and
            // protected_weeks, and the page ships before the hosted schema does.
            .from("player_form_contributions")
            .select("*")
            .eq("player_id", card.player_id)
            .order("session_date", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ]);
  const bounds =
    boundsResponse.data && typeof boundsResponse.data === "object" ? boundsResponse.data : null;
  const minimumPrice = bounds && "minimum_price" in bounds ? Number(bounds.minimum_price) : null;
  const maximumPrice = bounds && "maximum_price" in bounds ? Number(bounds.maximum_price) : null;
  const copyValue = valueResponse.data as {
    weight_percent: number;
    club_value_contribution: number;
    club_value_change_if_discarded: number;
  } | null;
  const ratingBreakdown = (breakdownResponse.data as RatingBreakdown | null) ?? null;
  const formContributions = (contributionsResponse.data as FormContribution[] | null) ?? [];

  const cardPlayer = toLiveCardPlayer(card, injuredPlayerIds, photoUrls);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8 py-4 sm:py-8">
        <Link className="text-sm font-bold text-brass hover:underline" href="/club/collection">
          &larr; Collection
        </Link>

        <div className="grid gap-10 md:grid-cols-[minmax(240px,330px)_minmax(0,1fr)] md:items-start lg:gap-16">
          <div>
            <LiveCard size="detail" player={cardPlayer} />
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
                {card.is_live ? "Live card" : "Special card"} &middot;{" "}
                <span className="capitalize">{card.rarity_tier}</span>
              </p>
              <h1 className="display text-3xl sm:text-6xl">{card.display_name}</h1>
              <p className="text-base text-ink-dim">
                {card.is_live
                  ? "This card’s rating is live and changes with published football sessions."
                  : card.edition_title}
              </p>
            </div>

            <AttributeBars player={card} />

            {card.is_live && ratingBreakdown && (
              <RatingBreakdownStory
                breakdown={ratingBreakdown}
                contributions={formContributions}
                playerName={card.display_name}
              />
            )}

            <Link
              className="block text-sm font-bold text-brass hover:underline"
              href={`/players/${card.player_slug}`}
            >
              See {card.display_name.split(" ")[0]}&rsquo;s rating history &rarr;
            </Link>

            {query.listed === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-sm font-bold text-moss">
                Listed successfully. This card is locked until the listing expires or you cancel it.
              </p>
            )}
            {query.listingCancelled === "1" && (
              <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 text-sm font-bold text-moss">
                Listing cancelled. This card is available again.
              </p>
            )}

            {card.held_by_offer_id && (
              <p className="rounded-2xl border border-brass/40 bg-brass/10 p-4 text-sm font-bold text-brass">
                This card is committed to a pending trade offer. It can&rsquo;t be listed or
                discarded until that offer is accepted, declined, or expires.
              </p>
            )}
            {!card.held_by_offer_id && card.active_listing_id && card.active_listing_price && (
              <CancelListingForm
                cardId={card.card_id}
                expiresAt={card.active_listing_expires_at}
                listingId={card.active_listing_id}
                price={card.active_listing_price}
              />
            )}
            {!card.held_by_offer_id && !card.active_listing_id && (
              <>
                {minimumPrice !== null && maximumPrice !== null && (
                  <CreateListingForm
                    cardId={card.card_id}
                    maximumPrice={maximumPrice}
                    minimumPrice={minimumPrice}
                  />
                )}
                <DiscardCardForm cardId={card.card_id} discardValue={card.discard_value} />
              </>
            )}

            <hr className="border-line/40" />

            <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                  Edition
                </dt>
                <dd className="mt-1.5 text-lg font-black">{readable(card.edition_type)}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                  Source
                </dt>
                <dd className="mt-1.5 text-lg font-black">{readable(card.source)}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                  Discard payout
                </dt>
                <dd className="mt-1.5 text-lg font-black tabular-nums">
                  {card.discard_value} KUT Coins
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                  Adds to Club Value
                </dt>
                <dd className="mt-1.5 text-lg font-black tabular-nums">
                  {copyValue?.club_value_contribution ?? 0}{" "}
                  <span className="text-xs text-ink-dim">({copyValue?.weight_percent ?? 0}%)</span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
                  Card ID
                </dt>
                <dd className="mt-1.5 break-all font-mono text-xs text-ink-dim">{card.card_id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
