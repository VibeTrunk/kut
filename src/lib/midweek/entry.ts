/**
 * Pure helpers for the Midweek Madness entry pages (PR 7, ADR-097): the
 * picker, the Home card, Compete's badge and the settings panel.
 *
 * Client-safe on purpose: nothing here imports the engine, whose `rng.ts`
 * pulls in `node:crypto`. The one helper that needs an engine factor (the
 * strongest copy of a Player) lives in `./copies.ts`, which only server pages
 * import. Every rule the database enforces stays in the database; these only
 * decide what the page says.
 */

import { archetypeLabel } from "@/game/archetypes";
import { MIDWEEK } from "@/game/midweek/config";
import { scheduleFor } from "@/game/midweek/schedule";
import { BRAND } from "@/lib/brand";
import type { CompeteStatus } from "@/lib/nav/routes";

const AMS = "Europe/Amsterdam";

const pad = (value: number) => String(value).padStart(2, "0");

const clockOf = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

/**
 * A week's schedule version (ADR-104). The column is absent from rows read
 * before the migration (version 1), and null on `midweek_current` before any
 * tournament exists; with no row or no tournament, the next week opens on the
 * current version.
 */
export function scheduleVersionOf(
  row: { schedule_version?: number | null } | null | undefined,
): number {
  if (!row) return MIDWEEK.schedule.current;
  if (!("schedule_version" in row)) return 1;
  return row.schedule_version ?? MIDWEEK.schedule.current;
}

/** "every 15 minutes", or "every half hour" on version 1: how often a round starts. */
export function roundIntervalText(version: number): string {
  const minutes = scheduleFor(version).roundIntervalMinutes;
  return minutes === 30 ? "every half hour" : `every ${minutes} minutes`;
}

/** "19:55": the lock, in club time, from the week's schedule. */
export function lockClock(version: number): string {
  const schedule = scheduleFor(version);
  return clockOf(schedule.lockHourLocal * 60 + schedule.lockMinuteLocal);
}

/** "20:00": round 1's start, when members first see the entered fives. */
export function roundOneClock(version: number): string {
  const schedule = scheduleFor(version);
  return clockOf(
    schedule.lockHourLocal * 60 + schedule.lockMinuteLocal + schedule.roundOffsetMinutes,
  );
}

/** The row `kut.midweek_current` returns (migration 20261003000000). */
export type MidweekCurrent = {
  enabled: boolean;
  tournament_id: string | null;
  week_start: string | null;
  lock_at: string | null;
  seed_hash: string | null;
  status: MidweekStatus | null;
  status_reason: "club_break" | "too_few_entrants" | "admin_void" | null;
  void_note: string | null;
  rounds: number | null;
  /** The end of the final; null until it has passed (ADR-105), so pages must not schedule on it. */
  final_reveal_at: string | null;
  seed: string | null;
  opted_out: boolean;
  /** ADR-104; absent before its migration. Read it through `scheduleVersionOf`. */
  schedule_version?: number | null;
  /** ADR-105; absent before its migration. Read it through `isEveningLive`. */
  evening_live?: boolean;
};

export type MidweekStatus = "open" | "skipped" | "simulated" | "complete" | "void";

/** A `kut.midweek_tournaments_public` row. `champion_*` came with the engine. */
export type MidweekTournament = {
  tournament_id: string;
  week_start: string;
  lock_at: string;
  status: MidweekStatus;
  status_reason: MidweekCurrent["status_reason"];
  void_note: string | null;
  rounds: number | null;
  seed_hash?: string;
  /** The end of the final; null until it has passed (ADR-105). */
  final_reveal_at?: string | null;
  /** Published once the week is complete (§44.8). */
  seed?: string | null;
  champion_user_id?: string | null;
  champion_name?: string | null;
  /** ADR-104; absent before its migration. Read it through `scheduleVersionOf`. */
  schedule_version?: number | null;
};

/** A `kut.my_midweek_squad` row: the caller's own saved slot, 1–5. */
export type MySquadRow = {
  tournament_id: string;
  week_start: string;
  saved_at: string;
  slot: number;
  card_id: string;
  player_id: string;
};

/**
 * Whether Midweek Madness shows at all (HANDOFF open question 6, settled in
 * ADR-097). The switch on shows it; with the switch off, a tournament that is
 * still open or simulated keeps it visible until it completes or is voided,
 * because §44.8 lets an open week run after a pause.
 */
export function isMidweekVisible(current: MidweekCurrent | null): current is MidweekCurrent {
  if (!current) return false;
  return current.enabled || current.status === "open" || current.status === "simulated";
}

/** True while members may still save a squad for the current tournament. */
export function isPickingOpen(current: MidweekCurrent, now: Date): boolean {
  return (
    current.status === "open" &&
    current.lock_at !== null &&
    Date.parse(current.lock_at) > now.getTime()
  );
}

/** Between the lock and the final: tonight's field is already fixed. */
export function isLockedTonight(current: MidweekCurrent, now: Date): boolean {
  if (current.status === "simulated") return true;
  return (
    current.status === "open" &&
    current.lock_at !== null &&
    Date.parse(current.lock_at) <= now.getTime()
  );
}

/**
 * Whether the evening is live: the week is drawn and now is between its lock
 * and the end of its final. `midweek_current.evening_live` says so from
 * ADR-105's push; before it the column is absent, and `final_reveal_at`, the end
 * of the final since ADR-104, is still readable from the lock.
 */
export function isEveningLive(current: MidweekCurrent, now: Date): boolean {
  if (typeof current.evening_live === "boolean") return current.evening_live;
  return (
    current.status === "simulated" &&
    current.lock_at !== null &&
    Date.parse(current.lock_at) <= now.getTime() &&
    current.final_reveal_at !== null &&
    now.getTime() < Date.parse(current.final_reveal_at)
  );
}

/**
 * Compete's badge (ADR-107): `live` from the lock to the end of the final, for
 * every member; `pick` while the week is open and a member taking part has no
 * saved five. `hasSavedFive` is null when the squad read failed, which must
 * not read as "not picked". Nothing otherwise.
 */
export function competeStatus(
  current: MidweekCurrent | null,
  hasSavedFive: boolean | null,
  now: Date,
): CompeteStatus | null {
  if (!current?.tournament_id) return null;
  if (isEveningLive(current, now)) return "live";
  if (isPickingOpen(current, now) && !current.opted_out && hasSavedFive === false) return "pick";
  return null;
}

// ---- dates, in club time ---------------------------------------------------

const dayDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: AMS,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: AMS,
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: AMS, weekday: "long" });
const shortWeekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: AMS, weekday: "short" });
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: AMS,
  day: "numeric",
  month: "short",
});

/** "Wed 7 Oct". */
export function formatDayDate(iso: string): string {
  return dayDateFormat.format(new Date(iso));
}

/** "20:00". */
export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso));
}

/** "Wednesday". */
export function formatWeekday(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

/** "Wed 20:00", for the one-line strip. */
export function formatShortLock(iso: string): string {
  return `${shortWeekdayFormat.format(new Date(iso))} ${formatClock(iso)}`;
}

/** "Tue 6 Oct, 14:02". */
export function formatSavedAt(iso: string): string {
  return `${formatDayDate(iso)}, ${formatClock(iso)}`;
}

/** "30 Sep". */
export function formatDayMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso));
}

/**
 * The lock countdown (HANDOFF, `MidweekLockBar`): "in 1 day, 4 h", "in 5 h,
 * 12 min", and below an hour "in 18 min". Minutes round up, so it never says
 * "in 0 min" while the squad can still be changed.
 */
export function countdownText(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    const dayText = `${days} ${days === 1 ? "day" : "days"}`;
    return hours > 0 ? `in ${dayText}, ${hours} h` : `in ${dayText}`;
  }
  if (hours > 0) return minutes > 0 ? `in ${hours} h, ${minutes} min` : `in ${hours} h`;
  return `in ${minutes} min`;
}

// ---- words ------------------------------------------------------------------

/** "Tess F.", "Tess F. and Wout Y.", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * After the lock, a squad whose saved cards were all still owned (KB-030).
 * It says what the lock checked in plain words, because "Locked in: all five
 * still yours" read as if the cards could stop being yours.
 */
export function allStillOwned(saved: number): string {
  const count = saved === MIDWEEK.squadSize ? "five" : String(saved);
  if (saved === 1) return "Your card was still in your collection at the lock, so it plays.";
  return `All ${count} were still in your collection at the lock, so all ${count} play.`;
}

/** A round named from the end, so it holds for every bracket size. */
export function stageName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "the final";
  if (fromEnd === 1) return "the semi-finals";
  if (fromEnd === 2) return "the quarter-finals";
  return `round ${round}`;
}

// ---- the squad ----------------------------------------------------------------

export type Segment = { text: string; strong?: boolean };

/**
 * The archetype a card plays this week, and how the picker names it (ADR-099):
 * the week's snapshot from when it opened, or the live archetype for a Player
 * without one (created since the open, or before the hosted push added
 * snapshots). A change since the open is named, so the owner isn't surprised:
 * `change` is "Goalkeeper this week, Speedster from next" and `next` the
 * coming archetype's name for the card badge (KB-028); both null otherwise.
 */
export function weekArchetype(
  frozen: ReadonlyMap<string, string>,
  playerId: string,
  live: string,
): { archetype: string; label: string; change: string | null; next: string | null } {
  const archetype = frozen.get(playerId) ?? live;
  const label = archetypeLabel(archetype);
  if (archetype === live) return { archetype, label, change: null, next: null };
  const next = archetypeLabel(live);
  return { archetype, label, change: `${label} this week, ${next} from next`, next };
}

/** The archetype filter's chips in order, plural (HANDOFF "Archetype filter"). */
const FILTER_ORDER: readonly (readonly [string, string])[] = [
  ["goalkeeper", "Goalkeepers"],
  ["defender", "Defenders"],
  ["tank", "Tanks"],
  ["speedster", "Speedsters"],
  ["finisher", "Finishers"],
  ["playmaker", "Playmakers"],
  ["all_rounder", "All-rounders"],
];

export type ArchetypeFilter = { key: string; label: string; count: number };

/**
 * `MidweekArchetypeFilter`'s chips with counts, by the archetype each card
 * plays this week: `All` and `Goalkeepers` always, so `Goalkeepers 0` makes a
 * missing keeper visible, then every other archetype the member owns.
 */
export function archetypeFilters(cards: readonly { archetype: string }[]): ArchetypeFilter[] {
  const count = (key: string) => cards.filter((card) => card.archetype === key).length;
  return [
    { key: "all", label: "All", count: cards.length },
    ...FILTER_ORDER.map(([key, label]) => ({ key, label, count: count(key) })).filter(
      (chip) => chip.key === "goalkeeper" || chip.count > 0,
    ),
  ];
}

/**
 * `MidweekKeeperCheck`, from archetypes alone: no factor is known before the
 * lock, so "strongest on the night" is the most the page can promise.
 */
export function keeperCheck(picked: readonly { archetype: string; displayName: string }[]): {
  tone: "ok" | "warn";
  segments: Segment[];
} {
  const keepers = picked.filter((card) => card.archetype === "goalkeeper");
  if (keepers.length === 1) {
    return {
      tone: "ok",
      segments: [{ text: keepers[0].displayName, strong: true }, { text: " goes in goal." }],
    };
  }
  if (keepers.length > 1) {
    return {
      tone: "ok",
      segments: [
        { text: "Your strongest Goalkeeper on the night goes in goal; " },
        {
          text: keepers.length > 2 ? "the others play outfield" : "the other plays outfield",
          strong: true,
        },
        { text: "." },
      ],
    };
  }
  return {
    tone: "warn",
    segments: [
      { text: "No Goalkeeper in your five.", strong: true },
      { text: " Your best defender goes in goal, and keeps goal much worse than a real one." },
    ],
  };
}

/**
 * "Load last week's five" (§44.2: pre-filling saves nothing). Each slot keeps
 * its position; a Player the member no longer owns any copy of leaves the slot
 * open and is named in the notice. A Player still owned stays, whichever copy
 * was saved, because the picker works one Player per slot and always sends the
 * strongest copy (ADR-097).
 */
export function prefillSlots(
  rows: readonly Pick<MySquadRow, "slot" | "player_id">[],
  ownedPlayerIds: ReadonlySet<string>,
  size: number,
): { slots: (string | null)[]; lostPlayerIds: string[]; lostSlots: number[] } {
  const slots: (string | null)[] = Array.from({ length: size }, () => null);
  const lostPlayerIds: string[] = [];
  const lostSlots: number[] = [];
  for (const row of [...rows].sort((a, b) => a.slot - b.slot)) {
    const index = row.slot - 1;
    if (index < 0 || index >= size) continue;
    if (ownedPlayerIds.has(row.player_id)) {
      slots[index] = row.player_id;
    } else {
      lostPlayerIds.push(row.player_id);
      lostSlots.push(row.slot);
    }
  }
  return { slots, lostPlayerIds, lostSlots };
}

/** The HANDOFF copy after "Load last week's five", its first sentence bold. */
export function prefillNotice(
  lostNames: readonly string[],
  lostSlots: readonly number[],
): Segment[] {
  const lead: Segment = { text: "Loaded last week's five.", strong: true };
  if (lostNames.length === 0) return [lead, { text: " Nothing is saved until you press Save." }];
  const verb = lostNames.length === 1 ? "isn't" : "aren't";
  const slotText =
    lostSlots.length === 1
      ? `slot ${lostSlots[0]} is`
      : `slots ${joinNames(lostSlots.map(String))} are`;
  return [
    lead,
    {
      text: ` ${joinNames(lostNames)} ${verb} in your collection any more, so ${slotText} open. Nothing is saved until you press Save.`,
    },
  ];
}

/**
 * The save status. Saved means the cards the picker would send now are
 * exactly the saved cards: a saved copy sold since, or a stronger copy bought
 * since, shows as unsaved, because only a saved squad counts at the lock.
 */
export function saveStatus(
  savedCardIds: readonly string[],
  sendCardIds: readonly string[],
): "none" | "dirty" | "saved" {
  if (savedCardIds.length === 0) return sendCardIds.length === 0 ? "none" : "dirty";
  if (savedCardIds.length !== sendCardIds.length) return "dirty";
  const saved = new Set(savedCardIds);
  return sendCardIds.every((id) => saved.has(id)) ? "saved" : "dirty";
}

/** How many trialists a member with this many distinct Players always fields. */
export function trialistCount(playerCount: number, size: number): number {
  return Math.max(0, size - playerCount);
}

/** The Picker-Starter notice's lead, or null when five Players are owned. */
export function starterNotice(playerCount: number, size: number): string | null {
  const trialists = trialistCount(playerCount, size);
  if (trialists === 0 || playerCount === 0) return null;
  const players = `${playerCount} ${playerCount === 1 ? "Player" : "Players"}`;
  const fill = `${trialists} ${trialists === 1 ? "trialist makes" : "trialists make"}`;
  return `You have ${players}, so ${fill} up your five.`;
}

// ---- last week -------------------------------------------------------------------

/** A reward row from `kut.my_midweek_rewards`. */
export type MyRewardRow = { tournament_id: string; round_no: number; amount: number };

/**
 * The last-week strip (Picker-Saved) for a completed tournament: how far the
 * member got, their coins and the champion. `entered` separates "went out in
 * round 1" from "sat it out"; both have no reward.
 */
export function lastWeekSummary(input: {
  rounds: number;
  rewards: readonly Pick<MyRewardRow, "round_no" | "amount">[];
  entered: boolean;
  isChampion: boolean;
  championName: string | null;
}): string {
  const coins = input.rewards.reduce((sum, row) => sum + Number(row.amount), 0);
  const champion = input.championName ? ` ${input.championName} won it.` : "";
  if (input.isChampion) return `You won it! +${coins} ${BRAND.currency}.`;
  if (input.rewards.length > 0) {
    const furthestWon = Math.max(...input.rewards.map((row) => row.round_no));
    return `You reached ${stageName(furthestWon + 1, input.rounds)}. +${coins} ${BRAND.currency}.${champion}`;
  }
  return input.entered ? `You went out in round 1.${champion}` : `You sat it out.${champion}`;
}

/**
 * The skip and void notices (HANDOFF, Week-Skipped* and Week-Void): a bold
 * lead, the rest, and whether it warns (a void) or informs (a skip).
 */
export function skipOrVoidNotice(
  tournament: Pick<MidweekTournament, "lock_at" | "status" | "status_reason" | "void_note">,
  minEntrants: number,
): { tone: "info" | "warn"; lead: string; rest: string } | null {
  const day = formatDayDate(tournament.lock_at);
  if (tournament.status === "void") {
    return {
      tone: "warn",
      lead: `${day} was called off by an admin.`,
      rest: `“${tournament.void_note ?? ""}” No results are shown and no coins were paid for that night.`,
    };
  }
  if (tournament.status !== "skipped") return null;
  const lead = `No Midweek Madness on ${day}.`;
  if (tournament.status_reason === "club_break") {
    return {
      tone: "info",
      lead,
      rest: "There was no TFH session the week before, so the club was on a break. Nothing was played or paid, and your saved five didn't carry over.",
    };
  }
  // The field size of a skipped week is not published (ADR-097), so the copy
  // names the minimum rather than the count.
  return {
    tone: "info",
    lead,
    rest: `Fewer than ${minEntrants} clubs were in, and a bracket needs ${minEntrants}. Nothing was played or paid.`,
  };
}

/** The same notice as one line of text. */
export function skipOrVoidText(
  tournament: Pick<MidweekTournament, "lock_at" | "status" | "status_reason" | "void_note">,
  minEntrants: number,
): string | null {
  const notice = skipOrVoidNotice(tournament, minEntrants);
  return notice ? `${notice.lead} ${notice.rest}` : null;
}

/**
 * `save_midweek_squad`'s refusals (migration 20261003000000) in members'
 * words, the `friendlyError` pattern of the settings actions. Both P0001
 * cases share a code, so the message decides.
 */
export function squadSaveError(code: string | undefined, message: string | undefined): string {
  if (code === "22023") return "Pick between one and five cards you own, one per Player.";
  if (code === "P0001" && message?.includes("opted out")) {
    return "You've opted out. Take part again to pick a five.";
  }
  if (code === "P0001" && message?.includes("locked")) {
    return "Squads are locked. The five you saved before the lock is the one that plays.";
  }
  if (code === "P0002") return "There's no Midweek Madness week open to pick for right now.";
  if (code === "42501") return `Only active ${BRAND.shortName} members can take part.`;
  return "Something went wrong. Please try again.";
}

// ---- settings -----------------------------------------------------------------------

/**
 * The Wednesday an opt-in or opt-out next affects: this week's while picking
 * is open, otherwise the one after (a week locked tonight, or one that has
 * ended while the next hasn't opened yet). Null when no week exists yet.
 */
export function nextEntryWeekLabel(current: MidweekCurrent, now: Date): string | null {
  if (!current.lock_at) return null;
  if (isPickingOpen(current, now)) return formatDayDate(current.lock_at);
  const lock = Date.parse(current.lock_at);
  const next = lock > now.getTime() ? lock : lock + 7 * 24 * 60 * 60 * 1000;
  return formatDayDate(new Date(next).toISOString());
}

/**
 * The opt-out confirmation (Settings-TakingPart). What it says depends on
 * whether a squad saved for an open, unlocked week would be withdrawn
 * (`set_midweek_opt_out` deletes it) and whether tonight is already locked.
 */
export function optOutConfirmText(input: {
  locked: boolean;
  hasSavedSquad: boolean;
  weekLabel: string | null;
}): string {
  const comeBack = "You can come back any time before a Wednesday's lock.";
  if (input.locked) {
    return `Tonight's squads are already locked, so this applies from next Wednesday. ${comeBack}`;
  }
  const week = input.weekLabel ? ` for ${input.weekLabel}` : "";
  if (input.hasSavedSquad) {
    return `Your saved five${week} will be removed and you won't be entered. ${comeBack}`;
  }
  return `You won't be entered${week}, picked or auto, and none of your cards will be shown. ${comeBack}`;
}
