import Link from "next/link";
import { ARCHETYPES, ARCHETYPE_LABELS } from "@/game/archetypes";
import { GAME_CONFIG } from "@/game/config";
import { ECONOMY } from "@/game/economy";
import {
  ARCHETYPE_OFFSETS,
  RARITY_BANDS,
  calculateActivityOvr,
  calculateLiveDiscardValue,
} from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";

export const metadata = { title: "How KUT works" };

const RARITY_INTENT: Record<(typeof RARITY_BANDS)[number]["tier"], string> = {
  common: "Muted, basic frame",
  bronze: "Warm metallic",
  silver: "Silver metallic",
  gold: "Gold metallic",
  holo: "Animated shimmer",
  elite: "Premium animated treatment",
};

const ATTRS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl border border-line/60 bg-panel/60 p-6">
      <h2 className="display text-2xl">{title}</h2>
      <div className="space-y-3 text-ink-dim">{children}</div>
    </section>
  );
}

export default async function HowItWorksPage() {
  await requireUser();

  const activityOvrRows = [10, 27, 48, 80, 100].map((activity) => ({
    activity,
    ovr: Math.round(calculateActivityOvr(activity)),
  }));
  const discardRows = [30, 40, 50, 60, 70, 80].map((ovr) => ({
    ovr,
    value: calculateLiveDiscardValue(ovr),
  }));

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">The rules</p>
          <h1 className="display text-5xl sm:text-6xl">How KUT works</h1>
          <p className="text-lg leading-8 text-ink-dim">
            Real Terrible Football Haarlem attendance and goals drive every card&rsquo;s rating and rarity.
            Show up, collect your teammates, open packs, and trade.
          </p>
        </header>

        <Section title="1. Attendance builds your Activity Score">
          <p>
            Every football week that has at least one published session, each player&rsquo;s hidden Activity
            Score (0&ndash;100) updates:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>It first decays to {Math.round(GAME_CONFIG.activityWeeklyDecay * 100)}% of its previous value.</li>
            <li>+{GAME_CONFIG.activityFirstAppearance} if you attended at least once that week.</li>
            <li>+{GAME_CONFIG.activitySecondAppearance} more if you attended a second session (Monday and Friday).</li>
          </ul>
          <p>
            A week with no TFH session changes nothing &mdash; nobody gains, nobody decays. Miss football and
            your score just decays that week.
          </p>
          <p className="text-sm">
            Example: from 0, attending once a week &rarr; ~{Math.round(GAME_CONFIG.activityFirstAppearance)} after
            week 1, ~27 after week 2, ~48 after week 4, capping near 100 around week 12.
          </p>
          <p className="rounded-xl bg-moss-bg/50 p-3 text-sm font-semibold text-moss">
            Showing up also pays: every published session you attend credits{" "}
            {ECONOMY.attendanceCoinReward} KUT Coins straight to your wallet, with a dated note in your{" "}
            <Link className="underline" href="/messages">Messages</Link>. It lands once the admin
            publishes that session&rsquo;s attendance. Whoever brings the bibs to the session gets a
            one-off +{ECONOMY.bibsCoinBonus} KUT Coins on top.
          </p>
        </Section>

        <Section title="2. Activity Score becomes your Overall (OVR)">
          <p>
            Your card&rsquo;s activity-based OVR is <code>30 + 45 &times; (activity / 100){" "}
            <sup>0.8</sup></code>, then any Form bonus is added on top. Live OVR is capped between{" "}
            {GAME_CONFIG.liveOvrMin} and {GAME_CONFIG.liveOvrMax}.
          </p>
          <table className="w-full max-w-sm text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 pr-4 font-bold uppercase tracking-wide">Activity</th>
                <th className="py-1 font-bold uppercase tracking-wide">Approx. OVR</th>
              </tr>
            </thead>
            <tbody>
              {activityOvrRows.map((row) => (
                <tr key={row.activity} className="border-t border-line/60">
                  <td className="py-1 pr-4">{row.activity}</td>
                  <td className="py-1">{row.ovr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="3. Goals and kudos give temporary Form">
          <p>
            For new-rule sessions, attendees privately report goals and may recognize teammates in three positive
            categories. Goals add up to 1.5 Form. One recognized kudos category gives 1 Form; two give 1.5 and three give 2.
            A single session contributes at most 3.5 Form combined. Each session contribution fades
            across the next four published sessions at 100%, 75%, 50%, 25%, then zero; total Form is capped at {GAME_CONFIG.formCap}.
            Completing every field, including an explicit zero and Skip choices, pays {ECONOMY.sessionReportReward} KUT Coins once.
            Earlier sessions retain their original weekly goal formula, so historical ratings do not silently change.
          </p>
        </Section>

        <Section title="4. OVR sets your rarity tier">
          <table className="w-full max-w-md text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 pr-4 font-bold uppercase tracking-wide">Tier</th>
                <th className="py-1 pr-4 font-bold uppercase tracking-wide">OVR</th>
                <th className="py-1 font-bold uppercase tracking-wide">Look</th>
              </tr>
            </thead>
            <tbody>
              {RARITY_BANDS.map((band) => (
                <tr key={band.tier} className="border-t border-line/60">
                  <td className="py-1 pr-4 font-black capitalize">{band.tier}</td>
                  <td className="py-1 pr-4">
                    {band.min}&ndash;{band.max}
                  </td>
                  <td className="py-1">{RARITY_INTENT[band.tier]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Every Live copy of a player shares the same current rating, so crossing a tier upgrades them all at once.</p>
        </Section>

        <Section title="5. Archetypes reshape the six stats">
          <p>
            Your archetype doesn&rsquo;t change your OVR &mdash; it redistributes it across the six attributes.
            There&rsquo;s one for each style of player, including a Goalkeeper profile. You can pick your own from{" "}
            <Link className="font-semibold text-brass underline" href="/settings/card">your card settings</Link>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead className="text-ink-faint">
                <tr>
                  <th className="py-1 pr-3 font-bold uppercase tracking-wide">Archetype</th>
                  {ATTRS.map((attr) => (
                    <th key={attr} className="py-1 pr-3 font-bold uppercase tracking-wide">
                      {attr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ARCHETYPES.map((archetype) => (
                  <tr key={archetype} className="border-t border-line/60">
                    <td className="py-1 pr-3 font-black">{ARCHETYPE_LABELS[archetype]}</td>
                    {ATTRS.map((attr) => {
                      const offset = ARCHETYPE_OFFSETS[archetype][attr];
                      return (
                        <td key={attr} className="py-1 pr-3">
                          {offset > 0 ? `+${offset}` : offset}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="6. Packs">
          <p>
            A <strong>TFH Pack</strong> costs {ECONOMY.basicPackPrice} KUT Coins and gives{" "}
            {ECONOMY.basicPackCardCount} Live Cards. Draws are weighted by rarity, so Common players
            come up far more often than Gold or better. The result is fixed the moment you open &mdash;
            refreshing never rerolls it.
          </p>
          <Link className="inline-block font-semibold text-brass underline" href="/club/packs">
            Open a pack &rarr;
          </Link>
        </Section>

        <Section title="7. Discard">
          <p>
            Discarding permanently burns a card for a guaranteed payout based on its current OVR
            (<code>round(10 &times; 1.08 <sup>OVR&minus;30</sup>)</code>). Every card you own can be discarded,
            unless it has an active market listing or is committed to a pending trade offer.
          </p>
          <table className="w-full max-w-xs text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 pr-4 font-bold uppercase tracking-wide">OVR</th>
                <th className="py-1 font-bold uppercase tracking-wide">Discard value</th>
              </tr>
            </thead>
            <tbody>
              {discardRows.map((row) => (
                <tr key={row.ovr} className="border-t border-line/60">
                  <td className="py-1 pr-4">{row.ovr}</td>
                  <td className="py-1">{row.value} KUT Coins</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="8. Transfer market & trade offers">
          <p>
            List any card at a buy-now price (within server-set bounds) for{" "}
            {ECONOMY.listingDurationHours} hours. When it sells, a {ECONOMY.marketTaxPercent}% tax (minimum 1
            coin) is <strong>burned</strong> &mdash; it doesn&rsquo;t go to anyone &mdash; and the seller gets
            the rest. A listed card is locked until it sells, is cancelled, or expires.
          </p>
          <p>
            Instead of paying the buy-now price, you can <strong>make an offer</strong>: some KUT Coins and/or
            up to {ECONOMY.tradeOfferMaxCards} of your own cards. Everything you offer is held in escrow until
            the seller accepts or declines, or the offer expires after {ECONOMY.tradeOfferExpiryHours} hours.
            Accepting an offer pays the seller the coins (minus the same {ECONOMY.marketTaxPercent}% burn),
            swaps the cards, and cancels every other offer on that listing. Your{" "}
            <Link className="font-semibold text-brass underline" href="/market/offers">Trade offers</Link>{" "}
            page tracks both sides.
          </p>
          <Link className="inline-block font-semibold text-brass underline" href="/market">
            Browse the market &rarr;
          </Link>
        </Section>

        <Section title="9. Club Value & the leaderboard">
          <p>
            Your Club Value is a plain sum of three numbers:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>your wallet balance in KUT Coins;</li>
            <li>
              plus each edition&rsquo;s weighted copies: the first contributes 100% of discard value, the second 20%,
              the third 5%, and later copies 0%;
            </li>
            <li>
              plus your linked player&rsquo;s own Live-card discard value, counted{" "}
              <strong>{ECONOMY.personalCardClubWeight}&times;</strong> &mdash; showing up to football is the
              fastest way to grow your club.
            </li>
          </ul>
          <p>
            The <Link className="font-semibold text-brass underline" href="/leaderboard">leaderboard</Link>{" "}
            ranks every club by that total, and{" "}
            <Link className="font-semibold text-brass underline" href="/club/value">your Club Value page</Link>{" "}
            shows the full breakdown card by card.
          </p>
        </Section>

        <Section title="10. Messages">
          <p>
            Your <Link className="font-semibold text-brass underline" href="/messages">Messages</Link> inbox keeps a
            private record of your club and market activity &mdash; sales, purchases, and coin rewards. Only you
            can read it.
          </p>
        </Section>
      </section>
    </main>
  );
}
