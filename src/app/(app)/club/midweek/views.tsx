import Link from "next/link";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import { MidweekNotice, MidweekSaveStatus, MidweekTrialistCard } from "@/components/midweek/bits";
import { MidweekRevealClock } from "@/components/midweek/clock";
import { MidweekCountdown } from "@/components/midweek/countdown";
import { MidweekMatchRow } from "@/components/midweek/match-row";
import { MidweekMiniCard } from "@/components/midweek/mini-card";
import { MIDWEEK_PAGE, MidweekPageHead, MidweekSectionHead } from "@/components/midweek/page-head";
import { MidweekPath } from "@/components/midweek/path";
import { MidweekSeed } from "@/components/midweek/seed";
import { MIDWEEK } from "@/game/midweek/config";
import { seedHash } from "@/game/midweek/rng";
import { revealAt } from "@/game/midweek/schedule";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer, type OwnedCardRow } from "@/lib/live-card-player";
import {
  formatClock,
  formatDayDate,
  formatDayMonth,
  joinNames,
  lastWeekSummary,
  skipOrVoidNotice,
  type MidweekCurrent,
  type MidweekTournament,
  type MySquadRow,
} from "@/lib/midweek/entry";
import {
  assembleBracket,
  entryCardFace,
  fieldCounts,
  finalLine,
  finishStat,
  myNight,
  nightTotals,
  revealedRounds,
  revealStops,
  wonRounds,
} from "@/lib/midweek/evening";
import { loadMyRewards, loadWeekResults } from "@/lib/midweek/results";
import { resolvePhotoUrls } from "@/lib/player-photos";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PANEL = "rounded-2xl border border-line/60 bg-panel/60 p-5 sm:p-6";
/** Two columns on a phone (the last odd card centred), five from `sm`. */
const FIVE =
  "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5 sm:gap-5 max-sm:[&>:last-child:nth-child(odd)]:col-span-2 max-sm:[&>:last-child:nth-child(odd)]:w-[calc(50%-6px)] max-sm:[&>:last-child:nth-child(odd)]:justify-self-center";

function FiveCards({ cards, label }: { cards: (LiveCardPlayer | null)[]; label: string }) {
  return (
    <ul aria-label={label} className={FIVE}>
      {cards.map((card, index) => (
        <li key={index}>
          {card ? (
            <LiveCard player={card} />
          ) : (
            <MidweekTrialistCard
              slot={index + 1}
              state="trialist"
              trialistOvr={MIDWEEK.trialist.ovr}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

// ---- last week, above the picker -------------------------------------------------

export type LastWeekView =
  | { kind: "notice"; tone: "info" | "warn"; lead: string; rest: string }
  | { kind: "strip"; kicker: string; text: string; href: string };

/**
 * The previous tournament's outcome above the picker (Picker-Saved and the
 * Week-Skipped and Week-Void notices): how far the member got, their coins and
 * the champion, with the bracket one tap away; or why nothing was played.
 */
export async function lastWeekView(
  supabase: SupabaseServerClient,
  userId: string,
  tournament: MidweekTournament,
  consecutive: boolean,
): Promise<LastWeekView | null> {
  const notice = skipOrVoidNotice(tournament, MIDWEEK.minEntrants);
  if (notice) return { kind: "notice", ...notice };
  if (tournament.status !== "complete" || !tournament.rounds) return null;

  const [rewardsResponse, entryResponse] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_midweek_rewards")
      .select("*")
      .eq("tournament_id", tournament.tournament_id),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("user_id")
      .eq("tournament_id", tournament.tournament_id)
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (rewardsResponse.error || entryResponse.error) return null;
  return {
    kind: "strip",
    kicker: consecutive
      ? `Last Wednesday · ${formatDayMonth(tournament.lock_at)}`
      : `Midweek Madness · ${formatDayDate(tournament.lock_at)}`,
    text: lastWeekSummary({
      rounds: tournament.rounds,
      rewards: rewardsResponse.data ?? [],
      entered: (entryResponse.data ?? []).length > 0,
      isChampion: tournament.champion_user_id === userId,
      championName: tournament.champion_name ?? null,
    }),
    href: `/club/midweek/${tournament.week_start}`,
  };
}

export function LastWeek({ view }: { view: LastWeekView }) {
  if (view.kind === "notice") {
    return (
      <MidweekNotice live tone={view.tone}>
        <b>{view.lead}</b> {view.rest}
      </MidweekNotice>
    );
  }
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[14px] border border-line/60 bg-board-deep/55 px-3.5 py-3">
      <p className="col-span-2 text-[0.65rem] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
        {view.kicker}
      </p>
      <p className="text-[13.5px] leading-snug text-ink-dim">{view.text}</p>
      <Link
        className="inline-flex min-h-11 items-center text-sm font-bold whitespace-nowrap text-brass hover:underline"
        href={view.href}
      >
        Bracket &rarr;
      </Link>
    </section>
  );
}

// ---- Wednesday evening ---------------------------------------------------------

/**
 * Between the lock and the final (Week-Locked, Week-Revealing): the member's
 * own night first, then the round that just came out. Coins are shown as won
 * but not yet paid, because payment happens after the final (§44.7).
 */
export async function WeekEvening({
  supabase,
  current,
  now,
  userId,
  squad,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  now: Date;
  userId: string;
  squad: MySquadRow[] | null;
}) {
  const lockAt = current.lock_at as string;
  const weekStart = current.week_start as string;
  const rounds = current.status === "simulated" ? current.rounds : null;
  const results = rounds
    ? await loadWeekResults(supabase, current.tournament_id as string)
    : { matches: [], entries: [] };
  const out = revealedRounds(results.matches);
  const nowIso = now.toISOString();

  if (!rounds || out === 0) {
    return (
      <WeekLocked current={current} now={now} rounds={rounds} squad={squad} supabase={supabase} />
    );
  }

  const night = myNight({ userId, rounds, lockAt, matches: results.matches });
  const stops = revealStops({ lockAt, rounds, now, wonRounds: wonRounds(night) });
  const bracket = assembleBracket({
    rounds,
    lockAt,
    matches: results.matches,
    autoUserIds: new Set(results.entries.filter((row) => row.auto).map((row) => row.user_id)),
  });
  const latest = bracket[out - 1];

  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <MidweekPageHead
          kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
          title={out === rounds ? "The final is out" : `Round ${out} is out`}
        />
        <section aria-label="Tonight" className={PANEL}>
          <MidweekRevealClock label="Wednesday's schedule" stops={stops} />
        </section>
        {night.entered && (
          <section aria-labelledby="night-h" className="grid gap-4">
            <MidweekSectionHead id="night-h" title="Your night">
              <p className="text-[13px] text-ink-faint">
                +{night.coins}
                {night.alive ? " so far" : ""} &middot; paid after the final
              </p>
            </MidweekSectionHead>
            <MidweekPath now={nowIso} rounds={rounds} rows={night.rows} weekStart={weekStart} />
          </section>
        )}
        <section aria-labelledby="latest-h" className="grid gap-4">
          <MidweekSectionHead id="latest-h" title={latest.name}>
            <Link
              className="text-sm font-bold text-brass hover:underline"
              href={`/club/midweek/${weekStart}`}
            >
              Full bracket &rarr;
            </Link>
          </MidweekSectionHead>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2.5">
            {latest.pairs.map((pair) => (
              <MidweekMatchRow
                key={pair.pairing}
                pair={pair}
                revealAt={latest.revealAt}
                weekStart={weekStart}
                you={userId}
              />
            ))}
          </div>
        </section>
        <MidweekSeed seedHash={current.seed_hash as string} />
      </section>
    </main>
  );
}

/** Week-Locked: the lock has passed, round 1 isn't out. Only the member's own five. */
async function WeekLocked({
  supabase,
  current,
  now,
  rounds,
  squad,
}: {
  supabase: SupabaseServerClient;
  current: MidweekCurrent;
  now: Date;
  rounds: number | null;
  squad: MySquadRow[] | null;
}) {
  const lockAt = current.lock_at as string;
  const lock = new Date(lockAt);
  const roundOneAt = revealAt(lock, 1).toISOString();
  const roundOne = formatClock(roundOneAt);
  const stops = rounds ? revealStops({ lockAt, rounds, now, wonRounds: new Set() }) : null;

  let five: { cards: (LiveCardPlayer | null)[]; lost: string[] } | null = null;
  if (!current.opted_out && squad && squad.length > 0) {
    const [collection, injuredPlayerIds] = await Promise.all([
      supabase
        .schema("kut")
        .from("my_collection_cards")
        .select(
          "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
        )
        .in(
          "card_id",
          squad.map((row) => row.card_id),
        ),
      fetchInjuredPlayerIds(supabase),
    ]);
    if (collection.error) throw new Error("Could not load your five.");
    const rows = (collection.data ?? []) as (OwnedCardRow & { card_id: string; ovr: number })[];
    const byCard = new Map(rows.map((row) => [row.card_id, row]));
    const photoUrls = await resolvePhotoUrls(
      supabase,
      rows.map((row) => row.photo_path),
    );
    const missing = squad.filter((row) => !byCard.has(row.card_id)).map((row) => row.player_id);
    const names = new Map<string, string>();
    if (missing.length > 0) {
      const { data } = await supabase
        .schema("kut")
        .from("player_directory")
        .select("id, display_name")
        .in("id", missing);
      for (const row of (data ?? []) as { id: string; display_name: string }[]) {
        names.set(row.id, row.display_name);
      }
    }
    // As the engine plays it: the surviving picks moved up, trialists after them (ADR-095).
    const kept = squad.flatMap((row) => {
      const card = byCard.get(row.card_id);
      return card ? [toLiveCardPlayer(card, injuredPlayerIds, photoUrls)] : [];
    });
    five = {
      cards: [...kept, ...Array.from({ length: MIDWEEK.squadSize - kept.length }, () => null)],
      lost: missing.map((id) => names.get(id) ?? "A Player"),
    };
  }

  const lede = `The bracket is drawn and every match is already decided. Round 1 comes out at ${roundOne}, then a round every half hour.`;
  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <MidweekPageHead
          kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
          lede={lede}
          title="Squads are locked"
        />
        <section aria-label="Tonight" className={`${PANEL} grid gap-[18px]`}>
          {stops && <MidweekRevealClock label="Wednesday's schedule" stops={stops} />}
          <p className="text-center text-[13px] text-ink-dim">
            <b className="text-ink">Round 1 at {roundOne}</b>,{" "}
            <MidweekCountdown now={now.toISOString()} target={roundOneAt} />.
            {rounds && <> The final at {formatClock(revealAt(lock, rounds).toISOString())}.</>}
          </p>
        </section>
        {current.opted_out ? (
          <p className={`${PANEL} text-sm text-ink-dim`}>
            You opted out, so you aren&rsquo;t in tonight.
          </p>
        ) : five ? (
          <section aria-labelledby="five-h" className="grid gap-4">
            <MidweekSectionHead id="five-h" title="Your five">
              <MidweekSaveStatus
                kind={five.lost.length > 0 ? "dirty" : "saved"}
                text={
                  five.lost.length > 0
                    ? `Locked in. ${joinNames(five.lost)} ${five.lost.length === 1 ? "was" : "were"} no longer yours at the lock, so a trialist took ${five.lost.length === 1 ? "that slot" : "those slots"}.`
                    : `Locked in: all ${squad && squad.length === MIDWEEK.squadSize ? "five" : (squad?.length ?? 0)} still yours`
                }
              />
            </MidweekSectionHead>
            <FiveCards cards={five.cards} label="Your five" />
            <p className="flex items-start gap-2.5 text-[13px] leading-normal text-ink-dim">
              Members see these five from {roundOne}, with their numbers for the week.
            </p>
          </section>
        ) : squad !== null ? (
          <p className={`${PANEL} text-sm text-ink-dim`}>
            You didn&rsquo;t pick, so an auto squad plays for you. See it at {roundOne}.
          </p>
        ) : null}
        <MidweekSeed seedHash={current.seed_hash as string} />
      </section>
    </main>
  );
}

// ---- Wednesday night and Thursday: the champion (owner decision D4) --------------

/**
 * Week-Complete: the champion leads, then the member's own result and coins
 * (now paid), the night in numbers, the next week one tap away, and the seed
 * with its check against the seal (§44.8).
 */
export async function WeekComplete({
  supabase,
  tournament,
  next,
  userId,
  now,
}: {
  supabase: SupabaseServerClient;
  tournament: MidweekTournament;
  /** Next week's open tournament, when it exists. */
  next: MidweekCurrent | null;
  userId: string;
  now: Date;
}) {
  const rounds = tournament.rounds as number;
  const [results, rewards] = await Promise.all([
    loadWeekResults(supabase, tournament.tournament_id),
    loadMyRewards(supabase, tournament.tournament_id),
  ]);
  const championId = tournament.champion_user_id ?? null;
  const championCards = results.entries
    .filter((row) => row.user_id === championId)
    .sort((a, b) => a.slot - b.slot);
  const photoUrls = await resolvePhotoUrls(
    supabase,
    championCards.map((row) => row.photo_path),
  );
  const final = results.matches.find((match) => match.round === rounds && !match.bye);
  const night = myNight({ userId, rounds, lockAt: tournament.lock_at, matches: results.matches });
  const finish = finishStat(night, rounds);
  const coins = rewards.reduce((sum, row) => sum + Number(row.amount), 0);
  const field = fieldCounts(results.entries);
  const totals = nightTotals(results.matches, rounds);
  const seed = tournament.seed ?? null;
  const seal = tournament.seed_hash ?? "";
  const championName = tournament.champion_name ?? "The champion";

  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto grid max-w-6xl gap-8 py-4 sm:gap-11 sm:py-8">
        <section
          aria-labelledby="champion-h"
          className="relative grid gap-3.5 overflow-hidden rounded-[20px] border border-brass-line bg-[radial-gradient(90%_120%_at_100%_0%,rgb(224_172_74/22%),transparent_60%),linear-gradient(to_bottom,#2b2112,#1a150e)] px-5 py-[22px] sm:px-9 sm:py-8"
        >
          <p className="text-[0.7rem] font-extrabold tracking-[0.26em] text-brass uppercase">
            Midweek Madness &middot; {formatDayDate(tournament.lock_at)} &middot; Champion
          </p>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="h-[34px] w-7 flex-none bg-brass [clip-path:polygon(50%_0%,100%_38%,82%_100%,18%_100%,0%_38%)]"
            />
            <h1
              className="display text-[54px] leading-none [overflow-wrap:anywhere] sm:text-8xl"
              id="champion-h"
            >
              {championName}
            </h1>
          </div>
          <p className="text-[15px] leading-normal text-ink-dim">
            {final && <b className="text-ink">{finalLine(final)}</b>} {MIDWEEK.championTotal} KUT
            Coins over the night.{" "}
            {final && (
              <Link
                className="font-bold text-brass hover:underline"
                href={`/club/midweek/${tournament.week_start}/match/${final.match_id}`}
              >
                Report &rarr;
              </Link>
            )}
          </p>
          {championCards.length > 0 && (
            <div className="max-w-[760px]">
              <FiveCards
                cards={championCards.map((row) => entryCardFace(row, photoUrls))}
                label={`${championName}’s five`}
              />
            </div>
          )}
        </section>

        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-b from-panel-2/70 to-panel/70 sm:grid-cols-4 [&>div]:px-4 [&>div]:py-3.5 max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(even)]:border-l sm:[&>div+div]:border-l [&>div]:border-line/50">
          <Stat label="You" note="paid to your wallet" tone="brass" value={`+${coins}`} />
          <Stat label="Your finish" note={finish.note} value={finish.value} />
          <Stat
            label="Entrants"
            note={`${field.auto} auto squads`}
            value={String(field.entrants)}
          />
          <Stat label="Goals" note={`in ${totals.matches} matches`} value={String(totals.goals)} />
        </dl>

        <section aria-labelledby="night-h" className="grid gap-4">
          <MidweekSectionHead id="night-h" title="Your night">
            <Link
              className="text-sm font-bold text-brass hover:underline"
              href={`/club/midweek/${tournament.week_start}`}
            >
              Bracket and picks &rarr;
            </Link>
          </MidweekSectionHead>
          {night.entered ? (
            <MidweekPath
              now={now.toISOString()}
              rounds={rounds}
              rows={night.rows}
              weekStart={tournament.week_start}
            />
          ) : (
            <p className="text-sm text-ink-dim">You weren&rsquo;t in this one.</p>
          )}
        </section>

        {next && next.lock_at && next.status === "open" && (
          <Link
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-brass/40 bg-brass-bg/28 px-3 py-2.5 hover:border-brass"
            href="/club/midweek?view=pick"
          >
            <MidweekMiniCard variant="unknown" />
            <span className="text-[13.5px] leading-snug text-ink-dim">
              <b className="block text-[14.5px] text-ink">Next Wednesday is open</b>
              Pick your five for {formatDayDate(next.lock_at)}. Locks at {formatClock(next.lock_at)}
              .
            </span>
            <span aria-hidden="true" className="text-xl font-black text-brass">
              &rarr;
            </span>
          </Link>
        )}

        {seal && (
          <MidweekSeed
            defaultOpen
            seed={seed}
            seedHash={seal}
            seedMatches={seed !== null && seedHash(seed) === seal}
          />
        )}
        <p className="text-[13px] text-ink-faint">{totals.coins} KUT Coins paid across the club.</p>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "brass";
}) {
  return (
    <div>
      <dt className="text-[10.4px] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[26px] font-black tracking-[-0.01em] tabular-nums ${tone === "brass" ? "text-brass" : ""}`}
      >
        {value}
        <small className="block text-xs font-bold tracking-normal text-ink-faint">{note}</small>
      </dd>
    </div>
  );
}
