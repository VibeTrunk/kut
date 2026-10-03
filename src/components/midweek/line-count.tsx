import Link from "next/link";
import { MIDWEEK } from "@/game/midweek/config";
import {
  keeperLine,
  LINE_NAMES,
  LINE_RULE,
  lineCountLabel,
  lineVerdict,
  NO_KEEPER_COUNT,
  type LineCount,
} from "@/lib/midweek/plusses";

/** Always the 3 a line needs, filled or dashed; anything above as `+4`. */
function Pips({ count }: { count: number }) {
  const need = MIDWEEK.balance.minPlusses;
  return (
    <span aria-hidden="true" className="flex items-center gap-[5px]">
      {Array.from({ length: need }, (_, index) => (
        <i
          className={`block h-3 w-3 rounded-full ${index < count ? "bg-ink" : "border-[1.5px] border-dashed border-ink-faint"}`}
          key={index}
        />
      ))}
      {count > need && (
        <em className="ml-0.5 text-xs font-black text-ink not-italic">+{count - need}</em>
      )}
    </span>
  );
}

/**
 * `MidweekLineCount` (DR3 HANDOFF §4, ADR-116): the plusses the four cards
 * not in goal give each line against the 3 a line needs, the verdict with the
 * factor, and who goes in goal. Without a Goalkeeper there is no count
 * (DR3-8). Without colour the filled and dashed pips, the ✓ and `!` and the
 * words carry it.
 */
export function MidweekLineCount({ count }: { count: LineCount }) {
  const short = count.kind === "count" && count.total > 0;
  return (
    <section
      aria-labelledby="mw-lines-h"
      className={`grid gap-2.5 rounded-[14px] border bg-panel/55 p-3.5 sm:p-4 ${short ? "border-warning-line" : "border-line/60"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-black" id="mw-lines-h">
          Plusses per line
        </h3>
        <Link
          className="text-[13px] font-bold text-brass hover:underline"
          href="/how-it-works#midweek-shape"
        >
          How plusses work &rarr;
        </Link>
      </div>
      {count.kind === "nokeeper" ? (
        <p className="text-sm text-ink-dim">{NO_KEEPER_COUNT}</p>
      ) : (
        <>
          <div aria-label={lineCountLabel(count)} className="grid gap-1.5" role="group">
            {LINE_NAMES.map((name, line) => (
              <div
                aria-hidden="true"
                className="grid grid-cols-[5.5rem_auto_minmax(0,1fr)_auto] items-center gap-x-2.5 text-sm"
                key={name}
              >
                <span className="font-extrabold">{name}</span>
                <Pips count={count.lines[line]} />
                <span className="text-[12.5px] text-ink-faint tabular-nums max-[411px]:invisible">
                  {count.lines[line]} of {MIDWEEK.balance.minPlusses}
                </span>
                {count.short[line] > 0 ? (
                  <span className="flex items-center gap-1.5 text-[13px] font-extrabold whitespace-nowrap text-warning">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-warning text-[11px] font-black text-ink-on-accent">
                      !
                    </span>
                    {count.short[line]} short
                  </span>
                ) : (
                  <span className="text-[13px] font-extrabold whitespace-nowrap text-moss">
                    ✓ enough
                  </span>
                )}
              </div>
            ))}
          </div>
          <p aria-live="polite" className="text-sm leading-snug">
            <b className="font-extrabold">{lineVerdict(count).lead}</b> {lineVerdict(count).rest}
          </p>
          <p className="text-[12.5px] leading-normal text-ink-faint">{keeperLine(count)}</p>
        </>
      )}
      <p className="text-[12.5px] leading-normal text-ink-faint">{LINE_RULE}</p>
    </section>
  );
}
