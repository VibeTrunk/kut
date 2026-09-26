import Link from "next/link";
import { formatClock } from "@/lib/midweek/entry";
import { roundShort, type PathRow } from "@/lib/midweek/evening";
import { Chip } from "./chip";
import { MidweekCountdown } from "./countdown";

const ROW =
  "grid min-h-[60px] grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border px-3 py-2.5";

/**
 * `MidweekPath`, "Your night": a row per round you played (a bye, a win with
 * its report and coins, the round you went out in), then a dashed "Next" row
 * with the time and what a win would pay.
 */
export function MidweekPath({
  rows,
  rounds,
  weekStart,
  now,
}: {
  rows: readonly PathRow[];
  rounds: number;
  weekStart: string;
  now: string;
}) {
  return (
    <ol aria-label="Your night" className="grid gap-2">
      {rows.map((row) => {
        const tone =
          row.kind === "next"
            ? "border-dashed border-brass-line bg-brass-bg/25"
            : row.kind === "out"
              ? "border-brick-line bg-brick-bg/35"
              : "border-line/70 bg-panel/70";
        const report =
          row.kind === "won" || row.kind === "out" ? (
            <Link
              className="font-extrabold text-brass hover:underline"
              href={`/club/midweek/${weekStart}/match/${row.matchId}`}
            >
              Report
            </Link>
          ) : null;
        return (
          <li className={`${ROW} ${tone}`} key={`${row.kind}-${row.round}`}>
            <p className="text-[10.5px] leading-[1.3] font-extrabold tracking-[0.1em] text-ink-faint uppercase">
              {roundShort(row.round, rounds)}
              <b className="block text-sm tracking-normal text-ink-dim normal-case tabular-nums">
                {formatClock(row.revealAt)}
              </b>
            </p>
            <p className="text-sm leading-[1.4] text-ink-dim">
              {row.kind === "bye" && (
                <>
                  <b className="text-ink">Bye.</b> Counts as a win.
                </>
              )}
              {row.kind === "won" && (
                <>
                  <b className="text-ink">
                    Beat {row.opponent} {row.score}.
                  </b>{" "}
                  {report}
                </>
              )}
              {row.kind === "out" && (
                <>
                  <b className="text-ink">
                    Out: lost to {row.opponent} {row.score}.
                  </b>{" "}
                  {report}
                </>
              )}
              {row.kind === "next" && (
                <>
                  <b className="text-ink">Next{row.opponent ? `: ${row.opponent}` : ""}.</b> Result
                  at {formatClock(row.revealAt)},{" "}
                  <MidweekCountdown now={now} target={row.revealAt} />.
                </>
              )}
            </p>
            <p className="text-right text-sm font-black text-brass tabular-nums">
              {row.kind === "out" ? (
                <Chip tone="out">Out</Chip>
              ) : row.kind === "next" ? (
                <>
                  <small className="block text-[10px] font-extrabold text-ink-faint">win</small>+
                  {row.coins}
                </>
              ) : (
                `+${row.coins}`
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
