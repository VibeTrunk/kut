/**
 * Home's "now" stack (design/ux-review/HANDOFF.md "Home", ADR-114): the cards
 * with a deadline, the Midweek evening first while it runs, then the rest by
 * deadline, soonest first. A card without a deadline goes last; ties keep the
 * order given.
 */
export type NowCard<T> = {
  key: string;
  /** The Midweek evening while it runs. */
  leads?: boolean;
  /** When the card stops applying, in epoch ms; null when it has no deadline. */
  deadline: number | null;
  value: T;
};

export function orderNowCards<T>(cards: readonly NowCard<T>[]): NowCard<T>[] {
  const rank = (card: NowCard<T>) => (card.leads ? -Infinity : (card.deadline ?? Infinity));
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rank(a.card) - rank(b.card) || a.index - b.index)
    .map(({ card }) => card);
}

/**
 * When a rehab check-in for `weekStart` closes: the end of the following
 * football week in club time, since the window is this week or the previous
 * one (ADR-082). Midnight UTC is close enough to order Home's cards by.
 */
export function checkInClosesAt(weekStart: string): number {
  return Date.parse(`${weekStart}T00:00:00Z`) + 14 * 86_400_000;
}
