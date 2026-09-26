import { formatClock } from "@/lib/midweek/entry";
import { matchName, type BracketPair, type BracketRound } from "@/lib/midweek/evening";
import { Chip } from "./chip";
import { MidweekMatchRow } from "./match-row";

/** Pairs 2k and 2k + 1, whose winners meet next (§44.6). */
function groups(pairs: readonly BracketPair[]): BracketPair[][] {
  const out: BracketPair[][] = [];
  for (let index = 0; index < pairs.length; index += 2) out.push(pairs.slice(index, index + 2));
  return out;
}

const hasYou = (pair: BracketPair, you: string | null) =>
  you !== null && pair.sides.some((side) => side.userId === you);

const TREE_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

function RoundTime({ round }: { round: BracketRound }) {
  const time = formatClock(round.revealAt);
  return round.revealed ? <>Out at {time}</> : <b className="text-brass">Reveals {time}</b>;
}

/**
 * `MidweekBracket`. Below `lg`, the rounds as sections in order, each pair of
 * pairings joined by a bracket line naming the match its winners meet in.
 * From `lg`, the same data as a tree, one column per round. Your path is brass
 * in both.
 *
 * HANDOFF drew the tree `aria-hidden` beside a list that is `display: none`
 * from `lg`, which leaves a screen reader nothing at that width. So the tree
 * keeps round headings and the same labelled match rows (ADR-098).
 */
export function MidweekBracket({
  rounds,
  you,
  weekStart,
}: {
  rounds: readonly BracketRound[];
  you: string | null;
  weekStart: string;
}) {
  const total = rounds.length;
  return (
    <>
      <div className="grid gap-7 lg:hidden">
        {rounds.map((round) => (
          <section
            aria-labelledby={`round-${round.round}-h`}
            className="grid scroll-mt-16 gap-3 sm:scroll-mt-20"
            id={`round-${round.round}`}
            key={round.round}
          >
            <div className="sticky top-14 z-[2] flex items-baseline justify-between gap-3 bg-[linear-gradient(var(--color-board)_80%,transparent)] py-2 sm:top-16">
              <h2 className="display text-[26px]" id={`round-${round.round}-h`}>
                {round.name}
              </h2>
              <p className="text-xs font-extrabold text-ink-faint tabular-nums">
                <RoundTime round={round} />
              </p>
            </div>
            <ol className="grid gap-3.5">
              {groups(round.pairs).map((group, index) => {
                const mine = group.some((pair) => hasYou(pair, you));
                const single = group.length === 1;
                return (
                  <li
                    className={`relative grid gap-1.5 ${
                      single
                        ? ""
                        : `pr-[22px] after:absolute after:top-[18px] after:right-1.5 after:bottom-[18px] after:w-2.5 after:rounded-r-lg after:border-2 after:border-l-0 after:content-[''] ${mine ? "after:border-brass" : "after:border-line"}`
                    }`}
                    key={index}
                  >
                    {group.map((pair) => (
                      <MidweekMatchRow
                        key={pair.pairing}
                        pair={pair}
                        revealAt={round.revealAt}
                        weekStart={weekStart}
                        you={you}
                      />
                    ))}
                    {!single && round.round < total && (
                      <p className="pr-0.5 text-right text-[11px] font-extrabold text-ink-faint">
                        Winners meet in{" "}
                        <b className={mine ? "text-brass" : "text-ink-dim"}>
                          {matchName(round.round + 1, index, total)}
                        </b>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className={`hidden gap-x-7 lg:grid ${TREE_COLS[total] ?? "lg:grid-cols-6"}`}>
        {rounds.map((round, column) => (
          <section
            aria-labelledby={`tree-round-${round.round}-h`}
            className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
            key={round.round}
          >
            <div className="grid gap-0.5 border-b border-line/50 pb-2">
              <h2 className="display text-2xl leading-none" id={`tree-round-${round.round}-h`}>
                {round.name}
              </h2>
              <p className="text-xs font-extrabold text-ink-faint tabular-nums">
                <RoundTime round={round} />
              </p>
            </div>
            <div className="flex flex-col">
              {groups(round.pairs).map((group, index) => {
                const mine = group.some((pair) => hasYou(pair, you));
                const last = column === total - 1;
                return (
                  <div
                    className={`relative flex flex-1 flex-col ${
                      last
                        ? ""
                        : `after:absolute after:top-1/4 after:-right-[15px] after:bottom-1/4 after:w-3.5 after:rounded-r-md after:border-2 after:border-l-0 after:content-[''] ${mine ? "after:border-brass" : "after:border-line"}`
                    }`}
                    key={index}
                  >
                    {group.map((pair) => (
                      <div
                        className={`relative flex flex-1 items-center py-[5px] ${
                          column > 0
                            ? `before:absolute before:top-1/2 before:-left-3.5 before:w-[13px] before:border-t-2 before:content-[''] ${hasYou(pair, you) ? "before:border-brass" : "before:border-line"}`
                            : ""
                        }`}
                        key={pair.pairing}
                      >
                        <div className="w-full">
                          <MidweekMatchRow
                            dense
                            pair={pair}
                            revealAt={round.revealAt}
                            weekStart={weekStart}
                            you={you}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** The bracket's legend: every mark in words. */
export function MidweekBracketLegend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-dim">
      <span className="inline-flex items-center gap-1.5">
        <b aria-hidden="true" className="text-moss">
          ✓
        </b>
        went through
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Chip tone="you">You</Chip> your path
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Chip tone="auto">Auto</Chip> auto squad
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Chip>Bye</Chip> counts as a win
      </span>
      <span>(4) penalties</span>
    </p>
  );
}
