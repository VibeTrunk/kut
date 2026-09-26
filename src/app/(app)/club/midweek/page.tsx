import Link from "next/link";
import { notFound } from "next/navigation";
import type { LiveCardPlayer } from "@/components/live-card";
import { MidweekNotice, MidweekPrivacyLine } from "@/components/midweek/bits";
import { MidweekLockBar } from "@/components/midweek/lock-bar";
import { MidweekOptInButton } from "@/components/midweek/opt-in-button";
import { MidweekPicker, type PickCard } from "@/components/midweek/picker";
import { MidweekSeed } from "@/components/midweek/seed";
import { archetypeLabel } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { revealAt } from "@/game/midweek/schedule";
import { requireUser } from "@/lib/auth/user";
import { fetchInjuredPlayerIds } from "@/lib/injuries";
import { toLiveCardPlayer } from "@/lib/live-card-player";
import { strongestCopies } from "@/lib/midweek/copies";
import {
  formatClock,
  formatDayDate,
  formatDayMonth,
  isLockedTonight,
  isPickingOpen,
  joinNames,
  lastWeekSummary,
  prefillSlots,
  skipOrVoidText,
  starterNotice,
  type MidweekCurrent,
  type MidweekTournament,
  type MyRewardRow,
  type MySquadRow,
} from "@/lib/midweek/entry";
import { loadMidweekEntryState } from "@/lib/midweek/load";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Midweek Madness" };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type CollectionRow = {
  card_id: string;
  player_id: string;
  is_live: boolean;
  display_name: string;
  archetype: string;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
  photo_path: string | null;
};

const TIER_LABEL: Record<LiveCardPlayer["rarityTier"], string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

const PAGE = "board-ground min-h-screen p-5 text-ink sm:p-10";
const KICKER = "text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass";

function PageHead({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <header className="space-y-3">
      <p className={KICKER}>{kicker}</p>
      <h1 className="display text-3xl sm:text-6xl">{title}</h1>
      {lede && (
        <p className="hidden max-w-2xl text-[15px] leading-relaxed text-ink-dim sm:block">{lede}</p>
      )}
    </header>
  );
}

/** Display names for Players the member no longer owns, for the notices. */
async function playerNames(supabase: SupabaseServerClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase
    .schema("kut")
    .from("player_directory")
    .select("id, display_name")
    .in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((row) => [
      row.id,
      row.display_name,
    ]),
  );
}

/**
 * The previous tournament's outcome for the strip above the picker (§44.1:
 * the next week opens as soon as one ends, so the page carries both). PR 8
 * adds the champion hero that leads until Thursday 23:59 (D4); until then the
 * strip is the whole of it, and it has no bracket link because that page is
 * PR 8's too (ADR-097).
 */
async function lastWeekStrip(
  supabase: SupabaseServerClient,
  userId: string,
  tournament: MidweekTournament,
  consecutive: boolean,
): Promise<{ kicker: string; text: string } | null> {
  const kicker = consecutive
    ? `Last Wednesday · ${formatDayMonth(tournament.lock_at)}`
    : `Midweek Madness · ${formatDayDate(tournament.lock_at)}`;
  const skipText = skipOrVoidText(tournament, MIDWEEK.minEntrants);
  if (skipText) return { kicker, text: skipText };
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
      .select("*")
      .eq("tournament_id", tournament.tournament_id)
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (rewardsResponse.error || entryResponse.error) return null;
  return {
    kicker,
    text: lastWeekSummary({
      rounds: tournament.rounds,
      rewards: (rewardsResponse.data ?? []) as MyRewardRow[],
      entered: (entryResponse.data ?? []).length > 0,
      isChampion: tournament.champion_user_id === userId,
      championName: tournament.champion_name ?? null,
    }),
  };
}

function LastWeek({ strip }: { strip: { kicker: string; text: string } }) {
  return (
    <section className="grid gap-1 rounded-[14px] border border-line/60 bg-board-deep/55 px-3.5 py-3">
      <p className="text-[0.65rem] font-extrabold tracking-[0.15em] text-ink-faint uppercase">
        {strip.kicker}
      </p>
      <p className="text-[13.5px] leading-snug text-ink-dim">{strip.text}</p>
    </section>
  );
}

export default async function MidweekPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const state = await loadMidweekEntryState(supabase);
  // Disabled with nothing running, or not deployed yet: the route doesn't
  // exist for members (Week-Disabled).
  if (!state) notFound();
  const { current } = state;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!current.tournament_id || !current.lock_at || !current.week_start || !current.seed_hash) {
    return (
      <main className={PAGE}>
        <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
          <PageHead kicker="Midweek Madness" title="Opening soon" />
          <p className="text-ink-dim">
            The first week of Midweek Madness opens soon. Five of your cards, one knockout,
            Wednesday night. Read{" "}
            <Link className="font-bold text-brass hover:underline" href="/how-it-works#midweek">
              how it works
            </Link>{" "}
            in the meantime.
          </p>
        </section>
      </main>
    );
  }

  const previousResponse = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .lt("week_start", current.week_start)
    .order("week_start", { ascending: false })
    .limit(1);
  const previous = previousResponse.error
    ? null
    : (((previousResponse.data ?? [])[0] ?? null) as MidweekTournament | null);
  const consecutive =
    previous !== null &&
    Date.parse(current.week_start) - Date.parse(previous.week_start) === 7 * 24 * 60 * 60 * 1000;

  if (!isPickingOpen(current, now)) {
    return (
      <NotOpen
        current={current}
        now={now}
        picked={state.squad === null ? null : state.squad.length > 0}
        supabase={supabase}
        userId={user.id}
      />
    );
  }

  const strip = previous ? await lastWeekStrip(supabase, user.id, previous, consecutive) : null;
  const lockAt = current.lock_at;
  const roundOne = formatClock(revealAt(new Date(lockAt), 1).toISOString());

  if (current.opted_out) {
    return (
      <main className={PAGE}>
        <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
          {strip && <LastWeek strip={strip} />}
          <PageHead kicker="Midweek Madness" title="You’re sitting this out" />
          <section className="grid gap-3.5 rounded-2xl border border-line/60 bg-panel/60 p-6 text-ink-dim">
            <p>
              You opted out of Midweek Madness, so you aren&rsquo;t entered: no squad, no auto
              squad, and none of your cards are shown to anyone.
            </p>
            <p>Come back and you&rsquo;re in for {formatDayDate(lockAt)}, picked or auto.</p>
            <div className="flex flex-wrap gap-2.5">
              <MidweekOptInButton />
              <Link
                className="inline-flex min-h-12 items-center rounded-xl px-3 font-extrabold text-brass hover:underline"
                href="/settings"
              >
                Settings
              </Link>
            </div>
          </section>
          <MidweekLockBar lockAt={lockAt} now={nowIso} seedHash={current.seed_hash} />
          <p className="text-sm text-ink-faint">
            You can still follow Wednesday&rsquo;s bracket from {roundOne} like everyone else.
          </p>
        </section>
      </main>
    );
  }

  const squad = state.squad;
  if (squad === null) throw new Error("Could not load your saved five.");

  const [collectionResponse, lastWeekResponse, injuredPlayerIds] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_collection_cards")
      .select(
        "card_id, player_id, is_live, display_name, archetype, ovr, pac, sho, pas, dri, def, phy, rarity_tier, photo_path",
      )
      .order("ovr", { ascending: false })
      .order("display_name"),
    supabase
      .schema("kut")
      .from("my_midweek_squad")
      .select("*")
      .lt("week_start", current.week_start)
      .order("week_start", { ascending: false })
      .order("slot")
      .limit(MIDWEEK.squadSize * 2),
    fetchInjuredPlayerIds(supabase),
  ]);
  if (collectionResponse.error) throw new Error("Could not load your collection.");

  const owned = (collectionResponse.data ?? []) as CollectionRow[];
  const tiles = strongestCopies(owned, injuredPlayerIds);
  const ownedPlayerIds = new Set(tiles.map(({ card }) => card.player_id));
  const photoUrls = await resolvePhotoUrls(
    supabase,
    tiles.map(({ card }) => card.photo_path),
  );
  const cards: PickCard[] = tiles.map(({ card, copies }) => ({
    playerId: card.player_id,
    cardId: card.card_id,
    displayName: card.display_name,
    archetype: card.archetype,
    archetypeLabel: archetypeLabel(card.archetype),
    tierLabel: TIER_LABEL[card.rarity_tier],
    copies,
    card: toLiveCardPlayer(card, injuredPlayerIds, photoUrls),
  }));

  // The saved five, one Player per slot; a Player no longer owned leaves the
  // slot open and is named below.
  const saved = prefillSlots(squad, ownedPlayerIds, MIDWEEK.squadSize);
  // "Load last week's five": the latest earlier tournament the member saved for.
  const earlier = lastWeekResponse.error ? [] : ((lastWeekResponse.data ?? []) as MySquadRow[]);
  const lastWeekRows = earlier.filter((row) => row.week_start === earlier[0]?.week_start);
  const lastWeek =
    lastWeekRows.length > 0 ? prefillSlots(lastWeekRows, ownedPlayerIds, MIDWEEK.squadSize) : null;
  const names = await playerNames(supabase, [
    ...saved.lostPlayerIds,
    ...(lastWeek?.lostPlayerIds ?? []),
  ]);
  const nameOf = (id: string) => names.get(id) ?? "A Player";

  const byPlayer = new Map(cards.map((card) => [card.playerId, card]));
  const sendNow = saved.slots.flatMap((id) => (id ? [byPlayer.get(id)?.cardId ?? ""] : []));
  const savedCardIds = squad.map((row) => row.card_id);
  let lostSavedNotice: string | null = null;
  if (saved.lostPlayerIds.length > 0) {
    const lost = saved.lostPlayerIds.map(nameOf);
    const slotText =
      saved.lostSlots.length === 1
        ? `slot ${saved.lostSlots[0]} is`
        : `slots ${joinNames(saved.lostSlots.map(String))} are`;
    lostSavedNotice = `${joinNames(lost)} ${lost.length === 1 ? "isn't" : "aren't"} in your collection any more, so ${slotText} open. Save your five again, or a trialist plays there.`;
  } else if (savedCardIds.length > 0 && sendNow.some((id) => !savedCardIds.includes(id))) {
    lostSavedNotice =
      "Your collection has changed since you saved, so a different copy of one of your Players would play now. Save your five again to make it count.";
  }

  return (
    <main className={PAGE}>
      <section className="mx-auto max-w-6xl space-y-7 py-4 sm:py-8">
        {strip && <LastWeek strip={strip} />}
        <PageHead
          kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
          lede={`Five of your cards, one knockout, Wednesday night. Every match you win pays KUT Coins; the champion takes ${MIDWEEK.championTotal} in all.`}
          title="Pick your five"
        />
        <MidweekLockBar lockAt={lockAt} now={nowIso} seedHash={current.seed_hash} />
        <MidweekPrivacyLine />
        {cards.length === 0 ? (
          <MidweekNotice tone="info">
            <b>You need at least one card to take part.</b> Every Player you add from a pack can
            play.{" "}
            <Link className="font-bold text-brass hover:underline" href="/club/packs">
              Open a pack &rarr;
            </Link>
          </MidweekNotice>
        ) : (
          <MidweekPicker
            cards={cards}
            initialSlots={saved.slots}
            lastWeek={
              lastWeek
                ? {
                    slots: lastWeek.slots,
                    lostNames: lastWeek.lostPlayerIds.map(nameOf),
                    lostSlots: lastWeek.lostSlots,
                  }
                : null
            }
            lockAt={lockAt}
            lostSavedNotice={lostSavedNotice}
            savedAt={squad[0]?.saved_at ?? null}
            savedCardIds={savedCardIds}
            starterLead={starterNotice(cards.length, MIDWEEK.squadSize)}
            trialistOvr={MIDWEEK.trialist.ovr}
          />
        )}
      </section>
    </main>
  );
}

/**
 * Between the lock and the next open week (ADR-097). PR 8 owns the evening
 * (the clock, your path, the bracket) and the skip and void pages; until then
 * this holding state says what is happening and keeps the seal on the page.
 */
async function NotOpen({
  current,
  now,
  userId,
  picked,
  supabase,
}: {
  current: MidweekCurrent;
  now: Date;
  userId: string;
  /** Whether the caller saved a squad for this week; null when unknown. */
  picked: boolean | null;
  supabase: SupabaseServerClient;
}) {
  const lockAt = current.lock_at as string;

  if (isLockedTonight(current, now)) {
    const roundOne = formatClock(revealAt(new Date(lockAt), 1).toISOString());
    const lede = `Round 1 comes out at ${roundOne}, then a round every half hour until the final.`;
    return (
      <main className={PAGE}>
        <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
          <PageHead
            kicker={`Midweek Madness · ${formatDayDate(lockAt)}`}
            lede={lede}
            title="Squads are locked"
          />
          <p className="text-ink-dim sm:hidden">{lede}</p>
          {picked !== null && (
            <p className="rounded-2xl border border-line/60 bg-panel/60 p-5 text-sm text-ink-dim">
              {current.opted_out
                ? "You opted out, so you aren't in tonight."
                : picked
                  ? `Locked in: your saved five. Members see them from ${roundOne}, with their numbers for the week.`
                  : `You didn't pick, so an auto squad plays for you. See it at ${roundOne}.`}
            </p>
          )}
          <MidweekSeed seedHash={current.seed_hash as string} />
        </section>
      </main>
    );
  }

  // The latest week has ended and the next isn't open yet.
  const latestResponse = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .eq("tournament_id", current.tournament_id as string)
    .maybeSingle();
  const latest = latestResponse.error ? null : (latestResponse.data as MidweekTournament | null);
  const strip = latest ? await lastWeekStrip(supabase, userId, latest, true) : null;
  return (
    <main className={PAGE}>
      <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
        <PageHead kicker="Midweek Madness" title="Next week opens soon" />
        {strip && <LastWeek strip={strip} />}
        <p className="text-ink-dim">
          Next Wednesday&rsquo;s knockout opens for picking soon. Your five don&rsquo;t carry over,
          but you can load them again in one tap.
        </p>
      </section>
    </main>
  );
}
