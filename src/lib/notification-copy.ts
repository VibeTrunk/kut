import { BRAND } from "@/lib/brand";

/**
 * The notification presentation adapter (ADR-137). Postgres functions write
 * messages and raise exceptions in the old name ("KUT Coins", "Your KUT club").
 * Rows are never rewritten: this translates the text at display time, for
 * messages already stored and for those the database still writes.
 *
 * Only known server templates change, and only in their fixed wording. Every
 * template below is a SQL `format()` string copied verbatim from
 * `supabase/migrations` (`''` unescaped), current and historical; each `%s`
 * matches anything and passes through untouched, so names, numbers, links and
 * an admin's free-text reason keep their own words. Text that matches no
 * template is returned as it came. The guard test in
 * `tests/unit/notification-copy.test.ts` fails when a migration adds a
 * "KUT Coins" literal this registry does not cover.
 */

/** One sentence (or whole message), as a SQL format string. */
type Template = string;
/**
 * A message built with `concat_ws(' ', …)`: the slots in order, each either
 * absent or one of its alternatives, the present ones joined by one space.
 */
type Composite = readonly (readonly Template[])[];

const TEMPLATES: readonly Template[] = [
  // Attendance reward (ADR-028; 20260831000000 function and backfill).
  "You received %s KUT Coins for attending the session on %s.",
  // Bibs bonus: 20260907000000, then 20260912000000's wording.
  "You received %s KUT Coins for washing the bibs after the session on %s.",
  "You received %s KUT Coins for bringing the bibs to the session on %s.",
  // Market purchase and sale (ADR-034, 20260904000000; 20260911000000).
  "You bought %s for %s KUT Coins.",
  "Your %s card sold to %s for %s KUT Coins. You received %s KUT Coins after tax.",
  // The pre-buyer sale wording, as 20260904000000's TF → KUT rewrite left it.
  "Your %s card sold for %s KUT Coins. You received %s KUT Coins after tax.",
  // Trade offers (20260911000000).
  "%s offered %s KUT Coins%s for your %s listing.",
  "You traded %s to %s for %s KUT Coins%s.",
  // Admin wallet adjustment (20260905000000): the reason is the admin's own words.
  "An admin adjusted your wallet by %s%s KUT Coins. Reason: %s",
  // Admin club reset (20260905000000, 20260911000000).
  "Your KUT club was reset by an admin. You've been given a fresh starter pack.",
  // Session report open (20260920000000, 20261009000000).
  "Your session report is open for 24 hours. Complete it to receive 50 KUT Coins.",
  // Injury protection (20260930000000).
  "Get well soon! While you are out, check in from Home once every football week you sit out: you receive 100 KUT Coins and your card rating is protected for that week.",
  "This week counts as a football week. Check in from Home to receive 100 KUT Coins and keep your card rating protected.",
  // Midweek payouts, first version (20261006000000).
  "You won Midweek Madness on %s: %s KUT Coins over the night.",
  "You reached the %s on %s: +%s KUT Coins. %s won it.",
  "You went out in round %s on %s: +%s KUT Coins. %s won it.",
  // RPC exceptions.
  "insufficient KUT Coins for this pack",
  "insufficient KUT Coins for this listing",
  "insufficient KUT Coins to escrow this offer",
  "amount exceeds the per-adjustment limit of 100000 KUT Coins",
  "an active KUT account is required",
];

const COMPOSITES: readonly Composite[] = [
  // The Midweek result for every entrant: 20261013000000, then 20261017000000
  // added the calls slot.
  [
    ["%s KUT Coins over the night.", "%s beat you on penalties, %s–%s.", "%s beat you %s–%s."],
    ["+%s KUT Coins."],
    ["%s won it."],
    ["You called %s of %s right: +%s KUT Coins.", "You called %s of %s right."],
    ["Your auto squad played for you."],
  ],
];

/**
 * A compiled pattern: every piece of the message is its own capture group,
 * fixed wording and `%s` values alike, so the groups that took part, read in
 * order, are the whole message. `fixed[i]` says whether group `i + 1` is
 * template wording.
 */
type Pattern = { regex: RegExp; fixed: boolean[] };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function sentence(template: Template, fixed: boolean[]): string {
  return template
    .split("%s")
    .map((part, index) => {
      let source = "";
      if (index > 0) {
        fixed.push(false);
        source += "([\\s\\S]*?)";
      }
      if (part) {
        fixed.push(true);
        source += `(${escape(part)})`;
      }
      return source;
    })
    .join("");
}

function alternatives(slot: readonly Template[], fixed: boolean[]): string {
  return `(?:${slot.map((template) => sentence(template, fixed)).join("|")})`;
}

function compileTemplate(template: Template): Pattern {
  const fixed: boolean[] = [];
  return { regex: new RegExp(`^${sentence(template, fixed)}$`), fixed };
}

/** `S1(?: S2)?(?: S3)?…|S2(?: S3)?…|…`: whichever slot comes first, the rest optional. */
function compileComposite(slots: Composite): Pattern {
  const fixed: boolean[] = [];
  const starts = slots.map((first, start) => {
    let source = alternatives(first, fixed);
    for (const later of slots.slice(start + 1)) {
      fixed.push(true);
      source += `(?:( )${alternatives(later, fixed)})?`;
    }
    return source;
  });
  return { regex: new RegExp(`^(?:${starts.join("|")})$`), fixed };
}

const PATTERNS: readonly Pattern[] = [
  ...TEMPLATES.map(compileTemplate),
  ...COMPOSITES.map(compileComposite),
];

/** Translates one known server text to the current brand; anything else is returned unchanged. */
export function presentServerText(text: string): string {
  for (const { regex, fixed } of PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;
    let out = "";
    for (let group = 1; group < match.length; group += 1) {
      const piece = match[group];
      if (piece === undefined) continue;
      out += fixed[group - 1] ? piece.replace(/\bKUT\b/g, BRAND.shortName) : piece;
    }
    return out;
  }
  return text;
}

/** A message as the inbox shows it: title and body through `presentServerText`. */
export function presentNotification<T extends { title: string; body: string }>(message: T): T {
  return {
    ...message,
    title: presentServerText(message.title),
    body: presentServerText(message.body),
  };
}
