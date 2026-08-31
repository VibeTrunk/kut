import Link from "next/link";
import { ECONOMY } from "@/game/economy";
import { calculateLiveDiscardValue } from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Club Value" };

type ClubValueRow = {
  wallet_balance: number;
  card_count: number;
  unique_player_count: number;
  owned_cards_value: number;
  personal_card_weight: number;
  personal_card_player_name: string | null;
  personal_card_player_slug: string | null;
  personal_card_ovr: number;
  personal_card_base_value: number;
  personal_card_bonus: number;
  club_value: number;
};

type OwnedCard = {
  card_id: string;
  display_name: string;
  ovr: number;
  rarity_tier: string;
  discard_value: number;
  is_live: boolean;
  edition_title: string;
};

const nf = new Intl.NumberFormat("en-US");

export default async function ClubValuePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [valueResponse, cardsResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_club_value")
      .select(
        "wallet_balance, card_count, unique_player_count, owned_cards_value, personal_card_weight, personal_card_player_name, personal_card_player_slug, personal_card_ovr, personal_card_base_value, personal_card_bonus, club_value",
      )
      .maybeSingle(),
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select("card_id, display_name, ovr, rarity_tier, discard_value, is_live, edition_title")
      .order("discard_value", { ascending: false })
      .order("display_name"),
  ]);

  if (valueResponse.error || cardsResponse.error) {
    throw new Error("Could not load your Club Value breakdown.");
  }

  const value =
    (valueResponse.data as ClubValueRow | null) ?? {
      wallet_balance: 0,
      card_count: 0,
      unique_player_count: 0,
      owned_cards_value: 0,
      personal_card_weight: ECONOMY.personalCardClubWeight,
      personal_card_player_name: null,
      personal_card_player_slug: null,
      personal_card_ovr: 0,
      personal_card_base_value: 0,
      personal_card_bonus: 0,
      club_value: 0,
    };
  const cards = (cardsResponse.data ?? []) as OwnedCard[];
  const weight = value.personal_card_weight || ECONOMY.personalCardClubWeight;
  const discardRows = [30, 40, 50, 60, 70, 80].map((ovr) => ({ ovr, value: calculateLiveDiscardValue(ovr) }));

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">My club</p>
          <h1 className="display text-5xl sm:text-6xl">Club Value</h1>
          <p className="text-ink-dim">
            {user.displayName}&rsquo;s Club Value is a plain sum of three numbers you can check yourself.
            The <Link className="font-semibold text-brass underline" href="/leaderboard">leaderboard</Link>{" "}
            ranks every club by it.
          </p>
        </header>

        <div className="rounded-3xl border border-steel-line/40 bg-steel-bg/30 p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-steel">Your Club Value</p>
          <p className="mt-1 text-4xl font-black text-steel">{nf.format(value.club_value)} KUT Coins</p>
          <p className="mt-3 text-sm text-ink-dim">
            {nf.format(value.wallet_balance)} coins + {nf.format(value.owned_cards_value)} owned-card value +{" "}
            {nf.format(value.personal_card_bonus)} personal-card bonus
          </p>
        </div>

        {/* 1. Coins ------------------------------------------------------ */}
        <section className="space-y-2 rounded-3xl border border-line/60 bg-panel/60 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-2xl">1. KUT Coins</h2>
            <p className="text-xl font-black text-brass">{nf.format(value.wallet_balance)}</p>
          </div>
          <p className="text-sm text-ink-dim">Your current wallet balance, counted at face value.</p>
        </section>

        {/* 2. Owned cards --------------------------------------------------- */}
        <section className="space-y-3 rounded-3xl border border-line/60 bg-panel/60 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-2xl">2. Cards you own</h2>
            <p className="text-xl font-black text-brass">{nf.format(value.owned_cards_value)}</p>
          </div>
          <p className="text-sm text-ink-dim">
            The <strong>discard value</strong> of every unburned card in your collection, added up &mdash;{" "}
            {value.card_count} {value.card_count === 1 ? "card" : "cards"} across {value.unique_player_count}{" "}
            {value.unique_player_count === 1 ? "player" : "players"}. Discard value is{" "}
            <code>round(10 &times; 1.08 <sup>OVR&minus;30</sup>)</code> (special editions keep their own multiplier).
          </p>
          {cards.length > 0 && (
            <details className="group rounded-2xl border border-line/70 bg-board/50 p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink-dim group-open:text-brass">
                Show the {cards.length}-card breakdown
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[24rem] text-left text-sm">
                  <thead className="text-ink-faint">
                    <tr>
                      <th className="py-1 pr-3 font-bold uppercase tracking-wide">Player</th>
                      <th className="py-1 pr-3 font-bold uppercase tracking-wide">OVR</th>
                      <th className="py-1 pr-3 font-bold uppercase tracking-wide">Tier</th>
                      <th className="py-1 text-right font-bold uppercase tracking-wide">Discard value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => (
                      <tr key={card.card_id} className="border-t border-line/50">
                        <td className="py-1 pr-3">
                          {card.display_name}
                          {!card.is_live && (
                            <span className="ml-1 text-xs text-ink-faint">({card.edition_title})</span>
                          )}
                        </td>
                        <td className="py-1 pr-3">{card.ovr}</td>
                        <td className="py-1 pr-3 capitalize">{card.rarity_tier}</td>
                        <td className="py-1 text-right tabular-nums">{nf.format(card.discard_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line font-black">
                      <td className="py-1 pr-3" colSpan={3}>
                        Subtotal
                      </td>
                      <td className="py-1 text-right tabular-nums text-brass">
                        {nf.format(value.owned_cards_value)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          )}
        </section>

        {/* 3. Personal card ---------------------------------------------- */}
        <section className="space-y-3 rounded-3xl border border-line/60 bg-panel/60 p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-2xl">3. Your personal card &times;{weight}</h2>
            <p className="text-xl font-black text-brass">{nf.format(value.personal_card_bonus)}</p>
          </div>
          {value.personal_card_player_name ? (
            <>
              <p className="text-sm text-ink-dim">
                Your own Live card &mdash;{" "}
                <Link
                  className="font-semibold text-brass underline"
                  href={`/players/${value.personal_card_player_slug}`}
                >
                  {value.personal_card_player_name}
                </Link>{" "}
                at OVR {value.personal_card_ovr} &mdash; is worth {nf.format(value.personal_card_base_value)}{" "}
                discard value, and it counts <strong>{weight}&times;</strong> toward your Club Value.
              </p>
              <p className="rounded-xl bg-board/60 p-3 text-sm font-semibold tabular-nums">
                {nf.format(value.personal_card_base_value)} &times; {weight} ={" "}
                <span className="text-brass">{nf.format(value.personal_card_bonus)}</span>
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-board/60 p-3 text-sm text-ink-dim">
              No player is linked to your account yet, so this part is 0. Ask an admin to link your account to
              your TFH player &mdash; then showing up to football lifts your Club Value {weight}&times; as fast
              as any card you could collect.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-3xl border border-line bg-panel/40 p-6 text-sm text-ink-dim">
          <h2 className="text-base font-black tracking-tight text-ink">Why the personal card counts more</h2>
          <p>
            KUT is a game about actually turning up to Terrible Football Haarlem. Your personal card&rsquo;s
            OVR is driven purely by your attendance and goals, so weighting it {weight}&times; keeps the
            leaderboard about playing football &mdash; not only about who opened the most packs. Collecting
            still matters: an active collector&rsquo;s card pile usually outweighs a single {weight}&times;
            personal card.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-xs text-left">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-4 font-bold uppercase tracking-wide">Personal OVR</th>
                  <th className="py-1 pr-4 font-bold uppercase tracking-wide">Base</th>
                  <th className="py-1 font-bold uppercase tracking-wide">&times;{weight}</th>
                </tr>
              </thead>
              <tbody>
                {discardRows.map((row) => (
                  <tr key={row.ovr} className="border-t border-line/60 tabular-nums">
                    <td className="py-1 pr-4">{row.ovr}</td>
                    <td className="py-1 pr-4">{nf.format(row.value)}</td>
                    <td className="py-1">{nf.format(row.value * weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-brass px-4 font-black text-brass"
            href="/leaderboard"
          >
            View the leaderboard
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-bold text-ink-dim"
            href="/club/collection"
          >
            Browse your collection
          </Link>
        </div>
      </section>
    </main>
  );
}
