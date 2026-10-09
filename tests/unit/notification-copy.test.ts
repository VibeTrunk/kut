import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";
import { presentNotification, presentServerText } from "@/lib/notification-copy";
import { latestFunctions, migrationFunctions, stringLiterals } from "../support/sql-functions";

const FLUT = BRAND.currency;

/** One stored text per template, historical and current, and how the inbox shows it. */
const FIXTURES: [source: string, stored: string, shown: string][] = [
  [
    "attendance reward",
    "You received 250 KUT Coins for attending the session on 07 Oct 2026.",
    `You received 250 ${FLUT} for attending the session on 07 Oct 2026.`,
  ],
  [
    "bibs bonus, first wording",
    "You received 100 KUT Coins for washing the bibs after the session on 02 Sep 2026.",
    `You received 100 ${FLUT} for washing the bibs after the session on 02 Sep 2026.`,
  ],
  [
    "bibs bonus, current wording",
    "You received 100 KUT Coins for bringing the bibs to the session on 07 Oct 2026.",
    `You received 100 ${FLUT} for bringing the bibs to the session on 07 Oct 2026.`,
  ],
  [
    "market purchase",
    "You bought Steffen for 137 KUT Coins.",
    `You bought Steffen for 137 ${FLUT}.`,
  ],
  [
    "market sale",
    "Your Steffen card sold to Teize for 140 KUT Coins. You received 133 KUT Coins after tax.",
    `Your Steffen card sold to Teize for 140 ${FLUT}. You received 133 ${FLUT} after tax.`,
  ],
  [
    "market sale, before the buyer was named",
    "Your Steffen card sold for 140 KUT Coins. You received 133 KUT Coins after tax.",
    `Your Steffen card sold for 140 ${FLUT}. You received 133 ${FLUT} after tax.`,
  ],
  [
    "trade offer with cards",
    "Teize offered 40 KUT Coins plus 2 card(s) for your Steffen listing.",
    `Teize offered 40 ${FLUT} plus 2 card(s) for your Steffen listing.`,
  ],
  [
    "trade offer, coins only",
    "Teize offered 40 KUT Coins for your Steffen listing.",
    `Teize offered 40 ${FLUT} for your Steffen listing.`,
  ],
  [
    "trade completed",
    "You traded Steffen to Teize for 40 KUT Coins plus cards.",
    `You traded Steffen to Teize for 40 ${FLUT} plus cards.`,
  ],
  [
    "admin wallet adjustment",
    "An admin adjusted your wallet by +500 KUT Coins. Reason: Bibs refund",
    `An admin adjusted your wallet by +500 ${FLUT}. Reason: Bibs refund`,
  ],
  [
    "admin club reset",
    "Your KUT club was reset by an admin. You've been given a fresh starter pack.",
    "Your FLUT club was reset by an admin. You've been given a fresh starter pack.",
  ],
  [
    "session report open",
    "Your session report is open for 24 hours. Complete it to receive 50 KUT Coins.",
    `Your session report is open for 24 hours. Complete it to receive 50 ${FLUT}.`,
  ],
  [
    "injury mode on",
    "Get well soon! While you are out, check in from Home once every football week you sit out: you receive 100 KUT Coins and your card rating is protected for that week.",
    `Get well soon! While you are out, check in from Home once every football week you sit out: you receive 100 ${FLUT} and your card rating is protected for that week.`,
  ],
  [
    "rehab check-in open",
    "This week counts as a football week. Check in from Home to receive 100 KUT Coins and keep your card rating protected.",
    `This week counts as a football week. Check in from Home to receive 100 ${FLUT} and keep your card rating protected.`,
  ],
  [
    "Midweek payout v1, champion",
    "You won Midweek Madness on Wed 30 Sep: 250 KUT Coins over the night.",
    `You won Midweek Madness on Wed 30 Sep: 250 ${FLUT} over the night.`,
  ],
  [
    "Midweek payout v1, late rounds",
    "You reached the semi-finals on Wed 30 Sep: +100 KUT Coins. Joris won it.",
    `You reached the semi-finals on Wed 30 Sep: +100 ${FLUT}. Joris won it.`,
  ],
  [
    "Midweek payout v1, early rounds",
    "You went out in round 2 on Wed 30 Sep: +20 KUT Coins. Joris won it.",
    `You went out in round 2 on Wed 30 Sep: +20 ${FLUT}. Joris won it.`,
  ],
  ["Midweek result, champion", "250 KUT Coins over the night.", `250 ${FLUT} over the night.`],
  [
    "Midweek result v2, out on penalties with coins",
    "Sophie beat you on penalties, 7–6. +50 KUT Coins. Joris won it.",
    `Sophie beat you on penalties, 7–6. +50 ${FLUT}. Joris won it.`,
  ],
  [
    "Midweek result v2, auto squad",
    "Emma beat you 2–1. +10 KUT Coins. Joris won it. Your auto squad played for you.",
    `Emma beat you 2–1. +10 ${FLUT}. Joris won it. Your auto squad played for you.`,
  ],
  [
    "Midweek result v3, champion with calls",
    "256 KUT Coins over the night. You called 3 of 3 right: +6 KUT Coins.",
    `256 ${FLUT} over the night. You called 3 of 3 right: +6 ${FLUT}.`,
  ],
  [
    "Midweek result v3, everything",
    "Emma beat you 2–1. +10 KUT Coins. Joris won it. You called 2 of 3 right: +20 KUT Coins. Your auto squad played for you.",
    `Emma beat you 2–1. +10 ${FLUT}. Joris won it. You called 2 of 3 right: +20 ${FLUT}. Your auto squad played for you.`,
  ],
  [
    "Midweek result v3, no coins for calls",
    "Emma beat you 2–1. Joris won it. You called 0 of 2 right.",
    "Emma beat you 2–1. Joris won it. You called 0 of 2 right.",
  ],
  ["pack exception", "insufficient KUT Coins for this pack", `insufficient ${FLUT} for this pack`],
  [
    "listing exception",
    "insufficient KUT Coins for this listing",
    `insufficient ${FLUT} for this listing`,
  ],
  [
    "offer escrow exception",
    "insufficient KUT Coins to escrow this offer",
    `insufficient ${FLUT} to escrow this offer`,
  ],
  [
    "wallet limit exception",
    "amount exceeds the per-adjustment limit of 100000 KUT Coins",
    `amount exceeds the per-adjustment limit of 100000 ${FLUT}`,
  ],
  [
    "active member exception",
    "an active KUT account is required",
    "an active FLUT account is required",
  ],
];

describe("the FLUT notification presentation adapter (ADR-137)", () => {
  it.each(FIXTURES)("translates the %s template", (_source, stored, shown) => {
    expect(presentServerText(stored)).toBe(shown);
  });

  it("passes unknown and free text through unchanged", () => {
    for (const text of [
      "",
      "KUT Coins",
      "Your card is in the KUT Chronicle.",
      "You received 250 KUT Coins for something new.",
      "Sophie accepted your offer for Steffen. The card is now in your collection.",
      "Midweek Madness",
    ]) {
      expect(presentServerText(text)).toBe(text);
    }
  });

  it("keeps an admin's free-text reason as written, KUT Coins included", () => {
    expect(
      presentServerText(
        "An admin adjusted your wallet by -50 KUT Coins. Reason: Refund of 50 KUT Coins. Reason: typo",
      ),
    ).toBe(
      `An admin adjusted your wallet by -50 ${FLUT}. Reason: Refund of 50 KUT Coins. Reason: typo`,
    );
  });

  it("keeps names that contain KUT", () => {
    expect(presentServerText("KUT Kees offered 40 KUT Coins for your KUT listing.")).toBe(
      `KUT Kees offered 40 ${FLUT} for your KUT listing.`,
    );
    expect(presentServerText("KUT Kees beat you 2–1. +10 KUT Coins. KUT Kees won it.")).toBe(
      `KUT Kees beat you 2–1. +10 ${FLUT}. KUT Kees won it.`,
    );
  });

  it("translates title and body and leaves the rest of the row alone", () => {
    const row = {
      id: "n1",
      read_at: null,
      title: "Card bought",
      body: "You bought Steffen for 137 KUT Coins.",
    };
    expect(presentNotification(row)).toEqual({
      ...row,
      body: `You bought Steffen for 137 ${FLUT}.`,
    });
    expect(row.body).toBe("You bought Steffen for 137 KUT Coins.");
  });
});

/** A literal as the database renders it, with every `%s` filled. */
const rendered = (literal: string) => literal.replaceAll("%s", "7");

function untranslated(literals: { file: string; key: string; literal: string }[]) {
  return literals
    .filter(({ literal }) => {
      const expected = rendered(literal).replaceAll("KUT Coins", "FLUT Coins");
      return presentServerText(rendered(literal)) !== expected;
    })
    .map(({ file, key, literal }) => `${file} ${key}: '${literal}'`);
}

function coinLiterals(definitions: ReturnType<typeof migrationFunctions>) {
  return definitions.flatMap(({ file, key, body }) =>
    stringLiterals(body)
      .filter((literal) => literal.includes("KUT Coins"))
      .map((literal) => ({ file, key, literal })),
  );
}

describe("the migrations guard for server-written KUT Coins", () => {
  it("translates every KUT Coins literal in the latest definition of each function", () => {
    const literals = coinLiterals(latestFunctions());
    // A parser that found nothing would pass vacuously.
    expect(literals.length).toBeGreaterThanOrEqual(15);
    expect(untranslated(literals)).toEqual([]);
  });

  it("translates every KUT Coins literal any function version ever wrote", () => {
    expect(untranslated(coinLiterals(migrationFunctions()))).toEqual([]);
  });
});
