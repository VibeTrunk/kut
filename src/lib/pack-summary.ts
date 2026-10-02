/**
 * The pack summary's chips (UX review, "Not mocked, follow the review";
 * ADR-114): each revealed card says whether it filled an album slot ("New ·
 * fills slot 14") or how many copies the member now holds and what this one
 * discards for ("×3 · discards for 63"), and one line sums the pack up ("2
 * new Players. Album 19 / 29."). Pure: the page reads the opening, the
 * member's cards now and the album's roster.
 */

export type PackChip =
  { kind: "new"; slot: number; text: string } | { kind: "copies"; copies: number; text: string };

export type PackSummary = {
  chips: (PackChip | null)[];
  newPlayers: number;
  collected: number;
  total: number;
  line: string;
};

export function packSummary(input: {
  /** The opening's cards, in slot order. */
  opened: readonly { card_id: string; player_id: string | null }[];
  /** Every card the member owns now. */
  owned: readonly { card_id: string; player_id: string; discard_value: number }[];
  /** The album's Players in slot order (`buildSlots`: by name, then id). */
  roster: readonly string[];
}): PackSummary {
  const openedIds = new Set(input.opened.map((card) => card.card_id));
  const slotOf = new Map(input.roster.map((id, index) => [id, index + 1]));
  const copiesOf = new Map<string, string[]>();
  for (const card of input.owned) {
    copiesOf.set(card.player_id, [...(copiesOf.get(card.player_id) ?? []), card.card_id]);
  }
  const discardOf = new Map(input.owned.map((card) => [card.card_id, card.discard_value]));

  const counted = new Set<string>();
  let newPlayers = 0;
  const chips = input.opened.map((card): PackChip | null => {
    const player = card.player_id;
    const copies = player ? (copiesOf.get(player) ?? []) : [];
    // A card sold or discarded since has nothing left to say.
    if (!player || !copies.includes(card.card_id)) return null;
    const slot = slotOf.get(player);
    // New: every copy the member holds came out of this pack, so the slot was
    // empty before it. Only the first copy of a Player in the pack says so.
    if (slot !== undefined && !counted.has(player) && copies.every((id) => openedIds.has(id))) {
      counted.add(player);
      newPlayers += 1;
      return { kind: "new", slot, text: `New · fills slot ${slot}` };
    }
    counted.add(player);
    if (copies.length < 2) return null;
    return {
      kind: "copies",
      copies: copies.length,
      text: `×${copies.length} · discards for ${discardOf.get(card.card_id) ?? 0}`,
    };
  });

  const total = input.roster.length;
  const collected = input.roster.filter((id) => (copiesOf.get(id)?.length ?? 0) > 0).length;
  const lead =
    newPlayers === 0
      ? "No new Players."
      : `${newPlayers} new ${newPlayers === 1 ? "Player" : "Players"}.`;
  return { chips, newPlayers, collected, total, line: `${lead} Album ${collected} / ${total}.` };
}
