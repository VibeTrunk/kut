import type { Side } from "@/game/midweek/match";
import type { Segment } from "@/lib/midweek/report/types";

/** A side's team colour as text (HANDOFF "Team colours"): side 0 blue, side 1 red. */
export const TEAM_TEXT = ["text-team-blue", "text-team-red"] as const;

/**
 * `PlayerName` (HANDOFF "Matches", DR1-5, DR2-2): a Player or manager in their
 * side's colour, on a match page only (DR2-1). A Player both sides fielded
 * shows its base name; screen readers still hear whose copy it is.
 */
export function PlayerName({
  side,
  owner,
  children,
}: {
  side: Side;
  owner?: string;
  children: string;
}) {
  return (
    <span className={`font-extrabold ${TEAM_TEXT[side]}`}>
      {children}
      {owner !== undefined && <span className="sr-only"> ({owner}&rsquo;s)</span>}
    </span>
  );
}

/** A score such as "3–0" never breaks at its dash: word joiners hold it together. */
export const keepScores = (text: string) => text.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2");

/** A line of report text from the renderer's segments, every name in its side's colour. */
export function ReportText({ parts }: { parts: readonly Segment[] }) {
  return parts.map((part, index) =>
    part.side === undefined ? (
      keepScores(part.text)
    ) : (
      <PlayerName key={index} owner={part.owner} side={part.side}>
        {part.text}
      </PlayerName>
    ),
  );
}
