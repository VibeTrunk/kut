import { formatClock } from "@/lib/midweek/entry";
import {
  matchName,
  treeGroupRows,
  type BracketPair,
  type BracketRound,
} from "@/lib/midweek/evening";
import { MidweekMatchRow, type RowCall } from "./match-row";

/** Pairs 2k and 2k + 1, whose winners meet next (§44.6). */
function groups(pairs: readonly BracketPair[]): BracketPair[][] {
  const out: BracketPair[][] = [];
  for (let index = 0; index < pairs.length; index += 2) out.push(pairs.slice(index, index + 2));
  return out;
}

const hasYou = (pair: BracketPair, you: string | null) =>
  you !== null && pair.sides.some((side) => !side.placeholder && side.userId === you);

const TREE_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * The tree's rows (KB-031): a header, then one equal row per round-1 pairing.
 * An auto-height grid sizes every `1fr` row to the tallest, so a bye's row is
 * as tall as a match's. Literal class names, because the CSP forbids inline
 * styles and Tailwind only generates classes it finds in the source.
 */
const TREE_ROWS: Record<number, string> = {
  1: "lg:grid-rows-[auto_repeat(1,1fr)]",
  2: "lg:grid-rows-[auto_repeat(2,1fr)]",
  4: "lg:grid-rows-[auto_repeat(4,1fr)]",
  8: "lg:grid-rows-[auto_repeat(8,1fr)]",
  16: "lg:grid-rows-[auto_repeat(16,1fr)]",
  32: "lg:grid-rows-[auto_repeat(32,1fr)]",
};

const ROW_START: Record<number, string> = {
  2: "row-start-2",
  4: "row-start-4",
  6: "row-start-6",
  8: "row-start-8",
  10: "row-start-10",
  12: "row-start-12",
  14: "row-start-14",
  16: "row-start-16",
  18: "row-start-18",
  20: "row-start-20",
  22: "row-start-22",
  24: "row-start-24",
  26: "row-start-26",
  28: "row-start-28",
  30: "row-start-30",
  32: "row-start-32",
};

const ROW_SPAN: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  4: "row-span-4",
  8: "row-span-8",
  16: "row-span-16",
  32: "row-span-32",
};

function RoundTime({ round }: { round: BracketRound }) {
  return <>Kick-off {formatClock(round.kickoffAt)}</>;
}

/**
 * `MidweekBracket`. Below `lg`, the rounds as sections in order, each pair of
 * pairings joined by a bracket line naming the match its winners meet in.
 * From `lg`, the same data as a tree, one column per round (DR2-4). Every
 * round shows its kick-off, and every pairing its state: kick-off, full time,
 * or a bye (ADR-113). Your path is brass in both; names are neutral.
 *
 * HANDOFF drew the tree `aria-hidden` beside a list that is `display: none`
 * from `lg`, which leaves a screen reader nothing at that width. So the tree
 * keeps round headings and the same labelled match rows (ADR-098). `calls`
 * puts a member's calls on their rows, keyed `round/pairing` (ADR-118).
 */
export function MidweekBracket({
  rounds,
  you,
  weekStart,
  calls,
}: {
  rounds: readonly BracketRound[];
  you: string | null;
  weekStart: string;
  calls?: ReadonlyMap<string, RowCall>;
}) {
  const total = rounds.length;
  const callOf = (pair: BracketPair) => calls?.get(`${pair.round}/${pair.pairing}`) ?? null;
  return (
    <>
      <div className="grid gap-7 lg:hidden">
        {rounds.map((round) => (
          <section
            aria-labelledby={`round-${round.round}-h`}
            className="grid scroll-mt-36 gap-3 sm:scroll-mt-40"
            id={`round-${round.round}`}
            key={round.round}
          >
            <div className="flex items-baseline justify-between gap-3">
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
                        call={callOf(pair)}
                        key={pair.pairing}
                        pair={pair}
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

      <div
        className={`hidden gap-x-7 lg:grid ${TREE_COLS[total] ?? "lg:grid-cols-6"} ${TREE_ROWS[2 ** (total - 1)] ?? ""}`}
        data-testid="bracket-tree"
      >
        {rounds.map((round, column) => (
          <section
            aria-labelledby={`tree-round-${round.round}-h`}
            className="row-span-full grid min-w-0 grid-rows-subgrid"
            key={round.round}
          >
            <div className="row-start-1 mb-3 grid gap-0.5 border-b border-line/50 pb-2">
              <h2 className="display text-2xl leading-none" id={`tree-round-${round.round}-h`}>
                {round.name}
              </h2>
              <p className="text-xs font-extrabold text-ink-faint tabular-nums">
                <RoundTime round={round} />
              </p>
            </div>
            {groups(round.pairs).map((group, index) => {
              const mine = group.some((pair) => hasYou(pair, you));
              const last = column === total - 1;
              const { rowStart, rowSpan } = treeGroupRows(round.round, index, group.length);
              return (
                <div
                  className={`relative flex flex-col ${ROW_START[rowStart] ?? ""} ${ROW_SPAN[rowSpan] ?? ""} ${
                    last
                      ? ""
                      : `after:absolute after:top-1/4 after:-right-[15px] after:bottom-1/4 after:w-3.5 after:rounded-r-md after:border-2 after:border-l-0 after:content-[''] ${mine ? "after:border-brass" : "after:border-line"}`
                  }`}
                  data-tree-group={`${round.round}/${index}`}
                  key={index}
                >
                  {group.map((pair) => (
                    <div
                      className={`relative flex flex-1 items-center py-[5px] ${
                        column > 0
                          ? `before:absolute before:top-1/2 before:-left-3.5 before:w-[13px] before:border-t-2 before:content-[''] ${hasYou(pair, you) ? "before:border-brass" : "before:border-line"}`
                          : ""
                      }`}
                      data-tree-pair={`${round.round}/${pair.pairing}`}
                      key={pair.pairing}
                    >
                      <div className="w-full">
                        <MidweekMatchRow
                          call={callOf(pair)}
                          dense
                          pair={pair}
                          weekStart={weekStart}
                          you={you}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
