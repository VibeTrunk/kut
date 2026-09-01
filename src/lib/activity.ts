import { formatDate } from "@/lib/format";

// Club-wide activity feed, rendered as a section at the bottom of Home.
// Backed by the read-only `kut.activity_feed` view (ADR-038); ADR-039 moved
// it from a standalone `/feed` route into Home. `trade` was added to the view
// by the trade-offers migration (20260911000000) and to this module by
// ADR-044.

export type ActivityKind = "sale" | "trade" | "listing" | "pack" | "session";

export type ActivityRow = {
  kind: ActivityKind;
  ts: string;
  actor_name: string | null;
  counterparty_name: string | null;
  card_name: string | null;
  amount: number | null;
  session_date: string | null;
  session_type: string | null;
};

// Oldest activity the feed will show. The club started using KUT for real on
// 2026-08-30; earlier rows are test/seed noise.
export const ACTIVITY_FLOOR_ISO = "2026-08-30T00:00:00Z";

const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  sale: "Sale",
  trade: "Trade",
  listing: "New listing",
  pack: "Pack opened",
  session: "Session published",
};

// Tolerant lookup: an unknown `kind` (e.g. a future view addition) falls back
// to a generic label rather than rendering a blank kicker.
export function activityKindLabel(kind: string): string {
  return ACTIVITY_KIND_LABELS[kind as ActivityKind] ?? "Club activity";
}

// Kept as a named export for backwards compatibility with existing imports.
export const ACTIVITY_KIND_LABEL = ACTIVITY_KIND_LABELS;

export function describeActivity(row: ActivityRow): string {
  const coins = (n: number | null) => `${n ?? 0} KUT Coins`;
  switch (row.kind) {
    case "sale":
      return `${row.actor_name ?? "A member"} sold ${row.card_name ?? "a card"} to ${row.counterparty_name ?? "a member"} for ${coins(row.amount)}.`;
    case "trade":
      return `${row.actor_name ?? "A member"} traded ${row.card_name ?? "a card"} to ${row.counterparty_name ?? "a member"} for ${coins(row.amount)}.`;
    case "listing":
      return `${row.actor_name ?? "A member"} listed ${row.card_name ?? "a card"} for ${coins(row.amount)}.`;
    case "pack":
      return `${row.actor_name ?? "A member"} opened a pack (${coins(row.amount)}).`;
    case "session":
      return `A new session was published${row.session_date ? ` — ${formatDate(row.session_date)} · ${row.session_type ?? "session"}` : ""}.`;
    default:
      return "A member did something in the club.";
  }
}
