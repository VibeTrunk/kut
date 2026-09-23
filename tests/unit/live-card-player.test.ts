import { describe, expect, it } from "vitest";
import { toLiveCardPlayer, type CardFaceRow } from "@/lib/live-card-player";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const OTHER_PLAYER = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";

const face: CardFaceRow = {
  display_name: "Djanco Example",
  archetype: "all_rounder",
  photo_path: null,
  pac: 60,
  sho: 61,
  pas: 62,
  dri: 63,
  def: 64,
  phy: 65,
  rarity_tier: "silver",
};

// The same Player in every row shape a card screen reads.
const directoryRow = { ...face, id: PLAYER, slug: "djanco", live_ovr: 70 };
const riserRow = { ...directoryRow, ovr_delta: 3 };
const collectionRow = { ...face, card_id: CARD, player_id: PLAYER, is_live: true, ovr: 70 };
const albumRow = { ...collectionRow, live_ovr: 70 };
const starterRow = { ...face, card_id: CARD, player_id: PLAYER, is_live: true, ovr: 70 };

const injured = new Set([PLAYER]);
const noPhotos = new Map<string, string>();

describe("toLiveCardPlayer", () => {
  it("never casts a Special card, even of an injured Player", () => {
    const special = { ...collectionRow, is_live: false };
    expect(toLiveCardPlayer(special, injured, noPhotos).injured).toBe(false);
    expect(toLiveCardPlayer({ ...albumRow, is_live: false }, injured, noPhotos).injured).toBe(
      false,
    );
  });

  it("casts a Live card of an injured Player", () => {
    for (const row of [directoryRow, riserRow, collectionRow, albumRow, starterRow]) {
      expect(toLiveCardPlayer(row, injured, noPhotos).injured).toBe(true);
    }
  });

  it("leaves a Live card of a Player who isn't injured alone", () => {
    const elsewhere = new Set([OTHER_PLAYER]);
    for (const row of [directoryRow, riserRow, collectionRow, albumRow, starterRow]) {
      expect(toLiveCardPlayer(row, elsewhere, noPhotos).injured).toBe(false);
      expect(toLiveCardPlayer(row, new Set(), noPhotos).injured).toBe(false);
    }
  });

  it("gives the same Player the same id from every row shape, never the card id", () => {
    const ids = [directoryRow, riserRow, collectionRow, albumRow, starterRow].map(
      (row) => toLiveCardPlayer(row, injured, noPhotos).id,
    );
    expect(new Set(ids)).toEqual(new Set([PLAYER]));
    expect(ids).not.toContain(CARD);
  });

  it("reads the rating from either column name and resolves the photo", () => {
    const photos = new Map([["players/djanco.jpg", "https://example.test/djanco.jpg"]]);
    const card = toLiveCardPlayer(
      { ...collectionRow, ovr: 71, photo_path: "players/djanco.jpg" },
      injured,
      photos,
    );
    expect(card.liveOvr).toBe(71);
    expect(card.photoUrl).toBe("https://example.test/djanco.jpg");
    expect(toLiveCardPlayer(directoryRow, injured, photos).liveOvr).toBe(70);
    expect(toLiveCardPlayer(directoryRow, injured, photos).photoUrl).toBeNull();
  });
});
