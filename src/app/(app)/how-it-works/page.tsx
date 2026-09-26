import Link from "next/link";
import { ARCHETYPES, ARCHETYPE_CHANGE_COOLDOWN_DAYS, ARCHETYPE_LABELS } from "@/game/archetypes";
import { GAME_CONFIG } from "@/game/config";
import { ECONOMY } from "@/game/economy";
import { bracketShape } from "@/game/midweek/bracket";
import { MIDWEEK } from "@/game/midweek/config";
import { roundPayouts } from "@/game/midweek/rewards";
import {
  ARCHETYPE_OFFSETS,
  RARITY_BANDS,
  calculateActivityOvr,
  calculateLiveDiscardValue,
} from "@/game/rating-engine";
import { requireUser } from "@/lib/auth/user";
import { LOCK_CLOCK, ROUND_ONE_CLOCK } from "@/lib/midweek/entry";

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

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="scroll-mt-6 space-y-3 rounded-3xl border border-line/60 bg-panel/60 p-6"
      id={id}
    >
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
  // Midweek Madness coins per win (§44.7), for a full bracket of each size.
  const midweekPayRows = [4, 8, 16, 32].map((entrants) => ({
    entrants,
    pays: roundPayouts(bracketShape(entrants).rounds),
  }));

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">
            The rules
          </p>
          <h1 className="display text-5xl sm:text-6xl">How KUT works</h1>
          <p className="text-lg leading-8 text-ink-dim">
            Real Terrible Football Haarlem attendance and goals drive every card&rsquo;s rating and
            rarity. Show up, collect your teammates, open packs, and trade.
          </p>
        </header>

        <Section title="1. Attendance builds your Activity Score">
          <p>
            Every football week that has at least one published session, each player&rsquo;s hidden
            Activity Score (0&ndash;100) updates:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              It first decays to {Math.round(GAME_CONFIG.activityWeeklyDecay * 100)}% of its
              previous value.
            </li>
            <li>+{GAME_CONFIG.activityFirstAppearance} if you attended at least once that week.</li>
            <li>
              +{GAME_CONFIG.activitySecondAppearance} more if you attended a second session (Monday
              and Friday).
            </li>
          </ul>
          <p>
            A week with no TFH session changes nothing &mdash; nobody gains, nobody decays. Miss
            football and your score just decays that week.
          </p>
          <p className="text-sm">
            Example: from 0, attending once a week &rarr; ~
            {Math.round(GAME_CONFIG.activityFirstAppearance)} after week 1, ~27 after week 2, ~48
            after week 4, capping near 100 around week 12.
          </p>
          <p className="rounded-xl bg-moss-bg/50 p-3 text-sm font-semibold text-moss">
            Showing up also pays: every published session you attend credits{" "}
            {ECONOMY.attendanceCoinReward} KUT Coins straight to your wallet, with a dated note in
            your{" "}
            <Link className="underline" href="/messages">
              Messages
            </Link>
            . It lands once the admin publishes that session&rsquo;s attendance. Whoever brings the
            bibs to the session gets a one-off +{ECONOMY.bibsCoinBonus} KUT Coins on top.
          </p>
        </Section>

        <Section title="2. Activity Score becomes your Overall (OVR)">
          <p>
            Your card&rsquo;s activity-based OVR is{" "}
            <code>
              30 + 45 &times; (activity / 100) <sup>0.8</sup>
            </code>
            , then any Form bonus is added on top. Live OVR is capped between{" "}
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
            For new-rule sessions, attendees privately report goals and may recognize teammates in
            three positive categories. Goals add up to 1.5 Form. One recognized kudos category gives
            1 Form; two give 1.5 and three give 2. A single session contributes at most 3.5 Form
            combined. Each session contribution fades across the next four published sessions at
            100%, 75%, 50%, 25%, then zero; total Form is capped at {GAME_CONFIG.formCap}.
            Completing every field, including an explicit zero and Skip choices, pays{" "}
            {ECONOMY.sessionReportReward} KUT Coins once. Earlier sessions retain their original
            weekly goal formula, so historical ratings do not silently change.
          </p>
        </Section>

        <Section title="4. Injured? Your card is protected">
          <p>
            A long-term injury shouldn&rsquo;t cost you your card. Ask an admin to put you in{" "}
            <strong>injury mode</strong> from the date you got hurt. From then on, every football
            week you sit out:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              A <strong>rehab check-in</strong> appears on Home once that week&rsquo;s session is
              published. You can still do it the following week if you missed it.
            </li>
            <li>
              Checking in pays <strong>{ECONOMY.injuryStipend} KUT Coins</strong> and keeps your
              Activity where it was, so your OVR doesn&rsquo;t drop for that week.
            </li>
            <li>
              A week you don&rsquo;t check in for decays as normal. Only this week and last week can
              be checked in, so older weeks can&rsquo;t be protected afterwards.
            </li>
          </ul>
          <p>
            Form still fades as usual, so your card settles on its attendance base. Your cards go
            into <strong>plaster, signed by the club</strong>, while it lasts. Injury mode ends by
            itself the first time you play a session again.
          </p>
          <p className="rounded-xl bg-moss-bg/50 p-3 text-sm font-semibold text-moss">
            Coming back pays off too. If you checked in for at least 3 weeks, your first session
            back earns a <strong>comeback boost</strong>: 0.25 Form for every week you checked in,
            up to 2 Form. Like any Form, it fades over your next four sessions.
          </p>
        </Section>

        <Section title="5. OVR sets your rarity tier">
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
          <p>
            Every Live copy of a player shares the same current rating, so crossing a tier upgrades
            them all at once.
          </p>
        </Section>

        <Section title="6. Archetypes reshape the six stats">
          <p>
            Your archetype doesn&rsquo;t change your OVR &mdash; it redistributes it across the six
            attributes. There&rsquo;s one for each style of player, including a Goalkeeper profile.
            You can pick your own from{" "}
            <Link className="font-semibold text-brass underline" href="/settings/card">
              your card settings
            </Link>
            .
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

        <Section title="7. Packs">
          <p>
            A <strong>TFH Pack</strong> costs {ECONOMY.basicPackPrice} KUT Coins and gives{" "}
            {ECONOMY.basicPackCardCount} Live Cards. Draws are weighted by rarity, so Common players
            come up far more often than Gold or better. The result is fixed the moment you open
            &mdash; refreshing never rerolls it.
          </p>
          <Link className="inline-block font-semibold text-brass underline" href="/club/packs">
            Open a pack &rarr;
          </Link>
        </Section>

        <Section title="8. Discard">
          <p>
            Discarding permanently burns a card for a guaranteed payout based on its current OVR (
            <code>
              round(10 &times; 1.08 <sup>OVR&minus;30</sup>)
            </code>
            ). Every card you own can be discarded, unless it has an active market listing or is
            committed to a pending trade offer.
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

        <Section title="9. Transfer market & trade offers">
          <p>
            List any card at a buy-now price (within server-set bounds), choosing whether it runs
            for {ECONOMY.listingDurationChoiceHours.join(" or ")} hours. When it sells, a{" "}
            {ECONOMY.marketTaxPercent}% tax (minimum 1 coin) is <strong>burned</strong> &mdash; it
            doesn&rsquo;t go to anyone &mdash; and the seller gets the rest. A listed card is locked
            until it sells, is cancelled, or expires.
          </p>
          <p>
            Instead of paying the buy-now price, you can <strong>make an offer</strong>: some KUT
            Coins and/or up to {ECONOMY.tradeOfferMaxCards} of your own cards. Everything you offer
            is held in escrow until the seller accepts or declines, or the offer expires after{" "}
            {ECONOMY.tradeOfferExpiryHours} hours. Accepting an offer pays the seller the coins
            (minus the same {ECONOMY.marketTaxPercent}% burn), swaps the cards, and cancels every
            other offer on that listing. Your{" "}
            <Link className="font-semibold text-brass underline" href="/market/offers">
              Trade offers
            </Link>{" "}
            page tracks both sides.
          </p>
          <Link className="inline-block font-semibold text-brass underline" href="/market">
            Browse the market &rarr;
          </Link>
        </Section>

        <Section title="10. Club Value & the leaderboard">
          <p>Your Club Value is a plain sum of three numbers:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>your wallet balance in KUT Coins;</li>
            <li>
              plus each edition&rsquo;s weighted copies: the first contributes 100% of discard
              value, the second 20%, the third 5%, and later copies 0%;
            </li>
            <li>
              plus your linked player&rsquo;s own Live-card discard value, counted{" "}
              <strong>{ECONOMY.personalCardClubWeight}&times;</strong> &mdash; showing up to
              football is the fastest way to grow your club.
            </li>
          </ul>
          <p>
            The{" "}
            <Link className="font-semibold text-brass underline" href="/leaderboard">
              leaderboard
            </Link>{" "}
            ranks every club by that total, and{" "}
            <Link className="font-semibold text-brass underline" href="/club/value">
              your Club Value page
            </Link>{" "}
            shows the full breakdown card by card.
          </p>
        </Section>

        <Section title="11. Messages">
          <p>
            Your{" "}
            <Link className="font-semibold text-brass underline" href="/messages">
              Messages
            </Link>{" "}
            inbox keeps a private record of your club and market activity &mdash; sales, purchases,
            and coin rewards. Only you can read it.
          </p>
        </Section>

        {/* Section 12 (HowItWorks-Midweek). It is the rules page, so it stays
            up even while Midweek Madness is disabled (ADR-097). Every number
            comes from the engine's config, never typed into the copy. */}
        <Section id="midweek" title="12. Midweek Madness">
          <p>
            Every Wednesday, {MIDWEEK.squadSize} of your cards play a knockout against everyone
            else&rsquo;s. You pick them during the week, the bracket is played the moment squads
            lock, and the results come out round by round that evening.
          </p>
          <h3 className="pt-2 font-black text-ink">The week</h3>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Pick up to {MIDWEEK.squadSize} cards from your collection,{" "}
              <strong className="text-ink">one per Player</strong>, any time until{" "}
              <strong className="text-ink">Wednesday {LOCK_CLOCK}</strong>. Change them as often as
              you like.
            </li>
            <li>
              Round 1 comes out at {ROUND_ONE_CLOCK}, then a round every{" "}
              {MIDWEEK.schedule.revealIntervalMinutes} minutes until the final.
            </li>
            <li>
              No TFH session the week before means a club break: no Midweek Madness that week.
            </li>
          </ul>
          <h3 className="pt-2 font-black text-ink">If you don&rsquo;t pick</h3>
          <p>
            You still play. An <strong className="text-ink">auto squad</strong> of up to{" "}
            {MIDWEEK.squadSize} random Players from your collection takes your place, heavily
            handicapped. It rarely gets far; picking is always better. Empty slots are filled by{" "}
            <strong className="text-ink">trialists</strong>: Common All-rounders at OVR{" "}
            {MIDWEEK.trialist.ovr}, handicapped so a real card always beats one.
          </p>
          <h3 className="pt-2 font-black text-ink">What makes a card strong</h3>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong className="text-ink">OVR</strong> counts, but only a little: the gap between a
              Common and a Holo is small.
            </li>
            <li>
              <strong className="text-ink">Form</strong>: each Player gets one roll for the week,
              the same for every squad that fields them.
            </li>
            <li>
              <strong className="text-ink">Pick</strong>: the fewer managers who pick a Player, the
              bigger their boost. Popular picks get a small dent.
            </li>
            <li>
              <strong className="text-ink">Fitness</strong>: an injured Player&rsquo;s Live card
              plays on, at slightly less.
            </li>
            <li>
              <strong className="text-ink">Day</strong>: a fresh roll every match, so upsets happen.
            </li>
          </ul>
          <p>
            Archetypes set your shape: attackers make chances, playmakers create them, defenders
            stop them. <strong className="text-ink">Take a Goalkeeper</strong>: without one, your
            best defender goes in goal and keeps goal much worse. A week plays each card&rsquo;s
            archetype as it was when that week opened, so the picker never changes under you. You
            can change your own archetype once every {ARCHETYPE_CHANGE_COOLDOWN_DAYS} days; in
            Midweek Madness it counts from the next week.
          </p>
          <h3 className="pt-2 font-black text-ink">Coins</h3>
          <p>
            Every match you win pays KUT Coins, more each round. A bye counts as a win. The champion
            takes {MIDWEEK.championTotal} in all. Coins are paid after the final.
          </p>
          <table className="w-full max-w-md text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 pr-4 font-bold uppercase tracking-wide">Entrants</th>
                <th className="py-1 font-bold uppercase tracking-wide">
                  Pay per win, round by round
                </th>
              </tr>
            </thead>
            <tbody>
              {midweekPayRows.map((row) => (
                <tr key={row.entrants} className="border-t border-line/60">
                  <td className="py-1 pr-4 tabular-nums">up to {row.entrants}</td>
                  <td className="py-1 tabular-nums">{row.pays.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="pt-2 font-black text-ink">What other members see</h3>
          <p className="rounded-xl bg-steel-bg/60 p-3 text-sm font-semibold text-steel">
            From {ROUND_ONE_CLOCK} on the Wednesday, members see the five cards you entered (or your
            auto squad) and their numbers for the week. Nobody ever sees the rest of your
            collection. Owner counts are shown only when at least {MIDWEEK.ownerCountMin} members
            own a Player. Don&rsquo;t want to take part?{" "}
            <Link className="underline" href="/settings">
              Opt out in Settings
            </Link>{" "}
            and you&rsquo;re never entered or shown.
          </p>
          <h3 className="pt-2 font-black text-ink">Fair draws</h3>
          <p>
            Every draw comes from a secret seed fixed before anyone picks. Its fingerprint, the{" "}
            <strong className="text-ink">fairness seal</strong>, is on the page all week, and the
            seed is published after the final so anyone can check it. Nobody, admins included, can
            re-roll a week.
          </p>
        </Section>
      </section>
    </main>
  );
}
