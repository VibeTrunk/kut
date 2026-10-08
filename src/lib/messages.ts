/**
 * The inbox (design/ux-review/HANDOFF.md "Messages", ADR-114): every message
 * links to its subject, opening one marks it read, and the list is grouped by
 * day in club time. Pure helpers; the page and the open route do the reads.
 */

export type NotificationEventType =
  | "market_sale"
  | "market_purchase"
  | "attendance_reward"
  | "bibs_bonus"
  | "pack_opened"
  | "admin_notice"
  | "trade_offer"
  | "trade_response"
  | "session_report"
  | "session_results"
  | "report_correction"
  | "kudos_awarded"
  | "injury_check_in"
  | "midweek_result";

export type UserNotification = {
  id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  reference_type: string | null;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** The kicker above each title; "Club notice" for a type added server-side before this map. */
export const EVENT_LABELS: Record<NotificationEventType, string> = {
  market_sale: "Market sale",
  market_purchase: "Market purchase",
  attendance_reward: "Attendance reward",
  bibs_bonus: "Bibs bonus",
  pack_opened: "Pack opened",
  admin_notice: "Club notice",
  trade_offer: "Trade offer",
  trade_response: "Trade update",
  session_report: "Session report",
  session_results: "Session results",
  report_correction: "Report correction",
  kudos_awarded: "Kudos awarded",
  injury_check_in: "Rehab check-in",
  midweek_result: "Midweek Madness",
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type as NotificationEventType] ?? "Club notice";
}

/** Where a message leads, and the words on its link (HANDOFF "Link labels"). */
export type MessageTarget = { href: string; label: string };

/**
 * What the page looked up to resolve the targets it can't read off the row:
 * a Midweek tournament's week, and a bought card the member still owns.
 */
export type TargetLookups = {
  /** Tournament id → its `week_start`. */
  weekByTournament: ReadonlyMap<string, string>;
  /** Market sale id → the bought card's id, only while the member still owns it. */
  ownedCardBySale: ReadonlyMap<string, string>;
};

/**
 * A message's subject, by `event_type` (HANDOFF "Messages"), or null when it
 * has none, which the row shows by leaving out its arrow:
 *
 * - Midweek result → that week's bracket;
 * - a sale → the wallet: FLUT has no wallet page, and Club Value opens with the
 *   balance; a purchase → the card, while the member still owns it;
 * - a trade offer or its answer → Offers. HANDOFF sends an answer to the
 *   listing, but by the time an offer is answered, expired or cancelled the
 *   listing has usually sold or closed, and the offer row says what happened;
 * - kudos → My card;
 * - a session's results, reward, bibs bonus or correction → its Chronicle
 *   issue (`/sessions/{id}` redirects to the week's issue, ADR-049); the
 *   report form's own message → the form;
 * - the rehab check-in → Home, where the check-in is;
 * - a club notice, or a type no code sends any more (`pack_opened`) → nothing.
 */
export function messageTarget(
  message: Pick<UserNotification, "event_type" | "reference_type" | "reference_id">,
  lookups: TargetLookups,
): MessageTarget | null {
  const ref = message.reference_id;
  switch (message.event_type) {
    case "midweek_result": {
      const week = ref ? lookups.weekByTournament.get(ref) : undefined;
      return week ? { href: `/midweek/${week}`, label: "Bracket" } : null;
    }
    case "market_sale":
      return { href: "/club/value", label: "Wallet" };
    case "market_purchase": {
      const card = ref ? lookups.ownedCardBySale.get(ref) : undefined;
      return card ? { href: `/club/collection/${card}`, label: "Your card" } : null;
    }
    case "trade_offer":
    case "trade_response":
      return { href: "/market/offers", label: "Offers" };
    case "kudos_awarded":
      return { href: "/settings/card", label: "Your card" };
    case "session_results":
    case "attendance_reward":
    case "bibs_bonus":
    case "report_correction":
      return message.reference_type === "match_session" && ref
        ? { href: `/sessions/${ref}`, label: "Chronicle" }
        : null;
    case "session_report":
      return message.reference_type === "match_session" && ref
        ? { href: `/sessions/${ref}/report`, label: "Your report" }
        : null;
    case "injury_check_in":
      return { href: "/", label: "Check in" };
    default:
      return null;
  }
}

/** The ids `messageTarget` needs looked up, from a page of messages. */
export function targetLookupIds(messages: readonly UserNotification[]) {
  const ids = (type: NotificationEventType) => [
    ...new Set(
      messages
        .filter((message) => message.event_type === type && message.reference_id)
        .map((message) => message.reference_id as string),
    ),
  ];
  return { tournamentIds: ids("midweek_result"), saleIds: ids("market_purchase") };
}

const AMS = "Europe/Amsterdam";
const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: AMS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: AMS,
  hour: "2-digit",
  minute: "2-digit",
});
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: AMS, weekday: "short" });
const dayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: AMS,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Days since 1970 of the club-time calendar date of `iso`. */
function clubDay(iso: string | Date): number {
  return Date.parse(`${isoDate.format(new Date(iso))}T00:00:00Z`) / 86_400_000;
}

export type MessageGroup = {
  /** "Today", "Earlier this week", or the day ("Wed 30 Sep"). */
  heading: string;
  messages: { message: UserNotification; time: string }[];
};

/**
 * Newest first, in `Today`, `Earlier this week` (since Monday, club time) and
 * then one group per older day. A row's time is the clock today, the weekday
 * earlier this week, and the clock again under a dated heading.
 */
export function groupMessages(messages: readonly UserNotification[], now: Date): MessageGroup[] {
  const today = clubDay(now);
  // 1970-01-01 was a Thursday, so day 4 is a Monday.
  const monday = today - ((((today - 4) % 7) + 7) % 7);
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const day = clubDay(message.created_at);
    const at = new Date(message.created_at);
    const heading =
      day >= today ? "Today" : day >= monday ? "Earlier this week" : dayDate.format(at);
    const time = heading === "Earlier this week" ? weekday.format(at) : clock.format(at);
    const last = groups.at(-1);
    if (last && last.heading === heading) last.messages.push({ message, time });
    else groups.push({ heading, messages: [{ message, time }] });
  }
  return groups;
}
