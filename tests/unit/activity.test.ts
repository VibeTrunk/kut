import { describe, expect, it } from "vitest";
import {
  activityKindLabel,
  describeActivity,
  type ActivityKind,
  type ActivityRow,
} from "@/lib/activity";

const base: ActivityRow = {
  kind: "sale",
  ts: "2026-08-31T10:00:00Z",
  actor_name: "Teize",
  counterparty_name: "Michael",
  card_name: "Steffen",
  amount: 137,
  session_date: null,
  session_type: null,
};

describe("describeActivity", () => {
  const kinds: ActivityKind[] = ["sale", "trade", "listing", "pack", "session"];

  it.each(kinds)("returns a non-empty sentence for a %s row", (kind) => {
    const sentence = describeActivity({ ...base, kind });
    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence).toMatch(/\.$/);
  });

  it("describes a trade with both parties and the coin amount", () => {
    expect(describeActivity({ ...base, kind: "trade" })).toBe(
      "Teize traded Steffen to Michael for 137 KUT Coins.",
    );
  });

  it("never renders blank for an unknown kind (e.g. a future view addition)", () => {
    const sentence = describeActivity({ ...base, kind: "raffle" as ActivityKind });
    expect(sentence.length).toBeGreaterThan(0);
  });

  it("tolerates null names and amounts", () => {
    const sentence = describeActivity({
      ...base,
      kind: "trade",
      actor_name: null,
      counterparty_name: null,
      card_name: null,
      amount: null,
    });
    expect(sentence).toBe("A member traded a card to a member for 0 KUT Coins.");
  });
});

describe("activityKindLabel", () => {
  it("labels every known kind", () => {
    expect(activityKindLabel("sale")).toBe("Sale");
    expect(activityKindLabel("trade")).toBe("Trade");
    expect(activityKindLabel("listing")).toBe("New listing");
    expect(activityKindLabel("pack")).toBe("Pack opened");
    expect(activityKindLabel("session")).toBe("Session published");
  });

  it("falls back to a generic label for an unknown kind", () => {
    expect(activityKindLabel("raffle")).toBe("Club activity");
  });
});
