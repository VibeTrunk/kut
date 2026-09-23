import type { LiveCardPlayer } from "@/components/live-card";

/**
 * One rule for the plaster cast on every card screen (ADR-084, ADR-085): a card
 * goes into the cast when it is a Live card of a Player who is injured right
 * now. A Special edition is a frozen snapshot whose rating nothing protects, so
 * it never does (ADR-082). The card's `id` is always the Player id, because the
 * cast's signatures hash it.
 */

/** The columns every card view carries for the card face. */
export type CardFaceRow = {
  display_name: string;
  archetype: string;
  photo_path: string | null;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  rarity_tier: LiveCardPlayer["rarityTier"];
};

/** A `kut.player_directory` or `kut.top_risers` row: the Player's own Live card. */
export type PlayerCardRow = CardFaceRow & { id: string; live_ovr: number };

/** A copy someone owns: a `kut.my_collection_cards` row, or the album's shape of it. */
export type OwnedCardRow = CardFaceRow & { player_id: string; is_live: boolean } & (
    { ovr: number } | { live_ovr: number }
  );

/**
 * A `kut.active_market_listings` or `kut.my_pack_opening_results` row. Both
 * views gained `player_id` and `is_live` in `20261002000000` (ADR-086). The
 * pages read them with `select("*")` and deploy before the hosted push, so
 * until then both fields are absent, which means no cast.
 */
export type ListedCardRow = CardFaceRow & {
  ovr: number;
  player_id?: string | null;
  is_live?: boolean | null;
};

function cardFace(row: CardFaceRow, ovr: number, photoUrls: ReadonlyMap<string, string>) {
  return {
    displayName: row.display_name,
    archetype: row.archetype,
    liveOvr: ovr,
    pac: row.pac,
    sho: row.sho,
    pas: row.pas,
    dri: row.dri,
    def: row.def,
    phy: row.phy,
    rarityTier: row.rarity_tier,
    photoUrl: row.photo_path ? (photoUrls.get(row.photo_path) ?? null) : null,
  };
}

export function toLiveCardPlayer(
  row: PlayerCardRow | OwnedCardRow,
  injuredPlayerIds: ReadonlySet<string>,
  photoUrls: ReadonlyMap<string, string>,
): LiveCardPlayer {
  const owned = "player_id" in row;
  const playerId = owned ? row.player_id : row.id;
  const isLive = owned ? row.is_live : true;
  const ovr = "ovr" in row ? row.ovr : row.live_ovr;
  return {
    ...cardFace(row, ovr, photoUrls),
    id: playerId,
    injured: isLive && injuredPlayerIds.has(playerId),
  };
}

/** The same rule for a market or pack row, which may not carry its Player yet. */
export function toListedCardPlayer(
  row: ListedCardRow,
  injuredPlayerIds: ReadonlySet<string>,
  photoUrls: ReadonlyMap<string, string>,
): LiveCardPlayer {
  const { player_id: playerId, is_live: isLive } = row;
  if (typeof playerId !== "string" || typeof isLive !== "boolean") {
    return { ...cardFace(row, row.ovr, photoUrls), id: null, injured: false };
  }
  return toLiveCardPlayer(
    { ...row, player_id: playerId, is_live: isLive },
    injuredPlayerIds,
    photoUrls,
  );
}
