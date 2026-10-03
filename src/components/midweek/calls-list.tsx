import Link from "next/link";
import type { CallRecord } from "@/lib/midweek/calls";
import { MidweekSectionHead } from "./page-head";

/**
 * `MidweekCalls` (DR3 HANDOFF §2, `Bracket-Complete`): the complete bracket
 * keeps the member's calls for good, read-only, each with `✓ +2` or `Not this
 * time`. A wrong call is never marked as a failure: the chip is neutral.
 */
export function MidweekCalls({
  records,
  line,
  coins,
}: {
  records: readonly CallRecord[];
  /** The weekly line, `You called 2 of 3 right: +4 KUT Coins.` */
  line: string;
  coins: number;
}) {
  return (
    <section aria-labelledby="calls-h" className="grid scroll-mt-24 gap-3" id="calls">
      <MidweekSectionHead id="calls-h" title="Your calls">
        <p className="text-[13px] text-ink-faint">{line}</p>
      </MidweekSectionHead>
      <ul className="grid gap-1.5">
        {records.map((record) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 rounded-xl border border-line/60 bg-panel/50 px-3 py-2.5 text-sm"
            key={record.label}
          >
            <span className="col-span-2 text-[10.5px] font-extrabold tracking-[0.14em] text-ink-faint uppercase">
              {record.label}
            </span>
            <span className="min-w-0">
              You picked <b>{record.picked}</b>.{record.winner && ` ${record.winner} won.`}
            </span>
            {record.correct === true ? (
              <span className="inline-flex rounded-full border border-moss-line bg-moss-bg px-2 text-[11px] font-black tracking-[0.06em] whitespace-nowrap text-moss">
                ✓ +{coins}
              </span>
            ) : record.correct === false ? (
              <span className="inline-flex rounded-full border border-line px-2 text-[11px] font-black tracking-[0.06em] whitespace-nowrap text-ink-dim uppercase">
                Not this time
              </span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The weekly line on the champion view, under `Your night`, with the way to the calls. */
export function MidweekWeeklyCalls({ line, href }: { line: string; href: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 rounded-[14px] border border-line/60 bg-panel/55 px-3.5 py-3 text-[14.5px]">
      <b className="font-extrabold">{line}</b>
      <Link className="text-sm font-bold text-brass hover:underline" href={href}>
        Your calls &rarr;
      </Link>
    </p>
  );
}
