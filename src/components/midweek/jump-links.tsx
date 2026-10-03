import { formatClock } from "@/lib/midweek/entry";
import { roundShort, type BracketRound } from "@/lib/midweek/evening";

const LINK =
  "inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] font-extrabold hover:bg-panel/60";

/**
 * `MidweekJumpLinks` (HANDOFF "Bracket"): the member's match first, in brass
 * (`Your match · Live` while it plays, else `Your match · R2 20:15`), then
 * the blocks above the rounds once the week is complete (`Your ratings`, DR3),
 * then every round. Below `lg` only: from
 * `lg` the tree shows every round side by side, so there is nowhere to jump.
 */
export function MidweekJumpLinks({
  rounds,
  yours,
  blocks = [],
}: {
  rounds: readonly BracketRound[];
  yours: BracketRound | null;
  /** Blocks of the member's own above the rounds, each an in-page anchor. */
  blocks?: readonly { href: string; label: string }[];
}) {
  const total = rounds.length;
  return (
    <nav aria-label="Jump to" className="flex flex-wrap gap-1.5 lg:hidden">
      {yours && (
        <a className={`${LINK} border-brass text-brass`} href={`#round-${yours.round}`}>
          Your match &middot;{" "}
          {yours.pairs.some((pair) => pair.kind === "inplay")
            ? "Live"
            : `R${yours.round} ${formatClock(yours.kickoffAt)}`}
        </a>
      )}
      {blocks.map((block) => (
        <a className={`${LINK} border-brass text-brass`} href={block.href} key={block.href}>
          {block.label}
        </a>
      ))}
      {rounds.map((round) => (
        <a
          className={`${LINK} border-line text-ink-dim`}
          href={`#round-${round.round}`}
          key={round.round}
        >
          {roundShort(round.round, total)}
        </a>
      ))}
    </nav>
  );
}
