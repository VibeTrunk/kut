import { describe, expect, it } from "vitest";
import { countOwnedCopies, ownershipDisplayData } from "@/lib/market-ownership";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const OTHER_PLAYER = "22222222-2222-4222-8222-222222222222";
const LIVE_EDITION = "33333333-3333-4333-8333-333333333333";
const SPECIAL_EDITION = "44444444-4444-4444-8444-444444444444";
const OTHER_EDITION = "55555555-5555-4555-8555-555555555555";
const listing = { player_id: PLAYER, edition_id: LIVE_EDITION };

describe("market ownership display", () => {
  it("returns nothing for zero holdings", () => {
    expect(ownershipDisplayData(countOwnedCopies([]), listing)).toBeNull();
  });

  it("uses the concise exact-edition wording for one copy", () => {
    const ownership = ownershipDisplayData(
      countOwnedCopies([{ player_id: PLAYER, edition_id: LIVE_EDITION }]),
      listing,
    );

    expect(ownership).toEqual({
      playerCopies: 1,
      editionCopies: 1,
      text: "You own 1 of this edition",
      accessibleText: "You own 1 copy of this edition.",
    });
  });

  it("counts multiple copies of one edition", () => {
    const cards = Array.from({ length: 3 }, () => ({
      player_id: PLAYER,
      edition_id: LIVE_EDITION,
    }));

    expect(ownershipDisplayData(countOwnedCopies(cards), listing)).toMatchObject({
      playerCopies: 3,
      editionCopies: 3,
      text: "You own 3 · 3 of this edition",
    });
  });

  it("shows the Player total and the exact-edition total across several editions", () => {
    const cards = [
      { player_id: PLAYER, edition_id: LIVE_EDITION },
      { player_id: PLAYER, edition_id: SPECIAL_EDITION },
      { player_id: PLAYER, edition_id: SPECIAL_EDITION },
    ];

    expect(ownershipDisplayData(countOwnedCopies(cards), listing)).toEqual({
      playerCopies: 3,
      editionCopies: 1,
      text: "You own 3 · 1 of this edition",
      accessibleText: "You own 3 copies of this Player, including 1 copy of this edition.",
    });
  });

  it("counts listed and offer-held copies as owned", () => {
    const cards = [
      {
        player_id: PLAYER,
        edition_id: LIVE_EDITION,
        active_listing_id: "66666666-6666-4666-8666-666666666666",
        held_by_offer_id: null,
      },
      {
        player_id: PLAYER,
        edition_id: LIVE_EDITION,
        active_listing_id: null,
        held_by_offer_id: "77777777-7777-4777-8777-777777777777",
      },
    ];

    expect(ownershipDisplayData(countOwnedCopies(cards), listing)).toMatchObject({
      playerCopies: 2,
      editionCopies: 2,
    });
  });

  it("does not let unrelated Players affect either total", () => {
    const cards = [
      { player_id: PLAYER, edition_id: LIVE_EDITION },
      { player_id: OTHER_PLAYER, edition_id: OTHER_EDITION },
      { player_id: OTHER_PLAYER, edition_id: OTHER_EDITION },
    ];

    expect(ownershipDisplayData(countOwnedCopies(cards), listing)).toMatchObject({
      playerCopies: 1,
      editionCopies: 1,
    });
  });
});
