export type OwnedCardIdentity = {
  player_id: string;
  edition_id: string;
  active_listing_id?: string | null;
  held_by_offer_id?: string | null;
};

export type MarketListingIdentity = {
  player_id?: string | null;
  edition_id?: string | null;
};

export type OwnershipCounts = {
  byPlayer: ReadonlyMap<string, number>;
  byEdition: ReadonlyMap<string, number>;
};

export type OwnershipDisplayData = {
  playerCopies: number;
  editionCopies: number;
  /** The listing page's chip: the whole sentence fits beside a detail card. */
  text: string;
  /** The grid tile's chip, on a ~167px card (KB-026): the counts alone. */
  shortText: string;
  /** Spoken in both places, unchanged since ADR-100. */
  accessibleText: string;
};

/** Count every owned copy once, regardless of listing or trade-offer holds. */
export function countOwnedCopies(cards: readonly OwnedCardIdentity[]): OwnershipCounts {
  const byPlayer = new Map<string, number>();
  const byEdition = new Map<string, number>();

  for (const card of cards) {
    byPlayer.set(card.player_id, (byPlayer.get(card.player_id) ?? 0) + 1);
    byEdition.set(card.edition_id, (byEdition.get(card.edition_id) ?? 0) + 1);
  }

  return { byPlayer, byEdition };
}

function copies(count: number) {
  return `${count} ${count === 1 ? "copy" : "copies"}`;
}

/** Turn the two ownership totals for one listing into its visible and spoken copy. */
export function ownershipDisplayData(
  counts: OwnershipCounts,
  listing: MarketListingIdentity,
): OwnershipDisplayData | null {
  if (!listing.player_id || !listing.edition_id) return null;

  const playerCopies = counts.byPlayer.get(listing.player_id) ?? 0;
  const editionCopies = counts.byEdition.get(listing.edition_id) ?? 0;
  if (playerCopies === 0 && editionCopies === 0) return null;

  // Equal totals need only one number: "2 · 2" reads as a typo (KB-026).
  const sameCount = playerCopies === editionCopies;
  const shortText = sameCount
    ? `You own ${playerCopies}`
    : `You own ${playerCopies} · ${editionCopies}`;

  if (playerCopies === 1 && editionCopies === 1) {
    return {
      playerCopies,
      editionCopies,
      text: "You own 1 of this edition",
      shortText,
      accessibleText: "You own 1 copy of this edition.",
    };
  }

  return {
    playerCopies,
    editionCopies,
    text: sameCount
      ? `You own ${playerCopies} of this edition`
      : `You own ${playerCopies} · ${editionCopies} of this edition`,
    shortText,
    accessibleText: `You own ${copies(playerCopies)} of this Player, including ${copies(editionCopies)} of this edition.`,
  };
}
