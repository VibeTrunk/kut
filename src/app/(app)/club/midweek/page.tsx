import Link from "next/link";
import { notFound } from "next/navigation";
import type { LiveCardPlayer } from "@/components/live-card";
import { MidweekNotice, MidweekPrivacyLine } from "@/components/midweek/bits";
import { MidweekLockBar } from "@/components/midweek/lock-bar";
import { MidweekOptInButton } from "@/components/midweek/opt-in-button";
import { MIDWEEK_PAGE, MidweekPageHead } from "@/components/midweek/page-head";
import { MidweekPicker, type PickCard } from "@/components/midweek/picker";
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
  isLockedTonight,
  isPickingOpen,
  joinNames,
  prefillSlots,
  starterNotice,
  type MidweekTournament,
  type MySquadRow,
} from "@/lib/midweek/entry";
import { championLeads } from "@/lib/midweek/evening";
import { loadMidweekEntryState } from "@/lib/midweek/load";
import { runDueMidweek } from "@/lib/midweek/run-due";
import { resolvePhotoUrls } from "@/lib/player-photos";
import { createClient } from "@/lib/supabase/server";
import { LastWeek, lastWeekView, WeekComplete, WeekEvening } from "./views";

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

export default async function MidweekPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  // No scheduler: a visit locks, completes or opens a week that is due before
  // the page reads it, so a visit at 20:01 sees the locked week (ADR-098).
  await runDueMidweek();
  const supabase = await createClient();
  const [state, { view }] = await Promise.all([loadMidweekEntryState(supabase), searchParams]);
  // Disabled with nothing running, or not deployed yet: the route doesn't
  // exist for members (Week-Disabled).
  if (!state) notFound();
  const { current } = state;
  const now = new Date();
  const nowIso = now.toISOString();

  if (!current.tournament_id || !current.lock_at || !current.week_start || !current.seed_hash) {
    return (
      <main className={MIDWEEK_PAGE}>
        <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
          <MidweekPageHead kicker="Midweek Madness" title="Opening soon" />
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

  // Wednesday evening: tonight's week is locked and its rounds come out.
  if (isLockedTonight(current, now)) {
    return (
      <WeekEvening
        current={current}
        now={now}
        squad={state.squad}
        supabase={supabase}
        userId={user.id}
      />
    );
  }

  if (!isPickingOpen(current, now)) {
    // The latest week has ended and the next isn't open yet (the switch is
    // paused, or the worker hasn't opened it).
    return (
      <NextWeekSoon
        current={current.tournament_id}
        now={now}
        supabase={supabase}
        userId={user.id}
      />
    );
  }

  // Owner decision D4: last Wednesday's champion leads until Thursday 23:59
  // Amsterdam; `?view=pick` is the way through to next week's picker meanwhile.
  if (previous && view !== "pick" && championLeads(previous, now)) {
    return (
      <WeekComplete
        next={current}
        now={now}
        supabase={supabase}
        tournament={previous}
        userId={user.id}
      />
    );
  }

  const strip = previous ? await lastWeekView(supabase, user.id, previous, consecutive) : null;
  const lockAt = current.lock_at;
  const roundOne = formatClock(revealAt(new Date(lockAt), 1).toISOString());

  if (current.opted_out) {
    return (
      <main className={MIDWEEK_PAGE}>
        <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
          {strip && <LastWeek view={strip} />}
          <MidweekPageHead kicker="Midweek Madness" title="You’re sitting this out" />
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
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto max-w-6xl space-y-7 py-4 sm:py-8">
        {strip && <LastWeek view={strip} />}
        <MidweekPageHead
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
 * The latest week has ended and the next isn't open yet. A complete week's
 * champion still leads until D4's cutoff; otherwise the outcome is the strip
 * (or the skip or void notice), and the next week follows.
 */
async function NextWeekSoon({
  current,
  now,
  userId,
  supabase,
}: {
  current: string | null;
  now: Date;
  userId: string;
  supabase: SupabaseServerClient;
}) {
  const latestResponse = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .eq("tournament_id", current as string)
    .maybeSingle();
  const latest = latestResponse.error ? null : (latestResponse.data as MidweekTournament | null);
  if (latest && championLeads(latest, now)) {
    return (
      <WeekComplete next={null} now={now} supabase={supabase} tournament={latest} userId={userId} />
    );
  }
  const strip = latest ? await lastWeekView(supabase, userId, latest, true) : null;
  return (
    <main className={MIDWEEK_PAGE}>
      <section className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
        <MidweekPageHead kicker="Midweek Madness" title="Next week opens soon" />
        {strip && <LastWeek view={strip} />}
        <p className="text-ink-dim">
          Next Wednesday&rsquo;s knockout opens for picking soon. Your five don&rsquo;t carry over,
          but you can load them again in one tap.
        </p>
      </section>
    </main>
  );
}
