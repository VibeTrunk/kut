import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth/user";
import { getNavContext } from "@/lib/nav/context";
import { buildMarketTabs } from "@/lib/nav/routes";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import { createClient } from "@/lib/supabase/server";
import { RespondToOfferForms, WithdrawOfferForm } from "./offer-response-forms";

export const metadata = { title: "Trade offers" };

type OfferedCard = { card_id: string; display_name: string; ovr: number; rarity_tier: string };
type TradeOffer = {
  offer_id: string;
  status: "active" | "accepted" | "rejected" | "withdrawn" | "expired";
  offered_coins: number;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  coins_to_seller: number | null;
  is_outgoing: boolean;
  proposer_name: string;
  seller_name: string;
  listing_card_name: string;
  listing_card_slug: string;
  listing_price: number;
  listing_status: string;
  offered_card_count: number;
  offered_cards: OfferedCard[];
};

const STATUS_LABEL: Record<TradeOffer["status"], string> = {
  active: "Awaiting response",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function OfferCard({ offer }: { offer: TradeOffer }) {
  const cards = Array.isArray(offer.offered_cards) ? offer.offered_cards : [];
  return (
    <li className="rounded-2xl border border-line/60 bg-panel/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brass">
            {offer.is_outgoing ? `To ${offer.seller_name}` : `From ${offer.proposer_name}`}
          </p>
          <h2 className="mt-1 text-xl font-black">
            <Link className="hover:text-brass" href={`/players/${offer.listing_card_slug}`}>
              {offer.listing_card_name}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-ink-faint">Listed at {offer.listing_price} KUT Coins</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.1em] ${
            offer.status === "active"
              ? "bg-brass/15 text-brass"
              : offer.status === "accepted"
                ? "bg-moss-bg text-moss"
                : "bg-board text-ink-faint"
          }`}
        >
          {STATUS_LABEL[offer.status]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-board/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Offered coins</dt>
          <dd className="mt-1 text-lg font-black tabular-nums">{offer.offered_coins}</dd>
        </div>
        <div className="rounded-xl bg-board/60 p-3">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
            {offer.status === "active" ? "Expires" : "Resolved"}
          </dt>
          <dd className="mt-1 text-sm font-bold">
            {formatDate(offer.status === "active" ? offer.expires_at : offer.resolved_at ?? offer.expires_at)}
          </dd>
        </div>
      </dl>

      {cards.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Plus {cards.length} card(s)</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {cards.map((card) => (
              <li
                key={card.card_id}
                className="rounded-lg border border-line px-2 py-1 text-xs font-semibold"
              >
                {card.display_name} <span className="text-ink-faint">· {card.ovr}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {offer.status === "accepted" && !offer.is_outgoing && offer.coins_to_seller !== null && (
        <p className="mt-3 text-sm font-bold text-moss">You received {offer.coins_to_seller} KUT Coins after the 5% burn.</p>
      )}

      {offer.status === "active" && !offer.is_outgoing && <RespondToOfferForms offerId={offer.offer_id} />}
      {offer.status === "active" && offer.is_outgoing && <WithdrawOfferForm offerId={offer.offer_id} />}
    </li>
  );
}

type OffersPageProps = {
  searchParams: Promise<{ sent?: string; withdrawn?: string; accepted?: string; declined?: string }>;
};

export default async function TradeOffersPage({ searchParams }: OffersPageProps) {
  await requireUser();
  const supabase = await createClient();
  await supabase.schema("kut").rpc("expire_trade_offers");
  const [{ data, error }, query] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_trade_offers")
      .select(
        "offer_id, status, offered_coins, created_at, expires_at, resolved_at, coins_to_seller, is_outgoing, proposer_name, seller_name, listing_card_name, listing_card_slug, listing_price, listing_status, offered_card_count, offered_cards",
      )
      .order("created_at", { ascending: false }),
    searchParams,
  ]);
  if (error) throw new Error("Could not load your trade offers.");
  const { incomingOfferCount } = await getNavContext();
  const marketTabs = buildMarketTabs(incomingOfferCount);
  const offers = (data ?? []) as TradeOffer[];
  const incoming = offers.filter((offer) => !offer.is_outgoing);
  const outgoing = offers.filter((offer) => offer.is_outgoing);
  const flash =
    query.sent === "1"
      ? "Offer sent. Your coins and cards are held until the seller responds."
      : query.withdrawn === "1"
        ? "Offer withdrawn and your escrow refunded."
        : query.accepted === "1"
          ? "Offer accepted. The trade is complete."
          : query.declined === "1"
            ? "Offer declined and the escrow refunded."
            : null;

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Transfer market</p>
          <h1 className="display mt-3 text-3xl sm:text-6xl">Trade offers</h1>
          <p className="mt-3 hidden text-ink-dim sm:block">
            Coin-and-card offers on market listings. Everything you offer is escrowed until the seller accepts or
            declines, or the offer expires.
          </p>
          {/* The Buy tab replaces the old "Back to the market" link. */}
          <div className="mt-5">
            <SectionTabs label="Market" tabs={marketTabs} />
          </div>
        </header>

        {flash && <p className="rounded-2xl border border-moss-line/40 bg-moss-bg/50 p-4 font-bold text-moss">{flash}</p>}

        <div className="space-y-4">
          <h2 className="display text-2xl">Incoming ({incoming.filter((o) => o.status === "active").length})</h2>
          {incoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-dim">
              No offers on your listings yet.
            </p>
          ) : (
            <ul className="space-y-3">{incoming.map((offer) => <OfferCard key={offer.offer_id} offer={offer} />)}</ul>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="display text-2xl">Sent ({outgoing.filter((o) => o.status === "active").length})</h2>
          {outgoing.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-dim">
              You haven&rsquo;t made any offers. Find a listing on the <Link className="text-brass underline" href="/market">market</Link>.
            </p>
          ) : (
            <ul className="space-y-3">{outgoing.map((offer) => <OfferCard key={offer.offer_id} offer={offer} />)}</ul>
          )}
        </div>
      </section>
    </main>
  );
}
