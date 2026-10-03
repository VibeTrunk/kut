import type { LiveCardPlayer } from "@/components/live-card";
import { archetypeLabel } from "@/game/archetypes";
import { formatDayDate, formatDayMonth } from "./entry";
import {
  fieldCounts,
  finalLine,
  myNight,
  nightTotals,
  roundName,
  roundShort,
  settledWinner,
  sideScore,
  TIER_LABEL,
  type MyNight,
} from "./evening";
import type { NightRatings } from "./night-ratings";
import type { EntryCardRow, MatchRow } from "./rows";

/**
 * The two share images (DR3 HANDOFF §3, ADR-120): the champion poster anyone
 * may share, and "my night" for the member's own. This module turns the rows
 * the page already has into every word and number on them; `share-draw.ts`
 * only lays them out. Pure, so the copy is unit-tested; the drawing runs in
 * the browser, on a canvas.
 */

export type ShareCard = {
  /** The name under the disc: `Bas V.`, `Sanne's trialist`. */
  name: string;
  ovr: number;
  tier: LiveCardPlayer["rarityTier"];
  /** `ALL-ROUNDER · BRONZE`, as LiveCard's nameplate. */
  meta: string;
  /** The nameplate's name: the card's display name, `Trialist` for a trialist. */
  plate: string;
  /** The surname set across the shirt's shoulders, as LiveCard sets it. */
  shirtName: string;
  stats: [string, number][];
  photoUrl: string | null;
  rating: number;
};

/** One round of a path: `Round 2` over `7–0 Emma` (the poster) or `Beat Eline 1–0` (my night). */
export type ShareTile = { round: string; text: string; out: boolean };

export type PosterData = {
  kind: "poster";
  top: string;
  champion: string;
  line: string;
  fiveLabel: string;
  cards: ShareCard[];
  tiles: ShareTile[];
  foot: string;
  fileName: string;
};

export type MyNightData = {
  kind: "night";
  top: string;
  title: string;
  finish: string;
  coins: number;
  tiles: ShareTile[];
  fiveLabel: string;
  cards: ShareCard[];
  /** Index into `cards` of the best night rating (first on a tie). */
  best: number;
  bestLine: string;
  foot: string;
  fileName: string;
};

export type ShareImage = PosterData | MyNightData;

/** `Midweek Madness · Wed 7 Oct 2026`. */
export function shareTop(lockAt: string): string {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
  }).format(new Date(lockAt));
  return `Midweek Madness · ${formatDayDate(lockAt)} ${year}`;
}

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** `kut-midweek-7-oct-champion.png`, `kut-midweek-7-oct-sanne.png`. */
export function shareFileName(lockAt: string, who: "champion" | string): string {
  return `kut-midweek-${slug(formatDayMonth(lockAt))}-${who === "champion" ? "champion" : slug(who) || "night"}.png`;
}

function surname(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : name.trim();
}

/** A rated card, with its face for the canvas: the same numbers LiveCard shows. */
export function shareCards(ratings: NightRatings): ShareCard[] {
  return [...ratings.cards]
    .sort((a, b) => a.slot - b.slot)
    .map((card) => {
      const face = card.face;
      const tier = face?.rarityTier ?? "common";
      return {
        name: card.name,
        ovr: card.ovr,
        tier,
        meta: `${archetypeLabel(face?.archetype ?? "all_rounder")} · ${TIER_LABEL[tier]}`.toUpperCase(),
        plate: face?.displayName ?? "Trialist",
        shirtName: surname(face?.displayName ?? "Trialist").toUpperCase(),
        stats: face
          ? [
              ["PAC", face.pac],
              ["SHO", face.sho],
              ["PAS", face.pas],
              ["DRI", face.dri],
              ["DEF", face.def],
              ["PHY", face.phy],
            ]
          : ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"].map((label) => [label, card.ovr]),
        photoUrl: face?.photoUrl ?? null,
        rating: card.rating,
      };
    });
}

/** A member's matches and byes, in round order, with their side. */
function pathOf(matches: readonly MatchRow[], userId: string) {
  return matches
    .filter(
      (match) =>
        match.winner_side !== null &&
        (match.side_0_user_id === userId || match.side_1_user_id === userId),
    )
    .sort((a, b) => a.round - b.round)
    .map((match) => ({ match, side: (match.side_0_user_id === userId ? 0 : 1) as 0 | 1 }));
}

/** `2–2, 6–7` with penalties, else `1–0`: the member's side first. */
function scoreFor(match: MatchRow, side: 0 | 1): { text: string; pens: boolean } {
  const mine = sideScore(match, side);
  const theirs = sideScore(match, side === 0 ? 1 : 0);
  if (mine.penalties !== null && theirs.penalties !== null) {
    return {
      text: `${mine.goals}–${theirs.goals}, ${mine.penalties}–${theirs.penalties}`,
      pens: true,
    };
  }
  return { text: `${mine.goals}–${theirs.goals}`, pens: false };
}

/** The poster's path: `Round 2` over `7–0 Emma`, a shoot-out as `1–1, 5–4 pens Sophie`, a bye as `Bye`. */
export function posterTiles(
  matches: readonly MatchRow[],
  userId: string,
  rounds: number,
): ShareTile[] {
  return pathOf(matches, userId).map(({ match, side }) => {
    const round = roundShort(match.round, rounds);
    if (match.bye) return { round, text: "Bye", out: false };
    const opponent = (side === 0 ? match.side_1_name : match.side_0_name) ?? "";
    const score = scoreFor(match, side);
    return { round, text: `${score.text}${score.pens ? " pens" : ""} ${opponent}`, out: false };
  });
}

/** My night's path: `Beat Eline 1–0`, `Lost to Sophie on pens, 6–7`; the tile where you went out is dashed. */
export function nightTiles(
  matches: readonly MatchRow[],
  userId: string,
  rounds: number,
): ShareTile[] {
  return pathOf(matches, userId).map(({ match, side }) => {
    const round = roundShort(match.round, rounds);
    if (match.bye) return { round, text: "Bye", out: false };
    const opponent = (side === 0 ? match.side_1_name : match.side_0_name) ?? "";
    const won = settledWinner(match) === side;
    const mine = sideScore(match, side);
    const theirs = sideScore(match, side === 0 ? 1 : 0);
    const pens =
      mine.penalties !== null && theirs.penalties !== null
        ? `on pens, ${mine.penalties}–${theirs.penalties}`
        : null;
    const text = won
      ? pens
        ? `Beat ${opponent} ${pens}`
        : `Beat ${opponent} ${mine.goals}–${theirs.goals}`
      : pens
        ? `Lost to ${opponent} ${pens}`
        : `Lost to ${opponent} ${mine.goals}–${theirs.goals}`;
    return { round, text, out: !won };
  });
}

/** The finish in the serif: `Champion`, `Final`, `Semi-finals`, `Quarter-finals`, `Round 1`. */
export function finishWord(night: Pick<MyNight, "rows" | "champion">, rounds: number): string {
  if (night.champion) return "Champion";
  const out = night.rows.find((row) => row.kind === "out");
  return roundName(out?.round ?? rounds, rounds);
}

const possessive = (name: string) => `${name}’s`;

export function posterData(input: {
  lockAt: string;
  rounds: number;
  championId: string;
  championName: string;
  final: MatchRow;
  matches: readonly MatchRow[];
  ratings: NightRatings;
  entrants: number;
  goals: number;
}): PosterData {
  return {
    kind: "poster",
    top: shareTop(input.lockAt),
    champion: input.championName,
    line: finalLine(input.final),
    fiveLabel: `${possessive(input.championName)} five · rated out of 10 for the night`,
    cards: shareCards(input.ratings),
    tiles: posterTiles(input.matches, input.championId, input.rounds),
    foot: `${input.entrants} entrants · ${input.goals} goals`,
    fileName: shareFileName(input.lockAt, "champion"),
  };
}

export function myNightData(input: {
  lockAt: string;
  rounds: number;
  userId: string;
  night: Pick<MyNight, "rows" | "champion">;
  matches: readonly MatchRow[];
  ratings: NightRatings;
  coins: number;
  calls: { right: number; picks: number };
  championName: string;
}): MyNightData {
  const cards = shareCards(input.ratings);
  const top = Math.max(...cards.map((card) => card.rating));
  const best = cards.findIndex((card) => card.rating === top);
  const bestCard = input.ratings.cards.find((card) => card.best) ?? input.ratings.cards[0];
  return {
    kind: "night",
    top: shareTop(input.lockAt),
    title: `${possessive(input.ratings.manager)} night`,
    finish: finishWord(input.night, input.rounds),
    coins: input.coins,
    tiles: nightTiles(input.matches, input.userId, input.rounds),
    fiveLabel: `${possessive(input.ratings.manager)} five · rated out of 10 for the night`,
    cards,
    best,
    bestLine: bestCard.line,
    foot:
      input.calls.picks > 0
        ? `Called ${input.calls.right} of ${input.calls.picks} · ${input.championName} won it`
        : `${input.championName} won it`,
    fileName: shareFileName(input.lockAt, input.ratings.manager),
  };
}

/**
 * Both images for a complete week, from what the champion view and the
 * bracket already load: the poster when the final and the champion's ratings
 * are there, "my night" when the member played (a member who didn't enter
 * gets the poster only).
 */
export function shareImages(input: {
  lockAt: string;
  rounds: number;
  scheduleVersion: number;
  userId: string;
  championId: string | null;
  championName: string | null;
  matches: readonly MatchRow[];
  entries: readonly Pick<EntryCardRow, "user_id" | "auto">[];
  ratings: ReadonlyMap<string, NightRatings>;
  /** The member's wins plus calls, as paid. */
  coins: number;
  calls: { right: number; picks: number };
}): { poster: PosterData | null; night: MyNightData | null } {
  const final = input.matches.find(
    (match) => match.round === input.rounds && !match.bye && match.winner_side !== null,
  );
  const championRatings = input.championId ? input.ratings.get(input.championId) : undefined;
  const champion = input.championName ?? "The champion";
  const poster =
    final && input.championId && championRatings
      ? posterData({
          lockAt: input.lockAt,
          rounds: input.rounds,
          championId: input.championId,
          championName: champion,
          final,
          matches: input.matches,
          ratings: championRatings,
          entrants: fieldCounts(input.entries).entrants,
          goals: nightTotals(input.matches, input.rounds).goals,
        })
      : null;
  const mine = input.ratings.get(input.userId);
  const night = mine
    ? myNightData({
        lockAt: input.lockAt,
        rounds: input.rounds,
        userId: input.userId,
        night: myNight({
          userId: input.userId,
          rounds: input.rounds,
          lockAt: input.lockAt,
          scheduleVersion: input.scheduleVersion,
          matches: input.matches,
        }),
        matches: input.matches,
        ratings: mine,
        coins: input.coins,
        calls: input.calls,
        championName: champion,
      })
    : null;
  return { poster, night };
}
